/**
 * BulkRegisterCustomerFleetModal — paste/upload CSV to bulk-register a
 * customer's BYO forklifts.
 *
 * Required columns:  serial_number, make, model
 * Optional columns:  type (Diesel|LPG|Battery/Electrical|Reach Truck|Others),
 *                    hourmeter (integer, defaults 0),
 *                    customer_forklift_no (the customer's own asset code)
 *
 * Per-row validation surfaces issues before insertion:
 *   - missing required field      → ✗ error (excluded from bulk insert)
 *   - duplicate serial_number      → ⚠ warning (skipped — won't overwrite)
 *   - unknown type                 → ✗ error
 *   - non-numeric hourmeter        → ✗ error
 *
 * On confirm: creates only the ✓ rows. Uses createForklift in parallel with
 * a small concurrency cap so we don't hammer the connection pool.
 */
import { AlertOctagon, AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { createForklift, getForklifts } from '../../../services/forkliftService';
import { showToast } from '../../../services/toastService';
import { ForkliftStatus, ForkliftType } from '../../../types';

interface Props {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
  serial: string;
  make: string;
  model: string;
  type: ForkliftType;
  hourmeter: number;
  customerForkliftNo: string;
  status: 'ok' | 'duplicate' | 'error';
  errors: string[];
}

const REQUIRED_COLS = ['serial_number', 'make', 'model'] as const;
const TYPE_VALUES = Object.values(ForkliftType) as string[];

const SAMPLE_CSV = `serial_number,make,model,type,hourmeter,customer_forklift_no
CUST-1234,Toyota,8FD25,Diesel,1250,FLT-001
CUST-1235,Komatsu,FB15,Battery/Electrical,2300,FLT-002
CUST-1236,Linde,H30,LPG,890,`;

/**
 * Minimal CSV parser — supports quoted fields with embedded commas/newlines
 * and double-quote escapes ("" → "). Returns an array of records keyed by
 * the (lowercased) header row. Empty trailing lines are ignored.
 *
 * Not a full RFC 4180 parser — but sufficient for hand-typed/pasted lists.
 */
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { cur.push(field); field = ''; i++; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(field); field = '';
      if (cur.some(c => c.length > 0)) lines.push(cur);
      cur = []; i++; continue;
    }
    field += ch; i++;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    if (cur.some(c => c.length > 0)) lines.push(cur);
  }

  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map(h => h.trim().toLowerCase());
  const rows = lines.slice(1).map(cells => {
    const r: Record<string, string> = {};
    headers.forEach((h, idx) => { r[h] = (cells[idx] ?? '').trim(); });
    return r;
  });
  return { headers, rows };
}

const BulkRegisterCustomerFleetModal: React.FC<Props> = ({
  customerId,
  customerName,
  onClose,
  onSuccess,
}) => {
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const counts = useMemo(() => {
    if (!parsedRows) return null;
    return {
      ok: parsedRows.filter(r => r.status === 'ok').length,
      dup: parsedRows.filter(r => r.status === 'duplicate').length,
      err: parsedRows.filter(r => r.status === 'error').length,
    };
  }, [parsedRows]);

  const handleParse = async () => {
    setHeaderError(null);
    if (!csvText.trim()) {
      setHeaderError('Paste or upload CSV content first');
      return;
    }

    const { headers, rows } = parseCsv(csvText);
    const missingReq = REQUIRED_COLS.filter(c => !headers.includes(c));
    if (missingReq.length > 0) {
      setHeaderError(`Missing required columns: ${missingReq.join(', ')}. Required: ${REQUIRED_COLS.join(', ')}.`);
      setParsedRows(null);
      return;
    }

    // Pull existing serials so we can flag duplicates without writing them.
    let existingSerials = new Set<string>();
    try {
      const all = await getForklifts();
      existingSerials = new Set(all.map(f => f.serial_number.toLowerCase()));
    } catch {
      // If the catalog read fails we still let the user proceed — the DB
      // will reject duplicates via UNIQUE on serial_number anyway. Just
      // can't pre-warn.
      showToast.warning('Could not load existing forklift list — duplicate detection skipped');
    }

    const seenInBatch = new Set<string>();
    const parsed: ParsedRow[] = rows.map((raw, idx) => {
      const errors: string[] = [];
      const serial = (raw.serial_number || '').trim();
      const make = (raw.make || '').trim();
      const model = (raw.model || '').trim();
      const typeRaw = (raw.type || ForkliftType.DIESEL).trim();
      const hourmeterRaw = (raw.hourmeter || '0').trim();
      const customerForkliftNo = (raw.customer_forklift_no || '').trim();

      if (!serial) errors.push('serial_number required');
      if (!make) errors.push('make required');
      if (!model) errors.push('model required');
      if (typeRaw && !TYPE_VALUES.includes(typeRaw)) errors.push(`type must be one of: ${TYPE_VALUES.join(', ')}`);
      const hourmeter = Number(hourmeterRaw);
      if (Number.isNaN(hourmeter) || hourmeter < 0) errors.push('hourmeter must be a non-negative number');

      let status: ParsedRow['status'] = 'ok';
      if (errors.length > 0) status = 'error';
      else if (existingSerials.has(serial.toLowerCase()) || seenInBatch.has(serial.toLowerCase())) {
        status = 'duplicate';
      }
      seenInBatch.add(serial.toLowerCase());

      return {
        rowIndex: idx + 2, // +2 = +1 for header row, +1 because humans 1-index
        raw,
        serial,
        make,
        model,
        type: (TYPE_VALUES.includes(typeRaw) ? typeRaw : ForkliftType.DIESEL) as ForkliftType,
        hourmeter,
        customerForkliftNo,
        status,
        errors,
      };
    });
    setParsedRows(parsed);
  };

  const handleConfirm = async () => {
    if (!parsedRows || !counts || counts.ok === 0) return;
    setSubmitting(true);
    setProgress({ done: 0, total: counts.ok });

    const toCreate = parsedRows.filter(r => r.status === 'ok');
    let succeeded = 0;
    let failed = 0;

    // Cap concurrency at 4 — keeps the connection pool happy.
    const CONCURRENCY = 4;
    const queue = toCreate.slice();
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) break;
        try {
          await createForklift({
            serial_number: row.serial,
            customer_forklift_no: row.customerForkliftNo || undefined,
            make: row.make,
            model: row.model,
            type: row.type,
            hourmeter: row.hourmeter,
            ownership: 'customer' as never,
            ownership_type: 'external',
            acquisition_source: 'new_byo',
            service_management_status: 'active',
            current_customer_id: customerId,
            customer_id: customerId,
            status: ForkliftStatus.ACTIVE,
          } as Parameters<typeof createForklift>[0]);
          succeeded++;
        } catch (e) {
          failed++;
          // eslint-disable-next-line no-console
          console.error('[BulkRegister] failed for', row.serial, e);
        }
        setProgress({ done: succeeded + failed, total: counts.ok });
      }
    });
    await Promise.all(workers);

    setSubmitting(false);
    setProgress(null);

    if (failed === 0) {
      showToast.success(`Registered ${succeeded} forklift${succeeded === 1 ? '' : 's'} for ${customerName}`);
      onSuccess();
    } else if (succeeded === 0) {
      showToast.error(`Failed to register any forklifts (${failed} errored)`);
    } else {
      showToast.warning(`Registered ${succeeded} of ${counts.ok} forklifts; ${failed} failed (see console)`);
      onSuccess();
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setCsvText(text);
      setParsedRows(null);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-fleet-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Bulk-register customer-owned forklifts
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="text-sm text-slate-600">
            For: <span className="font-medium text-slate-800">{customerName}</span>
          </div>

          {/* Step 1: input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Paste CSV or upload a file</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadTemplate}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                >
                  Download template
                </button>
                <label className="text-xs text-slate-600 hover:text-slate-800 font-medium cursor-pointer inline-flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  Upload .csv
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                </label>
              </div>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setParsedRows(null); }}
              rows={6}
              spellCheck={false}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
              placeholder={SAMPLE_CSV}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Required columns: <code>serial_number</code>, <code>make</code>, <code>model</code>.
                Optional: <code>type</code>, <code>hourmeter</code>, <code>customer_forklift_no</code>.
              </p>
              <button
                onClick={handleParse}
                disabled={!csvText.trim() || submitting}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                Parse & preview
              </button>
            </div>
            {headerError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                {headerError}
              </div>
            )}
          </div>

          {/* Step 2: preview */}
          {parsedRows && counts && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {counts.ok} ready
                </span>
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" /> {counts.dup} duplicate{counts.dup === 1 ? '' : 's'}
                </span>
                <span className="inline-flex items-center gap-1 text-red-700">
                  <AlertOctagon className="w-3.5 h-3.5" /> {counts.err} error{counts.err === 1 ? '' : 's'}
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Row</th>
                      <th className="px-2 py-1.5 text-left">Status</th>
                      <th className="px-2 py-1.5 text-left">Serial</th>
                      <th className="px-2 py-1.5 text-left">Asset no.</th>
                      <th className="px-2 py-1.5 text-left">Make</th>
                      <th className="px-2 py-1.5 text-left">Model</th>
                      <th className="px-2 py-1.5 text-left">Type</th>
                      <th className="px-2 py-1.5 text-right">Hourmeter</th>
                      <th className="px-2 py-1.5 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map(r => (
                      <tr key={r.rowIndex} className={
                        r.status === 'error' ? 'bg-red-50/40' :
                        r.status === 'duplicate' ? 'bg-amber-50/40' :
                        ''
                      }>
                        <td className="px-2 py-1.5 text-slate-400">{r.rowIndex}</td>
                        <td className="px-2 py-1.5">
                          {r.status === 'ok' && <span className="text-emerald-600">✓</span>}
                          {r.status === 'duplicate' && <span className="text-amber-600">⚠</span>}
                          {r.status === 'error' && <span className="text-red-600">✗</span>}
                        </td>
                        <td className="px-2 py-1.5 text-slate-700">{r.serial || <em className="text-slate-300">missing</em>}</td>
                        <td className="px-2 py-1.5 text-slate-600">{r.customerForkliftNo || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-700">{r.make || <em className="text-slate-300">missing</em>}</td>
                        <td className="px-2 py-1.5 text-slate-700">{r.model || <em className="text-slate-300">missing</em>}</td>
                        <td className="px-2 py-1.5 text-slate-600">{r.type}</td>
                        <td className="px-2 py-1.5 text-right text-slate-600">{r.hourmeter}</td>
                        <td className="px-2 py-1.5 text-slate-500 text-xs">
                          {r.status === 'error' && r.errors.join('; ')}
                          {r.status === 'duplicate' && 'serial already exists — skipped'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {progress && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-3 text-sm text-emerald-800">
              <Loader2 className="w-4 h-4 animate-spin" />
              Registering {progress.done} of {progress.total}…
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!counts || counts.ok === 0 || submitting}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {counts && counts.ok > 0 ? `Register ${counts.ok} forklift${counts.ok === 1 ? '' : 's'}` : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkRegisterCustomerFleetModal;

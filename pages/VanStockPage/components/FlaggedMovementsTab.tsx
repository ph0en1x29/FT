/**
 * FlaggedMovementsTab - Admin view of van movements with balance_override flag
 * Shows movements where notes contains 'balance_override: true'
 */
import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';

interface FlaggedMovementRow {
  movement_id: string;
  performed_at: string;
  van_code?: string;
  van_plate?: string;
  technician_name?: string;
  part_name?: string;
  part_code?: string;
  container_size: number;
  bulk_qty_change?: number;
  container_qty_change?: number;
  van_bulk_qty_after?: number;
  van_container_qty_after?: number;
  job_id?: string;
  notes?: string;
}

const FlaggedMovementsTab: React.FC = () => {
  const [movements, setMovements] = useState<FlaggedMovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          movement_id,
          performed_at,
          bulk_qty_change,
          container_qty_change,
          van_bulk_qty_after,
          van_container_qty_after,
          job_id,
          notes,
          van_stocks(van_code, van_plate, technician_name),
          parts(part_name, part_code, container_size)
        `)
        .like('notes', '%balance_override: true%')
        .order('performed_at', { ascending: false });

      if (!error && data) {
        const mapped: FlaggedMovementRow[] = (data as any[]).map((m) => ({
          movement_id: m.movement_id,
          performed_at: m.performed_at,
          van_code: m.van_stocks?.van_code,
          van_plate: m.van_stocks?.van_plate,
          technician_name: m.van_stocks?.technician_name,
          part_name: m.parts?.part_name,
          part_code: m.parts?.part_code,
          container_size: m.parts?.container_size ?? 1,
          bulk_qty_change: m.bulk_qty_change,
          container_qty_change: m.container_qty_change,
          van_bulk_qty_after: m.van_bulk_qty_after,
          van_container_qty_after: m.van_container_qty_after,
          job_id: m.job_id,
          notes: m.notes,
        }));
        setMovements(mapped);
      }
      setLoading(false);
    };
    load();
  }, []);

  const formatQty = (m: FlaggedMovementRow) => {
    const bQty = Math.abs(m.bulk_qty_change ?? 0);
    const cQty = Math.abs(m.container_qty_change ?? 0);
    if (cQty > 0 && bQty > 0) return `${cQty} ctn + ${bQty} L`;
    if (cQty > 0) return `${cQty} ctn`;
    return `${bQty} L`;
  };

  const formatBalanceAfter = (m: FlaggedMovementRow) => {
    const cAfter = m.van_container_qty_after ?? 0;
    const bAfter = Number(m.van_bulk_qty_after ?? 0);
    const totalL = cAfter * m.container_size + bAfter;
    return `${totalL.toFixed(2)} L`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        <h2 className="text-base font-semibold text-theme">
          ⚠️ Flagged Movements — Insufficient Balance
        </h2>
        {!loading && (
          <span className="ml-auto text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            {movements.length} flagged
          </span>
        )}
      </div>

      <p className="text-xs text-theme-muted">
        These movements were recorded when the van had insufficient stock. The system allowed the job to proceed with a balance override.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-sm text-theme-muted">Loading flagged movements…</div>
        </div>
      ) : movements.length === 0 ? (
        <div className="text-center py-16 text-theme-muted text-sm">
          No flagged movements found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-amber-200">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Van</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Tech</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Part</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Qty Used</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Balance After</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase tracking-wide">Job Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {movements.map(m => (
                <tr key={m.movement_id} className="bg-amber-50/60 hover:bg-amber-50 transition-colors">
                  <td className="px-4 py-3 text-theme-muted whitespace-nowrap">
                    {new Date(m.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="block text-xs text-theme-muted/60">
                      {new Date(m.performed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-theme">
                    <span className="font-medium">{m.van_code ?? '—'}</span>
                    {m.van_plate && <span className="block text-xs text-theme-muted">{m.van_plate}</span>}
                  </td>
                  <td className="px-4 py-3 text-theme">{m.technician_name ?? '—'}</td>
                  <td className="px-4 py-3 text-theme">
                    <span className="font-medium">{m.part_name ?? '—'}</span>
                    {m.part_code && <span className="block text-xs text-theme-muted">{m.part_code}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600 font-semibold">
                    {formatQty(m)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-amber-600 font-semibold">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {formatBalanceAfter(m)}
                  </td>
                  <td className="px-4 py-3 text-theme-muted text-xs">
                    {m.job_id ? `Job #${m.job_id.slice(0, 8)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FlaggedMovementsTab;

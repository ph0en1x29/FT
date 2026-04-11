/**
 * Admin 2 transfer modal — move parts between the central warehouse and a van.
 *
 * Two modes:
 *   'in'  — store → van. Shows a part picker (only parts with stock > 0) and
 *           a quantity input. Used both from the footer "Transfer from Store"
 *           button (no pre-selection — Admin 2 picks which part) and from a
 *           per-row "+ from Store" button (pre-selects that item's part).
 *   'out' — van → store. Locked to a specific van_stock_items row. Shows the
 *           current van quantity and caps the input at that value.
 *
 * Both modes require a non-empty reason. The RPC enforces the same rule on
 * the server side; this client-side check is purely to catch the mistake
 * before the round-trip.
 */
import { ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Combobox } from '../../../../components/Combobox';
import { useSearchParts } from '../../../../hooks/useQueryHooks';
import { supabase } from '../../../../services/supabaseClient';
import { returnPartToStore, transferPartToVan } from '../../../../services/inventoryService';
import { showToast } from '../../../../services/toastService';
import { VanStock, VanStockItem } from '../../../../types';

type TransferMode = 'in' | 'out';

interface TransferPartModalProps {
  isOpen: boolean;
  mode: TransferMode;
  vanStock: VanStock;
  /** Required for 'out' mode; optional for 'in' mode (pre-selects the row being loaded) */
  vanStockItem?: VanStockItem | null;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  /** Called after a successful transfer so the parent can refresh data */
  onSuccess: () => void;
}

export function TransferPartModal({
  isOpen,
  mode,
  vanStock,
  vanStockItem,
  currentUserId,
  currentUserName,
  onClose,
  onSuccess,
}: TransferPartModalProps) {
  const { options, isSearching, search } = useSearchParts(30);
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [selectedPartLabel, setSelectedPartLabel] = useState<string>('');
  const [centralStock, setCentralStock] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Reset internal state every time the modal opens. Pre-select the part when
  // the caller passed a specific van_stock_item (per-row "transfer in" button).
  useEffect(() => {
    if (!isOpen) return;
    setQuantity('');
    setReason('');
    setCentralStock(null);
    if (mode === 'in' && vanStockItem?.part_id) {
      setSelectedPartId(vanStockItem.part_id);
      setSelectedPartLabel(vanStockItem.part?.part_name || '');
    } else if (mode === 'out' && vanStockItem) {
      setSelectedPartId(vanStockItem.part_id);
      setSelectedPartLabel(vanStockItem.part?.part_name || '');
    } else {
      setSelectedPartId('');
      setSelectedPartLabel('');
    }
  }, [isOpen, mode, vanStockItem]);

  // Fetch central stock whenever a part is selected in 'in' mode so we can
  // show the admin how much is actually available before they type a number.
  useEffect(() => {
    if (!isOpen || mode !== 'in' || !selectedPartId) {
      setCentralStock(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('parts')
        .select('stock_quantity, part_name')
        .eq('part_id', selectedPartId)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setCentralStock(null);
        return;
      }
      setCentralStock(data.stock_quantity ?? 0);
      if (data.part_name) setSelectedPartLabel(data.part_name);
    })();
    return () => { cancelled = true; };
  }, [isOpen, mode, selectedPartId]);

  if (!isOpen) return null;

  const vanQty = vanStockItem?.quantity ?? 0;
  const qtyNumber = Number(quantity);
  const isValidQuantity = Number.isFinite(qtyNumber) && qtyNumber > 0;
  const exceedsAvailable = mode === 'in'
    ? centralStock !== null && qtyNumber > centralStock
    : qtyNumber > vanQty;
  const hasReason = reason.trim().length > 0;
  const canSubmit =
    !submitting &&
    !!selectedPartId &&
    isValidQuantity &&
    !exceedsAvailable &&
    hasReason;

  const vanLabel = vanStock.van_plate || vanStock.van_code || vanStock.technician_name || 'Van';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (mode === 'in') {
        await transferPartToVan(
          selectedPartId,
          vanStock.van_stock_id,
          qtyNumber,
          reason.trim(),
          currentUserId,
          currentUserName
        );
        showToast.success(
          'Transfer complete',
          `${qtyNumber} × ${selectedPartLabel || 'part'} moved to ${vanLabel}`
        );
      } else {
        if (!vanStockItem) {
          showToast.error('Nothing selected', 'No van stock item selected for return');
          setSubmitting(false);
          return;
        }
        await returnPartToStore(
          vanStockItem.item_id,
          qtyNumber,
          reason.trim(),
          currentUserId,
          currentUserName
        );
        showToast.success(
          'Return complete',
          `${qtyNumber} × ${selectedPartLabel || 'part'} returned from ${vanLabel} to store`
        );
      }
      onSuccess();
      onClose();
    } catch (err) {
      const msg = (err as Error).message || 'Unknown error';
      showToast.error(mode === 'in' ? 'Transfer failed' : 'Return failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'in' ? 'Transfer Part to Van' : 'Return Part to Store';
  const subtitle = mode === 'in'
    ? `Move stock FROM central warehouse TO ${vanLabel}`
    : `Move stock FROM ${vanLabel} BACK TO central warehouse`;
  const accentIcon = mode === 'in'
    ? <ArrowDownToLine className="w-5 h-5 text-blue-600" />
    : <ArrowUpFromLine className="w-5 h-5 text-amber-600" />;
  const accentBg = mode === 'in' ? 'bg-blue-100' : 'bg-amber-100';
  const confirmClass = mode === 'in'
    ? 'bg-blue-600 hover:bg-blue-700'
    : 'bg-amber-600 hover:bg-amber-700';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accentBg}`}>
              {accentIcon}
            </div>
            <div>
              <h2 className="font-semibold text-lg text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {mode === 'in' && !vanStockItem && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Part from Central Stock
              </label>
              <Combobox
                options={options}
                value={selectedPartId}
                onChange={(id) => {
                  setSelectedPartId(id);
                  const opt = options.find(o => o.id === id);
                  if (opt) setSelectedPartLabel(opt.label);
                }}
                onSearch={search}
                isSearching={isSearching}
                placeholder="Search by part name or item code..."
              />
            </div>
          )}

          {(mode === 'out' || vanStockItem) && selectedPartLabel && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Part</p>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">{selectedPartLabel}</p>
              {vanStockItem?.part?.part_code && (
                <p className="text-xs text-slate-500">{vanStockItem.part.part_code}</p>
              )}
              {mode === 'out' && (
                <p className="text-xs text-slate-600 mt-2">
                  Currently on van: <span className="font-semibold">{vanQty}</span>
                </p>
              )}
            </div>
          )}

          {mode === 'in' && centralStock !== null && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
              Central warehouse stock: <span className="font-semibold">{centralStock}</span>
              {centralStock === 0 && (
                <p className="text-xs text-red-600 mt-1">Out of stock — nothing to transfer.</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Quantity
              {mode === 'out' && vanQty > 0 && (
                <span className="text-xs text-slate-500 font-normal ml-2">(max {vanQty})</span>
              )}
              {mode === 'in' && centralStock !== null && centralStock > 0 && (
                <span className="text-xs text-slate-500 font-normal ml-2">(max {centralStock})</span>
              )}
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              max={mode === 'in' ? centralStock ?? undefined : vanQty}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="How many to move?"
              autoFocus={mode === 'out' || !!vanStockItem}
            />
            {exceedsAvailable && (
              <p className="text-xs text-red-600 mt-1">
                {mode === 'in'
                  ? `Only ${centralStock} available in central stock`
                  : `Only ${vanQty} on van`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={mode === 'in'
                ? 'e.g., Weekly van load, replacement for used stock, new job prep'
                : 'e.g., Leftover from completed job, van decommissioned, monthly audit'}
            />
            <p className="text-xs text-slate-500 mt-1">
              Required. Logged to the inventory movements ledger alongside your user ID.
            </p>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${confirmClass}`}
          >
            {submitting
              ? (mode === 'in' ? 'Transferring...' : 'Returning...')
              : (mode === 'in' ? 'Transfer to Van' : 'Return to Store')}
          </button>
        </div>
      </div>
    </div>
  );
}

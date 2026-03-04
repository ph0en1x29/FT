import { Loader2, Package, Search, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { receiveLiquidStock } from '../../../services/liquidInventoryService';
import { supabase } from '../../../services/supabaseClient';
import { showToast } from '../../../services/toastService';
import { Part } from '../../../types';

interface BatchReceiveStockModalProps {
  show: boolean;
  currentUser: { user_id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedPart extends Part {
  qtyReceived: string;
  unitCost: string;
}

const todayStr = () => new Date().toISOString().split('T')[0];

const BatchReceiveStockModal: React.FC<BatchReceiveStockModalProps> = ({
  show,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [poReference, setPoReference] = useState('');
  const [receiveDate, setReceiveDate] = useState(todayStr());
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Part[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Invoice upload state
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [invoicePath, setInvoicePath] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      setPoReference('');
      setReceiveDate(todayStr());
      setSelectedParts([]);
      setSearchQuery('');
      setSearchResults([]);
      setInvoiceFile(null);
      setInvoicePath(null);
    }
  }, [show]);

  // Search parts
  useEffect(() => {
    const searchParts = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('parts')
          .select('part_id, part_code, part_name, stock_quantity, is_liquid, bulk_quantity, container_quantity, container_size, container_unit, base_unit, unit, cost_price')
          .or(`part_code.ilike.%${searchQuery}%,part_name.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) throw error;
        setSearchResults(data || []);
        setShowDropdown(true);
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setSearching(false);
      }
    };

    const timer = setTimeout(searchParts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle invoice upload
  const handleInvoiceUpload = async (file: File) => {
    setUploadingInvoice(true);
    try {
      const path = `receipts/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('invoices')
        .upload(path, file);

      if (error) {
        showToast.warning('Invoice upload failed — receiving will continue without attachment.');
        console.error('Upload error:', error);
      } else {
        setInvoicePath(path);
        showToast.success('Invoice uploaded successfully');
      }
    } catch (e) {
      showToast.warning('Invoice upload failed — receiving will continue without attachment.');
      console.error('Upload error:', e);
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInvoiceFile(file);
      handleInvoiceUpload(file);
    }
  };

  const addPartToList = (part: Part) => {
    if (selectedParts.some(p => p.part_id === part.part_id)) {
      showToast.error('Item already added');
      return;
    }

    setSelectedParts(prev => [...prev, {
      ...part,
      qtyReceived: '',
      unitCost: part.cost_price?.toString() || '',
    }]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const removePartFromList = (partId: string) => {
    setSelectedParts(prev => prev.filter(p => p.part_id !== partId));
  };

  const updatePart = (partId: string, field: 'qtyReceived' | 'unitCost', value: string) => {
    setSelectedParts(prev => prev.map(p => 
      p.part_id === partId ? { ...p, [field]: value } : p
    ));
  };

  const getUnit = (part: Part) => part.is_liquid ? 'L' : (part.base_unit || 'pcs');

  const getCurrentStock = (part: Part) => {
    if (part.is_liquid) {
      const containerTotal = (part.container_quantity ?? 0) * (part.container_size ?? 0);
      return containerTotal + (part.bulk_quantity ?? 0);
    }
    return part.stock_quantity ?? 0;
  };

  const getContainerInfo = (part: Part) => {
    if (!part.is_liquid) return null;
    const containerCount = part.container_quantity ?? 0;
    const containerSize = part.container_size ?? 0;
    const bulkQty = part.bulk_quantity ?? 0;
    const containerUnit = part.container_unit || 'drum';
    
    return {
      containerSize,
      containerUnit,
      currentContainers: containerCount,
      currentBulk: bulkQty,
    };
  };

  const getNewTotal = (part: SelectedPart) => {
    if (!part.is_liquid) return null;
    const currentStock = getCurrentStock(part);
    const receiving = parseFloat(part.qtyReceived) || 0;
    return currentStock + receiving;
  };

  const filledRows = selectedParts.filter(p => parseFloat(p.qtyReceived) > 0);

  const totalCost = filledRows.reduce((sum, p) => {
    const qty = parseFloat(p.qtyReceived) || 0;
    const cost = parseFloat(p.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  const handleSubmit = async () => {
    if (filledRows.length === 0) {
      showToast.error('Enter quantity for at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      // Prepare reference number
      const referenceNumber = invoicePath 
        ? `receipt:${invoicePath}` 
        : (poReference || null);

      for (const part of filledRows) {
        const qty = parseFloat(part.qtyReceived);
        const unitCost = parseFloat(part.unitCost) || 0;
        const totalLineCost = qty * unitCost;

        if (part.is_liquid) {
          await receiveLiquidStock({
            partId: part.part_id,
            containerQty: 0,
            containerSize: 0,
            totalLiters: qty,
            totalPrice: totalLineCost,
            costPerLiter: unitCost,
            poReference: referenceNumber || undefined,
            performedBy: currentUser.user_id,
            performedByName: currentUser.name,
          });
        } else {
          const { error: movErr } = await supabase.from('inventory_movements').insert({
            part_id: part.part_id,
            movement_type: 'purchase',
            container_qty_change: 0,
            bulk_qty_change: qty,
            performed_by: currentUser.user_id,
            performed_by_name: currentUser.name,
            reference_number: referenceNumber,
            unit_cost_at_time: unitCost || null,
            total_cost: totalLineCost || null,
            notes: `Batch receive on ${receiveDate}`,
          });
          if (movErr) throw movErr;

          const newQty = (part.stock_quantity ?? 0) + qty;
          const updatePayload: Record<string, unknown> = { stock_quantity: newQty };
          if (unitCost > 0) updatePayload.cost_price = unitCost;

          const { error: upErr } = await supabase
            .from('parts')
            .update(updatePayload)
            .eq('part_id', part.part_id);
          if (upErr) throw upErr;
        }
      }

      showToast.success(`Received stock for ${filledRows.length} item(s) (Total: RM ${totalCost.toFixed(2)})`);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      showToast.error(e instanceof Error ? e.message : 'Failed to receive stock.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-2">
      <div className="w-full max-w-5xl bg-[var(--surface)] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="font-semibold text-[var(--text)]">Batch Receive Stock</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Search and add parts to receive</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg-subtle)] rounded-lg transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* PO Reference, Date, Invoice Upload */}
        <div className="px-5 py-3 border-b border-[var(--border)] flex flex-wrap gap-4 shrink-0">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">PO Reference</label>
            <input
              type="text"
              value={poReference}
              onChange={e => setPoReference(e.target.value)}
              placeholder="e.g. PO-2024-001"
              className="input-premium text-sm w-full"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Date</label>
            <input
              type="date"
              value={receiveDate}
              onChange={e => setReceiveDate(e.target.value)}
              className="input-premium text-sm w-full"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Invoice / Receipt (Optional)
            </label>
            <label className="input-premium text-sm w-full flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors">
              {uploadingInvoice ? (
                <Loader2 className="w-4 h-4 text-[var(--text-muted)] animate-spin" />
              ) : (
                <Upload className="w-4 h-4 text-[var(--text-muted)]" />
              )}
              <span className={invoiceFile ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>
                {invoiceFile ? invoiceFile.name : 'Choose file...'}
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploadingInvoice}
              />
            </label>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-5 py-3 border-b border-[var(--border)] shrink-0 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Search parts by code or name..."
              className="input-premium text-sm w-full pl-10"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] animate-spin" />
            )}
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute left-5 right-5 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-xl max-h-64 overflow-auto z-10">
              {searchResults.map(part => (
                <button
                  key={part.part_id}
                  onClick={() => addPartToList(part)}
                  className="w-full px-4 py-2.5 text-left hover:bg-[var(--bg-subtle)] transition-colors border-b border-[var(--border)] last:border-0"
                >
                  <div className="font-medium text-sm text-[var(--text)]">{part.part_name}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {part.part_code} • Stock: {getCurrentStock(part).toFixed(part.is_liquid ? 2 : 0)} {getUnit(part)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Parts Table */}
        <div className="overflow-auto flex-1">
          {selectedParts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
              <Package className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No items added yet</p>
              <p className="text-xs mt-1">Search and add parts to receive stock</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-subtle)] text-left">
                  <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Part</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Current Stock</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Qty Received</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Unit</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Unit Cost (RM)</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Total Cost (RM)</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {selectedParts.map(part => {
                  const qty = parseFloat(part.qtyReceived) || 0;
                  const cost = parseFloat(part.unitCost) || 0;
                  const lineCost = qty * cost;
                  const unit = getUnit(part);
                  const currentStock = getCurrentStock(part);
                  const containerInfo = getContainerInfo(part);
                  const newTotal = getNewTotal(part);

                  return (
                    <tr key={part.part_id} className={qty > 0 ? 'bg-green-50/30' : ''}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-[var(--text)]">
                          {part.part_name}
                          {part.is_liquid && containerInfo && (
                            <span className="text-[var(--text-muted)] font-normal ml-1">
                              [{containerInfo.containerSize}L]
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{part.part_code}</div>
                        {part.is_liquid && containerInfo && (
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Container: {containerInfo.containerSize}L {containerInfo.containerUnit} | 
                            Current: {containerInfo.currentContainers} {containerInfo.containerUnit}s + {containerInfo.currentBulk.toFixed(2)}L bulk
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[var(--text-muted)] whitespace-nowrap">
                        {currentStock.toFixed(part.is_liquid ? 2 : 0)} {unit}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          inputMode={part.is_liquid ? 'decimal' : 'numeric'}
                          min="0"
                          step={part.is_liquid ? '0.01' : '1'}
                          value={part.qtyReceived}
                          onChange={e => updatePart(part.part_id, 'qtyReceived', e.target.value)}
                          placeholder="0"
                          className="input-premium text-sm w-24"
                        />
                        {part.is_liquid && qty > 0 && newTotal !== null && (
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            → New total: {newTotal.toFixed(2)}L
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[var(--text-muted)]">{unit}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={part.unitCost}
                          onChange={e => updatePart(part.part_id, 'unitCost', e.target.value)}
                          placeholder="0.00"
                          className="input-premium text-sm w-28"
                        />
                      </td>
                      <td className="px-4 py-2 text-[var(--text)] font-medium whitespace-nowrap">
                        {lineCost > 0 ? `RM ${lineCost.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => removePartFromList(part.part_id)}
                          className="p-1 hover:bg-red-50 rounded transition-colors"
                          title="Remove"
                        >
                          <X className="w-4 h-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">{filledRows.length}</span> item(s) to receive
            {totalCost > 0 && (
              <> — Total: <span className="font-semibold text-[var(--text)]">RM {totalCost.toFixed(2)}</span></>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-premium btn-premium-secondary" disabled={submitting}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || filledRows.length === 0}
              className="btn-premium btn-premium-primary disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />Submitting...
                </span>
              ) : (
                `Receive ${filledRows.length} Item(s)`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchReceiveStockModal;

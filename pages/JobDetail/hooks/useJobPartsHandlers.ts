import { useCallback } from 'react';
import { useVanStockPart } from '../../../services/inventoryService';
import { createReplenishmentRequest } from '../../../services/replenishmentService';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Job, UserRole } from '../../../types';
import { JobDetailState } from './useJobDetailState';

interface UseJobPartsHandlersParams {
  job: Job | null;
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  loadJob: () => Promise<void>;
  setJob: (j: Job | null | ((prev: Job | null) => Job | null)) => void;
}

export const useJobPartsHandlers = ({
  job,
  state,
  currentUserId,
  currentUserName,
  currentUserRole,
  loadJob,
  setJob,
}: UseJobPartsHandlersParams) => {
  const handleAddPart = useCallback(async () => {
    if (!job || !state.selectedPartId) return;
    const price = parseFloat(state.selectedPartPrice) || 0;
    try {
      const updated = await MockDb.addPartToJob(job.job_id, state.selectedPartId, 1, price, UserRole.ADMIN, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      state.setSelectedPartId('');
      state.setSelectedPartPrice('');
      showToast.success('Part added');
    } catch (e) {
      showToast.error('Could not add part', (e as Error).message);
    }
  }, [job, state, setJob, currentUserId, currentUserName]);

  const handleStartEditPartPrice = useCallback((partId: string, currentPrice: number) => {
    state.setEditingPartId(partId);
    state.setEditingPrice(currentPrice.toString());
  }, [state]);

  const handleSavePartPrice = useCallback(async (partId: string) => {
    if (!job) return;
    const price = parseFloat(state.editingPrice);
    if (isNaN(price) || price < 0) {
      showToast.error('Invalid price');
      return;
    }
    try {
      const updated = await MockDb.updatePartPrice(job.job_id, partId, price);
      setJob({ ...updated } as Job);
      state.setEditingPartId(null);
      state.setEditingPrice('');
      showToast.success('Price updated');
    } catch (e) {
      showToast.error('Could not update price', (e as Error).message);
    }
  }, [job, state, setJob]);

  const handleCancelPartEdit = useCallback(() => {
    state.setEditingPartId(null);
    state.setEditingPrice('');
  }, [state]);

  const handleRemovePart = useCallback(async (partId: string) => {
    if (!job) return;
    try {
      const updated = await MockDb.removePartFromJob(job.job_id, partId);
      setJob({ ...updated } as Job);
      showToast.success('Part removed');
    } catch (e) {
      showToast.error('Could not remove part', (e as Error).message);
    }
  }, [job, setJob]);

  const handleToggleNoPartsUsed = useCallback(async () => {
    if (!job) return;
    const newValue = !state.noPartsUsed;
    try {
      await MockDb.setNoPartsUsed(job.job_id, newValue);
      state.setNoPartsUsed(newValue);
      showToast.success(newValue ? 'Marked as no parts used' : 'Cleared no parts flag');
    } catch (e) {
      showToast.error('Could not update', (e as Error).message);
    }
  }, [job, state]);

  const handleConfirmParts = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.confirmParts(job.job_id, currentUserId, currentUserName, currentUserRole);
      setJob({ ...updated } as Job);
      showToast.success('Parts confirmed');
    } catch (e) {
      showToast.error('Could not confirm parts', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleUseVanStockPart = useCallback(async () => {
    if (!job || !state.selectedVanStockItemId || !state.vanStock) return;
    const item = state.vanStock.items?.find(i => i.item_id === state.selectedVanStockItemId);
    if (!item) { showToast.error('Van stock item not found'); return; }
    if (item.quantity < 1) { showToast.error('No stock available', `${item.part?.part_name} is out of stock in your van`); return; }

    try {
      await useVanStockPart(
        item.item_id,
        job.job_id,
        1,
        currentUserId,
        currentUserName,
        false // no approval needed for own van stock
      );

      // Also add to job parts for invoicing
      if (item.part) {
        await MockDb.addPartToJob(job.job_id, item.part_id, 1, item.part.sell_price || 0, UserRole.TECHNICIAN, currentUserId, currentUserName);
      }

      // Check if low stock — auto-create replenishment alert
      const newQty = item.quantity - 1;
      if (newQty <= item.min_quantity && state.vanStock) {
        const lowItems = (state.vanStock.items || []).filter(i => {
          const qty = i.item_id === item.item_id ? newQty : i.quantity;
          return qty <= i.min_quantity;
        });
        if (lowItems.length > 0) {
          try {
            await createReplenishmentRequest(
              state.vanStock.van_stock_id,
              currentUserId,
              currentUserName,
              lowItems.map(i => ({
                vanStockItemId: i.item_id,
                partId: i.part_id,
                partName: i.part?.part_name || 'Unknown',
                partCode: i.part?.part_code || '',
                quantityRequested: i.max_quantity - (i.item_id === item.item_id ? newQty : i.quantity),
              })),
              'low_stock',
              job.job_id,
              `Auto-triggered: low stock after job usage`
            );
            showToast.info('Low stock alert', 'Replenishment request sent to store');
          } catch { /* non-critical */ }
        }
      }

      state.setSelectedVanStockItemId('');
      showToast.success('Part used from van stock', `${item.part?.part_name} added to job`);
      // Reload job + van stock
      loadJob();
    } catch (e) {
      showToast.error('Failed to use van stock part', (e as Error).message);
    }
  }, [job, state, currentUserId, currentUserName, loadJob]);

  const handleSelectJobVan = useCallback(async (vanStockId: string) => {
    if (!job) return;
    // Prevent changing van after parts have been used from van stock
    const hasVanStockParts = job.parts_used.some(p => p.from_van_stock);
    if (hasVanStockParts) {
      showToast.error('Cannot change van', 'Parts have already been used from the current van');
      return;
    }
    try {
      const updated = await MockDb.updateJob(job.job_id, { job_van_stock_id: vanStockId || undefined });
      setJob({ ...updated } as Job);
      // Reload van stock for the newly selected van
      loadJob();
      showToast.success('Van updated');
    } catch (e) {
      showToast.error('Could not update van', (e as Error).message);
    }
  }, [job, setJob, loadJob]);

  return {
    handleAddPart,
    handleStartEditPartPrice,
    handleSavePartPrice,
    handleCancelPartEdit,
    handleRemovePart,
    handleToggleNoPartsUsed,
    handleConfirmParts,
    handleUseVanStockPart,
    handleSelectJobVan,
  };
};

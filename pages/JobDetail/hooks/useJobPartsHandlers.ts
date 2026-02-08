import { useCallback } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Job, UserRole } from '../../../types';
import { JobDetailState } from './useJobDetailState';

interface UseJobPartsHandlersParams {
  job: Job | null;
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  loadJob: () => Promise<void>;
  setJob: (j: Job | null | ((prev: Job | null) => Job | null)) => void;
}

export const useJobPartsHandlers = ({
  job,
  state,
  currentUserId,
  currentUserName,
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
      const updated = await MockDb.confirmParts(job.job_id, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      showToast.success('Parts confirmed');
    } catch (e) {
      showToast.error('Could not confirm parts', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  return {
    handleAddPart,
    handleStartEditPartPrice,
    handleSavePartPrice,
    handleCancelPartEdit,
    handleRemovePart,
    handleToggleNoPartsUsed,
    handleConfirmParts,
  };
};

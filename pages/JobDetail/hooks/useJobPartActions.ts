import { useCallback } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Job, UserRole } from '../../../types';
import { JobDetailState } from './useJobDetailState';

interface UseJobPartActionsParams {
  job: Job | null;
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  setJob: (j: Job | null | ((prev: Job | null) => Job | null)) => void;
}

/**
 * Hook for parts, extra charges, and parts confirmation actions
 */
export const useJobPartActions = ({
  job,
  state,
  currentUserId,
  currentUserName,
  setJob,
}: UseJobPartActionsParams) => {

  // Parts handlers
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

  // Confirmation handlers
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

  // Extra Charges handlers
  const handleAddExtraCharge = useCallback(async () => {
    if (!job) return;
    const amount = parseFloat(state.chargeAmount);
    if (!state.chargeName.trim() || isNaN(amount) || amount <= 0) {
      showToast.error('Please fill in all required fields');
      return;
    }
    try {
      const updated = await MockDb.addExtraCharge(job.job_id, { name: state.chargeName, description: state.chargeDescription, amount });
      setJob({ ...updated } as Job);
      state.setShowAddCharge(false);
      state.setChargeName('');
      state.setChargeDescription('');
      state.setChargeAmount('');
      showToast.success('Extra charge added');
    } catch (e) {
      showToast.error('Could not add charge', (e as Error).message);
    }
  }, [job, state, setJob]);

  const handleRemoveExtraCharge = useCallback(async (chargeId: string) => {
    if (!job) return;
    try {
      const updated = await MockDb.removeExtraCharge(job.job_id, chargeId);
      setJob({ ...updated } as Job);
      showToast.success('Charge removed');
    } catch (e) {
      showToast.error('Could not remove charge', (e as Error).message);
    }
  }, [job, setJob]);

  return {
    handleAddPart,
    handleStartEditPartPrice,
    handleSavePartPrice,
    handleCancelPartEdit,
    handleRemovePart,
    handleToggleNoPartsUsed,
    handleConfirmParts,
    handleAddExtraCharge,
    handleRemoveExtraCharge,
  };
};

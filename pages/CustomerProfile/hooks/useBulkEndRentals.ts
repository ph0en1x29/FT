import { useCallback,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { ForkliftRental,User } from '../../../types';
import { ResultModalState } from '../types';

interface UseBulkEndRentalsResult {
  showBulkEndModal: boolean;
  bulkEndDate: string;
  bulkProcessing: boolean;
  setBulkEndDate: (date: string) => void;
  openBulkEndModal: () => void;
  closeBulkEndModal: () => void;
  handleBulkEndRentals: () => Promise<void>;
}

/**
 * Hook for managing bulk rental termination
 */
export function useBulkEndRentals(
  selectedRentals: ForkliftRental[],
  currentUser: User,
  onComplete: () => Promise<void>,
  onResetSelection: () => void,
  setResultModal: (modal: ResultModalState) => void
): UseBulkEndRentalsResult {
  const [showBulkEndModal, setShowBulkEndModal] = useState(false);
  const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const openBulkEndModal = useCallback(() => {
    setBulkEndDate(new Date().toISOString().split('T')[0]);
    setShowBulkEndModal(true);
  }, []);

  const closeBulkEndModal = useCallback(() => {
    setShowBulkEndModal(false);
  }, []);

  const handleBulkEndRentals = useCallback(async () => {
    if (selectedRentals.length === 0) return;

    setBulkProcessing(true);
    try {
      const forkliftIds = selectedRentals.map(r => r.forklift_id);
      
      const result = await MockDb.bulkEndRentals(
        forkliftIds,
        bulkEndDate || undefined,
        currentUser.user_id,
        currentUser.name
      );

      const details: string[] = [];
      result.success.forEach(r => {
        details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rental ended`);
      });
      result.failed.forEach(f => {
        const rental = selectedRentals.find(r => r.forklift_id === f.forkliftId);
        details.push(`✗ ${rental?.forklift?.serial_number || f.forkliftId} - ${f.error}`);
      });

      setResultModal({
        show: true,
        type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
        title: result.failed.length === 0 ? 'Rentals Ended Successfully' : 'Bulk End Rental Complete',
        message: `Successfully ended ${result.success.length} rental(s)${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}.`,
        details,
      });

      setShowBulkEndModal(false);
      onResetSelection();
      await onComplete();
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message,
      });
    } finally {
      setBulkProcessing(false);
    }
  }, [selectedRentals, bulkEndDate, currentUser, onComplete, onResetSelection, setResultModal]);

  return {
    showBulkEndModal,
    bulkEndDate,
    bulkProcessing,
    setBulkEndDate,
    openBulkEndModal,
    closeBulkEndModal,
    handleBulkEndRentals,
  };
}

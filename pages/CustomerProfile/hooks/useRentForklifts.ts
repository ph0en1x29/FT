import { useState, useCallback } from 'react';
import { Customer, Forklift, User } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { ResultModalState } from '../types';

interface UseRentForkliftsResult {
  showRentModal: boolean;
  selectedForkliftIds: Set<string>;
  rentStartDate: string;
  rentEndDate: string;
  rentNotes: string;
  rentMonthlyRate: string;
  forkliftSearchQuery: string;
  rentProcessing: boolean;
  setRentStartDate: (date: string) => void;
  setRentEndDate: (date: string) => void;
  setRentNotes: (notes: string) => void;
  setRentMonthlyRate: (rate: string) => void;
  setForkliftSearchQuery: (query: string) => void;
  toggleForkliftForRent: (forkliftId: string) => void;
  openRentModal: () => Promise<void>;
  closeRentModal: () => void;
  handleRentForklifts: () => Promise<void>;
}

/**
 * Hook for managing forklift rental modal and operations
 */
export function useRentForklifts(
  customer: Customer | null,
  availableForklifts: Forklift[],
  currentUser: User,
  loadAvailableForklifts: () => Promise<void>,
  onComplete: () => Promise<void>,
  setResultModal: (modal: ResultModalState) => void
): UseRentForkliftsResult {
  const [showRentModal, setShowRentModal] = useState(false);
  const [selectedForkliftIds, setSelectedForkliftIds] = useState<Set<string>>(new Set());
  const [rentStartDate, setRentStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rentEndDate, setRentEndDate] = useState('');
  const [rentNotes, setRentNotes] = useState('');
  const [rentMonthlyRate, setRentMonthlyRate] = useState('');
  const [forkliftSearchQuery, setForkliftSearchQuery] = useState('');
  const [rentProcessing, setRentProcessing] = useState(false);

  const openRentModal = useCallback(async () => {
    await loadAvailableForklifts();
    setSelectedForkliftIds(new Set());
    setRentStartDate(new Date().toISOString().split('T')[0]);
    setRentEndDate('');
    setRentNotes('');
    setRentMonthlyRate('');
    setForkliftSearchQuery('');
    setShowRentModal(true);
  }, [loadAvailableForklifts]);

  const closeRentModal = useCallback(() => {
    setShowRentModal(false);
  }, []);

  const toggleForkliftForRent = useCallback((forkliftId: string) => {
    setSelectedForkliftIds(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(forkliftId)) {
        newSelected.delete(forkliftId);
      } else {
        newSelected.add(forkliftId);
      }
      return newSelected;
    });
  }, []);

  const handleRentForklifts = useCallback(async () => {
    if (!customer || selectedForkliftIds.size === 0 || !rentStartDate) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Validation Error',
        message: 'Please select at least one forklift and a start date',
      });
      return;
    }

    setRentProcessing(true);
    try {
      const forkliftIds: string[] = Array.from(selectedForkliftIds);
      
      if (forkliftIds.length === 1) {
        await MockDb.assignForkliftToCustomer(
          forkliftIds[0],
          customer.customer_id,
          rentStartDate,
          rentEndDate || undefined,
          rentNotes || undefined,
          currentUser.user_id,
          currentUser.name,
          rentMonthlyRate ? parseFloat(rentMonthlyRate) : undefined
        );
        
        const forklift = availableForklifts.find(f => f.forklift_id === forkliftIds[0]);
        setResultModal({
          show: true,
          type: 'success',
          title: 'Forklift Rented Successfully',
          message: `${forklift?.make} ${forklift?.model} (${forklift?.serial_number}) has been rented to ${customer.name}.`,
          details: [
            `✓ Rental created successfully`,
            `✓ Start date: ${new Date(rentStartDate).toLocaleDateString()}`,
            rentMonthlyRate ? `✓ Monthly rate: RM${parseFloat(rentMonthlyRate).toLocaleString()}` : '',
          ].filter(Boolean),
        });
      } else {
        const result = await MockDb.bulkAssignForkliftsToCustomer(
          forkliftIds,
          customer.customer_id,
          rentStartDate,
          rentEndDate || undefined,
          rentNotes || undefined,
          currentUser.user_id,
          currentUser.name,
          rentMonthlyRate ? parseFloat(rentMonthlyRate) : undefined
        );

        const details: string[] = [];
        result.success.forEach(r => {
          details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rented successfully`);
        });
        result.failed.forEach(f => {
          const forklift = availableForklifts.find(fl => fl.forklift_id === f.forkliftId);
          details.push(`✗ ${forklift?.serial_number || f.forkliftId} - ${f.error}`);
        });

        setResultModal({
          show: true,
          type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
          title: result.failed.length === 0 ? 'Forklifts Rented Successfully' : 'Bulk Rental Complete',
          message: `Successfully rented ${result.success.length} forklift(s) to ${customer.name}${result.failed.length > 0 ? `. ${result.failed.length} failed.` : '.'}`,
          details,
        });
      }

      setShowRentModal(false);
      await onComplete();
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message,
      });
    } finally {
      setRentProcessing(false);
    }
  }, [customer, selectedForkliftIds, rentStartDate, rentEndDate, rentNotes, rentMonthlyRate, currentUser, availableForklifts, onComplete, setResultModal]);

  return {
    showRentModal,
    selectedForkliftIds,
    rentStartDate,
    rentEndDate,
    rentNotes,
    rentMonthlyRate,
    forkliftSearchQuery,
    rentProcessing,
    setRentStartDate,
    setRentEndDate,
    setRentNotes,
    setRentMonthlyRate,
    setForkliftSearchQuery,
    toggleForkliftForRent,
    openRentModal,
    closeRentModal,
    handleRentForklifts,
  };
}

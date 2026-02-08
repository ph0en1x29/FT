import { useCallback,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { ForkliftRental,User } from '../../../types';

interface RentalEditData {
  startDate: string;
  endDate: string;
  notes: string;
  monthlyRate: string;
}

interface UseRentalActionsResult {
  editingRental: ForkliftRental | null;
  setEditingRental: (rental: ForkliftRental | null) => void;
  handleEndRental: (rentalId: string) => Promise<void>;
  handleSaveRentalEdit: (data: RentalEditData) => Promise<void>;
}

/**
 * Hook for managing individual rental actions (edit/end)
 */
export function useRentalActions(
  currentUser: User,
  onComplete: () => Promise<void>
): UseRentalActionsResult {
  const [editingRental, setEditingRental] = useState<ForkliftRental | null>(null);

  const handleEndRental = useCallback(async (rentalId: string) => {
    if (!confirm('End this rental? The forklift will be marked as available.')) return;
    
    try {
      await MockDb.endRental(rentalId, undefined, currentUser.user_id, currentUser.name);
      await onComplete();
    } catch (error) {
      alert((error as Error).message);
    }
  }, [currentUser, onComplete]);

  const handleSaveRentalEdit = useCallback(async (data: RentalEditData) => {
    if (!editingRental) return;
    
    try {
      await MockDb.updateRental(editingRental.rental_id, {
        start_date: data.startDate,
        end_date: data.endDate || undefined,
        notes: data.notes || undefined,
        monthly_rental_rate: parseFloat(data.monthlyRate) || 0,
      });
      setEditingRental(null);
      await onComplete();
    } catch (error) {
      alert((error as Error).message);
    }
  }, [editingRental, onComplete]);

  return {
    editingRental,
    setEditingRental,
    handleEndRental,
    handleSaveRentalEdit,
  };
}

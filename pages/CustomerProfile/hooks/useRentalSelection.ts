import { useState, useMemo, useCallback } from 'react';
import { ForkliftRental } from '../../../types';

interface UseRentalSelectionResult {
  isSelectionMode: boolean;
  selectedRentalIds: Set<string>;
  selectedRentals: ForkliftRental[];
  toggleSelectionMode: () => void;
  toggleRentalSelection: (rentalId: string, e: React.MouseEvent) => void;
  selectAllActiveRentals: () => void;
  deselectAll: () => void;
  resetSelection: () => void;
}

/**
 * Hook for managing multi-select rental operations
 */
export function useRentalSelection(
  activeRentals: ForkliftRental[]
): UseRentalSelectionResult {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRentalIds, setSelectedRentalIds] = useState<Set<string>>(new Set());

  // Compute selected rentals based on IDs
  const selectedRentals = useMemo(() => {
    return activeRentals.filter(r => selectedRentalIds.has(r.rental_id));
  }, [activeRentals, selectedRentalIds]);

  const toggleSelectionMode = useCallback(() => {
    if (isSelectionMode) {
      setSelectedRentalIds(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  }, [isSelectionMode]);

  const toggleRentalSelection = useCallback((rentalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRentalIds(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(rentalId)) {
        newSelected.delete(rentalId);
      } else {
        newSelected.add(rentalId);
      }
      return newSelected;
    });
  }, []);

  const selectAllActiveRentals = useCallback(() => {
    setSelectedRentalIds(new Set(activeRentals.map(r => r.rental_id)));
  }, [activeRentals]);

  const deselectAll = useCallback(() => {
    setSelectedRentalIds(new Set());
  }, []);

  const resetSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedRentalIds(new Set());
  }, []);

  return {
    isSelectionMode,
    selectedRentalIds,
    selectedRentals,
    toggleSelectionMode,
    toggleRentalSelection,
    selectAllActiveRentals,
    deselectAll,
    resetSelection,
  };
}

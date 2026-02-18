import { Truck } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Forklift } from '../../../types';
import ForkliftCard from './ForkliftCard';

interface ForkliftGridProps {
  forklifts: Forklift[];
  isSelectionMode: boolean;
  selectedForkliftIds: Set<string>;
  canEdit: boolean;
  hasFilters: boolean;
  onToggleSelection: (id: string, e: React.MouseEvent) => void;
  onEdit: (forklift: Forklift, e: React.MouseEvent) => void;
  onDelete: (forklift: Forklift, e: React.MouseEvent) => void;
  onAssign: (forklift: Forklift, e: React.MouseEvent) => void;
}

const ForkliftGrid: React.FC<ForkliftGridProps> = ({
  forklifts,
  isSelectionMode,
  selectedForkliftIds,
  canEdit,
  hasFilters,
  onToggleSelection,
  onEdit,
  onDelete,
  onAssign,
}) => {
  const navigate = useNavigate();

  const handleCardClick = (forklift: Forklift) => {
    if (isSelectionMode) {
      // Simulate click event for toggle
      onToggleSelection(forklift.forklift_id, { stopPropagation: () => {} } as React.MouseEvent);
    } else {
      navigate(`/forklifts/${forklift.forklift_id}`);
    }
  };

  if (forklifts.length === 0) {
    return (
      <div className="card-theme rounded-xl p-12 text-center">
        <Truck className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-theme mb-2">No forklifts found</h3>
        <p className="text-sm text-theme-muted">
          {hasFilters
            ? 'Try adjusting your search or filters'
            : 'Add your first forklift to get started'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
      {forklifts.map((forklift) => (
        <ForkliftCard
          key={forklift.forklift_id}
          forklift={forklift}
          isSelectionMode={isSelectionMode}
          isSelected={selectedForkliftIds.has(forklift.forklift_id)}
          canEdit={canEdit}
          onSelect={onToggleSelection}
          onClick={() => handleCardClick(forklift)}
          onEdit={onEdit}
          onDelete={onDelete}
          onAssign={onAssign}
        />
      ))}
    </div>
  );
};

export default ForkliftGrid;

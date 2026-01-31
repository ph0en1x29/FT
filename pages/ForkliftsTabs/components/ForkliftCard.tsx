import React from 'react';
import { Forklift, ForkliftType, ForkliftStatus } from '../../../types';
import {
  Truck, Edit2, Trash2, Gauge, Calendar, MapPin,
  CheckCircle, AlertCircle, Clock, Building2, ChevronRight,
  Square, CheckSquare
} from 'lucide-react';

interface ForkliftCardProps {
  forklift: Forklift;
  isSelectionMode: boolean;
  isSelected: boolean;
  canEdit: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onClick: () => void;
  onEdit: (forklift: Forklift, e: React.MouseEvent) => void;
  onDelete: (forklift: Forklift, e: React.MouseEvent) => void;
  onAssign: (forklift: Forklift, e: React.MouseEvent) => void;
}

const ForkliftCard: React.FC<ForkliftCardProps> = ({
  forklift,
  isSelectionMode,
  isSelected,
  canEdit,
  onSelect,
  onClick,
  onEdit,
  onDelete,
  onAssign,
}) => {
  const currentCustomer = forklift.current_customer;

  const getStatusIcon = (status: ForkliftStatus) => {
    switch (status) {
      case ForkliftStatus.ACTIVE: return <CheckCircle className="w-4 h-4 text-green-500" />;
      case ForkliftStatus.MAINTENANCE: return <Clock className="w-4 h-4 text-amber-500" />;
      case ForkliftStatus.INACTIVE: return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: ForkliftStatus) => {
    const styles = {
      [ForkliftStatus.ACTIVE]: 'bg-green-100 text-green-700',
      [ForkliftStatus.MAINTENANCE]: 'bg-amber-100 text-amber-700',
      [ForkliftStatus.INACTIVE]: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  const getTypeBadge = (type: ForkliftType) => {
    const styles = {
      [ForkliftType.ELECTRIC]: 'bg-blue-100 text-blue-700',
      [ForkliftType.DIESEL]: 'bg-slate-100 text-slate-700',
      [ForkliftType.LPG]: 'bg-purple-100 text-purple-700',
      [ForkliftType.PETROL]: 'bg-orange-100 text-orange-700',
    };
    return styles[type] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div
      onClick={onClick}
      className={`card-theme rounded-xl overflow-hidden cursor-pointer group transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' : 'hover:shadow-theme hover:border-blue-300'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-theme">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {isSelectionMode && (
              <button onClick={(e) => onSelect(forklift.forklift_id, e)} className="mt-1">
                {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-theme-muted" />}
              </button>
            )}
            <div>
              <h3 className="font-bold text-theme group-hover:text-blue-600 transition-colors">
                {forklift.make} {forklift.model}
              </h3>
              <p className="text-sm text-theme-muted font-mono">{forklift.serial_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {getStatusIcon(forklift.status)}
            {!isSelectionMode && <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-blue-500" />}
          </div>
        </div>
      </div>

      {/* Current Customer Badge */}
      {currentCustomer && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-100">
          <div className="flex items-center gap-2 text-green-700">
            <Building2 className="w-4 h-4" />
            <span className="text-sm font-medium truncate">{currentCustomer.name}</span>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadge(forklift.type)}`}>{forklift.type}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(forklift.status)}`}>{forklift.status}</span>
          {currentCustomer && <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">🔴 Rented</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-theme-muted">
            <Gauge className="w-4 h-4 opacity-60" />
            <span>{forklift.hourmeter.toLocaleString()} hrs</span>
          </div>
          {forklift.year && (
            <div className="flex items-center gap-2 text-theme-muted">
              <Calendar className="w-4 h-4 opacity-60" />
              <span>{forklift.year}</span>
            </div>
          )}
          {forklift.location && (
            <div className="flex items-center gap-2 text-theme-muted col-span-2">
              <MapPin className="w-4 h-4 opacity-60" />
              <span className="truncate">{forklift.location}</span>
            </div>
          )}
        </div>

        {forklift.capacity_kg && forklift.capacity_kg > 0 && (
          <div className="text-xs text-theme-muted">Capacity: {forklift.capacity_kg.toLocaleString()} kg</div>
        )}
      </div>

      {/* Actions */}
      {!isSelectionMode && (
        <div className="px-4 py-3 bg-theme-surface-2 border-t border-theme flex justify-between items-center">
          {!currentCustomer && (
            <button onClick={(e) => onAssign(forklift, e)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <Building2 className="w-4 h-4" /> Rent Out
            </button>
          )}
          {currentCustomer && <div />}
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={(e) => onEdit(forklift, e)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={(e) => onDelete(forklift, e)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ForkliftCard;

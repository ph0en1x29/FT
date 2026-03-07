import {
AlertCircle,
Building2,
Calendar,
CheckCircle,
CheckSquare,
ChevronRight,
Clock,
Edit2,
Gauge,
MapPin,
Square,
Trash2
} from 'lucide-react';
import React from 'react';
import { Forklift,ForkliftStatus,ForkliftType } from '../../../types';

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
  onReturn?: (forklift: Forklift, e: React.MouseEvent) => void;
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
  onReturn,
}) => {
  const currentCustomer = forklift.current_customer;
  const siteLabel = forklift.site || forklift.location;

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
      [ForkliftStatus.AVAILABLE]: 'bg-emerald-100 text-emerald-700',
      [ForkliftStatus.RENTED_OUT]: 'bg-blue-100 text-blue-700',
      [ForkliftStatus.IN_SERVICE]: 'bg-amber-100 text-amber-700',
      [ForkliftStatus.SERVICE_DUE]: 'bg-amber-100 text-amber-700',
      [ForkliftStatus.AWAITING_PARTS]: 'bg-orange-100 text-orange-700',
      [ForkliftStatus.OUT_OF_SERVICE]: 'bg-red-100 text-red-700',
      [ForkliftStatus.RESERVED]: 'bg-violet-100 text-violet-700',
      [ForkliftStatus.ACTIVE]: 'bg-green-100 text-green-700',
      [ForkliftStatus.MAINTENANCE]: 'bg-amber-100 text-amber-700',
      [ForkliftStatus.INACTIVE]: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  const getTypeBadge = (type: ForkliftType) => {
    const styles = {
      [ForkliftType.BATTERY_ELECTRICAL]: 'bg-blue-100 text-blue-700',
      [ForkliftType.DIESEL]: 'bg-slate-100 text-slate-700',
      [ForkliftType.LPG]: 'bg-purple-100 text-purple-700',
      [ForkliftType.REACH_TRUCK]: 'bg-teal-100 text-teal-700',
      [ForkliftType.OTHERS]: 'bg-orange-100 text-orange-700',
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {isSelectionMode && (
              <button onClick={(e) => onSelect(forklift.forklift_id, e)} className="mt-1">
                {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-theme-muted" />}
              </button>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {forklift.forklift_no && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                    {forklift.forklift_no}
                  </span>
                )}
                {forklift.customer_forklift_no && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    Customer #{forklift.customer_forklift_no}
                  </span>
                )}
              </div>
              <h3 className="mt-2 font-bold text-theme group-hover:text-blue-600 transition-colors">
                {forklift.make} {forklift.model}
              </h3>
              <p className="text-sm text-theme-muted font-mono">{forklift.serial_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusBadge(forklift.status)}`}>
              {getStatusIcon(forklift.status)}
              {forklift.status}
            </span>
            {!isSelectionMode && <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-blue-500" />}
          </div>
        </div>
      </div>

      {/* Current Customer Badge */}
      {currentCustomer && (
        <div className="px-4 py-2.5 bg-blue-50/70 border-b border-blue-100">
          <div className="flex items-center gap-2 text-blue-700">
            <Building2 className="w-4 h-4" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">Current customer</p>
              <span className="text-sm font-medium truncate block">{currentCustomer.name}</span>
            </div>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadge(forklift.type)}`}>{forklift.type}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${currentCustomer ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {currentCustomer ? 'On Rent' : 'Ready'}
          </span>
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
          {siteLabel && (
            <div className="flex items-center gap-2 text-theme-muted col-span-2">
              <MapPin className="w-4 h-4 opacity-60" />
              <span className="truncate">{siteLabel}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-theme-muted">
          {forklift.capacity_kg && forklift.capacity_kg > 0 && (
            <span>Capacity {forklift.capacity_kg.toLocaleString()} kg</span>
          )}
          {currentCustomer && siteLabel && (
            <span className="truncate max-w-full">Site {siteLabel}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isSelectionMode && (
        <div className="px-4 py-3 bg-theme-surface-2 border-t border-theme flex justify-between items-center gap-3">
          <div>
            {!currentCustomer && (
              <button onClick={(e) => onAssign(forklift, e)} className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                <Building2 className="w-4 h-4" /> Rent Out
              </button>
            )}
            {currentCustomer && onReturn && (
              <button onClick={(e) => onReturn(forklift, e)} className="flex items-center gap-1.5 text-sm bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 font-medium shadow-sm">
                <Building2 className="w-4 h-4" /> Return
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-theme-muted hidden sm:inline">View details</span>
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
        </div>
      )}
    </div>
  );
};

export default ForkliftCard;

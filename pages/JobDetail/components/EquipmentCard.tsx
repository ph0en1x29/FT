import { AlertTriangle,Edit2,Gauge,Save,Truck,X } from 'lucide-react';
import React from 'react';
import { Job } from '../../../types';
import { RoleFlags,StatusFlags } from '../types';

interface EquipmentCardProps {
  job: Job;
  activeRental: { rental_id: string; customer_name: string; rental_location: string; start_date: string; } | null;
  currentUserId: string;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  // Hourmeter editing state
  editingHourmeter: boolean;
  hourmeterInput: string;
  onHourmeterInputChange: (value: string) => void;
  onStartEditHourmeter: () => void;
  onSaveHourmeter: () => void;
  onCancelHourmeterEdit: () => void;
  onRequestAmendment: () => void;
}

export const EquipmentCard: React.FC<EquipmentCardProps> = ({
  job,
  activeRental,
  currentUserId,
  roleFlags,
  statusFlags,
  editingHourmeter,
  hourmeterInput,
  onHourmeterInputChange,
  onStartEditHourmeter,
  onSaveHourmeter,
  onCancelHourmeterEdit,
  onRequestAmendment,
}) => {
  const { isAdmin, isSupervisor, isTechnician } = roleFlags;
  const { isInProgress, isCompleted } = statusFlags;
  
  if (!job.forklift) return null;

  const canEditHourmeter = (isInProgress || (isAdmin && !isCompleted)) && (
    !job.first_hourmeter_recorded_by_id || // No one recorded yet
    job.first_hourmeter_recorded_by_id === currentUserId || // Current user recorded it
    isAdmin || isSupervisor // Admins can always edit
  );

  return (
    <div className="card-premium card-tint-warning p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--warning-bg)] flex items-center justify-center">
          <Truck className="w-5 h-5 text-[var(--warning)]" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--text)]">Equipment</h3>
          <p className="text-xs text-[var(--text-muted)]">{job.forklift.make} {job.forklift.model}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div>
          <p className="label-premium mb-1">Serial Number</p>
          <p className="font-mono value-premium">{job.forklift.serial_number}</p>
        </div>
        <div>
          <p className="label-premium mb-1">Type</p>
          <p className="value-premium-secondary">{job.forklift.type}</p>
        </div>
        <div>
          <p className="label-premium mb-1 flex items-center gap-1">
            <Gauge className="w-3 h-3" /> Hourmeter
          </p>
          {editingHourmeter ? (
            <div className="flex items-center gap-1">
              <input 
                type="number" 
                className="input-premium w-20 text-sm py-1" 
                value={hourmeterInput} 
                onChange={(e) => onHourmeterInputChange(e.target.value)} 
                autoFocus 
              />
              <button onClick={onSaveHourmeter} className="p-1 text-[var(--success)] hover:bg-[var(--success-bg)] rounded">
                <Save className="w-3.5 h-3.5" />
              </button>
              <button onClick={onCancelHourmeterEdit} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1">
                <span className={`font-semibold ${job.hourmeter_flagged ? 'text-[var(--error)]' : 'text-[var(--text)]'}`}>
                  {(job.hourmeter_reading || job.forklift.hourmeter).toLocaleString()} hrs
                </span>
{/* Last service hourmeter moved to its own field below */}
                {job.hourmeter_flagged && (
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--error)]" />
                )}
                {canEditHourmeter && (
                  <button onClick={onStartEditHourmeter} className="p-1 text-[var(--warning)] hover:bg-[var(--warning-bg)] rounded">
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {/* Show who recorded the hourmeter (for subsequent technicians) */}
              {job.first_hourmeter_recorded_by_id && job.first_hourmeter_recorded_by_id !== currentUserId && isTechnician && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Recorded by {job.first_hourmeter_recorded_by_name || 'Another technician'}
                </p>
              )}
              
              {/* Amendment button for technicians who didn't record it */}
              {job.first_hourmeter_recorded_by_id && job.first_hourmeter_recorded_by_id !== currentUserId && isTechnician && (
                <button
                  onClick={onRequestAmendment}
                  className="mt-1 text-xs text-[var(--accent)] hover:underline"
                >
                  Request Amendment
                </button>
              )}
              
              {/* Hourmeter flag warning */}
              {job.hourmeter_flagged && job.hourmeter_flag_reasons && job.hourmeter_flag_reasons.length > 0 && (
                <div className="mt-1">
                  <div className="flex flex-wrap gap-1 text-xs">
                    {job.hourmeter_flag_reasons.map((flag) => (
                      <span key={flag} className="px-1.5 py-0.5 bg-[var(--error-bg)] text-[var(--error)] rounded">
                        {flag === 'lower_than_previous' ? 'Lower' : flag === 'excessive_jump' ? 'High Jump' : flag}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={onRequestAmendment}
                    className="mt-1 text-xs text-[var(--accent)] hover:underline"
                  >
                    Request Amendment
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {job.forklift.last_service_hourmeter != null && job.forklift.last_service_hourmeter > 0 && (
          <div>
            <p className="label-premium mb-1 flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Last Serviced Hour
            </p>
            <p className="font-semibold text-[var(--text)]">
              {job.forklift.last_service_hourmeter.toLocaleString()} hrs
            </p>
            {job.forklift.last_service_date && (
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {new Date(job.forklift.last_service_date).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
        {activeRental && (
          <div>
            <p className="label-premium mb-1">Location</p>
            <p className="text-[var(--text-secondary)] text-sm">{activeRental.rental_location || activeRental.customer_name}</p>
          </div>
        )}
      </div>
    </div>
  );
};

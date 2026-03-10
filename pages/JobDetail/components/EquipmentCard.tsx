import { AlertTriangle,Edit2,Gauge,RefreshCw,Save,Truck,X } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { Combobox,ComboboxOption } from '../../../components/Combobox';
import { getForkliftsForList } from '../../../services/forkliftService';
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
  // Forklift switching
  onSwitchForklift?: (forkliftId: string) => void;
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
  onSwitchForklift,
}) => {
  const { isAdmin, isSupervisor, isTechnician } = roleFlags;
  const { isNew, isAssigned, isInProgress, isCompleted } = statusFlags;
  
  const [switchingForklift, setSwitchingForklift] = useState(false);
  const [availableForklifts, setAvailableForklifts] = useState<ComboboxOption[]>([]);
  const [selectedForkliftId, setSelectedForkliftId] = useState('');
  
  // Can switch forklift if: Admin + Job not started (New or Assigned)
  const canSwitchForklift = isAdmin && (isNew || isAssigned) && !isInProgress && !isCompleted && onSwitchForklift;

  // Fetch available forklifts when switching mode is enabled
  useEffect(() => {
    if (switchingForklift && job.customer_id) {
      getForkliftsForList()
        .then(forklifts => {
          // Filter to forklifts rented by this job's customer
          const customerForklifts = forklifts.filter(f => f.current_customer_id === job.customer_id);
          const options: ComboboxOption[] = customerForklifts.map(f => ({
            id: f.forklift_id,
            label: f.forklift_no || f.serial_number,
            subLabel: `${f.make} ${f.model} - ${f.type}`,
          }));
          setAvailableForklifts(options);
        })
        .catch(err => {
          console.error('Failed to fetch forklifts:', err);
          setAvailableForklifts([]);
        });
    }
  }, [switchingForklift, job.customer_id]);

  const handleForkliftChange = (forkliftId: string) => {
    if (forkliftId && onSwitchForklift) {
      onSwitchForklift(forkliftId);
      setSwitchingForklift(false);
      setSelectedForkliftId('');
    }
  };

  if (!job.forklift) return null;

  const canEditHourmeter = (isInProgress || (isAdmin && !isCompleted)) && (
    !job.first_hourmeter_recorded_by_id || // No one recorded yet
    job.first_hourmeter_recorded_by_id === currentUserId || // Current user recorded it
    isAdmin || isSupervisor // Admins can always edit
  );

  return (
    <div className="card-premium card-tint-warning p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--warning-bg)] flex items-center justify-center shrink-0">
          <Truck className="w-4 h-4 text-[var(--warning)]" />
        </div>
        {switchingForklift ? (
          <div className="flex-1">
            <Combobox
              options={availableForklifts}
              value={selectedForkliftId}
              onChange={handleForkliftChange}
              placeholder="Select forklift..."
            />
            <button 
              onClick={() => setSwitchingForklift(false)} 
              className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-[var(--text)]">Equipment</h3>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-[var(--text-muted)] truncate">{job.forklift.make} {job.forklift.model}</p>
              {canSwitchForklift && (
                <button 
                  onClick={() => setSwitchingForklift(true)} 
                  className="p-1 text-[var(--warning)] hover:bg-[var(--warning-bg)] rounded transition-colors"
                  title="Switch forklift"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Customer Forklift No & Site Info */}
      {(job.forklift.customer_forklift_no || activeRental?.rental_location) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {job.forklift.customer_forklift_no && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              Customer No: {job.forklift.customer_forklift_no}
            </span>
          )}
          {activeRental?.rental_location && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              Site: {activeRental.rental_location}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div>
          <p className="label-premium mb-0.5">Serial Number</p>
          <p className="font-mono value-premium text-sm">{job.forklift.serial_number}</p>
        </div>
        {job.forklift.forklift_no && (
          <div>
            <p className="label-premium mb-0.5">Forklift No</p>
            <p className="font-mono value-premium text-sm">{job.forklift.forklift_no}</p>
          </div>
        )}
        <div>
          <p className="label-premium mb-0.5">Type</p>
          <p className="value-premium-secondary text-sm">{job.forklift.type}</p>
        </div>
        <div>
          <p className="label-premium mb-0.5 flex items-center gap-1">
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
            <p className="label-premium mb-0.5 flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Last Service
            </p>
            <p className="font-semibold text-sm text-[var(--text)]">
              {job.forklift.last_service_hourmeter.toLocaleString()} hrs
            </p>
            {job.forklift.last_service_date && (
              <p className="text-[10px] text-[var(--text-muted)]">
                {new Date(job.forklift.last_service_date).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

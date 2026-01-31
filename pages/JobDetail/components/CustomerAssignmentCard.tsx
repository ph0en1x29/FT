import React from 'react';
import { Job, User } from '../../../types';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { UserIcon, MapPin, Phone, UserPlus, RefreshCw } from 'lucide-react';
import { RoleFlags, StatusFlags } from '../types';

interface CustomerAssignmentCardProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  techOptions: ComboboxOption[];
  selectedTechId: string;
  onSelectedTechIdChange: (id: string) => void;
  onAssignJob: () => void;
  onOpenReassignModal: () => void;
}

export const CustomerAssignmentCard: React.FC<CustomerAssignmentCardProps> = ({
  job,
  roleFlags,
  statusFlags,
  techOptions,
  selectedTechId,
  onSelectedTechIdChange,
  onAssignJob,
  onOpenReassignModal,
}) => {
  return (
    <div className="card-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text)]">Customer</h3>
            {job.customer ? (
              <p className="text-sm text-[var(--text-secondary)]">{job.customer.name}</p>
            ) : (
              <p className="text-sm text-[var(--warning)]">No customer assigned</p>
            )}
          </div>
        </div>
        {job.customer?.phone && (
          <a href={`tel:${job.customer.phone}`} className="btn-premium btn-premium-ghost text-xs">
            <Phone className="w-3.5 h-3.5" /> Call
          </a>
        )}
      </div>
      
      {job.customer && (
        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <span className="text-[var(--text-secondary)]">{job.customer.address}</span>
          </div>
        </div>
      )}

      <div className="divider"></div>

      <div>
        <p className="label-premium mb-2">Description</p>
        <p className="text-[var(--text-secondary)] text-sm">{job.description}</p>
      </div>

      {/* Assign Technician */}
      {(roleFlags.isAdmin || roleFlags.isSupervisor) && statusFlags.isNew && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" /> Assign Technician
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Combobox options={techOptions} value={selectedTechId} onChange={onSelectedTechIdChange} placeholder="Select Technician..." />
            </div>
            <button onClick={onAssignJob} disabled={!selectedTechId} className="btn-premium btn-premium-primary disabled:opacity-50">Assign</button>
          </div>
        </div>
      )}

      {/* Current Assignment */}
      {roleFlags.canReassign && job.assigned_technician_id && !statusFlags.isCompleted && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-subtle)] p-3 flex justify-between items-center">
            <div>
              <p className="label-premium mb-1">Assigned Technician</p>
              <p className="value-premium">{job.assigned_technician_name}</p>
            </div>
            <button onClick={onOpenReassignModal} className="chip-premium chip-premium-accent">
              <RefreshCw className="w-3.5 h-3.5" /> Reassign
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

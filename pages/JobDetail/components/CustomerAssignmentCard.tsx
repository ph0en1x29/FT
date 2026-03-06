import { Building2,MapPin,Phone,RefreshCw,UserCheck,UserPlus,X } from 'lucide-react';
import React from 'react';
import { Combobox,ComboboxOption } from '../../../components/Combobox';
import { Job } from '../../../types';
import { CustomerContact,CustomerSite } from '../../../types/customer.types';
import { RoleFlags,StatusFlags } from '../types';

interface CustomerAssignmentCardProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  techOptions: ComboboxOption[];
  selectedTechId: string;
  isCurrentUserHelper?: boolean;
  jobContact?: CustomerContact;
  jobSite?: CustomerSite;
  onSelectedTechIdChange: (id: string) => void;
  onAssignJob: () => void;
  onOpenReassignModal: () => void;
  onOpenHelperModal?: () => void;
  onRemoveHelper?: () => void;
}

export const CustomerAssignmentCard: React.FC<CustomerAssignmentCardProps> = ({
  job,
  roleFlags,
  statusFlags,
  techOptions,
  selectedTechId,
  isCurrentUserHelper = false,
  jobContact,
  jobSite,
  onSelectedTechIdChange,
  onAssignJob,
  onOpenReassignModal,
  onOpenHelperModal,
  onRemoveHelper,
}) => {
  const contactPhone = jobContact?.phone || job.customer?.phone;
  const contactName = jobContact?.name || job.customer?.contact_person;
  const siteAddress = jobSite?.address || job.customer?.address;

  return (
    <div className="card-premium p-4">
      {/* Top row: Customer + PIC + Call — all inline */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span className="font-bold text-sm text-[var(--text)] truncate">{job.customer?.name || 'No customer'}</span>
          {contactName && (
            <>
              <span className="text-[var(--text-muted)]">·</span>
              <UserCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-sm text-[var(--text-secondary)] truncate">{contactName}</span>
              {jobContact?.role && <span className="text-xs text-[var(--text-muted)]">({jobContact.role})</span>}
            </>
          )}
        </div>
        {contactPhone && (
          <a
            href={`tel:${contactPhone}`}
            className="inline-flex items-center gap-1 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 active:bg-green-200 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" /> {contactPhone}
          </a>
        )}
      </div>

      {/* Site + Description — compact row */}
      {(jobSite || siteAddress || job.description) && (
        <div className="mt-2 flex items-start gap-4 text-xs text-[var(--text-muted)]">
          {(jobSite || siteAddress) && (
            <span className="inline-flex items-start gap-1 shrink-0">
              <MapPin className="w-3 h-3 mt-0.5 text-amber-500" />
              <span>{jobSite ? `${jobSite.site_name} — ${siteAddress}` : siteAddress}</span>
            </span>
          )}
          {job.description && (jobSite || siteAddress) && <span className="text-[var(--border-subtle)]">|</span>}
          {job.description && <span className="truncate">{job.description}</span>}
        </div>
      )}

      {/* Assign Technician */}
      {(roleFlags.isAdmin || roleFlags.isSupervisor) && statusFlags.isNew && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex gap-2">
            <div className="flex-1">
              <Combobox options={techOptions} value={selectedTechId} onChange={onSelectedTechIdChange} placeholder="Assign technician..." />
            </div>
            <button onClick={onAssignJob} disabled={!selectedTechId} className="btn-premium btn-premium-primary disabled:opacity-50 text-sm px-4">Assign</button>
          </div>
        </div>
      )}

      {/* Current Assignment */}
      {roleFlags.canReassign && job.assigned_technician_id && !statusFlags.isCompleted && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-muted)]">Tech:</span>
            <span className="font-semibold text-[var(--text)]">{job.assigned_technician_name}</span>
          </div>
          <button onClick={onOpenReassignModal} className="chip-premium chip-premium-accent text-xs">
            <RefreshCw className="w-3 h-3" /> Reassign
          </button>
        </div>
      )}

      {/* Helper Section */}
      {(statusFlags.isInProgress || statusFlags.isAwaitingFinalization) && (
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-muted)]">Helper:</span>
            {job.helper_assignment ? (
              <span className="font-semibold text-[var(--text)]">{job.helper_assignment.technician?.name || 'Unknown'}</span>
            ) : (
              <span className="text-[var(--text-muted)] italic">None</span>
            )}
          </div>
          {roleFlags.canReassign && (
            job.helper_assignment ? (
              <button onClick={onRemoveHelper} className="chip-premium chip-premium-danger text-xs">
                <X className="w-3 h-3" /> Remove
              </button>
            ) : (
              <button onClick={onOpenHelperModal} className="chip-premium chip-premium-warning text-xs">
                <UserPlus className="w-3 h-3" /> Add
              </button>
            )
          )}
          {isCurrentUserHelper && (
            <span className="text-xs text-[var(--warning)] ml-2">(You — photos only)</span>
          )}
        </div>
      )}
    </div>
  );
};

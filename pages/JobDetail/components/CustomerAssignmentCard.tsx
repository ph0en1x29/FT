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
    <div className="card-premium card-tint-accent p-4">
      {/* Header — same pattern as Equipment card */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-blue-600" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-[var(--text)]">{job.customer?.name || 'No customer'}</h3>
          {job.customer?.account_number && (
            <p className="text-xs text-[var(--text-muted)]">A/C: {job.customer.account_number}</p>
          )}
        </div>
      </div>

      {/* Grid of fields — matches Equipment card layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* PIC */}
        <div>
          <p className="label-premium mb-0.5 flex items-center gap-1">
            <UserCheck className="w-3 h-3" /> PIC
          </p>
          {contactName ? (
            <div>
              <p className="value-premium text-sm">{contactName}</p>
              {jobContact?.role && <p className="text-[10px] text-[var(--text-muted)]">{jobContact.role}</p>}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">—</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <p className="label-premium mb-0.5 flex items-center gap-1">
            <Phone className="w-3 h-3" /> Phone
          </p>
          {contactPhone ? (
            <a
              href={`tel:${contactPhone}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-800 active:text-green-900"
            >
              {contactPhone}
            </a>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">—</p>
          )}
        </div>

        {/* Site */}
        <div>
          <p className="label-premium mb-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Site
          </p>
          {jobSite ? (
            <p className="value-premium text-sm">{jobSite.site_name}</p>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">—</p>
          )}
        </div>

        {/* Address */}
        <div>
          <p className="label-premium mb-0.5">Address</p>
          {siteAddress ? (
            <p className="value-premium-secondary text-sm leading-tight">{siteAddress}</p>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">—</p>
          )}
        </div>
      </div>

      {/* Description */}
      {job.description && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <p className="label-premium mb-0.5">Description</p>
          <p className="text-[var(--text-secondary)] text-sm">{job.description}</p>
        </div>
      )}

      {/* Assign Technician */}
      {(roleFlags.isAdmin || roleFlags.isSupervisor) && statusFlags.isNew && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <p className="label-premium mb-2 flex items-center gap-1">
            <UserPlus className="w-3 h-3" /> Assign Technician
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
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-subtle)] p-3 flex justify-between items-center">
            <div>
              <p className="label-premium mb-0.5">Assigned Technician</p>
              <p className="value-premium">{job.assigned_technician_name}</p>
            </div>
            <button onClick={onOpenReassignModal} className="chip-premium chip-premium-accent">
              <RefreshCw className="w-3.5 h-3.5" /> Reassign
            </button>
          </div>
        </div>
      )}

      {/* Helper Section */}
      {(statusFlags.isInProgress || statusFlags.isAwaitingFinalization) && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className={`rounded-xl border border-[var(--border-subtle)] p-3 flex justify-between items-center ${
            job.helper_assignment ? 'bg-[var(--bg-subtle)]' : 'bg-[var(--warning-bg)]'
          }`}>
            <div>
              <p className="label-premium mb-0.5">Helper Technician</p>
              {job.helper_assignment ? (
                <p className="value-premium">{job.helper_assignment.technician?.name || 'Unknown'}</p>
              ) : (
                <p className="text-[var(--text-muted)] text-sm">No helper assigned</p>
              )}
            </div>
            {roleFlags.canReassign && (
              job.helper_assignment ? (
                <button onClick={onRemoveHelper} className="chip-premium chip-premium-danger">
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              ) : (
                <button onClick={onOpenHelperModal} className="chip-premium chip-premium-warning">
                  <UserPlus className="w-3.5 h-3.5" /> Add Helper
                </button>
              )
            )}
          </div>
          {isCurrentUserHelper && (
            <div className="mt-2 p-2 bg-[var(--warning-bg)] rounded-lg text-xs text-[var(--warning)]">
              <strong>You are the helper.</strong> You can upload photos only.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

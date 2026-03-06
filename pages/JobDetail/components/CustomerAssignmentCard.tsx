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
    <div className="card-premium overflow-hidden">
      {/* Customer Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[var(--text)]">{job.customer?.name || 'No customer'}</h3>
            {job.customer?.account_number && (
              <p className="text-xs text-[var(--text-muted)]">A/C: {job.customer.account_number}</p>
            )}
          </div>
        </div>
      </div>

      {/* Contact & Site Info */}
      <div className="px-5 py-4 space-y-3">
        {/* PIC row */}
        {contactName && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text)] truncate">{contactName}</p>
                {jobContact?.role && <p className="text-xs text-[var(--text-muted)]">{jobContact.role}</p>}
              </div>
            </div>
            {contactPhone && (
              <a
                href={`tel:${contactPhone}`}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-2 text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 active:bg-green-200 transition-colors shadow-sm"
              >
                <Phone className="w-4 h-4" /> {contactPhone}
              </a>
            )}
          </div>
        )}

        {/* Site/Address row */}
        {(jobSite || siteAddress) && (
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              {jobSite && <p className="text-sm font-semibold text-[var(--text)]">{jobSite.site_name}</p>}
              {siteAddress && <p className="text-xs text-[var(--text-muted)] leading-relaxed">{siteAddress}</p>}
            </div>
          </div>
        )}

        {/* No contact info fallback */}
        {!contactName && !jobSite && !siteAddress && job.customer && (
          <p className="text-sm text-[var(--text-muted)] italic">No contact or site info</p>
        )}
      </div>

      {/* Description */}
      <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-slate-50/50">
        <p className="label-premium mb-1">Description</p>
        <p className="text-[var(--text-secondary)] text-sm">{job.description || '—'}</p>
      </div>

      {/* Assign Technician */}
      {(roleFlags.isAdmin || roleFlags.isSupervisor) && statusFlags.isNew && (
        <div className="px-5 py-4 border-t border-[var(--border-subtle)]">
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
        <div className="px-5 py-3 border-t border-[var(--border-subtle)]">
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
        <div className="px-5 py-3 border-t border-[var(--border-subtle)]">
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
              <>
                {job.helper_assignment ? (
                  <button onClick={onRemoveHelper} className="chip-premium chip-premium-danger">
                    <X className="w-3.5 h-3.5" /> Remove
                  </button>
                ) : (
                  <button onClick={onOpenHelperModal} className="chip-premium chip-premium-warning">
                    <UserPlus className="w-3.5 h-3.5" /> Add Helper
                  </button>
                )}
              </>
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

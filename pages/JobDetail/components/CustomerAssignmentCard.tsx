import { Building2,CalendarClock,Check,Edit2,MapPin,Navigation,Phone,RefreshCw,Send,UserCheck,UserPlus,X } from 'lucide-react';
import React from 'react';
import { Combobox,ComboboxOption } from '../../../components/Combobox';
import { DatePicker, formatMalaysiaDateLabel } from '../../../components/DatePicker';
import { Job, JobType } from '../../../types';
import { CREATABLE_JOB_TYPES, JOB_TYPE_LABEL, jobTypeLabel } from '../../../types/job-core.types';
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
  editingDescription: boolean;
  descriptionInput: string;
  onDescriptionInputChange: (v: string) => void;
  onStartEditDescription: () => void;
  onSaveDescription: () => void;
  onCancelDescriptionEdit: () => void;
  // Job type edit (admin/admin_service only, pre-start statuses)
  editingJobType?: boolean;
  jobTypeInput?: JobType | '';
  onJobTypeInputChange?: (v: JobType) => void;
  onStartEditJobType?: () => void;
  onSaveJobType?: () => void;
  onCancelJobTypeEdit?: () => void;
  onSelectedTechIdChange: (id: string) => void;
  onAssignJob: () => void;
  onOpenReassignModal: () => void;
  onOpenTransferModal?: () => void;
  onOpenHelperModal?: () => void;
  onRemoveHelper?: () => void;
  onScheduledDateChange?: (iso: string) => void;
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
  editingDescription,
  descriptionInput,
  onDescriptionInputChange,
  onStartEditDescription,
  onSaveDescription,
  onCancelDescriptionEdit,
  editingJobType,
  jobTypeInput,
  onJobTypeInputChange,
  onStartEditJobType,
  onSaveJobType,
  onCancelJobTypeEdit,
  onSelectedTechIdChange,
  onAssignJob,
  onOpenReassignModal,
  onOpenTransferModal,
  onOpenHelperModal,
  onRemoveHelper,
  onScheduledDateChange,
}) => {
  // Lead technicians need a calm read-only view of the scheduled date too.
  // Only admins/supervisors can edit it, and only while the job is still unstarted.
  const canEditScheduledDate =
    !!onScheduledDateChange &&
    (roleFlags.isAdmin || roleFlags.isSupervisor) &&
    (statusFlags.isNew || statusFlags.isAssigned);
  const hasScheduledDate = !!job.scheduled_date;
  // Job type is editable only by admin/admin_service before the tech starts work.
  // Mirrors the scheduled-date gate above and the description-edit gate below.
  const canEditJobType =
    !!onStartEditJobType &&
    roleFlags.isAdminService &&
    (statusFlags.isNew || statusFlags.isAssigned);
  const contactPhone = jobContact?.phone || job.customer?.phone;
  const contactName = jobContact?.name || job.customer?.contact_person;
  const siteAddress = jobSite?.address;

  return (
    <div className="card-premium card-tint-accent p-4">
      {/* Header — same pattern as Equipment card */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-blue-600" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-[var(--text)]">{roleFlags.canViewCustomerName ? (job.customer?.name || 'No customer') : 'Customer'}</h3>
          {roleFlags.canViewCustomerName && job.customer?.account_number && (
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
            <div className="flex items-start gap-2">
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(siteAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="value-premium-secondary text-sm leading-tight text-blue-400 hover:text-blue-300 underline underline-offset-2 flex-1"
              >
                {siteAddress}
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(siteAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-muted)] hover:text-blue-400 transition-colors shrink-0 mt-0.5"
                title="Open in Google Maps"
              >
                <MapPin className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">—</p>
          )}
        </div>
      </div>

      {/* Navigate button — uses lat/lng if available */}
      {jobSite?.latitude && jobSite?.longitude && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${jobSite.latitude},${jobSite.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors"
          >
            <Navigation className="w-4 h-4" />
            Navigate to Site
          </a>
        </div>
      )}

      {/* Job Type — visible to all, editable by admin/admin_service while unstarted */}
      {(job.job_type || canEditJobType) && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-0.5">
            <p className="label-premium">Job Type</p>
            {canEditJobType && !editingJobType && (
              <button
                type="button"
                onClick={onStartEditJobType}
                className="btn-premium btn-premium-ghost text-xs"
                title="Editable until the tech starts the job"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
          </div>
          {editingJobType ? (
            <div className="space-y-2">
              <Combobox
                options={CREATABLE_JOB_TYPES.map(t => ({ id: t, label: JOB_TYPE_LABEL[t] }))}
                value={jobTypeInput || ''}
                onChange={(val) => onJobTypeInputChange?.(val as JobType)}
                placeholder="Select job type..."
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancelJobTypeEdit} className="btn-premium btn-premium-ghost text-xs">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={onSaveJobType}
                  disabled={!jobTypeInput || jobTypeInput === job.job_type}
                  className="btn-premium btn-premium-primary text-xs disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] text-sm">
              {jobTypeLabel(job.job_type) || <span className="text-[var(--text-muted)] italic">Not set</span>}
            </p>
          )}
        </div>
      )}

      {/* Description */}
      {(job.description || roleFlags.isAdminService) && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between mb-0.5">
            <p className="label-premium">Description</p>
            {roleFlags.isAdminService && !statusFlags.isCompleted && !editingDescription && (
              <button
                type="button"
                onClick={onStartEditDescription}
                className="btn-premium btn-premium-ghost text-xs"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
          </div>
          {editingDescription ? (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={descriptionInput}
                onChange={e => onDescriptionInputChange(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancelDescriptionEdit} className="btn-premium btn-premium-ghost text-xs">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button type="button" onClick={onSaveDescription} className="btn-premium btn-premium-primary text-xs">
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] text-sm">{job.description || <span className="text-[var(--text-muted)] italic">No description</span>}</p>
          )}
        </div>
      )}

      {/* Scheduled Date — visible to all, editable by admin/supervisor while unstarted */}
      {(canEditScheduledDate || hasScheduledDate) && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="label-premium mb-0.5 flex items-center gap-1">
                <CalendarClock className="w-3 h-3" /> Scheduled Date
              </p>
              {hasScheduledDate ? (
                <p className="value-premium text-sm">{formatMalaysiaDateLabel(job.scheduled_date)}</p>
              ) : (
                <p className="text-sm text-[var(--text-muted)] italic">Not scheduled</p>
              )}
              {hasScheduledDate && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Technician reminded at 7:30 AM MYT</p>
              )}
            </div>
            {canEditScheduledDate && (
              <div className="shrink-0">
                <DatePicker
                  value={job.scheduled_date}
                  onChange={(iso) => onScheduledDateChange?.(iso)}
                  placeholder={hasScheduledDate ? 'Change…' : 'Set date'}
                  compact
                  allowClear
                />
              </div>
            )}
          </div>
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
            <div className="flex flex-col gap-1.5">
              <button type="button" onClick={onOpenReassignModal} className="chip-premium chip-premium-accent cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5" /> Reassign
              </button>
              {onOpenTransferModal && (roleFlags.isAdmin || roleFlags.isSupervisor) && (
                <button
                  type="button"
                  onClick={onOpenTransferModal}
                  className="chip-premium chip-premium-warning cursor-pointer"
                  title="Transfer (KPI): clones the job to a new -B/-C and freezes this one. Use when receiving tech should start a fresh timer."
                >
                  <Send className="w-3.5 h-3.5" /> Transfer
                </button>
              )}
            </div>
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

// =============================================
// JOB / JOB REQUEST / JOB PARTS TYPES
// Re-exports from split files for backward compatibility
// =============================================

export {
  JobStatus,
  JobPriority,
  JobType,
  SERVICE_RESET_JOB_TYPES,
  DEFAULT_DURATION_ALERTS,
} from './job-core.types';

export type {
  PhotoRequirements,
  DurationAlertConfig,
  ExtraCharge,
  JobAssignment,
  JobMedia,
  Job,
  CourierItem,
} from './job-core.types';

export {
  MANDATORY_CHECKLIST_ITEMS,
} from './job-validation.types';

export type {
  JobTypeChangeStatus,
  JobTypeChangeRequest,
  JobTypeChangeLog,
  DeletedJob,
  ChecklistValidation,
} from './job-validation.types';

export type {
  JobRequestType,
  JobRequestStatus,
  JobRequest,
} from './job-request.types';

export {
  DEFAULT_HOURMETER_CONFIG,
} from './job-hourmeter.types';

export type {
  HourmeterAmendmentStatus,
  HourmeterFlagReason,
  HourmeterAmendment,
  HourmeterValidationConfig,
  HourmeterHistoryEntry,
} from './job-hourmeter.types';

export type {
  QuotationItem,
  Quotation,
  TechnicianKPI,
  EnhancedTechnicianKPI,
} from './job-quotation.types';

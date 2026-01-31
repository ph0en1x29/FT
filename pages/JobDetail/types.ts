import { Job, User, Part, JobRequest, VanStock, HourmeterFlagReason, ForkliftConditionChecklist } from '../../types';
import { ComboboxOption } from '../../components/Combobox';

export interface JobDetailProps {
  currentUser: User;
}

// Role-based permission flags
export interface RoleFlags {
  isAdmin: boolean;
  isAdminService: boolean;
  isAdminStore: boolean;
  isSupervisor: boolean;
  isTechnician: boolean;
  isAccountant: boolean;
  canReassign: boolean;
  isHelperOnly: boolean;
  canViewPricing: boolean;
  canEditPrices: boolean;
  canAddParts: boolean;
}

// Status flags for the job
export interface StatusFlags {
  isNew: boolean;
  isAssigned: boolean;
  isInProgress: boolean;
  isAwaitingFinalization: boolean;
  isCompleted: boolean;
  isIncompleteContinuing: boolean;
  isIncompleteReassigned: boolean;
  isEscalated: boolean;
  isOvertime: boolean;
  isAwaitingAck: boolean;
  isDisputed: boolean;
  isDeferred: boolean;
  hasBothSignatures: boolean;
  isSlotIn: boolean;
  isSlotInPendingAck: boolean;
  isAssignedToCurrentUser: boolean;
  needsAcceptance: boolean;
  hasAccepted: boolean;
}

// Common props for sub-components
export interface JobSectionProps {
  job: Job;
  currentUserId: string;
  currentUserName: string;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  onJobUpdate: (job: Job) => void;
}

// Extended props including helper data
export interface JobSectionWithDataProps extends JobSectionProps {
  parts: Part[];
  technicians: User[];
  vanStock: VanStock | null;
  isCurrentUserHelper: boolean;
  partOptions: ComboboxOption[];
  techOptions: ComboboxOption[];
}

// Props for request section
export interface RequestSectionProps extends JobSectionProps {
  jobRequests: JobRequest[];
  technicians: User[];
  parts: Part[];
  techOptions: ComboboxOption[];
  onRequestsUpdate: () => void;
}

// Props for checklist section
export interface ChecklistSectionProps extends JobSectionProps {
  editingChecklist: boolean;
  checklistEditData: ForkliftConditionChecklist;
  onStartEdit: () => void;
  onSaveChecklist: () => void;
  onCancelEdit: () => void;
  onChecklistDataChange: (data: ForkliftConditionChecklist) => void;
}

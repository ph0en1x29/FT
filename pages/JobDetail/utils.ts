import { ForkliftConditionChecklist,Job,JobType,MANDATORY_CHECKLIST_ITEMS,normalizeChecklistState } from '../../types';
import { RoleFlags,StatusFlags } from './types';

/**
 * Calculate repair duration from job start/end times
 */
export function getRepairDuration(job: Job | null): { hours: number; minutes: number; total: number } | null {
  if (!job?.repair_start_time) return null;
  const start = new Date(job.repair_start_time);
  const end = job.repair_end_time ? new Date(job.repair_end_time) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes, total: diffMs };
}

/**
 * Get remaining time for technician to accept/reject job
 */
export function getResponseTimeRemaining(job: Job | null): string | null {
  if (!job?.technician_response_deadline) return null;
  const deadline = new Date(job.technician_response_deadline);
  const now = new Date();
  const remaining = deadline.getTime() - now.getTime();
  if (remaining <= 0) return 'Expired';
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get mandatory checklist items that haven't been marked
 */
export function getMissingMandatoryItems(job: Job | null): string[] {
  if (!job?.condition_checklist) return MANDATORY_CHECKLIST_ITEMS as string[];
  const checklist = job.condition_checklist;
  return MANDATORY_CHECKLIST_ITEMS.filter(key => {
    const state = normalizeChecklistState(checklist[key]);
    return state === undefined;
  }) as string[];
}

/**
 * Get checklist completion progress
 */
export function getChecklistProgress(job: Job | null): { checked: number; total: number } {
  if (!job?.condition_checklist) return { checked: 0, total: MANDATORY_CHECKLIST_ITEMS.length };
  const checklist = job.condition_checklist;
  const checked = MANDATORY_CHECKLIST_ITEMS.filter(key => {
    const state = normalizeChecklistState(checklist[key]);
    return state === 'ok' || state === 'not_ok';
  }).length;
  return { checked, total: MANDATORY_CHECKLIST_ITEMS.length };
}

/**
 * Check if a checklist item is mandatory
 */
export function isMandatoryItem(key: string): boolean {
  return MANDATORY_CHECKLIST_ITEMS.includes(key as keyof ForkliftConditionChecklist);
}

/**
 * Derive role flags from current user role
 */
export function getRoleFlags(
  currentUserRole: string,
  isCurrentUserHelper: boolean,
  job: Job | null,
  statusFlags: StatusFlags
): RoleFlags {
  const normalizedRole = (currentUserRole || '').toString().toLowerCase().trim();
  
  const isAdmin = normalizedRole === 'admin' || normalizedRole === 'admin_service' || normalizedRole === 'admin_store';
  const isAdminService = normalizedRole === 'admin_service' || normalizedRole === 'admin';
  const isAdminStore = normalizedRole === 'admin_store' || normalizedRole === 'admin';
  const isSupervisor = normalizedRole === 'supervisor';
  const isTechnician = normalizedRole === 'technician';
  const isAccountant = normalizedRole === 'accountant';
  const canReassign = isAdmin || isSupervisor;
  const isHelperOnly = isCurrentUserHelper && !isAdmin && !isSupervisor;
  
  // Pricing visibility - Hide from technicians per customer feedback
  const canViewPricing = isAdmin || isAccountant || isSupervisor;
  
  const canEditPrices =
    canViewPricing &&
    !statusFlags.isCompleted &&
    !isHelperOnly &&
    ((isTechnician && !statusFlags.isAwaitingFinalization) || isAdmin || isAccountant);
  
  // Parts entry: Technicians can only request parts via Spare Part Requests
  // Admins can add parts at any stage (including pre-job for New/Assigned)
  // Supervisors can add parts from Assigned onwards
  // Accountants can only add parts at Awaiting Finalization (for invoice adjustments)
  const jobNotCompleted = !statusFlags.isCompleted;
  const canAddParts =
    !isHelperOnly &&
    !isTechnician &&
    jobNotCompleted &&
    (
      isAdmin || // Admins can add parts at any stage
      (isSupervisor && !statusFlags.isNew) || // Supervisors from Assigned onwards
      (isAccountant && statusFlags.isAwaitingFinalization) // Accountants only at finalization
    );
  
  return {
    isAdmin,
    isAdminService,
    isAdminStore,
    isSupervisor,
    isTechnician,
    isAccountant,
    canReassign,
    isHelperOnly,
    canViewPricing,
    canEditPrices,
    canAddParts,
  };
}

/**
 * Derive status flags from job
 */
export function getStatusFlags(job: Job | null, currentUserId: string, currentUserRole: string): StatusFlags {
  if (!job) {
    return {
      isNew: false,
      isAssigned: false,
      isInProgress: false,
      isAwaitingFinalization: false,
      isCompleted: false,
      isIncompleteContinuing: false,
      isIncompleteReassigned: false,
      isEscalated: false,
      isOvertime: false,
      isAwaitingAck: false,
      isDisputed: false,
      isDeferred: false,
      hasBothSignatures: false,
      hasHourmeter: false,
      hasAfterPhoto: false,
      isSlotIn: false,
      isSlotInPendingAck: false,
      isAssignedToCurrentUser: false,
      needsAcceptance: false,
      hasAccepted: false,
    };
  }
  
  const normalizedStatus = (job.status || '').toString().toLowerCase().trim();
  const normalizedRole = (currentUserRole || '').toString().toLowerCase().trim();
  const isTechnician = normalizedRole === 'technician';
  
  const isNew = normalizedStatus === 'new';
  const isAssigned = normalizedStatus === 'assigned';
  const isInProgress = normalizedStatus === 'in progress' || normalizedStatus === 'in_progress';
  const isAwaitingFinalization = normalizedStatus === 'awaiting finalization' || normalizedStatus === 'awaiting_finalization';
  const isCompleted = normalizedStatus === 'completed';
  const isIncompleteContinuing = normalizedStatus === 'incomplete - continuing' || normalizedStatus === 'incomplete_continuing';
  const isIncompleteReassigned = normalizedStatus === 'incomplete - reassigned' || normalizedStatus === 'incomplete_reassigned';
  const isEscalated = !!job.escalation_triggered_at;
  const isOvertime = job.is_overtime || false;
  const isAwaitingAck = normalizedStatus === 'completed awaiting acknowledgement' || normalizedStatus === 'completed_awaiting_ack';
  const isDisputed = normalizedStatus === 'disputed';
  const isDeferred = job.verification_type === 'deferred' || job.verification_type === 'auto_completed';
  const hasBothSignatures = !!(job.technician_signature && job.customer_signature);
  const hasHourmeter = !!job.hourmeter_reading;
  const hasAfterPhoto = !!job.media?.some(m => m.category === 'after');
  
  // Slot-In SLA tracking
  const isSlotIn = job.job_type === JobType.SLOT_IN;
  const isSlotInPendingAck = isSlotIn && !job.acknowledged_at && !isCompleted;
  const isAssignedToCurrentUser = job.assigned_technician_id === currentUserId;
  
  // Technician accept/reject logic
  const needsAcceptance = isAssigned && isTechnician && !job?.technician_accepted_at && !job?.technician_rejected_at;
  const hasAccepted = isAssigned && !!job?.technician_accepted_at;
  
  return {
    isNew,
    isAssigned,
    isInProgress,
    isAwaitingFinalization,
    isCompleted,
    isIncompleteContinuing,
    isIncompleteReassigned,
    isEscalated,
    isOvertime,
    isAwaitingAck,
    isDisputed,
    isDeferred,
    hasBothSignatures,
    hasHourmeter,
    hasAfterPhoto,
    isSlotIn,
    isSlotInPendingAck,
    isAssignedToCurrentUser,
    needsAcceptance,
    hasAccepted,
  };
}

/**
 * Calculate job financial totals
 */
export function calculateJobTotals(job: Job | null): {
  totalPartsCost: number;
  laborCost: number;
  extraChargesCost: number;
  totalCost: number;
} {
  if (!job) {
    return { totalPartsCost: 0, laborCost: 150, extraChargesCost: 0, totalCost: 150 };
  }
  
  const totalPartsCost = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
  const laborCost = job.labor_cost || 150;
  const extraChargesCost = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
  const totalCost = totalPartsCost + laborCost + extraChargesCost;
  
  return { totalPartsCost, laborCost, extraChargesCost, totalCost };
}

/**
 * Premium status badge styling
 */
export function getStatusBadgeClass(statusFlags: StatusFlags): string {
  if (statusFlags.isCompleted) return 'badge-success';
  if (statusFlags.isAwaitingFinalization) return 'bg-purple-100 text-purple-700';
  if (statusFlags.isInProgress) return 'badge-info';
  if (statusFlags.isAwaitingAck) return 'badge-warning';
  if (statusFlags.isDisputed) return 'badge-error';
  if (statusFlags.isIncompleteContinuing) return 'bg-amber-100 text-amber-700';
  return 'badge-neutral';
}

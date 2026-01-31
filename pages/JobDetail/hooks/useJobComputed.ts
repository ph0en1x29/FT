/**
 * Hook for computed job values - status flags, role flags, costs, etc.
 */

import { useMemo } from 'react';
import { JobType, JobPriority, MANDATORY_CHECKLIST_ITEMS, normalizeChecklistState } from '../../../types';
import { ComboboxOption } from '../../../components/Combobox';
import { useJobDetail } from '../JobDetailContext';

export function useJobComputed() {
  const {
    job,
    currentUser,
    currentUserRole,
    isCurrentUserHelper,
    parts,
    technicians,
    vanStock,
  } = useJobDetail();

  // ===== ROLE FLAGS =====
  const roleFlags = useMemo(() => {
    const normalizedRole = (currentUserRole || '').toString().toLowerCase().trim();
    
    const isAdmin = normalizedRole === 'admin' || normalizedRole === 'admin_service' || normalizedRole === 'admin_store';
    const isAdminService = normalizedRole === 'admin_service' || normalizedRole === 'admin';
    const isAdminStore = normalizedRole === 'admin_store' || normalizedRole === 'admin';
    const isSupervisor = normalizedRole === 'supervisor';
    const isTechnician = normalizedRole === 'technician';
    const isAccountant = normalizedRole === 'accountant';
    const canReassign = isAdmin || isSupervisor;
    const isHelperOnly = isCurrentUserHelper && !isAdmin && !isSupervisor;
    const canViewPricing = isAdmin || isAccountant || isSupervisor;
    
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
    };
  }, [currentUserRole, isCurrentUserHelper]);

  // ===== STATUS FLAGS =====
  const statusFlags = useMemo(() => {
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
        isSlotIn: false,
        isSlotInPendingAck: false,
        isAssignedToCurrentUser: false,
        needsAcceptance: false,
        hasAccepted: false,
      };
    }

    const normalizedStatus = (job.status || '').toString().toLowerCase().trim();
    
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
    const isSlotIn = job.job_type === JobType.SLOT_IN;
    const isSlotInPendingAck = isSlotIn && !job.acknowledged_at && !isCompleted;
    const isAssignedToCurrentUser = job.assigned_technician_id === currentUser.user_id;
    const needsAcceptance = isAssigned && roleFlags.isTechnician && !job.technician_accepted_at && !job.technician_rejected_at;
    const hasAccepted = isAssigned && !!job.technician_accepted_at;

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
      isSlotIn,
      isSlotInPendingAck,
      isAssignedToCurrentUser,
      needsAcceptance,
      hasAccepted,
    };
  }, [job, currentUser.user_id, roleFlags.isTechnician]);

  // ===== CAN EDIT PRICES =====
  const canEditPrices = useMemo(() => {
    if (!job) return false;
    const { canViewPricing, isTechnician, isAdmin, isAccountant, isHelperOnly } = roleFlags;
    const { isCompleted, isAwaitingFinalization } = statusFlags;
    
    return canViewPricing &&
      !isCompleted &&
      !isHelperOnly &&
      ((isTechnician && !isAwaitingFinalization) || isAdmin || isAccountant);
  }, [job, roleFlags, statusFlags]);

  // ===== CAN ADD PARTS =====
  const canAddParts = useMemo(() => {
    if (!job) return false;
    const { isAdmin, isAdminStore, isSupervisor, isTechnician, isAccountant, isHelperOnly } = roleFlags;
    const { isNew, isAssigned, isInProgress, isAwaitingFinalization } = statusFlags;
    
    return !isHelperOnly &&
      !isTechnician &&
      (((isAssigned || isInProgress) && (isAdmin || isSupervisor)) ||
        (isAwaitingFinalization && (isAdmin || isAccountant || isSupervisor)) ||
        ((isNew || isAssigned) && isAdminStore));
  }, [job, roleFlags, statusFlags]);

  // ===== COSTS =====
  const costs = useMemo(() => {
    if (!job) {
      return {
        totalPartsCost: 0,
        laborCost: 150,
        extraChargesCost: 0,
        totalCost: 150,
      };
    }

    const totalPartsCost = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
    const laborCost = job.labor_cost || 150;
    const extraChargesCost = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
    const totalCost = totalPartsCost + laborCost + extraChargesCost;

    return {
      totalPartsCost,
      laborCost,
      extraChargesCost,
      totalCost,
    };
  }, [job]);

  // ===== REPAIR DURATION =====
  const repairDuration = useMemo(() => {
    if (!job?.repair_start_time) return null;
    const start = new Date(job.repair_start_time);
    const end = job.repair_end_time ? new Date(job.repair_end_time) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, total: diffMs };
  }, [job?.repair_start_time, job?.repair_end_time]);

  // ===== CHECKLIST PROGRESS =====
  const checklistProgress = useMemo(() => {
    if (!job?.condition_checklist) return { checked: 0, total: MANDATORY_CHECKLIST_ITEMS.length };
    const checklist = job.condition_checklist;
    const checked = MANDATORY_CHECKLIST_ITEMS.filter(key => {
      const state = normalizeChecklistState(checklist[key]);
      return state === 'ok' || state === 'not_ok';
    }).length;
    return { checked, total: MANDATORY_CHECKLIST_ITEMS.length };
  }, [job?.condition_checklist]);

  // ===== MISSING MANDATORY ITEMS =====
  const missingMandatoryItems = useMemo(() => {
    if (!job?.condition_checklist) return MANDATORY_CHECKLIST_ITEMS as string[];
    const checklist = job.condition_checklist;
    return MANDATORY_CHECKLIST_ITEMS.filter(key => {
      const state = normalizeChecklistState(checklist[key]);
      return state === undefined;
    }) as string[];
  }, [job?.condition_checklist]);

  // ===== COMBOBOX OPTIONS =====
  const partOptions: ComboboxOption[] = useMemo(() => {
    return parts.map(p => ({
      id: p.part_id,
      label: p.part_name,
      subLabel: roleFlags.canViewPricing
        ? `RM${p.sell_price} | Stock: ${p.stock_quantity} | ${p.category}`
        : `Stock: ${p.stock_quantity} | ${p.category}`
    }));
  }, [parts, roleFlags.canViewPricing]);

  const techOptions: ComboboxOption[] = useMemo(() => {
    return technicians.map(t => ({ id: t.user_id, label: t.name, subLabel: t.email }));
  }, [technicians]);

  const vanStockOptions: ComboboxOption[] = useMemo(() => {
    return (vanStock?.items || [])
      .filter(item => item.quantity > 0)
      .map(item => ({
        id: item.item_id,
        label: item.part?.part_name || 'Unknown Part',
        subLabel: roleFlags.canViewPricing
          ? `RM${item.part?.sell_price || 0} | Van Stock: ${item.quantity} | ${item.part?.category || ''}`
          : `Van Stock: ${item.quantity} | ${item.part?.category || ''}`
      }));
  }, [vanStock, roleFlags.canViewPricing]);

  // ===== CUSTOMER OWNED FORKLIFT =====
  const isCustomerOwnedForklift = useMemo(() => {
    return job?.forklift?.ownership === 'customer';
  }, [job?.forklift?.ownership]);

  // ===== RESPONSE TIME REMAINING =====
  const responseTimeRemaining = useMemo(() => {
    if (!job?.technician_response_deadline) return null;
    const deadline = new Date(job.technician_response_deadline);
    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();
    if (remaining <= 0) return 'Expired';
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [job?.technician_response_deadline]);

  // ===== STATUS BADGE CLASS =====
  const statusBadgeClass = useMemo(() => {
    const { isCompleted, isAwaitingFinalization, isInProgress, isAwaitingAck, isDisputed, isIncompleteContinuing } = statusFlags;
    if (isCompleted) return 'badge-success';
    if (isAwaitingFinalization) return 'bg-purple-100 text-purple-700';
    if (isInProgress) return 'badge-info';
    if (isAwaitingAck) return 'badge-warning';
    if (isDisputed) return 'badge-error';
    if (isIncompleteContinuing) return 'bg-amber-100 text-amber-700';
    return 'badge-neutral';
  }, [statusFlags]);

  return {
    roleFlags,
    statusFlags,
    canEditPrices,
    canAddParts,
    costs,
    repairDuration,
    checklistProgress,
    missingMandatoryItems,
    partOptions,
    techOptions,
    vanStockOptions,
    isCustomerOwnedForklift,
    responseTimeRemaining,
    statusBadgeClass,
  };
}

/**
 * Helper to check if an item is mandatory
 */
export function isMandatoryItem(key: string): boolean {
  return MANDATORY_CHECKLIST_ITEMS.includes(key as any);
}

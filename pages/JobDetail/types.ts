/**
 * Shared types for JobDetail components
 */

import { Job, User, Part, JobRequest, VanStock, ForkliftConditionChecklist, HourmeterFlagReason } from '../../types';
import { ComboboxOption } from '../../components/Combobox';

export interface JobDetailProps {
  currentUser: User;
}

/**
 * Role-based permission flags
 */
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

/**
 * Status-based flags for the job
 */
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

/**
 * Computed values from job data
 */
export interface ComputedJobValues {
  totalPartsCost: number;
  laborCost: number;
  extraChargesCost: number;
  totalCost: number;
  repairDuration: { hours: number; minutes: number; total: number } | null;
  checklistProgress: { checked: number; total: number };
  partOptions: ComboboxOption[];
  techOptions: ComboboxOption[];
  vanStockOptions: ComboboxOption[];
  isCustomerOwnedForklift: boolean;
}

/**
 * Active rental info for forklift
 */
export interface ActiveRental {
  rental_id: string;
  customer_name: string;
  rental_location: string;
  start_date: string;
}

/**
 * Job data context value - passed to all child components
 */
export interface JobDataContextValue {
  // Core data
  job: Job | null;
  loading: boolean;
  isRealtimeConnected: boolean;
  
  // Related data
  parts: Part[];
  technicians: User[];
  vanStock: VanStock | null;
  jobRequests: JobRequest[];
  activeRental: ActiveRental | null;
  noPartsUsed: boolean;
  
  // Helper state
  isCurrentUserHelper: boolean;
  helperAssignmentId: string | null;
  
  // Hourmeter flags
  hourmeterFlagReasons: HourmeterFlagReason[];
  
  // Acknowledgement data
  jobAcknowledgement: any;
  
  // Refresh functions
  loadJob: () => Promise<void>;
  loadRequests: () => Promise<void>;
  loadVanStock: () => Promise<void>;
  setJob: (job: Job | null | ((prev: Job | null) => Job | null)) => void;
  setNoPartsUsed: (value: boolean) => void;
  setHourmeterFlagReasons: (reasons: HourmeterFlagReason[]) => void;
}

/**
 * Job actions context value - passed to all child components
 */
export interface JobActionsContextValue {
  // Status changes
  handleStatusChange: (newStatus: string) => Promise<void>;
  handleAcceptJob: () => Promise<void>;
  handleRejectJob: (reason: string) => Promise<void>;
  handleAcknowledgeJob: () => Promise<void>;
  handleStartJobWithCondition: (hourmeter: number, checklist: ForkliftConditionChecklist) => Promise<void>;
  handleContinueTomorrow: (reason: string) => Promise<void>;
  handleResumeJob: () => Promise<void>;
  handleDeferredCompletion: (reason: string, hourmeter: number, evidenceIds: string[]) => Promise<void>;
  
  // Assignment
  handleAssignJob: (techId: string) => Promise<void>;
  handleReassignJob: (techId: string) => Promise<void>;
  handleAssignHelper: (helperId: string, notes?: string) => Promise<void>;
  handleRemoveHelper: () => Promise<void>;
  
  // Parts
  handleAddPart: (partId: string, price?: number, fromVanStock?: boolean, vanStockItemId?: string) => Promise<void>;
  handleRemovePart: (jobPartId: string) => Promise<void>;
  handleSavePartPrice: (jobPartId: string, price: number) => Promise<void>;
  handleToggleNoPartsUsed: () => Promise<void>;
  
  // Pricing
  handleSaveLabor: (cost: number) => Promise<void>;
  handleAddExtraCharge: (name: string, description: string, amount: number) => Promise<void>;
  handleRemoveExtraCharge: (chargeId: string) => Promise<void>;
  
  // Notes
  handleAddNote: (note: string) => Promise<void>;
  
  // Photos
  uploadPhotoFile: (file: File, category: string) => Promise<void>;
  handleDownloadPhotos: (filter: string) => Promise<void>;
  
  // Signatures
  handleTechnicianSignature: (dataUrl: string) => Promise<void>;
  handleCustomerSignature: (dataUrl: string) => Promise<void>;
  
  // Hourmeter
  handleSaveHourmeter: (reading: number) => Promise<void>;
  handleSubmitHourmeterAmendment: (amendedReading: number, reason: string) => Promise<void>;
  
  // Job details
  handleSaveJobCarriedOut: (jobCarriedOut: string, recommendation: string) => Promise<void>;
  handleSaveChecklist: (checklist: ForkliftConditionChecklist) => Promise<void>;
  
  // Requests
  handleSubmitRequest: (type: string, description: string, photoUrl?: string, editingId?: string) => Promise<void>;
  handleApproval: (request: JobRequest, approve: boolean, data: any) => Promise<void>;
  
  // Finalization
  handleFinalizeInvoice: () => Promise<void>;
  handleConfirmParts: () => Promise<void>;
  handleDeleteJob: (reason: string) => Promise<void>;
  
  // PDF/Export
  handlePrintServiceReport: () => Promise<void>;
  handlePrintQuotation: () => Promise<void>;
  handleExportPDF: () => Promise<void>;
  handleExportToAutoCount: () => Promise<void>;
  
  // AI
  handleAiSummary: () => Promise<string>;
}

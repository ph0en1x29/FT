import { useCallback,useState } from 'react';
import { ForkliftConditionChecklist,HourmeterFlagReason,Job,JobRequest,JobRequestType,ServiceUpgradePrompt,VanStock } from '../../../types';

/**
 * Custom hook that manages all state for JobDetailPage
 * Extracted to reduce main component complexity
 */
export const useJobDetailState = () => {
  // Core job state
  const [jobRaw, setJobRaw] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  // Normalize job data to ensure arrays are never null/undefined
  const normalizeJob = (j: Job | null): Job | null => {
    if (!j) return null;
    return {
      ...j,
      parts_used: j.parts_used || [],
      media: j.media || [],
      extra_charges: j.extra_charges || []
    };
  };

  const setJob = useCallback((j: Job | null | ((prev: Job | null) => Job | null)) => {
    if (typeof j === 'function') {
      setJobRaw(prev => normalizeJob(j(prev)));
    } else {
      setJobRaw(normalizeJob(j));
    }
  }, []);

  const job = jobRaw;

  // Input states
  const [noteInput, setNoteInput] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedPartPrice, setSelectedPartPrice] = useState<string>('');
  const [selectedTechId, setSelectedTechId] = useState('');

  // Modal visibility states
  const [showTechSigPad, setShowTechSigPad] = useState(false);
  const [showCustSigPad, setShowCustSigPad] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showStartJobModal, setShowStartJobModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignHelperModal, setShowAssignHelperModal] = useState(false);
  const [showChecklistWarningModal, setShowChecklistWarningModal] = useState(false);
  const [showCheckAllConfirmModal, setShowCheckAllConfirmModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [bulkApproveRequests, setBulkApproveRequests] = useState<unknown[]>([]);
  const [showContinueTomorrowModal, setShowContinueTomorrowModal] = useState(false);
  const [showDeferredModal, setShowDeferredModal] = useState(false);
  const [showHourmeterAmendmentModal, setShowHourmeterAmendmentModal] = useState(false);
  const [showRejectJobModal, setShowRejectJobModal] = useState(false);

  // Service upgrade prompt state (for Minor Service on overdue unit)
  const [serviceUpgradePrompt, setServiceUpgradePrompt] = useState<ServiceUpgradePrompt>({
    show: false,
    forklift_id: '',
    current_hourmeter: 0,
    target_hourmeter: 0,
    hours_overdue: 0,
    job_id: '',
    original_job_type: ''
  });

  // AI states

  // Editing states
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [editingLabor, setEditingLabor] = useState(false);
  const [laborCostInput, setLaborCostInput] = useState<string>('');
  const [editingHourmeter, setEditingHourmeter] = useState(false);
  const [hourmeterInput, setHourmeterInput] = useState<string>('');
  const [editingJobCarriedOut, setEditingJobCarriedOut] = useState(false);
  const [jobCarriedOutInput, setJobCarriedOutInput] = useState('');
  const [recommendationInput, setRecommendationInput] = useState('');
  const [editingChecklist, setEditingChecklist] = useState(false);
  const [checklistEditData, setChecklistEditData] = useState<ForkliftConditionChecklist>({});

  // Extra charge states
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [chargeName, setChargeName] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState<string>('');

  // Start job states
  const [startJobHourmeter, setStartJobHourmeter] = useState<string>('');
  const [conditionChecklist, setConditionChecklist] = useState<ForkliftConditionChecklist>({});

  // Reassignment states
  const [reassignTechId, setReassignTechId] = useState('');

  // Delete states
  const [deletionReason, setDeletionReason] = useState('');

  // Continue tomorrow states
  const [continueTomorrowReason, setContinueTomorrowReason] = useState('');
  const [submittingContinue, setSubmittingContinue] = useState(false);

  // Deferred states
  const [deferredReason, setDeferredReason] = useState('');
  const [deferredHourmeter, setDeferredHourmeter] = useState('');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [submittingDeferred, setSubmittingDeferred] = useState(false);

  // Helper states
  const [selectedHelperId, setSelectedHelperId] = useState('');
  const [helperNotes, setHelperNotes] = useState('');
  const [isCurrentUserHelper, setIsCurrentUserHelper] = useState(false);
  const [helperAssignmentId, setHelperAssignmentId] = useState<string | null>(null);

  // Reject job states
  const [rejectJobReason, setRejectJobReason] = useState('');

  // Request states
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [requestType, setRequestType] = useState<JobRequestType>('spare_part');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestPhotoUrl, setRequestPhotoUrl] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<JobRequest | null>(null);

  // Approval states
  const [approvalRequest, setApprovalRequest] = useState<JobRequest | null>(null);
  const [approvalPartId, setApprovalPartId] = useState('');
  const [approvalQuantity, setApprovalQuantity] = useState('1');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalHelperId, setApprovalHelperId] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Van stock states
  const [useFromVanStock, setUseFromVanStock] = useState(false);
  const [vanStock, setVanStock] = useState<VanStock | null>(null);
  const [selectedVanStockItemId, setSelectedVanStockItemId] = useState('');
  const [vanStockQuantity, setVanStockQuantity] = useState('1');
  const [availableVans, setAvailableVans] = useState<VanStock[]>([]);

  // Checklist states
  const [missingChecklistItems, setMissingChecklistItems] = useState<string[]>([]);
  const [noPartsUsed, setNoPartsUsed] = useState(false);

  // Other data states
  const [activeRental, setActiveRental] = useState<{ rental_id: string; customer_name: string; rental_location: string; start_date: string; } | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobAcknowledgement, setJobAcknowledgement] = useState<any>(null);
  const [hourmeterFlagReasons, setHourmeterFlagReasons] = useState<HourmeterFlagReason[]>([]);
  const [exportingToAutoCount, setExportingToAutoCount] = useState(false);

  return {
    // Core
    job,
    setJob,
    loading,
    setLoading,

    // Inputs
    noteInput, setNoteInput,
    selectedPartId, setSelectedPartId,
    selectedPartPrice, setSelectedPartPrice,
    selectedTechId, setSelectedTechId,

    // Modals
    showTechSigPad, setShowTechSigPad,
    showCustSigPad, setShowCustSigPad,
    showFinalizeModal, setShowFinalizeModal,
    showStartJobModal, setShowStartJobModal,
    showReassignModal, setShowReassignModal,
    showDeleteModal, setShowDeleteModal,
    showAssignHelperModal, setShowAssignHelperModal,
    showChecklistWarningModal, setShowChecklistWarningModal,
    showCheckAllConfirmModal, setShowCheckAllConfirmModal,
    showRequestModal, setShowRequestModal,
    showApprovalModal, setShowApprovalModal,
    showBulkApproveModal, setShowBulkApproveModal,
    bulkApproveRequests, setBulkApproveRequests,
    showContinueTomorrowModal, setShowContinueTomorrowModal,
    showDeferredModal, setShowDeferredModal,
    showHourmeterAmendmentModal, setShowHourmeterAmendmentModal,
    showRejectJobModal, setShowRejectJobModal,

    // Service upgrade
    serviceUpgradePrompt, setServiceUpgradePrompt,

    // AI

    // Editing
    editingPartId, setEditingPartId,
    editingPrice, setEditingPrice,
    editingLabor, setEditingLabor,
    laborCostInput, setLaborCostInput,
    editingHourmeter, setEditingHourmeter,
    hourmeterInput, setHourmeterInput,
    editingJobCarriedOut, setEditingJobCarriedOut,
    jobCarriedOutInput, setJobCarriedOutInput,
    recommendationInput, setRecommendationInput,
    editingChecklist, setEditingChecklist,
    checklistEditData, setChecklistEditData,

    // Extra charges
    showAddCharge, setShowAddCharge,
    chargeName, setChargeName,
    chargeDescription, setChargeDescription,
    chargeAmount, setChargeAmount,

    // Start job
    startJobHourmeter, setStartJobHourmeter,
    conditionChecklist, setConditionChecklist,

    // Reassignment
    reassignTechId, setReassignTechId,

    // Delete
    deletionReason, setDeletionReason,

    // Continue tomorrow
    continueTomorrowReason, setContinueTomorrowReason,
    submittingContinue, setSubmittingContinue,

    // Deferred
    deferredReason, setDeferredReason,
    deferredHourmeter, setDeferredHourmeter,
    selectedEvidenceIds, setSelectedEvidenceIds,
    submittingDeferred, setSubmittingDeferred,

    // Helper
    selectedHelperId, setSelectedHelperId,
    helperNotes, setHelperNotes,
    isCurrentUserHelper, setIsCurrentUserHelper,
    helperAssignmentId, setHelperAssignmentId,

    // Reject
    rejectJobReason, setRejectJobReason,

    // Requests
    jobRequests, setJobRequests,
    requestType, setRequestType,
    requestDescription, setRequestDescription,
    requestPhotoUrl, setRequestPhotoUrl,
    submittingRequest, setSubmittingRequest,
    editingRequestId, setEditingRequestId,
    editingRequest, setEditingRequest,

    // Approval
    approvalRequest, setApprovalRequest,
    approvalPartId, setApprovalPartId,
    approvalQuantity, setApprovalQuantity,
    approvalNotes, setApprovalNotes,
    approvalHelperId, setApprovalHelperId,
    submittingApproval, setSubmittingApproval,

    // Van stock
    useFromVanStock, setUseFromVanStock,
    vanStock, setVanStock,
    selectedVanStockItemId, setSelectedVanStockItemId,
    vanStockQuantity, setVanStockQuantity,
    availableVans, setAvailableVans,

    // Checklist
    missingChecklistItems, setMissingChecklistItems,
    noPartsUsed, setNoPartsUsed,

    // Other
    activeRental, setActiveRental,
    jobAcknowledgement, setJobAcknowledgement,
    hourmeterFlagReasons, setHourmeterFlagReasons,
    exportingToAutoCount, setExportingToAutoCount,
  };
};

export type JobDetailState = ReturnType<typeof useJobDetailState>;

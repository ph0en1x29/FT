import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, JobStatus, UserRole, Part, JobPriority, JobType, SignatureEntry, User, ForkliftConditionChecklist, MediaCategory, JobRequest, JobRequestType, MANDATORY_CHECKLIST_ITEMS, VanStock, VanStockItem, HourmeterFlagReason, ChecklistItemState, normalizeChecklistState } from '../../types';
import { SupabaseDb as MockDb, supabase } from '../../services/supabaseService';
import { useTechnicians, usePartsForList } from '../../hooks/useQueryHooks';
import { useQueryClient } from '@tanstack/react-query';
import HourmeterAmendmentModal from '../../components/HourmeterAmendmentModal';
import { generateJobSummary } from '../../services/geminiService';
import { SignaturePad } from '../../components/SignaturePad';
import { Combobox, ComboboxOption } from '../../components/Combobox';
import { showToast } from '../../services/toastService';
import { useDevModeContext } from '../../contexts/DevModeContext';
import {
  ArrowLeft, MapPin, Phone, User as UserIcon, Calendar,
  CheckCircle, Plus, Camera, PenTool, Box, DollarSign, BrainCircuit,
  ShieldCheck, UserCheck, UserPlus, Edit2, Trash2, Save, X, FileText,
  Info, FileDown, Truck, Gauge, ClipboardList, Receipt, Play, Clock,
  AlertTriangle, CheckSquare, Square, FileCheck, RefreshCw, Download, Filter,
  HandHelping, Wrench, MessageSquarePlus, HelpCircle, Send, MoreVertical, ChevronRight,
  Zap, XCircle
} from 'lucide-react';
import SlotInSLABadge from '../../components/SlotInSLABadge';

// Import extracted components
import { JobHeader, JobTimerCard, EquipmentCard, FinancialSummary, JobTimeline, SignaturesCard, AIAssistantCard, JobPhotosSection } from './components';
import { useJobRealtime } from './hooks/useJobRealtime';
import { CHECKLIST_CATEGORIES, PHOTO_CATEGORIES, getDefaultPhotoCategory } from './constants';
import { getRoleFlags, getStatusFlags, getChecklistProgress, getMissingMandatoryItems, isMandatoryItem, calculateJobTotals } from './utils';
import { JobDetailProps } from './types';

const JobDetailPage: React.FC<JobDetailProps> = ({ currentUser }) => {
  // Use dev mode context for role-based permissions
  const { displayRole } = useDevModeContext();
  const currentUserRole = displayRole;
  const currentUserId = currentUser.user_id;
  const currentUserName = currentUser.name;
  
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJobRaw] = useState<Job | null>(null);
  
  // Normalize job data to ensure arrays are never null/undefined (prevents runtime crashes)
  const normalizeJob = (j: Job | null): Job | null => {
    if (!j) return null;
    return {
      ...j,
      parts_used: j.parts_used || [],
      media: j.media || [],
      extra_charges: j.extra_charges || []
    };
  };
  
  // Safe setter that normalizes job data before setting state
  const setJob = (j: Job | null | ((prev: Job | null) => Job | null)) => {
    if (typeof j === 'function') {
      setJobRaw(prev => normalizeJob(j(prev)));
    } else {
      setJobRaw(normalizeJob(j));
    }
  };
  const [loading, setLoading] = useState(true);
  
  // Use cached hooks for static data (parts/technicians rarely change)
  const { data: cachedParts = [] } = usePartsForList();
  const { data: cachedTechnicians = [] } = useTechnicians();
  const queryClient = useQueryClient();
  
  // Map cached data for compatibility
  const parts = cachedParts as unknown as Part[];
  const technicians = cachedTechnicians as User[];
  
  // All existing state variables
  const [noteInput, setNoteInput] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedPartPrice, setSelectedPartPrice] = useState<string>('');
  const [selectedTechId, setSelectedTechId] = useState('');
  const [showTechSigPad, setShowTechSigPad] = useState(false);
  const [showCustSigPad, setShowCustSigPad] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [editingLabor, setEditingLabor] = useState(false);
  const [laborCostInput, setLaborCostInput] = useState<string>('');
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [chargeName, setChargeName] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState<string>('');
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [editingHourmeter, setEditingHourmeter] = useState(false);
  const [hourmeterInput, setHourmeterInput] = useState<string>('');
  const [showStartJobModal, setShowStartJobModal] = useState(false);
  const [startJobHourmeter, setStartJobHourmeter] = useState<string>('');
  const [conditionChecklist, setConditionChecklist] = useState<ForkliftConditionChecklist>({});
  const [editingJobCarriedOut, setEditingJobCarriedOut] = useState(false);
  const [jobCarriedOutInput, setJobCarriedOutInput] = useState('');
  const [recommendationInput, setRecommendationInput] = useState('');
  const [editingChecklist, setEditingChecklist] = useState(false);
  const [checklistEditData, setChecklistEditData] = useState<ForkliftConditionChecklist>({});
  const [showChecklistWarningModal, setShowChecklistWarningModal] = useState(false);
  const [missingChecklistItems, setMissingChecklistItems] = useState<string[]>([]);
  const [showCheckAllConfirmModal, setShowCheckAllConfirmModal] = useState(false);
  const [noPartsUsed, setNoPartsUsed] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTechId, setReassignTechId] = useState('');
  const [activeRental, setActiveRental] = useState<{ rental_id: string; customer_name: string; rental_location: string; start_date: string; } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [showAssignHelperModal, setShowAssignHelperModal] = useState(false);

  // Van Stock state
  const [useFromVanStock, setUseFromVanStock] = useState(false);
  const [vanStock, setVanStock] = useState<VanStock | null>(null);
  const [selectedVanStockItemId, setSelectedVanStockItemId] = useState('');
  const [selectedHelperId, setSelectedHelperId] = useState('');
  const [helperNotes, setHelperNotes] = useState('');
  const [isCurrentUserHelper, setIsCurrentUserHelper] = useState(false);
  const [helperAssignmentId, setHelperAssignmentId] = useState<string | null>(null);
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<JobRequestType>('spare_part');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestPhotoUrl, setRequestPhotoUrl] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState<JobRequest | null>(null);
  const [approvalPartId, setApprovalPartId] = useState('');
  const [approvalQuantity, setApprovalQuantity] = useState('1');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalHelperId, setApprovalHelperId] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [showContinueTomorrowModal, setShowContinueTomorrowModal] = useState(false);
  const [continueTomorrowReason, setContinueTomorrowReason] = useState('');
  const [submittingContinue, setSubmittingContinue] = useState(false);
  const [showDeferredModal, setShowDeferredModal] = useState(false);
  const [deferredReason, setDeferredReason] = useState('');
  const [deferredHourmeter, setDeferredHourmeter] = useState('');
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [submittingDeferred, setSubmittingDeferred] = useState(false);
  const [jobAcknowledgement, setJobAcknowledgement] = useState<any>(null);
  const [showHourmeterAmendmentModal, setShowHourmeterAmendmentModal] = useState(false);
  const [hourmeterFlagReasons, setHourmeterFlagReasons] = useState<HourmeterFlagReason[]>([]);
  const [exportingToAutoCount, setExportingToAutoCount] = useState(false);
  const [showRejectJobModal, setShowRejectJobModal] = useState(false);
  const [rejectJobReason, setRejectJobReason] = useState('');

  // Data loading functions
  const loadJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await MockDb.getJobById(id);
      setJob(data ? { ...data } : null);
      if (data) {
        const serviceRecord = await MockDb.getJobServiceRecord(id);
        if (serviceRecord) setNoPartsUsed(serviceRecord.no_parts_used || false);
        if (data.forklift_id) {
          const rental = await MockDb.getActiveRentalForForklift(data.forklift_id);
          setActiveRental(rental);
        }
        if (data.helper_assignment) {
          const isHelper = data.helper_assignment.technician_id === currentUserId;
          setIsCurrentUserHelper(isHelper);
          if (isHelper) setHelperAssignmentId(data.helper_assignment.assignment_id);
        } else {
          setIsCurrentUserHelper(false);
          setHelperAssignmentId(null);
        }
      }
    } catch (error) {
      console.error('Error loading job:', error);
      showToast.error('Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [id, currentUserId]);

  const loadRequests = useCallback(async () => {
    if (!id) return;
    try {
      const requests = await MockDb.getJobRequests(id);
      setJobRequests(requests);
    } catch (error) {
      console.error('Error loading requests:', error);
      showToast.error('Failed to load requests');
    }
  }, [id]);

  const loadVanStock = useCallback(async () => {
    if (currentUserRole !== UserRole.TECHNICIAN) return;
    try {
      const data = await MockDb.getVanStockByTechnician(currentUserId);
      setVanStock(data);
    } catch (error) {
      console.error('Error loading Van Stock:', error);
    }
  }, [currentUserId, currentUserRole]);

  // Real-time subscription hook
  const { isRealtimeConnected } = useJobRealtime({
    jobId: id,
    currentUserId,
    onJobDeleted: () => navigate('/jobs'),
    onJobUpdated: loadJob,
    onRequestsUpdated: loadRequests,
  });

  // Load job-specific data on mount
  useEffect(() => {
    loadJob();
    loadRequests();
    loadVanStock();
  }, [loadJob, loadRequests, loadVanStock]);

  useEffect(() => {
    if (job) {
      const defaultCategory = getDefaultPhotoCategory(job);
      setUploadPhotoCategory(defaultCategory);
    }
  }, [job?.status, job?.started_at]);

  // Derive status and role flags
  const statusFlags = getStatusFlags(job, currentUserId, currentUserRole);
  const roleFlags = getRoleFlags(currentUserRole, isCurrentUserHelper, job, statusFlags);

  // === Event Handlers ===
  
  const handleAcceptJob = async () => {
    if (!job) return;
    try {
      const updated = await MockDb.acceptJobAssignment(job.job_id, currentUserId, currentUserName);
      setJob(updated as Job);
      showToast.success('Job accepted', 'You can now start the job when ready.');
    } catch (e) {
      showToast.error('Failed to accept job', (e as Error).message);
    }
  };

  const handleRejectJob = async () => {
    if (!job || !rejectJobReason.trim()) {
      showToast.error('Please provide a reason for rejecting this job');
      return;
    }
    try {
      await MockDb.rejectJobAssignment(job.job_id, currentUserId, currentUserName, rejectJobReason.trim());
      showToast.success('Job rejected', 'Admin has been notified for reassignment.');
      setShowRejectJobModal(false);
      setRejectJobReason('');
      navigate('/jobs');
    } catch (e) {
      showToast.error('Failed to reject job', (e as Error).message);
    }
  };

  const handleOpenStartJobModal = () => {
    if (!job) return;
    setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
    setConditionChecklist({});
    setShowStartJobModal(true);
  };

  const handleChecklistToggle = (key: string) => {
    setConditionChecklist(prev => ({ ...prev, [key]: !prev[key as keyof ForkliftConditionChecklist] }));
  };

  const handleStartJobWithCondition = async () => {
    if (!job) return;
    const hourmeter = parseInt(startJobHourmeter);
    if (isNaN(hourmeter) || hourmeter < 0) {
      showToast.error('Please enter a valid hourmeter reading');
      return;
    }
    const currentForkliftHourmeter = job.forklift?.hourmeter || 0;
    if (hourmeter < currentForkliftHourmeter) {
      showToast.error(`Hourmeter must be ≥ ${currentForkliftHourmeter} (forklift's current reading)`);
      return;
    }
    try {
      const updated = await MockDb.startJobWithCondition(job.job_id, hourmeter, conditionChecklist, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      setShowStartJobModal(false);
      showToast.success('Job started', 'Status changed to In Progress');
    } catch (error) {
      showToast.error('Failed to start job', (error as Error).message);
    }
  };

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (!job) return;
    if (newStatus === JobStatus.AWAITING_FINALIZATION) {
      const missing = getMissingMandatoryItems(job);
      if (missing.length > 0) {
        setMissingChecklistItems(missing);
        setShowChecklistWarningModal(true);
        return;
      }
    }
    try {
      const updated = await MockDb.updateJobStatus(job.job_id, newStatus, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      showToast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      showToast.error('Failed to update status', (error as Error).message);
    }
  };

  const handleAssignJob = async () => {
    if (!job || !selectedTechId) return;
    const tech = technicians.find(t => t.user_id === selectedTechId);
    if (tech) {
      const updated = await MockDb.assignJob(job.job_id, tech.user_id, tech.name, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      setSelectedTechId('');
    }
  };

  const handleAcknowledgeJob = async () => {
    if (!job) return;
    try {
      const updated = await MockDb.updateJob(job.job_id, {
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_id: currentUserId,
        acknowledged_by_name: currentUserName,
      });
      setJob({ ...updated } as Job);
      showToast.success('Job acknowledged', 'SLA timer stopped');
    } catch (error) {
      showToast.error('Failed to acknowledge job', (error as Error).message);
    }
  };

  const handleReassignJob = async () => {
    if (!job || !reassignTechId) return;
    const tech = technicians.find(t => t.user_id === reassignTechId);
    if (tech) {
      try {
        const updated = await MockDb.reassignJob(job.job_id, tech.user_id, tech.name, currentUserId, currentUserName);
        if (updated) {
          setJob({ ...updated } as Job);
          setShowReassignModal(false);
          setReassignTechId('');
          showToast.success(`Job reassigned to ${tech.name}`);
        }
      } catch (e) {
        showToast.error('Failed to reassign job', (e as Error).message);
      }
    }
  };

  const handleAddNote = async () => {
    if (!job || !noteInput.trim()) return;
    try {
      const updated = await MockDb.addNote(job.job_id, noteInput);
      setJob({ ...updated } as Job);
      setNoteInput('');
    } catch (error) {
      console.error('Error adding note:', error);
      showToast.error('Could not add note', (error as Error).message);
    }
  };

  // Labor cost handlers
  const handleStartEditLabor = () => {
    if (!job) return;
    setEditingLabor(true);
    setLaborCostInput((job.labor_cost || 150).toString());
  };

  const handleSaveLabor = async () => {
    if (!job) return;
    const parsed = parseFloat(laborCostInput);
    if (isNaN(parsed) || parsed < 0) {
      showToast.error('Please enter a valid labor cost');
      return;
    }
    try {
      const updated = await MockDb.updateLaborCost(job.job_id, parsed);
      setJob({ ...updated } as Job);
      setEditingLabor(false);
      setLaborCostInput('');
      showToast.success('Labor cost updated');
    } catch (e) {
      showToast.error('Could not update labor cost');
    }
  };

  const handleCancelLaborEdit = () => {
    setEditingLabor(false);
    setLaborCostInput('');
  };

  // Hourmeter handlers
  const handleStartEditHourmeter = () => {
    if (!job) return;
    setEditingHourmeter(true);
    setHourmeterInput((job.hourmeter_reading || job.forklift?.hourmeter || 0).toString());
  };

  const handleSaveHourmeter = async () => {
    if (!job || !job.forklift_id) return;
    const parsed = parseInt(hourmeterInput);
    if (isNaN(parsed) || parsed < 0) {
      showToast.error('Please enter a valid hourmeter reading');
      return;
    }

    const validation = await MockDb.validateHourmeterReading(job.forklift_id, parsed);
    const isFirstRecording = !job.first_hourmeter_recorded_by_id;
    const firstRecordingData = isFirstRecording ? {
      first_hourmeter_recorded_by_id: currentUserId,
      first_hourmeter_recorded_by_name: currentUserName,
      first_hourmeter_recorded_at: new Date().toISOString(),
    } : {};

    if (!validation.isValid) {
      setHourmeterFlagReasons(validation.flags);
      try {
        const updated = await MockDb.updateJobHourmeter(job.job_id, parsed);
        await MockDb.flagJobHourmeter(job.job_id, validation.flags);
        if (isFirstRecording) {
          await MockDb.updateJob(job.job_id, firstRecordingData);
        }
        setJob({ ...updated, hourmeter_flagged: true, hourmeter_flag_reasons: validation.flags, ...firstRecordingData } as Job);
        setEditingHourmeter(false);
        setHourmeterInput('');
        showToast.warning('Hourmeter saved with flags', 'This reading has been flagged for review.');
      } catch (e) {
        showToast.error(e instanceof Error ? e.message : 'Could not update hourmeter');
      }
      return;
    }

    try {
      const updated = await MockDb.updateJobHourmeter(job.job_id, parsed);
      if (isFirstRecording) {
        await MockDb.updateJob(job.job_id, firstRecordingData);
      }
      setJob({ ...updated, ...firstRecordingData } as Job);
      setEditingHourmeter(false);
      setHourmeterInput('');
      setHourmeterFlagReasons([]);
      showToast.success('Hourmeter updated');
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Could not update hourmeter');
    }
  };

  const handleCancelHourmeterEdit = () => {
    setEditingHourmeter(false);
    setHourmeterInput('');
  };

  const handleSubmitHourmeterAmendment = async (amendedReading: number, reason: string) => {
    if (!job || !job.forklift_id) throw new Error('Job or forklift not found');
    const originalReading = job.hourmeter_reading || 0;
    const flagReasons = job.hourmeter_flag_reasons || hourmeterFlagReasons;

    await MockDb.createHourmeterAmendment(
      job.job_id,
      job.forklift_id,
      originalReading,
      amendedReading,
      reason,
      flagReasons,
      currentUserId,
      currentUserName
    );

    setShowHourmeterAmendmentModal(false);
    showToast.success('Amendment request submitted', 'Waiting for Admin 1 (Service) approval');
  };

  // Continue tomorrow / Resume handlers
  const handleContinueTomorrow = async () => {
    if (!job || !continueTomorrowReason.trim()) return;
    setSubmittingContinue(true);
    try {
      const success = await MockDb.markJobContinueTomorrow(job.job_id, continueTomorrowReason, currentUserId, currentUserName);
      if (success) {
        showToast.success('Job marked to continue tomorrow');
        setShowContinueTomorrowModal(false);
        setContinueTomorrowReason('');
        loadJob();
      } else {
        showToast.error('Failed to update job');
      }
    } catch (e) {
      console.error('Continue tomorrow error:', e);
      showToast.error('Error updating job');
    } finally {
      setSubmittingContinue(false);
    }
  };

  const handleResumeJob = async () => {
    if (!job) return;
    try {
      const success = await MockDb.resumeMultiDayJob(job.job_id, currentUserId, currentUserName);
      if (success) {
        showToast.success('Job resumed');
        loadJob();
      } else {
        showToast.error('Failed to resume job');
      }
    } catch (e) {
      console.error('Resume job error:', e);
      showToast.error('Error resuming job');
    }
  };

  // Finalize invoice handler
  const handleFinalizeInvoice = async () => {
    if (!job) return;
    const needsPartsVerification = job.parts_used.length > 0 && !job.parts_confirmation_skipped;
    if (needsPartsVerification && !job.parts_confirmed_at) {
      showToast.error('Store Verification Pending', 'Admin 2 (Store) must verify parts before final service closure.');
      setShowFinalizeModal(false);
      return;
    }
    try {
      const updated = await MockDb.finalizeInvoice(job.job_id, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      setShowFinalizeModal(false);
      showToast.success('Invoice finalized');
    } catch (e) {
      showToast.error('Could not finalize invoice', (e as Error).message);
    }
  };

  // PDF handlers (lazy loaded)
  const handlePrintServiceReport = async () => {
    if (!job) return;
    const { printServiceReport } = await import('../../components/ServiceReportPDF');
    printServiceReport(job);
  };

  const handleExportPDF = async () => {
    if (!job) return;
    const { printInvoice } = await import('../../components/InvoicePDF');
    printInvoice(job);
  };

  const handleExportToAutoCount = async () => {
    if (!job) return;
    setExportingToAutoCount(true);
    try {
      await MockDb.createAutoCountExport(job.job_id, currentUserId, currentUserName);
      showToast.success('Export created', 'Invoice queued for AutoCount export');
    } catch (e) {
      showToast.error('Export failed', e instanceof Error ? e.message : 'Unknown error');
    }
    setExportingToAutoCount(false);
  };

  // Delete job handler
  const handleDeleteJob = async () => {
    if (!job) return;
    if (!deletionReason.trim()) {
      showToast.error('Please provide a reason for deleting this job');
      return;
    }
    try {
      await MockDb.deleteJob(job.job_id, currentUserId, currentUserName, deletionReason.trim());
      setShowDeleteModal(false);
      showToast.success('Job deleted');
      navigate('/jobs');
    } catch (e) {
      showToast.error('Could not delete job', (e as Error).message);
    }
  };

  // Signature handlers
  const handleTechnicianSignature = async (dataUrl: string) => {
    if (!job) return;
    const updated = await MockDb.signJob(job.job_id, 'technician', currentUserName, dataUrl);
    setJob({ ...updated } as Job);
    setShowTechSigPad(false);
  };

  const handleCustomerSignature = async (dataUrl: string) => {
    if (!job) return;
    const customerName = job.customer?.name || 'Customer';
    const updated = await MockDb.signJob(job.job_id, 'customer', customerName, dataUrl);
    setJob({ ...updated } as Job);
    setShowCustSigPad(false);
  };

  // AI Summary handler
  const handleAiSummary = async () => {
    if (!job) return;
    setGeneratingAi(true);
    const summary = await generateJobSummary(job);
    setAiSummary(summary);
    setGeneratingAi(false);
  };

  // Combobox options
  const partOptions: ComboboxOption[] = parts.map(p => ({
    id: p.part_id,
    label: p.part_name,
    subLabel: roleFlags.canViewPricing
      ? `RM${p.sell_price} | Stock: ${p.stock_quantity} | ${p.category}`
      : `Stock: ${p.stock_quantity} | ${p.category}`
  }));
  
  const techOptions: ComboboxOption[] = technicians.map(t => ({ 
    id: t.user_id, 
    label: t.name, 
    subLabel: t.email 
  }));

  // Loading state
  if (loading) return (
    <div className="max-w-5xl mx-auto p-6 fade-in">
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[var(--text-muted)] text-sm">Loading job details...</p>
        </div>
      </div>
    </div>
  );

  // Not found state
  if (!job) return (
    <div className="max-w-5xl mx-auto p-6 fade-in">
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-[var(--error)] mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[var(--text)]">Job not found</h2>
        <p className="text-[var(--text-muted)] mt-2">This job may have been deleted or you don't have access.</p>
        <button onClick={() => navigate('/jobs')} className="btn-premium btn-premium-primary mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </button>
      </div>
    </div>
  );

  const { totalPartsCost, laborCost, extraChargesCost, totalCost } = calculateJobTotals(job);

  return (
    <div className="max-w-5xl mx-auto pb-20 fade-in">
      {/* Header - Extracted Component */}
      <JobHeader
        job={job}
        isRealtimeConnected={isRealtimeConnected}
        roleFlags={roleFlags}
        statusFlags={statusFlags}
        exportingToAutoCount={exportingToAutoCount}
        onAcceptJob={handleAcceptJob}
        onRejectJob={() => setShowRejectJobModal(true)}
        onStartJob={handleOpenStartJobModal}
        onCompleteJob={() => handleStatusChange(JobStatus.AWAITING_FINALIZATION)}
        onContinueTomorrow={() => setShowContinueTomorrowModal(true)}
        onResumeJob={handleResumeJob}
        onCustomerUnavailable={() => setShowDeferredModal(true)}
        onFinalizeInvoice={() => setShowFinalizeModal(true)}
        onPrintServiceReport={handlePrintServiceReport}
        onExportPDF={handleExportPDF}
        onExportToAutoCount={handleExportToAutoCount}
        onDeleteJob={() => setShowDeleteModal(true)}
        onAcknowledgeJob={handleAcknowledgeJob}
      />

      {/* Main Content */}
      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Equipment Card - Extracted Component */}
          {job.forklift && (
            <EquipmentCard
              job={job}
              activeRental={activeRental}
              currentUserId={currentUserId}
              roleFlags={roleFlags}
              statusFlags={statusFlags}
              editingHourmeter={editingHourmeter}
              hourmeterInput={hourmeterInput}
              onHourmeterInputChange={setHourmeterInput}
              onStartEditHourmeter={handleStartEditHourmeter}
              onSaveHourmeter={handleSaveHourmeter}
              onCancelHourmeterEdit={handleCancelHourmeterEdit}
              onRequestAmendment={() => setShowHourmeterAmendmentModal(true)}
            />
          )}

          {/* Repair Time Card - Extracted Component */}
          {(statusFlags.isInProgress || statusFlags.isAwaitingFinalization || statusFlags.isCompleted) && (
            <JobTimerCard job={job} />
          )}

          {/* Customer & Assignment Card - keeping inline for now as it has complex state */}
          <div className="card-premium p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text)]">Customer</h3>
                  {job.customer ? (
                    <p className="text-sm text-[var(--text-secondary)]">{job.customer.name}</p>
                  ) : (
                    <p className="text-sm text-[var(--warning)]">No customer assigned</p>
                  )}
                </div>
              </div>
              {job.customer?.phone && (
                <a href={`tel:${job.customer.phone}`} className="btn-premium btn-premium-ghost text-xs">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              )}
            </div>
            
            {job.customer && (
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
                  <span className="text-[var(--text-secondary)]">{job.customer.address}</span>
                </div>
              </div>
            )}

            <div className="divider"></div>

            <div>
              <p className="label-premium mb-2">Description</p>
              <p className="text-[var(--text-secondary)] text-sm">{job.description}</p>
            </div>

            {/* Assign Technician */}
            {(roleFlags.isAdmin || roleFlags.isSupervisor) && statusFlags.isNew && (
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" /> Assign Technician
                </p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Combobox options={techOptions} value={selectedTechId} onChange={setSelectedTechId} placeholder="Select Technician..." />
                  </div>
                  <button onClick={handleAssignJob} disabled={!selectedTechId} className="btn-premium btn-premium-primary disabled:opacity-50">Assign</button>
                </div>
              </div>
            )}

            {/* Current Assignment */}
            {roleFlags.canReassign && job.assigned_technician_id && !statusFlags.isCompleted && (
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--accent-subtle)] p-3 flex justify-between items-center">
                  <div>
                    <p className="label-premium mb-1">Assigned Technician</p>
                    <p className="value-premium">{job.assigned_technician_name}</p>
                  </div>
                  <button onClick={() => setShowReassignModal(true)} className="chip-premium chip-premium-accent">
                    <RefreshCw className="w-3.5 h-3.5" /> Reassign
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notes Section - keeping inline */}
          {(roleFlags.isTechnician || roleFlags.isAdmin || roleFlags.isSupervisor) && (
            <div className="card-premium p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                  <PenTool className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <h3 className="font-semibold text-[var(--text)]">Notes</h3>
              </div>
              
              <div className="max-h-40 overflow-y-auto space-y-2 mb-4 scrollbar-premium">
                {job.notes.map((note, idx) => (
                  <div key={idx} className="p-3 bg-[var(--bg-subtle)] rounded-xl border-l-2 border-[var(--accent)] text-sm text-[var(--text-secondary)]">
                    {note}
                  </div>
                ))}
                {job.notes.length === 0 && (
                  <p className="text-[var(--text-muted)] italic text-sm">No notes yet.</p>
                )}
              </div>

              {(statusFlags.isAssigned || statusFlags.isInProgress) && !roleFlags.isHelperOnly && (
                <div className="flex gap-2">
                  <input type="text" placeholder="Add a note..." className="input-premium flex-1" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
                  <button onClick={handleAddNote} className="btn-premium btn-premium-primary">Add</button>
                </div>
              )}
            </div>
          )}

          {/* Photos Section - Extracted Component */}
          <JobPhotosSection
            job={job}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            roleFlags={roleFlags}
            statusFlags={statusFlags}
            isCurrentUserHelper={isCurrentUserHelper}
            onJobUpdate={setJob}
          />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-5">
          {/* Financial Summary - Extracted Component */}
          <FinancialSummary
            job={job}
            roleFlags={roleFlags}
            editingLabor={editingLabor}
            laborCostInput={laborCostInput}
            onLaborInputChange={setLaborCostInput}
            onStartEditLabor={handleStartEditLabor}
            onSaveLabor={handleSaveLabor}
            onCancelLaborEdit={handleCancelLaborEdit}
          />

          {/* Timeline - Extracted Component */}
          <JobTimeline job={job} />

          {/* Signatures - Extracted Component */}
          <SignaturesCard
            job={job}
            roleFlags={roleFlags}
            statusFlags={statusFlags}
            onOpenTechSignature={() => setShowTechSigPad(true)}
            onOpenCustomerSignature={() => setShowCustSigPad(true)}
          />

          {/* AI Assistant - Extracted Component */}
          <AIAssistantCard
            aiSummary={aiSummary}
            generatingAi={generatingAi}
            onGenerateSummary={handleAiSummary}
          />
        </div>
      </div>

      {/* Modals - keeping inline for now */}
      
      {/* Signature Modals */}
      {showTechSigPad && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-4 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold mb-4 text-[var(--text)]">Technician Signature</h4>
            <p className="text-xs text-[var(--text-muted)] mb-2">I certify that this work has been completed according to standards.</p>
            <SignaturePad onSave={handleTechnicianSignature} />
            <button onClick={() => setShowTechSigPad(false)} className="mt-4 text-sm text-[var(--error)] underline w-full text-center">Cancel</button>
          </div>
        </div>
      )}

      {showCustSigPad && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-4 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold mb-4 text-[var(--text)]">Customer Acceptance</h4>
            <p className="text-xs text-[var(--text-muted)] mb-2">I acknowledge the service performed and agree to the charges.</p>
            <SignaturePad onSave={handleCustomerSignature} />
            <button onClick={() => setShowCustSigPad(false)} className="mt-4 text-sm text-[var(--error)] underline w-full text-center">Cancel</button>
          </div>
        </div>
      )}

      {/* Start Job Modal */}
      {showStartJobModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-premium-elevated">
            <h4 className="font-bold text-xl mb-4 text-[var(--text)] flex items-center gap-2">
              <Play className="w-5 h-5 text-[var(--accent)]" /> Start Job - Condition Check
            </h4>
            <div className="bg-[var(--warning-bg)] p-4 rounded-xl border border-[var(--warning)] border-opacity-20 mb-6">
              <label className="text-sm font-bold text-[var(--warning)] mb-2 block flex items-center gap-2">
                <Gauge className="w-4 h-4" /> Current Hourmeter *
              </label>
              <div className="flex items-center gap-2">
                <input type="number" className="input-premium w-40" value={startJobHourmeter} onChange={(e) => setStartJobHourmeter(e.target.value)} placeholder="e.g., 5230" />
                <span className="text-[var(--text-muted)]">hours</span>
              </div>
            </div>
            <div className="mb-6">
              <h5 className="font-bold text-[var(--text)] mb-3 flex items-center gap-2">
                <ClipboardList className="w-5 h-5" /> Condition Checklist
              </h5>
              <p className="text-sm text-[var(--text-muted)] mb-4">Check items in good condition:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CHECKLIST_CATEGORIES.map(category => (
                  <div key={category.name} className="bg-[var(--bg-subtle)] p-3 rounded-xl border border-[var(--border)]">
                    <h6 className="font-semibold text-[var(--text-secondary)] text-xs mb-2 border-b border-[var(--border-subtle)] pb-1">{category.name}</h6>
                    <div className="space-y-1">
                      {category.items.map(item => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--surface-2)] p-1 rounded text-xs">
                          <input type="checkbox" checked={!!conditionChecklist[item.key as keyof ForkliftConditionChecklist]} onChange={() => handleChecklistToggle(item.key)} className="w-3.5 h-3.5 rounded border-[var(--border)] text-[var(--accent)]" />
                          <span className="text-[var(--text-secondary)]">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end border-t border-[var(--border)] pt-4">
              <button onClick={() => setShowStartJobModal(false)} className="btn-premium btn-premium-secondary">Cancel</button>
              <button onClick={handleStartJobWithCondition} className="btn-premium btn-premium-primary">
                <Play className="w-4 h-4" /> Start Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4 text-[var(--text)]">Finalize Invoice</h4>
            <p className="text-sm text-[var(--text-muted)] mb-6">This action cannot be undone.</p>
            <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-6">
              <div className="flex justify-between mb-1">
                <span className="text-[var(--text-muted)]">Total:</span>
                <span className="font-bold text-xl text-[var(--success)]">RM{totalCost.toFixed(2)}</span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">Finalized by: {currentUserName}</div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowFinalizeModal(false)} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
              <button onClick={handleFinalizeInvoice} className="btn-premium btn-premium-primary flex-1">Finalize</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4 text-[var(--text)] flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[var(--accent)]" /> Reassign Job
            </h4>
            <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-4 text-sm">
              <div className="text-[var(--text-muted)]">Currently assigned:</div>
              <div className="font-medium text-[var(--text)]">{job?.assigned_technician_name || 'Unassigned'}</div>
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">New Technician</label>
              <Combobox options={techOptions.filter(t => t.id !== job?.assigned_technician_id)} value={reassignTechId} onChange={setReassignTechId} placeholder="Select technician..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowReassignModal(false); setReassignTechId(''); }} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
              <button onClick={handleReassignJob} disabled={!reassignTechId} className="btn-premium btn-premium-primary flex-1 disabled:opacity-50">
                <RefreshCw className="w-4 h-4" /> Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Continue Tomorrow Modal */}
      {showContinueTomorrowModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4 text-[var(--warning)] flex items-center gap-2">
              <Clock className="w-5 h-5" /> Continue Tomorrow
            </h4>
            <div className="bg-[var(--warning-bg)] rounded-xl p-3 mb-4">
              <p className="text-sm text-[var(--warning)] font-medium">{job?.title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Job will be marked incomplete and can resume tomorrow.</p>
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason *</label>
              <textarea className="input-premium resize-none h-24" value={continueTomorrowReason} onChange={(e) => setContinueTomorrowReason(e.target.value)} placeholder="e.g., Waiting for parts..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowContinueTomorrowModal(false); setContinueTomorrowReason(''); }} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
              <button onClick={handleContinueTomorrow} disabled={!continueTomorrowReason.trim() || submittingContinue} className="btn-premium bg-[var(--warning)] text-white hover:opacity-90 flex-1 disabled:opacity-50">
                {submittingContinue ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4 text-[var(--error)] flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete Job
            </h4>
            <div className="bg-[var(--error-bg)] rounded-xl p-3 mb-4">
              <p className="text-sm text-[var(--error)] font-medium">{job?.title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">This will mark the job as cancelled.</p>
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason *</label>
              <textarea className="input-premium resize-none h-24" value={deletionReason} onChange={(e) => setDeletionReason(e.target.value)} placeholder="e.g., Customer cancelled..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletionReason(''); }} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
              <button onClick={handleDeleteJob} disabled={!deletionReason.trim()} className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Job Modal */}
      {showRejectJobModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4 text-[var(--error)] flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Reject Job Assignment
            </h4>
            <div className="bg-[var(--warning-bg)] rounded-xl p-3 mb-4">
              <p className="text-sm text-[var(--warning)] font-medium">{job?.title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">This job will be returned to Admin for reassignment.</p>
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason for Rejection *</label>
              <textarea 
                className="input-premium resize-none h-24" 
                value={rejectJobReason} 
                onChange={(e) => setRejectJobReason(e.target.value)} 
                placeholder="e.g., Already have too many jobs, Not available on scheduled date, etc." 
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowRejectJobModal(false); setRejectJobReason(''); }} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
              <button onClick={handleRejectJob} disabled={!rejectJobReason.trim()} className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Reject Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hourmeter Amendment Modal */}
      {showHourmeterAmendmentModal && job && job.forklift && (
        <HourmeterAmendmentModal
          job={job}
          previousReading={job.forklift.hourmeter || 0}
          flagReasons={job.hourmeter_flag_reasons || hourmeterFlagReasons}
          onClose={() => setShowHourmeterAmendmentModal(false)}
          onSubmit={handleSubmitHourmeterAmendment}
        />
      )}
    </div>
  );
};

export default JobDetailPage;

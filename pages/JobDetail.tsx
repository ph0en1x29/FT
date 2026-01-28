import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, JobStatus, UserRole, Part, JobPriority, JobType, SignatureEntry, User, ForkliftConditionChecklist, MediaCategory, JobRequest, JobRequestType, MANDATORY_CHECKLIST_ITEMS, VanStock, VanStockItem, HourmeterFlagReason, ChecklistItemState, normalizeChecklistState } from '../types';
import { SupabaseDb as MockDb, supabase } from '../services/supabaseService';
import HourmeterAmendmentModal from '../components/HourmeterAmendmentModal';
import { generateJobSummary } from '../services/geminiService';
import { SignaturePad } from '../components/SignaturePad';
import { Combobox, ComboboxOption } from '../components/Combobox';
import { printServiceReport } from '../components/ServiceReportPDF';
import { printQuotation, generateQuotationFromJob } from '../components/QuotationPDF';
import { printInvoice } from '../components/InvoicePDF';
import { showToast } from '../services/toastService';
import { useDevModeContext } from '../contexts/DevModeContext';
import {
  ArrowLeft, MapPin, Phone, User as UserIcon, Calendar,
  CheckCircle, Plus, Camera, PenTool, Box, DollarSign, BrainCircuit,
  ShieldCheck, UserCheck, UserPlus, Edit2, Trash2, Save, X, FileText,
  Info, FileDown, Truck, Gauge, ClipboardList, Receipt, Play, Clock,
  AlertTriangle, CheckSquare, Square, FileCheck, RefreshCw, Download, Filter,
  HandHelping, Wrench, MessageSquarePlus, HelpCircle, Send, MoreVertical, ChevronRight,
  Zap, XCircle
} from 'lucide-react';
import SlotInSLABadge from '../components/SlotInSLABadge';

interface JobDetailProps {
  currentUser: User;
}

// Checklist categories for the condition check
const CHECKLIST_CATEGORIES = [
  {
    name: 'Drive System',
    items: [
      { key: 'drive_front_axle', label: 'Front Axle' },
      { key: 'drive_rear_axle', label: 'Rear Axle' },
      { key: 'drive_motor_engine', label: 'Motor/Engine' },
      { key: 'drive_controller_transmission', label: 'Controller/Transmission' },
    ]
  },
  {
    name: 'Hydraulic System',
    items: [
      { key: 'hydraulic_pump', label: 'Pump' },
      { key: 'hydraulic_control_valve', label: 'Control Valve' },
      { key: 'hydraulic_hose', label: 'Hose' },
      { key: 'hydraulic_oil_level', label: 'Oil Level' },
    ]
  },
  {
    name: 'Braking System',
    items: [
      { key: 'braking_brake_pedal', label: 'Brake Pedal' },
      { key: 'braking_parking_brake', label: 'Parking Brake' },
      { key: 'braking_fluid_pipe', label: 'Fluid/Pipe' },
      { key: 'braking_master_pump', label: 'Master Pump' },
    ]
  },
  {
    name: 'Electrical System',
    items: [
      { key: 'electrical_ignition', label: 'Ignition' },
      { key: 'electrical_battery', label: 'Battery' },
      { key: 'electrical_wiring', label: 'Wiring' },
      { key: 'electrical_instruments', label: 'Instruments' },
    ]
  },
  {
    name: 'Steering System',
    items: [
      { key: 'steering_wheel_valve', label: 'Wheel/Valve' },
      { key: 'steering_cylinder', label: 'Cylinder' },
      { key: 'steering_motor', label: 'Motor' },
      { key: 'steering_knuckle', label: 'Knuckle' },
    ]
  },
  {
    name: 'Load Handling',
    items: [
      { key: 'load_fork', label: 'Fork' },
      { key: 'load_mast_roller', label: 'Mast/Roller' },
      { key: 'load_chain_wheel', label: 'Chain/Wheel' },
      { key: 'load_cylinder', label: 'Cylinder' },
    ]
  },
  {
    name: 'Tyres',
    items: [
      { key: 'tyres_front', label: 'Front Tyres' },
      { key: 'tyres_rear', label: 'Rear Tyres' },
      { key: 'tyres_rim', label: 'Rim' },
      { key: 'tyres_screw_nut', label: 'Screw/Nut' },
    ]
  },
  {
    name: 'Wheels',
    items: [
      { key: 'wheels_drive', label: 'Drive Wheel' },
      { key: 'wheels_load', label: 'Load Wheel' },
      { key: 'wheels_support', label: 'Support Wheel' },
      { key: 'wheels_hub_nut', label: 'Hub Nut' },
    ]
  },
  {
    name: 'Safety Devices',
    items: [
      { key: 'safety_overhead_guard', label: 'Overhead Guard' },
      { key: 'safety_cabin_body', label: 'Cabin/Body' },
      { key: 'safety_backrest', label: 'Backrest' },
      { key: 'safety_seat_belt', label: 'Seat Belt' },
    ]
  },
  {
    name: 'Lighting',
    items: [
      { key: 'lighting_beacon_light', label: 'Beacon Light' },
      { key: 'lighting_horn', label: 'Horn' },
      { key: 'lighting_buzzer', label: 'Buzzer' },
      { key: 'lighting_rear_view_mirror', label: 'Rear View Mirror' },
    ]
  },
  {
    name: 'Fuel/Engine',
    items: [
      { key: 'fuel_engine_oil_level', label: 'Engine Oil Level' },
      { key: 'fuel_line_leaks', label: 'Line Leaks' },
      { key: 'fuel_radiator', label: 'Radiator' },
      { key: 'fuel_exhaust_piping', label: 'Exhaust/Piping' },
    ]
  },
  {
    name: 'Transmission',
    items: [
      { key: 'transmission_fluid_level', label: 'Fluid Level' },
      { key: 'transmission_inching_valve', label: 'Inching Valve' },
      { key: 'transmission_air_cleaner', label: 'Air Cleaner' },
      { key: 'transmission_lpg_regulator', label: 'LPG Regulator' },
    ]
  },
];

// Photo categories for ACWER workflow
const PHOTO_CATEGORIES = [
  { value: 'before', label: 'Before', color: 'bg-blue-500' },
  { value: 'after', label: 'After', color: 'bg-green-500' },
  { value: 'spare_part', label: 'Parts', color: 'bg-amber-500' },
  { value: 'condition', label: 'Condition', color: 'bg-purple-500' },
  { value: 'evidence', label: 'Evidence', color: 'bg-red-500' },
  { value: 'other', label: 'Other', color: 'bg-slate-500' },
];

const getDefaultPhotoCategory = (job: Job | null): MediaCategory => {
  if (!job) return 'other';
  const status = job.status;
  if (status === JobStatus.NEW || status === JobStatus.ASSIGNED) return 'before';
  if (status === JobStatus.IN_PROGRESS) {
    const startTime = job.started_at ? new Date(job.started_at) : null;
    if (startTime) {
      const now = new Date();
      const minutesSinceStart = (now.getTime() - startTime.getTime()) / (1000 * 60);
      if (minutesSinceStart <= 30) return 'before';
    }
    return 'other';
  }
  if (status === JobStatus.AWAITING_FINALIZATION) return 'after';
  return 'other';
};

const JobDetail: React.FC<JobDetailProps> = ({ currentUser }) => {
  // Use dev mode context for role-based permissions
  const { displayRole } = useDevModeContext();
  const currentUserRole = displayRole;
  const currentUserId = currentUser.user_id;
  const currentUserName = currentUser.name;
  
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<Part[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  
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
  const [photoCategoryFilter, setPhotoCategoryFilter] = useState<string>('all');
  const [uploadPhotoCategory, setUploadPhotoCategory] = useState<string>('other');
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);
  const [isPhotoDragActive, setIsPhotoDragActive] = useState(false);
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

  // Hourmeter amendment state
  const [showHourmeterAmendmentModal, setShowHourmeterAmendmentModal] = useState(false);
  const [hourmeterFlagReasons, setHourmeterFlagReasons] = useState<HourmeterFlagReason[]>([]);

  // AutoCount export state
  const [exportingToAutoCount, setExportingToAutoCount] = useState(false);

  // All existing useEffect hooks and handler functions remain the same
  useEffect(() => {
    loadJob();
    loadParts();
    loadRequests();
    loadVanStock();
    if (currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.SUPERVISOR) {
      loadTechnicians();
    }
  }, [id, currentUserRole]);

  useEffect(() => {
    if (job) {
      const defaultCategory = getDefaultPhotoCategory(job);
      setUploadPhotoCategory(defaultCategory);
    }
  }, [job?.status, job?.started_at]);

  // Real-time WebSocket connection state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Real-time subscription for job updates (deletion, status changes, assignments)
  // Provides live updates without manual refresh
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`job-detail-${id}`)
      // Listen for job updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `job_id=eq.${id}`
        },
        (payload) => {
          const updatedJob = payload.new as any;
          const oldJob = payload.old as any;
          
          // Check if this job was soft-deleted
          if (updatedJob?.deleted_at !== null && oldJob?.deleted_at === null) {
            showToast.warning('Job deleted', 'This job has been cancelled or deleted by admin');
            navigate('/jobs');
            return;
          }
          
          // Check for status change
          if (oldJob?.status !== updatedJob?.status) {
            showToast.info('Job updated', `Status changed to ${updatedJob.status}`);
          }
          
          // Check for reassignment
          if (oldJob?.assigned_technician_id !== updatedJob?.assigned_technician_id) {
            if (updatedJob.assigned_technician_id === currentUserId) {
              showToast.success('Job assigned to you', 'You have been assigned to this job');
            } else if (oldJob?.assigned_technician_id === currentUserId) {
              showToast.warning('Job reassigned', `Job has been reassigned to ${updatedJob.assigned_technician_name || 'another technician'}`);
            } else {
              showToast.info('Job reassigned', `Now assigned to ${updatedJob.assigned_technician_name || 'another technician'}`);
            }
          }
          
          // Reload job to get fresh data with all relations
          loadJob();
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('[JobDetail] ✅ Real-time connected for job:', id);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, navigate, currentUserId]);

  // Real-time subscription for job requests (approvals/rejections)
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`job-requests-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_requests',
          filter: `job_id=eq.${id}`
        },
        (payload) => {
          const updatedRequest = payload.new as any;
          const oldRequest = payload.old as any;
          
          // Notify on status change
          if (oldRequest?.status !== updatedRequest?.status) {
            if (updatedRequest.status === 'approved') {
              showToast.success('Request approved', `Your ${updatedRequest.request_type?.replace('_', ' ')} request has been approved`);
            } else if (updatedRequest.status === 'rejected') {
              showToast.error('Request rejected', `Your ${updatedRequest.request_type?.replace('_', ' ')} request has been rejected`);
            }
          }
          
          // Reload requests
          loadRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_requests',
          filter: `job_id=eq.${id}`
        },
        (payload) => {
          showToast.info('New request', 'A new request has been submitted for this job');
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const loadJob = async () => {
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
  };

  const loadParts = async () => {
    try {
      const data = await MockDb.getParts();
      setParts(data);
    } catch (error) {
      console.error('Error loading parts:', error);
      showToast.error('Failed to load parts');
    }
  };

  const loadTechnicians = async () => {
    try {
      const data = await MockDb.getTechnicians();
      setTechnicians(data);
    } catch (error) {
      console.error('Error loading technicians:', error);
      showToast.error('Failed to load technicians');
    }
  };

  const loadRequests = async () => {
    if (!id) return;
    try {
      const requests = await MockDb.getJobRequests(id);
      setJobRequests(requests);
    } catch (error) {
      console.error('Error loading requests:', error);
      showToast.error('Failed to load requests');
    }
  };

  // Load Van Stock for current user (if technician)
  const loadVanStock = async () => {
    if (currentUserRole !== UserRole.TECHNICIAN) return;
    try {
      const data = await MockDb.getVanStockByTechnician(currentUserId);
      setVanStock(data);
    } catch (error) {
      console.error('Error loading Van Stock:', error);
    }
  };

  const handleSubmitRequest = async () => {
    if (!job || !requestDescription.trim()) { showToast.error('Please enter a description'); return; }
    setSubmittingRequest(true);
    try {
      // If editing, update existing request; otherwise create new
      if (editingRequestId) {
        const success = await MockDb.updateJobRequest(editingRequestId, currentUserId, {
          description: requestDescription.trim(),
          request_type: requestType,
          photo_url: requestPhotoUrl || null,
        });
        if (success) {
          showToast.success('Request updated');
          setShowRequestModal(false);
          setRequestDescription('');
          setRequestPhotoUrl('');
          setEditingRequestId(null);
          loadRequests();
        } else {
          showToast.error('Failed to update request');
        }
      } else {
        const result = await MockDb.createJobRequest(job.job_id, requestType, currentUserId, requestDescription.trim(), requestPhotoUrl || undefined);
        if (result) { showToast.success('Request submitted', 'Admin will review your request'); setShowRequestModal(false); setRequestDescription(''); setRequestPhotoUrl(''); loadRequests(); }
        else { showToast.error('Failed to submit request'); }
      }
    } catch (e) { showToast.error('Error submitting request'); }
    finally { setSubmittingRequest(false); }
  };

  const openRequestModal = (type: JobRequestType) => { setRequestType(type); setRequestDescription(''); setRequestPhotoUrl(''); setEditingRequestId(null); setShowRequestModal(true); };

  // Open modal in edit mode with pre-populated data
  const openEditRequestModal = (req: JobRequest) => {
    setRequestType(req.request_type);
    setRequestDescription(req.description);
    setRequestPhotoUrl(req.photo_url || '');
    setEditingRequestId(req.request_id);
    setShowRequestModal(true);
  };
  const openApprovalModal = (request: JobRequest) => { setApprovalRequest(request); setApprovalPartId(''); setApprovalQuantity('1'); setApprovalNotes(''); setApprovalHelperId(''); setShowApprovalModal(true); };

  const handleApproval = async (approve: boolean) => {
    if (!approvalRequest || !job) return;
    setSubmittingApproval(true);
    try {
      let success = false;
      if (approve) {
        if (approvalRequest.request_type === 'spare_part') {
          if (!approvalPartId || !approvalQuantity) { showToast.error('Please select a part and quantity'); setSubmittingApproval(false); return; }
          success = await MockDb.approveSparePartRequest(approvalRequest.request_id, currentUserId, approvalPartId, parseInt(approvalQuantity), approvalNotes || undefined);
        } else if (approvalRequest.request_type === 'assistance') {
          if (!approvalHelperId) { showToast.error('Please select a helper technician'); setSubmittingApproval(false); return; }
          success = await MockDb.approveAssistanceRequest(approvalRequest.request_id, currentUserId, approvalHelperId, approvalNotes || undefined);
        } else if (approvalRequest.request_type === 'skillful_technician') {
          success = await MockDb.acknowledgeSkillfulTechRequest(approvalRequest.request_id, currentUserId, approvalNotes || 'Acknowledged - Job will be reassigned');
          showToast.info('Request acknowledged. Use Job Reassignment to assign a new technician.');
        }
      } else {
        if (!approvalNotes) { showToast.error('Please provide a reason for rejection'); setSubmittingApproval(false); return; }
        success = await MockDb.rejectRequest(approvalRequest.request_id, currentUserId, approvalNotes);
      }
      if (success) { showToast.success(approve ? 'Request approved' : 'Request rejected'); setShowApprovalModal(false); loadRequests(); loadJob(); }
      else { showToast.error('Failed to process request'); }
    } catch (e) { console.error('Approval error:', e); showToast.error('Error processing request'); }
    finally { setSubmittingApproval(false); }
  };

  const handleContinueTomorrow = async () => {
    if (!job || !continueTomorrowReason.trim()) return;
    setSubmittingContinue(true);
    try {
      const success = await MockDb.markJobContinueTomorrow(job.job_id, continueTomorrowReason, currentUserId, currentUserName);
      if (success) { showToast.success('Job marked to continue tomorrow'); setShowContinueTomorrowModal(false); setContinueTomorrowReason(''); loadJob(); }
      else { showToast.error('Failed to update job'); }
    } catch (e) { console.error('Continue tomorrow error:', e); showToast.error('Error updating job'); }
    finally { setSubmittingContinue(false); }
  };

  const handleResumeJob = async () => {
    if (!job) return;
    try {
      const success = await MockDb.resumeMultiDayJob(job.job_id, currentUserId, currentUserName);
      if (success) { showToast.success('Job resumed'); loadJob(); }
      else { showToast.error('Failed to resume job'); }
    } catch (e) { console.error('Resume job error:', e); showToast.error('Error resuming job'); }
  };

  // Accept job assignment (technician confirms they will do the job)
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

  // Reject job assignment (technician declines, needs reassignment)
  const [showRejectJobModal, setShowRejectJobModal] = useState(false);
  const [rejectJobReason, setRejectJobReason] = useState('');
  
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
      // Navigate back to jobs list since this job is no longer assigned to tech
      navigate('/jobs');
    } catch (e) {
      showToast.error('Failed to reject job', (e as Error).message);
    }
  };

  // Check if technician needs to accept/reject (within 15-min window)
  const needsAcceptance = isAssigned && isTechnician && !job?.technician_accepted_at && !job?.technician_rejected_at;
  const hasAccepted = isAssigned && job?.technician_accepted_at;
  
  // Calculate remaining time for response
  const getResponseTimeRemaining = () => {
    if (!job?.technician_response_deadline) return null;
    const deadline = new Date(job.technician_response_deadline);
    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();
    if (remaining <= 0) return 'Expired';
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDeferredCompletion = async () => {
    if (!job || !deferredReason.trim()) return;
    const hourmeterValue = parseFloat(deferredHourmeter);
    if (!deferredHourmeter.trim() || isNaN(hourmeterValue)) { showToast.error('Please enter a valid hourmeter reading'); return; }
    const startHourmeter = job.start_hourmeter || job.forklift?.hourmeter || 0;
    if (hourmeterValue < startHourmeter) { showToast.error(`Hourmeter must be >= start reading (${startHourmeter})`); return; }
    if (selectedEvidenceIds.length === 0) { showToast.error('Please select at least 1 evidence photo'); return; }
    setSubmittingDeferred(true);
    try {
      const result = await MockDb.deferJobCompletion(job.job_id, deferredReason, selectedEvidenceIds, currentUserId, currentUserName, hourmeterValue);
      if (result.success) { showToast.success('Job marked as completed (pending customer acknowledgement)'); setShowDeferredModal(false); setDeferredReason(''); setDeferredHourmeter(''); setSelectedEvidenceIds([]); loadJob(); }
      else { showToast.error(result.error || 'Failed to defer completion'); }
    } catch (e) { console.error('Deferred completion error:', e); showToast.error('Error processing deferred completion'); }
    finally { setSubmittingDeferred(false); }
  };

  const loadAcknowledgement = async () => {
    if (job && (job.status === 'Completed Awaiting Acknowledgement' || job.status === 'Disputed')) {
      const ack = await MockDb.getJobAcknowledgement(job.job_id);
      setJobAcknowledgement(ack);
    }
  };

  useEffect(() => { if (job) loadAcknowledgement(); }, [job?.status]);

  const handleOpenStartJobModal = () => {
    if (!job) return;
    setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
    setConditionChecklist({});
    setShowStartJobModal(true);
  };

  const handleChecklistToggle = (key: string) => { setConditionChecklist(prev => ({ ...prev, [key]: !prev[key as keyof ForkliftConditionChecklist] })); };

  const handleStartJobWithCondition = async () => {
    if (!job) return;
    const hourmeter = parseInt(startJobHourmeter);
    if (isNaN(hourmeter) || hourmeter < 0) { showToast.error('Please enter a valid hourmeter reading'); return; }
    const currentForkliftHourmeter = job.forklift?.hourmeter || 0;
    if (hourmeter < currentForkliftHourmeter) { showToast.error(`Hourmeter must be ≥ ${currentForkliftHourmeter} (forklift's current reading)`); return; }
    try {
      const updated = await MockDb.startJobWithCondition(job.job_id, hourmeter, conditionChecklist, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      setShowStartJobModal(false);
      showToast.success('Job started', 'Status changed to In Progress');
    } catch (error) { showToast.error('Failed to start job', (error as Error).message); }
  };

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (!job) return;

    // Checklist enforcement: validate mandatory items before completing
    if (newStatus === JobStatus.AWAITING_FINALIZATION) {
      const missing = getMissingMandatoryItems();
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
    } catch (error) { showToast.error('Failed to update status', (error as Error).message); }
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

  // Acknowledge Slot-In job (for SLA tracking)
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
        if (updated) { setJob({ ...updated } as Job); setShowReassignModal(false); setReassignTechId(''); showToast.success(`Job reassigned to ${tech.name}`); }
      } catch (e) { showToast.error('Failed to reassign job', (e as Error).message); }
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

  const handleAddPart = async () => {
    if (!job) return;

    // Handle Van Stock part
    if (useFromVanStock) {
      if (!selectedVanStockItemId) return;
      const vanStockItem = vanStock?.items?.find(i => i.item_id === selectedVanStockItemId);
      if (!vanStockItem) { showToast.error('Van Stock item not found'); return; }

      let finalPrice = undefined;
      if (selectedPartPrice !== '') {
        const parsed = parseFloat(selectedPartPrice);
        if (isNaN(parsed) || parsed < 0) { showToast.error('Please enter a valid price'); return; }
        finalPrice = parsed;
      }

      try {
        // Use Van Stock part (requires approval if customer-owned forklift)
        const requiresApproval = isCustomerOwnedForklift;
        await MockDb.useVanStockPart(
          selectedVanStockItemId,
          job.job_id,
          1,
          currentUserId,
          currentUserName,
          requiresApproval
        );

        // Also add to job parts for tracking
        const updated = await MockDb.addPartToJob(
          job.job_id,
          vanStockItem.part_id,
          1,
          finalPrice || vanStockItem.part?.sell_price,
          currentUserRole
        );
        setJob({ ...updated } as Job);
        setSelectedVanStockItemId('');
        setSelectedPartPrice('');
        loadVanStock(); // Refresh Van Stock quantities

        if (requiresApproval) {
          showToast.warning('Part added (pending approval)', 'Customer-owned forklift requires admin approval');
        } else {
          showToast.success('Part added from Van Stock');
        }
      } catch (e) {
        showToast.error('Could not add part from Van Stock', (e as Error).message);
      }
      return;
    }

    // Handle warehouse part (existing logic)
    if (!selectedPartId) return;
    let finalPrice = undefined;
    if (selectedPartPrice !== '') { const parsed = parseFloat(selectedPartPrice); if (isNaN(parsed) || parsed < 0) { showToast.error('Please enter a valid price'); return; } finalPrice = parsed; }
    try {
      const updated = await MockDb.addPartToJob(job.job_id, selectedPartId, 1, finalPrice, currentUserRole);
      setJob({ ...updated } as Job);
      setSelectedPartId('');
      setSelectedPartPrice('');
      showToast.success('Part added to job');
    } catch (e) {
      showToast.error('Could not add part', (e as Error).message);
    }
  };

  const handleStartEditPrice = (jobPartId: string, currentPrice: number) => { setEditingPartId(jobPartId); setEditingPrice(currentPrice.toString()); };
  const handleSavePartPrice = async (jobPartId: string) => {
    if (!job) return;
    const parsed = parseFloat(editingPrice);
    if (isNaN(parsed) || parsed < 0) { showToast.error('Please enter a valid price'); return; }
    try { const updated = await MockDb.updatePartPrice(job.job_id, jobPartId, parsed); setJob({ ...updated } as Job); setEditingPartId(null); setEditingPrice(''); showToast.success('Price updated'); }
    catch (e) { showToast.error('Could not update price'); }
  };
  const handleCancelEdit = () => { setEditingPartId(null); setEditingPrice(''); };
  const handleRemovePart = async (jobPartId: string) => {
    if (!job) return;
    if (!confirm('Remove this part from the job?')) return;
    try {
      const updated = await MockDb.removePartFromJob(job.job_id, jobPartId, currentUserRole);
      setJob({ ...updated } as Job);
      showToast.success('Part removed from job');
    } catch (e) {
      showToast.error('Could not remove part', (e as Error).message);
    }
  };

  const handleStartEditLabor = () => { if (!job) return; setEditingLabor(true); setLaborCostInput((job.labor_cost || 150).toString()); };
  const handleSaveLabor = async () => {
    if (!job) return;
    const parsed = parseFloat(laborCostInput);
    if (isNaN(parsed) || parsed < 0) { showToast.error('Please enter a valid labor cost'); return; }
    try { const updated = await MockDb.updateLaborCost(job.job_id, parsed); setJob({ ...updated } as Job); setEditingLabor(false); setLaborCostInput(''); showToast.success('Labor cost updated'); }
    catch (e) { showToast.error('Could not update labor cost'); }
  };
  const handleCancelLaborEdit = () => { setEditingLabor(false); setLaborCostInput(''); };

  const handleAddExtraCharge = async () => {
    if (!job) return;
    if (!chargeName.trim()) { showToast.error('Please enter a charge name'); return; }
    const parsed = parseFloat(chargeAmount);
    if (isNaN(parsed) || parsed < 0) { showToast.error('Please enter a valid amount'); return; }
    try { const updated = await MockDb.addExtraCharge(job.job_id, { name: chargeName.trim(), description: chargeDescription.trim(), amount: parsed }); setJob({ ...updated } as Job); setChargeName(''); setChargeDescription(''); setChargeAmount(''); setShowAddCharge(false); showToast.success('Extra charge added'); }
    catch (e) { showToast.error('Could not add extra charge'); }
  };
  const handleRemoveExtraCharge = async (chargeId: string) => {
    if (!job) return;
    if (!confirm('Remove this charge?')) return;
    try { const updated = await MockDb.removeExtraCharge(job.job_id, chargeId); setJob({ ...updated } as Job); showToast.success('Extra charge removed'); }
    catch (e) { showToast.error('Could not remove charge'); }
  };

  const handleStartEditHourmeter = () => { if (!job) return; setEditingHourmeter(true); setHourmeterInput((job.hourmeter_reading || job.forklift?.hourmeter || 0).toString()); };
  const handleSaveHourmeter = async () => {
    if (!job || !job.forklift_id) return;
    const parsed = parseInt(hourmeterInput);
    if (isNaN(parsed) || parsed < 0) { showToast.error('Please enter a valid hourmeter reading'); return; }
    const currentForkliftHourmeter = job.forklift?.hourmeter || 0;

    // Validate and check for flags
    const validation = await MockDb.validateHourmeterReading(job.forklift_id, parsed);

    // Check if this is the first hourmeter recording
    const isFirstRecording = !job.first_hourmeter_recorded_by_id;
    const firstRecordingData = isFirstRecording ? {
      first_hourmeter_recorded_by_id: currentUserId,
      first_hourmeter_recorded_by_name: currentUserName,
      first_hourmeter_recorded_at: new Date().toISOString(),
    } : {};

    if (!validation.isValid) {
      // Save with flags
      setHourmeterFlagReasons(validation.flags);
      try {
        const updated = await MockDb.updateJobHourmeter(job.job_id, parsed);
        await MockDb.flagJobHourmeter(job.job_id, validation.flags);
        // Also save first recording info
        if (isFirstRecording) {
          await MockDb.updateJob(job.job_id, firstRecordingData);
        }
        setJob({ ...updated, hourmeter_flagged: true, hourmeter_flag_reasons: validation.flags, ...firstRecordingData } as Job);
        setEditingHourmeter(false);
        setHourmeterInput('');
        showToast.warning('Hourmeter saved with flags', 'This reading has been flagged for review. Consider requesting an amendment.');
      } catch (e: any) {
        showToast.error(e.message || 'Could not update hourmeter');
      }
      return;
    }

    try {
      const updated = await MockDb.updateJobHourmeter(job.job_id, parsed);
      // Also save first recording info
      if (isFirstRecording) {
        await MockDb.updateJob(job.job_id, firstRecordingData);
      }
      setJob({ ...updated, ...firstRecordingData } as Job);
      setEditingHourmeter(false);
      setHourmeterInput('');
      setHourmeterFlagReasons([]);
      showToast.success('Hourmeter updated');
    } catch (e: any) {
      showToast.error(e.message || 'Could not update hourmeter');
    }
  };
  const handleCancelHourmeterEdit = () => { setEditingHourmeter(false); setHourmeterInput(''); };

  // Hourmeter amendment handler
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

  const handleStartEditJobCarriedOut = () => { if (!job) return; setEditingJobCarriedOut(true); setJobCarriedOutInput(job.job_carried_out || ''); setRecommendationInput(job.recommendation || ''); };
  const handleSaveJobCarriedOut = async () => {
    if (!job) return;
    try { const updated = await MockDb.updateJobCarriedOut(job.job_id, jobCarriedOutInput, recommendationInput); setJob({ ...updated } as Job); setEditingJobCarriedOut(false); showToast.success('Job details saved'); }
    catch (e) { showToast.error('Could not save job details'); }
  };
  const handleCancelJobCarriedOutEdit = () => { setEditingJobCarriedOut(false); setJobCarriedOutInput(''); setRecommendationInput(''); };

  const handleStartEditChecklist = () => { if (!job) return; setEditingChecklist(true); setChecklistEditData(job.condition_checklist || {}); };
  const handleSaveChecklist = async () => {
    if (!job) return;
    
    // Auto-set unchecked items to 'not_ok' (Unticked = automatic Cross)
    const finalChecklist: ForkliftConditionChecklist = { ...checklistEditData };
    CHECKLIST_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        const state = normalizeChecklistState(finalChecklist[item.key as keyof ForkliftConditionChecklist]);
        if (state === undefined) {
          finalChecklist[item.key as keyof ForkliftConditionChecklist] = 'not_ok';
        }
      });
    });
    
    try { 
      const updated = await MockDb.updateConditionChecklist(job.job_id, finalChecklist, currentUserId); 
      setJob({ ...updated } as Job); 
      setEditingChecklist(false); 
      showToast.success('Checklist saved', 'Unchecked items marked as Not OK'); 
    }
    catch (e) { showToast.error('Could not save checklist', (e as Error).message); }
  };
  const handleCancelChecklistEdit = () => { setEditingChecklist(false); setChecklistEditData({}); };
  // Set checklist item to OK or Not OK
  const setChecklistItemState = (key: string, state: 'ok' | 'not_ok' | undefined) => {
    setChecklistEditData(prev => ({ ...prev, [key]: state }));
  };

  // Legacy toggle for backward compatibility
  const toggleChecklistItem = (key: string) => {
    setChecklistEditData(prev => {
      const currentState = normalizeChecklistState(prev[key as keyof ForkliftConditionChecklist]);
      // Cycle: undefined -> ok -> not_ok -> undefined
      const nextState = currentState === undefined ? 'ok' : currentState === 'ok' ? 'not_ok' : undefined;
      return { ...prev, [key]: nextState };
    });
  };

  const handleToggleNoPartsUsed = async () => {
    if (!job) return;
    const newValue = !noPartsUsed;
    try { await MockDb.setNoPartsUsed(job.job_id, newValue); setNoPartsUsed(newValue); }
    catch (e) { showToast.error('Could not update', (e as Error).message); }
  };

  const handleFinalizeInvoice = async () => {
    if (!job) return;
    // Check if store parts have been verified first (Admin 2 must verify before Admin 1 can finalize)
    // Skip check if no parts were used or if parts confirmation was explicitly skipped
    const needsPartsVerification = job.parts_used.length > 0 && !job.parts_confirmation_skipped;
    if (needsPartsVerification && !job.parts_confirmed_at) {
      showToast.error('Store Verification Pending', 'Admin 2 (Store) must verify parts before final service closure.');
      setShowFinalizeModal(false);
      return;
    }
    try { const updated = await MockDb.finalizeInvoice(job.job_id, currentUserId, currentUserName); setJob({ ...updated } as Job); setShowFinalizeModal(false); showToast.success('Invoice finalized'); }
    catch (e) { showToast.error('Could not finalize invoice', (e as Error).message); }
  };

  const handleConfirmParts = async () => {
    if (!job) return;
    try {
      const updated = {
        ...job,
        parts_confirmed_by_id: currentUserId,
        parts_confirmed_by_name: currentUserName,
        parts_confirmed_at: new Date().toISOString(),
      };
      await MockDb.updateJob(job.job_id, updated);
      setJob(updated as Job);
      showToast.success('Parts verified successfully', 'Admin 1 (Service) can now finalize the job.');
    } catch (e) {
      showToast.error('Could not verify parts', (e as Error).message);
    }
  };

  const handleDeleteJob = async () => {
    if (!job) return;
    if (!deletionReason.trim()) { showToast.error('Please provide a reason for deleting this job'); return; }
    try { await MockDb.deleteJob(job.job_id, currentUserId, currentUserName, deletionReason.trim()); setShowDeleteModal(false); showToast.success('Job deleted'); navigate('/jobs'); }
    catch (e) { showToast.error('Could not delete job', (e as Error).message); }
  };

  const handlePrintServiceReport = () => { if (!job) return; printServiceReport(job); };
  const handlePrintQuotation = () => { if (!job) return; const quotation = generateQuotationFromJob(job); const quotationNumber = `Q-${new Date().getFullYear()}-${job.job_id.slice(0, 6).toUpperCase()}`; printQuotation(quotation, quotationNumber); };
  const handleExportPDF = () => { if (!job) return; printInvoice(job); };

  // Export to AutoCount
  const handleExportToAutoCount = async () => {
    if (!job) return;
    setExportingToAutoCount(true);
    try {
      await MockDb.createAutoCountExport(job.job_id, currentUserId, currentUserName);
      showToast.success('Export created', 'Invoice queued for AutoCount export');
    } catch (e: any) {
      showToast.error('Export failed', e.message);
    }
    setExportingToAutoCount(false);
  };

  // Helper to get GPS coordinates
  const getGPSCoordinates = (): Promise<{ latitude: number; longitude: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          console.warn('GPS error:', error.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const uploadPhotoFile = async (file: File) => {
    if (!job) return;
    if (!file.type.startsWith('image/')) {
      showToast.error('Please upload an image file');
      return;
    }

    // Get GPS coordinates while reading file
    const gpsPromise = getGPSCoordinates();

    // Get device timestamp from file's lastModified (approximation)
    const deviceTimestamp = new Date(file.lastModified).toISOString();
    const serverTimestamp = new Date().toISOString();

    // Calculate timestamp mismatch (threshold: 5 minutes = 300000ms)
    const timeDiffMs = Math.abs(new Date(serverTimestamp).getTime() - new Date(deviceTimestamp).getTime());
    const timeDiffMinutes = Math.round(timeDiffMs / 60000);
    const timestampMismatch = timeDiffMinutes > 5;

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        // Wait for GPS
        const gps = await gpsPromise;

        const mediaData: any = {
          type: 'photo',
          url: reader.result as string,
          description: file.name,
          created_at: serverTimestamp,
          category: uploadPhotoCategory as MediaCategory,
          source: 'camera',
          // Timestamp validation
          device_timestamp: deviceTimestamp,
          server_timestamp: serverTimestamp,
          timestamp_mismatch: timestampMismatch,
          timestamp_mismatch_minutes: timestampMismatch ? timeDiffMinutes : undefined,
        };

        // Add GPS data if available
        if (gps) {
          mediaData.gps_latitude = gps.latitude;
          mediaData.gps_longitude = gps.longitude;
          mediaData.gps_accuracy = gps.accuracy;
          mediaData.gps_captured_at = serverTimestamp;
        }

        // Check if this is the first photo and job hasn't started - auto-start timer
        const isFirstPhoto = job.media.length === 0;
        const shouldAutoStart = isFirstPhoto && !job.repair_start_time && !job.started_at;

        // Mark first photo if auto-starting
        if (shouldAutoStart) {
          mediaData.is_start_photo = true;
        }

        const updated = await MockDb.addMedia(
          job.job_id,
          mediaData,
          currentUserId,
          currentUserName,
          isCurrentUserHelper
        );

        // Auto-start job timer on first photo
        if (shouldAutoStart) {
          const now = new Date().toISOString();
          const startedJob = await MockDb.updateJob(job.job_id, {
            repair_start_time: now,
            started_at: now,
            status: JobStatus.IN_PROGRESS,
          });
          setJob({ ...startedJob } as Job);
          showToast.info('Job timer started', 'Timer started automatically with first photo');
        } else {
          setJob({ ...updated } as Job);
        }

        const categoryLabel = PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other';

        // Show appropriate toast based on validation
        if (!gps && timestampMismatch) {
          showToast.warning('Photo uploaded (flagged)', `GPS missing • Timestamp mismatch: ${timeDiffMinutes}min`);
        } else if (!gps) {
          showToast.warning('Photo uploaded', `GPS location not captured • ${categoryLabel}`);
        } else if (timestampMismatch) {
          showToast.warning('Photo uploaded', `Timestamp mismatch: ${timeDiffMinutes}min • ${categoryLabel}`);
        } else {
          showToast.success('Photo uploaded', `Category: ${categoryLabel}${isCurrentUserHelper ? ' (Helper)' : ''}`);
        }
      } catch (e) {
        showToast.error('Photo upload failed', (e as Error).message);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadPhotoFile(file);
  };

  const handlePhotoDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handlePhotoDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPhotoDragActive(true);
  };

  const handlePhotoDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPhotoDragActive(false);
  };

  const handlePhotoDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPhotoDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadPhotoFile(file);
  };

  const handleDownloadPhotos = async () => {
    if (!job || job.media.length === 0) { showToast.error('No photos to download'); return; }
    setDownloadingPhotos(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const photosToDownload = photoCategoryFilter === 'all' ? job.media : job.media.filter(m => m.category === photoCategoryFilter);
      if (photosToDownload.length === 0) { showToast.error('No photos in selected category'); setDownloadingPhotos(false); return; }
      for (const photo of photosToDownload) {
        const category = photo.category || 'other';
        const folder = zip.folder(category);
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const timestamp = new Date(photo.created_at).toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}_${photo.description || 'photo'}.jpg`;
        folder?.file(filename, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Job_${job.service_report_number || job.job_id}_Photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast.success('Photos downloaded', `${photosToDownload.length} photos`);
    } catch (e: any) { console.error('Failed to download photos:', e); showToast.error('Download failed', e.message); }
    finally { setDownloadingPhotos(false); }
  };

  const handleAssignHelper = async () => {
    if (!job || !selectedHelperId) { showToast.error('Please select a helper technician'); return; }
    if (selectedHelperId === job.assigned_technician_id) { showToast.error('Cannot assign lead technician as helper'); return; }
    const result = await MockDb.assignHelper(job.job_id, selectedHelperId, currentUserId, helperNotes || undefined);
    if (result) { showToast.success('Helper assigned'); setShowAssignHelperModal(false); setSelectedHelperId(''); setHelperNotes(''); loadJob(); }
    else { showToast.error('Failed to assign helper'); }
  };

  const handleRemoveHelper = async () => {
    if (!job) return;
    const confirmed = window.confirm('Remove helper technician from this job?');
    if (!confirmed) return;
    const success = await MockDb.removeHelper(job.job_id);
    if (success) { showToast.success('Helper removed'); loadJob(); }
    else { showToast.error('Failed to remove helper'); }
  };

  const handleTechnicianSignature = async (dataUrl: string) => { if (!job) return; const updated = await MockDb.signJob(job.job_id, 'technician', currentUserName, dataUrl); setJob({ ...updated } as Job); setShowTechSigPad(false); };
  const handleCustomerSignature = async (dataUrl: string) => { if (!job) return; const customerName = job.customer?.name || 'Customer'; const updated = await MockDb.signJob(job.job_id, 'customer', customerName, dataUrl); setJob({ ...updated } as Job); setShowCustSigPad(false); };
  const handleAiSummary = async () => { if (!job) return; setGeneratingAi(true); const summary = await generateJobSummary(job); setAiSummary(summary); setGeneratingAi(false); };

  const getRepairDuration = () => {
    if (!job?.repair_start_time) return null;
    const start = new Date(job.repair_start_time);
    const end = job.repair_end_time ? new Date(job.repair_end_time) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, total: diffMs };
  };

  // Checklist validation helpers
  // Get mandatory checklist items that haven't been marked as OK or Not OK
  const getMissingMandatoryItems = (): string[] => {
    if (!job?.condition_checklist) return MANDATORY_CHECKLIST_ITEMS as string[];
    const checklist = job.condition_checklist;
    return MANDATORY_CHECKLIST_ITEMS.filter(key => {
      const state = normalizeChecklistState(checklist[key]);
      return state === undefined; // Item not checked (neither OK nor Not OK)
    }) as string[];
  };

  const getChecklistProgress = () => {
    if (!job?.condition_checklist) return { checked: 0, total: MANDATORY_CHECKLIST_ITEMS.length };
    const checklist = job.condition_checklist;
    const checked = MANDATORY_CHECKLIST_ITEMS.filter(key => {
      const state = normalizeChecklistState(checklist[key]);
      return state === 'ok' || state === 'not_ok'; // Count both OK and Not OK as checked
    }).length;
    return { checked, total: MANDATORY_CHECKLIST_ITEMS.length };
  };

  const isMandatoryItem = (key: string): boolean => {
    return MANDATORY_CHECKLIST_ITEMS.includes(key as keyof ForkliftConditionChecklist);
  };

  // Loading and not found states
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

  // Status flags
  const normalizedStatus = (job.status || '').toString().toLowerCase().trim();
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

  // Slot-In SLA tracking
  const isSlotIn = job.job_type === JobType.SLOT_IN;
  const isSlotInPendingAck = isSlotIn && !job.acknowledged_at && !isCompleted;
  const isAssignedToCurrentUser = job.assigned_technician_id === currentUser.user_id;

  const totalPartsCost = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
  const laborCost = job.labor_cost || 150;
  const extraChargesCost = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
  const totalCost = totalPartsCost + laborCost + extraChargesCost;

  const partOptions: ComboboxOption[] = parts.map(p => ({
    id: p.part_id,
    label: p.part_name,
    subLabel: canViewPricing
      ? `RM${p.sell_price} | Stock: ${p.stock_quantity} | ${p.category}`
      : `Stock: ${p.stock_quantity} | ${p.category}`
  }));
  const techOptions: ComboboxOption[] = technicians.map(t => ({ id: t.user_id, label: t.name, subLabel: t.email }));

  // Van Stock options - only items with quantity > 0
  const vanStockOptions: ComboboxOption[] = (vanStock?.items || [])
    .filter(item => item.quantity > 0)
    .map(item => ({
      id: item.item_id,
      label: item.part?.part_name || 'Unknown Part',
      subLabel: canViewPricing
        ? `RM${item.part?.sell_price || 0} | Van Stock: ${item.quantity} | ${item.part?.category || ''}`
        : `Van Stock: ${item.quantity} | ${item.part?.category || ''}`
    }));

  // Check if forklift is customer-owned (requires approval for Van Stock usage)
  const isCustomerOwnedForklift = job?.forklift?.ownership === 'customer';
  const canEditPrices =
    canViewPricing &&
    !isCompleted &&
    !isHelperOnly &&
    ((isTechnician && !isAwaitingFinalization) || isAdmin || isAccountant);
  // Parts entry: Technicians can only request parts via Spare Part Requests
  // Only Admin/Supervisor/Accountant can directly add parts to jobs
  // Admin 2 (Store) can add pre-job parts for jobs in New/Assigned status
  const canAddParts =
    !isHelperOnly &&
    !isTechnician &&
    (((isAssigned || isInProgress) && (isAdmin || isSupervisor)) ||
      (isAwaitingFinalization && (isAdmin || isAccountant || isSupervisor)) ||
      ((isNew || isAssigned) && isAdminStore));
  const repairDuration = getRepairDuration();
  const jobMedia = job.media || [];

  // Premium status badge styling
  const getStatusBadge = () => {
    if (isCompleted) return 'badge-success';
    if (isAwaitingFinalization) return 'bg-purple-100 text-purple-700';
    if (isInProgress) return 'badge-info';
    if (isAwaitingAck) return 'badge-warning';
    if (isDisputed) return 'badge-error';
    if (isIncompleteContinuing) return 'bg-amber-100 text-amber-700';
    return 'badge-neutral';
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 fade-in">
      {/* Premium Header */}
      <div className="bg-[var(--surface)] border-b border-[var(--border)] -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 sticky top-0 z-30 shadow-premium-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg transition-colors mt-0.5"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-[var(--text)]">{job.title}</h1>
                {/* Real-time connection indicator */}
                <span 
                  className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-gray-400'}`}
                  title={isRealtimeConnected ? 'Live updates active' : 'Connecting...'}
                />
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`badge ${getStatusBadge()}`}>{job.status}</span>
                {job.job_type && (
                  <span className={`badge ${
                    job.job_type === JobType.SLOT_IN ? 'badge-error' :
                    job.job_type === JobType.COURIER ? 'bg-cyan-100 text-cyan-700' :
                    job.job_type === JobType.REPAIR ? 'badge-warning' :
                    job.job_type === JobType.CHECKING ? 'bg-purple-100 text-purple-700' :
                    'badge-success'
                  }`}>{job.job_type}</span>
                )}
                {job.priority === JobPriority.EMERGENCY && (
                  <span className="badge badge-error">Emergency</span>
                )}
                {isEscalated && (
                  <span className="badge badge-error animate-pulse">⚠️ Escalated</span>
                )}
                {isOvertime && (
                  <span className="badge bg-purple-100 text-purple-700">OT Job</span>
                )}
                {/* Slot-In SLA Badge */}
                {isSlotIn && (
                  <SlotInSLABadge
                    createdAt={job.created_at}
                    acknowledgedAt={job.acknowledged_at}
                    slaTargetMinutes={job.sla_target_minutes || 15}
                    size="sm"
                  />
                )}
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Acknowledge Slot-In Job Button */}
            {isSlotInPendingAck && (isAssigned || isInProgress) && (isAssignedToCurrentUser || isAdmin || isSupervisor) && (
              <button
                onClick={handleAcknowledgeJob}
                className="btn-premium bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                <Zap className="w-4 h-4" /> Acknowledge
              </button>
            )}
            {/* Technician Accept/Reject buttons (before they can start) */}
            {isTechnician && isAssigned && !isHelperOnly && needsAcceptance && (
              <>
                <button onClick={handleAcceptJob} className="btn-premium btn-premium-primary">
                  <CheckCircle className="w-4 h-4" /> Accept Job
                </button>
                <button onClick={() => setShowRejectJobModal(true)} className="btn-premium bg-[var(--error)] text-white hover:opacity-90">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                {job?.technician_response_deadline && (
                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {getResponseTimeRemaining()}
                  </span>
                )}
              </>
            )}
            {/* Start Job button - only after technician accepts (or for admin/supervisor) */}
            {((isTechnician && isAssigned && !isHelperOnly && hasAccepted) || 
              ((isAdmin || isSupervisor) && isAssigned && !isHelperOnly)) && (
              <button onClick={handleOpenStartJobModal} className="btn-premium btn-premium-primary">
                <Play className="w-4 h-4" /> Start Job
              </button>
            )}
            {(isTechnician || isAdmin || isSupervisor) && isInProgress && !isHelperOnly && (
              <div className="relative group">
                <button 
                  onClick={() => handleStatusChange(JobStatus.AWAITING_FINALIZATION)} 
                  disabled={!hasBothSignatures}
                  className={`btn-premium ${hasBothSignatures ? 'btn-premium-primary' : 'btn-premium-secondary opacity-60 cursor-not-allowed'}`}
                >
                  <CheckCircle className="w-4 h-4" /> Complete
                </button>
                {!hasBothSignatures && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--text)] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    Both signatures required
                  </div>
                )}
              </div>
            )}
            {(isTechnician || isAdmin || isSupervisor) && isInProgress && !isHelperOnly && (
              <button onClick={() => setShowContinueTomorrowModal(true)} className="btn-premium btn-premium-secondary">
                <Clock className="w-4 h-4" /> Continue Tomorrow
              </button>
            )}
            {(isTechnician || isAdmin || isSupervisor) && isIncompleteContinuing && !isHelperOnly && (
              <button onClick={handleResumeJob} className="btn-premium btn-premium-primary">
                <Play className="w-4 h-4" /> Resume Job
              </button>
            )}
            {(isTechnician || isAdmin || isSupervisor) && isInProgress && !isHelperOnly && job.technician_signature && !job.customer_signature && (
              <button
                onClick={() => setShowDeferredModal(true)}
                className="btn-premium btn-premium-secondary border-[var(--warning)] text-[var(--warning)] hover:bg-[var(--warning-bg)] hover:border-[var(--warning)] hover:text-[var(--warning)]"
              >
                <UserCheck className="w-4 h-4" /> Customer Unavailable
              </button>
            )}
            {(isAccountant || isAdmin) && isAwaitingFinalization && (
              <button onClick={() => setShowFinalizeModal(true)} className="btn-premium btn-premium-primary">
                Finalize Invoice
              </button>
            )}
            {(isTechnician || isAdmin || isSupervisor) && (isInProgress || isAwaitingFinalization || isCompleted || isAwaitingAck || isDisputed) && (
              <button onClick={handlePrintServiceReport} className="btn-premium btn-premium-secondary">
                <FileCheck className="w-4 h-4" /> Report
              </button>
            )}
            {(isAccountant || isAdmin) && (isAwaitingFinalization || isCompleted) && (
              <button onClick={handleExportPDF} className="btn-premium btn-premium-secondary">
                <FileDown className="w-4 h-4" /> Invoice
              </button>
            )}
            {(isAccountant || isAdmin) && isCompleted && (
              <button
                onClick={handleExportToAutoCount}
                disabled={exportingToAutoCount}
                className="btn-premium btn-premium-secondary"
                title="Export to AutoCount"
              >
                <Send className="w-4 h-4" /> {exportingToAutoCount ? 'Exporting...' : 'AutoCount'}
              </button>
            )}
            {(isAdmin || isSupervisor) && !isCompleted && (
              <button onClick={() => setShowDeleteModal(true)} className="btn-premium btn-premium-ghost text-[var(--error)] hover:bg-[var(--error-bg)] hover:text-[var(--error)]">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Equipment Card */}
          {job.forklift && (
            <div className="card-premium card-tint-warning p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--warning-bg)] flex items-center justify-center">
                  <Truck className="w-5 h-5 text-[var(--warning)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text)]">Equipment</h3>
                  <p className="text-xs text-[var(--text-muted)]">{job.forklift.make} {job.forklift.model}</p>
                </div>
              </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                  <p className="label-premium mb-1">Serial Number</p>
                  <p className="font-mono value-premium">{job.forklift.serial_number}</p>
                </div>
                <div>
                  <p className="label-premium mb-1">Type</p>
                  <p className="value-premium-secondary">{job.forklift.type}</p>
                </div>
                <div>
                  <p className="label-premium mb-1 flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> Hourmeter
                  </p>
                  {editingHourmeter ? (
                    <div className="flex items-center gap-1">
                      <input type="number" className="input-premium w-20 text-sm py-1" value={hourmeterInput} onChange={(e) => setHourmeterInput(e.target.value)} autoFocus />
                      <button onClick={handleSaveHourmeter} className="p-1 text-[var(--success)] hover:bg-[var(--success-bg)] rounded"><Save className="w-3.5 h-3.5" /></button>
                      <button onClick={handleCancelHourmeterEdit} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] rounded"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-1">
                        <span className={`font-semibold ${job.hourmeter_flagged ? 'text-[var(--error)]' : 'text-[var(--text)]'}`}>
                          {(job.hourmeter_reading || job.forklift.hourmeter).toLocaleString()} hrs
                        </span>
                        {job.hourmeter_flagged && (
                          <AlertTriangle className="w-3.5 h-3.5 text-[var(--error)]" />
                        )}
                        {/* Edit button: Only show for first recorder, admins, or if no one recorded yet */}
                        {(isInProgress || (isAdmin && !isCompleted)) && (
                          (!job.first_hourmeter_recorded_by_id || // No one recorded yet
                            job.first_hourmeter_recorded_by_id === currentUserId || // Current user recorded it
                            isAdmin || isSupervisor) && ( // Admins can always edit
                            <button onClick={handleStartEditHourmeter} className="p-1 text-[var(--warning)] hover:bg-[var(--warning-bg)] rounded"><Edit2 className="w-3 h-3" /></button>
                          )
                        )}
                      </div>
                      {/* Show who recorded the hourmeter (for subsequent technicians) */}
                      {job.first_hourmeter_recorded_by_id && job.first_hourmeter_recorded_by_id !== currentUserId && isTechnician && (
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          Recorded by {job.first_hourmeter_recorded_by_name || 'Another technician'}
                        </p>
                      )}
                      {/* Amendment button for technicians who didn't record it */}
                      {job.first_hourmeter_recorded_by_id && job.first_hourmeter_recorded_by_id !== currentUserId && isTechnician && (
                        <button
                          onClick={() => setShowHourmeterAmendmentModal(true)}
                          className="mt-1 text-xs text-[var(--accent)] hover:underline"
                        >
                          Request Amendment
                        </button>
                      )}
                      {/* Hourmeter flag warning */}
                      {job.hourmeter_flagged && job.hourmeter_flag_reasons && job.hourmeter_flag_reasons.length > 0 && (
                        <div className="mt-1">
                          <div className="flex flex-wrap gap-1 text-xs">
                            {job.hourmeter_flag_reasons.map((flag) => (
                              <span key={flag} className="px-1.5 py-0.5 bg-[var(--error-bg)] text-[var(--error)] rounded">
                                {flag === 'lower_than_previous' ? 'Lower' : flag === 'excessive_jump' ? 'High Jump' : flag}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => setShowHourmeterAmendmentModal(true)}
                            className="mt-1 text-xs text-[var(--accent)] hover:underline"
                          >
                            Request Amendment
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {activeRental && (
                  <div>
                    <p className="label-premium mb-1">Location</p>
                    <p className="text-[var(--text-secondary)] text-sm">{activeRental.rental_location || activeRental.customer_name}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Repair Time Card */}
          {(isInProgress || isAwaitingFinalization || isCompleted) && job.repair_start_time && (
            <div className="card-premium card-tint-info p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--info-bg)] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-[var(--info)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text)]">Repair Time</h3>
                  {repairDuration && (
                    <p className="text-xs text-[var(--accent)] font-medium">{repairDuration.hours}h {repairDuration.minutes}m</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="label-premium mb-1">Started</p>
                  <p className="font-mono text-sm text-[var(--text)]">{new Date(job.repair_start_time).toLocaleTimeString()}</p>
                  <p className="text-xs text-[var(--text-muted)]">{new Date(job.repair_start_time).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="label-premium mb-1">Ended</p>
                  {job.repair_end_time ? (
                    <>
                      <p className="font-mono text-sm text-[var(--text)]">{new Date(job.repair_end_time).toLocaleTimeString()}</p>
                      <p className="text-xs text-[var(--text-muted)]">{new Date(job.repair_end_time).toLocaleDateString()}</p>
                    </>
                  ) : (
                    <p className="text-[var(--text-muted)] italic text-sm">In Progress</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Customer & Assignment Card */}
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
            {(isAdmin || isSupervisor) && isNew && (
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5" /> Assign Technician
                </p>
                <div className="flex gap-2">
                  <div className="flex-1"><Combobox options={techOptions} value={selectedTechId} onChange={setSelectedTechId} placeholder="Select Technician..." /></div>
                  <button onClick={handleAssignJob} disabled={!selectedTechId} className="btn-premium btn-premium-primary disabled:opacity-50">Assign</button>
                </div>
              </div>
            )}

            {/* Current Assignment */}
            {canReassign && job.assigned_technician_id && !isCompleted && (
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

            {/* Helper Section */}
            {(isInProgress || isAwaitingFinalization) && (
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <div className={`rounded-xl border border-[var(--border-subtle)] p-3 flex justify-between items-center ${
                  job.helper_assignment ? 'bg-[var(--bg-subtle)]' : 'bg-[var(--warning-bg)]'
                }`}>
                  <div>
                    <p className="label-premium mb-1">Helper Technician</p>
                    {job.helper_assignment ? (
                      <p className="value-premium">{job.helper_assignment.technician?.name || 'Unknown'}</p>
                    ) : (
                      <p className="text-[var(--text-muted)] text-sm">No helper assigned</p>
                    )}
                  </div>
                  {canReassign && (
                    <>
                      {job.helper_assignment ? (
                        <button onClick={handleRemoveHelper} className="chip-premium chip-premium-danger">
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      ) : (
                        <button onClick={() => setShowAssignHelperModal(true)} className="chip-premium chip-premium-warning">
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

          {/* Job Details Card */}
          <div className="card-premium p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <h3 className="font-semibold text-[var(--text)]">Job Details</h3>
              </div>
              {(isInProgress || isAwaitingFinalization) && !editingJobCarriedOut && !isHelperOnly && (
                <button onClick={handleStartEditJobCarriedOut} className="btn-premium btn-premium-ghost text-xs">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>
            
            {editingJobCarriedOut ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Job Carried Out</label>
                  <textarea className="input-premium min-h-[100px] resize-none" placeholder="Describe the work performed..." value={jobCarriedOutInput} onChange={(e) => setJobCarriedOutInput(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Recommendation</label>
                  <textarea className="input-premium min-h-[80px] resize-none" placeholder="Any recommendations..." value={recommendationInput} onChange={(e) => setRecommendationInput(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveJobCarriedOut} className="btn-premium btn-premium-primary flex-1">Save</button>
                  <button onClick={handleCancelJobCarriedOutEdit} className="btn-premium btn-premium-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="label-premium mb-1">Job Carried Out</p>
                  <p className="text-[var(--text-secondary)] text-sm">{job.job_carried_out || <span className="italic text-[var(--text-muted)]">Not specified</span>}</p>
                </div>
                <div>
                  <p className="label-premium mb-1">Recommendation</p>
                  <p className="text-[var(--text-secondary)] text-sm">{job.recommendation || <span className="italic text-[var(--text-muted)]">None</span>}</p>
                </div>
              </div>
            )}
          </div>

          {/* Confirmation Status Card - Shows for Awaiting Finalization or Completed jobs */}
          {(isAwaitingFinalization || isCompleted) && (
            <div className="card-premium p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <h3 className="font-semibold text-[var(--text)]">Confirmation Status</h3>
              </div>

              <div className="space-y-3">
                {/* Parts Confirmation (Admin 2 - Store) */}
                <div className="flex items-center justify-between p-3 bg-[var(--bg-subtle)] rounded-lg">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-sm text-[var(--text-secondary)]">Parts Confirmation</span>
                    <span className="text-xs text-[var(--text-muted)]">(Admin 2)</span>
                  </div>
                  {job.parts_confirmed_at ? (
                    <div className="flex items-center gap-2 text-[var(--success)]">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">{job.parts_confirmed_by_name}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(job.parts_confirmed_at).toLocaleDateString()}
                      </span>
                    </div>
                  ) : job.parts_confirmation_skipped ? (
                    <span className="text-sm text-[var(--text-muted)] italic">Skipped (no parts)</span>
                  ) : job.parts_used.length === 0 ? (
                    <span className="text-sm text-[var(--text-muted)] italic">N/A (no parts used)</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-amber-600">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Pending</span>
                      </div>
                      {(isAdminStore || isAdmin || isAccountant) && (
                        <button 
                          onClick={handleConfirmParts}
                          className="ml-2 px-3 py-1 text-xs bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Verify Parts
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Job Confirmation (Admin 1 - Service) */}
                <div className="flex items-center justify-between p-3 bg-[var(--bg-subtle)] rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-sm text-[var(--text-secondary)]">Job Confirmation</span>
                    <span className="text-xs text-[var(--text-muted)]">(Admin 1)</span>
                  </div>
                  {job.job_confirmed_at ? (
                    <div className="flex items-center gap-2 text-[var(--success)]">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">{job.job_confirmed_by_name}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(job.job_confirmed_at).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Pending</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmation Notes */}
              {(job.parts_confirmation_notes || job.job_confirmation_notes) && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  {job.parts_confirmation_notes && (
                    <p className="text-sm text-amber-800">
                      <span className="font-medium">Parts:</span> {job.parts_confirmation_notes}
                    </p>
                  )}
                  {job.job_confirmation_notes && (
                    <p className="text-sm text-amber-800 mt-1">
                      <span className="font-medium">Job:</span> {job.job_confirmation_notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Condition Checklist */}
          {job.condition_checklist && Object.keys(job.condition_checklist).length > 0 && (
            <div className="card-premium p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text)]">Condition Checklist</h3>
                    {/* Mandatory items progress */}
                    <p className="text-xs text-[var(--text-muted)]">
                      {getChecklistProgress().checked}/{getChecklistProgress().total} mandatory items checked
                    </p>
                  </div>
                </div>
                {(isInProgress || isAwaitingFinalization) && !editingChecklist && !isHelperOnly && (
                  <button onClick={handleStartEditChecklist} className="btn-premium btn-premium-ghost text-xs">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>

              {editingChecklist ? (
                <div className="space-y-4">
                  {/* Check All Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowCheckAllConfirmModal(true)}
                      className="btn-premium btn-premium-secondary text-xs"
                    >
                      <CheckSquare className="w-3.5 h-3.5" /> Check All
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {CHECKLIST_CATEGORIES.map(cat => (
                      <div key={cat.name} className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl">
                        <p className="font-medium text-[var(--text-secondary)] text-xs mb-2">{cat.name}</p>
                        <div className="space-y-2">
                          {cat.items.map(item => {
                            const itemState = normalizeChecklistState(checklistEditData[item.key as keyof ForkliftConditionChecklist]);
                            return (
                              <div key={item.key} className="flex items-center justify-between gap-2">
                                <span className={`text-xs flex-1 ${
                                  itemState === 'ok' ? 'text-[var(--success)]' :
                                  itemState === 'not_ok' ? 'text-[var(--error)]' :
                                  'text-[var(--text-muted)]'
                                }`}>
                                  {item.label}
                                  {isMandatoryItem(item.key) && <span className="text-red-500 ml-0.5">*</span>}
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setChecklistItemState(item.key, 'ok')}
                                    className={`p-1 rounded text-xs transition-colors ${
                                      itemState === 'ok'
                                        ? 'bg-[var(--success)] text-white'
                                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--success-bg)] hover:text-[var(--success)]'
                                    }`}
                                    title="OK"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setChecklistItemState(item.key, 'not_ok')}
                                    className={`p-1 rounded text-xs transition-colors ${
                                      itemState === 'not_ok'
                                        ? 'bg-[var(--error)] text-white'
                                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--error-bg)] hover:text-[var(--error)]'
                                    }`}
                                    title="Not OK"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveChecklist} className="btn-premium btn-premium-primary flex-1">Save</button>
                    <button onClick={handleCancelChecklistEdit} className="btn-premium btn-premium-secondary">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {CHECKLIST_CATEGORIES.map(cat => {
                    // Filter items that have been checked (either OK or Not OK)
                    const checkedItems = cat.items.filter(item => {
                      const state = normalizeChecklistState(job.condition_checklist?.[item.key as keyof ForkliftConditionChecklist]);
                      return state === 'ok' || state === 'not_ok';
                    });
                    if (checkedItems.length === 0) return null;
                    return (
                      <div key={cat.name} className="bg-[var(--surface)] border border-[var(--border)] p-2 rounded-lg">
                        <p className="font-medium text-[var(--text-secondary)] text-[10px] uppercase tracking-wide mb-1">{cat.name}</p>
                        {checkedItems.map(item => {
                          const state = normalizeChecklistState(job.condition_checklist?.[item.key as keyof ForkliftConditionChecklist]);
                          return (
                            <div key={item.key} className={`flex items-center gap-1 text-xs ${
                              state === 'ok' ? 'text-[var(--success)]' : 'text-[var(--error)]'
                            }`}>
                              {state === 'ok' ? (
                                <CheckCircle className="w-3 h-3" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                              {item.label}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Parts Section */}
          <div className="card-premium p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                  <Box className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text)]">Parts Used</h3>
                  <p className="text-xs text-[var(--text-muted)]">{job.parts_used.length} items</p>
                </div>
              </div>
              {canEditPrices && <span className="badge badge-info text-[10px]">Editable</span>}
            </div>

            {/* Technician parts filter: Only show confirmed parts */}
            {isTechnician && job.parts_used.length > 0 && !job.parts_confirmed_at ? (
              <div className="mb-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                  <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
                    <Clock className="w-4 h-4" />
                    Parts Pending Verification
                  </div>
                  <p className="text-amber-600 text-xs">
                    {job.parts_used.length} part(s) added. Waiting for Admin 2 (Store) verification before displaying.
                  </p>
                </div>
              </div>
            ) : job.parts_used.length > 0 ? (
              <div className="space-y-2 mb-4">
                {/* Show confirmation status for technicians */}
                {isTechnician && job.parts_confirmed_at && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-[var(--success)]">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Verified by {job.parts_confirmed_by_name} on {new Date(job.parts_confirmed_at).toLocaleDateString()}</span>
                  </div>
                )}
                {job.parts_used.map(p => (
                  <div key={p.job_part_id} className="flex items-center justify-between p-3 bg-[var(--bg-subtle)] rounded-xl">
                    <div>
                      <span className="font-medium text-[var(--text)]">{p.quantity}× {p.part_name}</span>
                    </div>
                    {canViewPricing && editingPartId === p.job_part_id ? (
                      <div className="flex items-center gap-2">
                        <div className="relative w-24">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">RM</span>
                          <input type="number" className="input-premium input-premium-prefix text-sm" value={editingPrice} onChange={(e) => setEditingPrice(e.target.value)} autoFocus />
                        </div>
                        <button onClick={() => handleSavePartPrice(p.job_part_id)} className="p-1 text-[var(--success)] hover:bg-[var(--success-bg)] rounded"><Save className="w-4 h-4" /></button>
                        <button onClick={handleCancelEdit} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : canViewPricing ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--text-secondary)]">RM{p.sell_price_at_time.toFixed(2)}</span>
                        {canEditPrices && (
                          <>
                            <button onClick={() => handleStartEditPrice(p.job_part_id, p.sell_price_at_time)} className="p-1 text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleRemovePart(p.job_part_id)} className="p-1 text-[var(--error)] hover:bg-[var(--error-bg)] rounded"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    ) : null /* Technicians: no pricing shown */}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-[var(--text-muted)] italic text-sm mb-3">No parts added yet.</p>
                {(isInProgress || isAwaitingFinalization) && !isHelperOnly && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm bg-[var(--warning-bg)] p-3 rounded-xl border border-[var(--warning)] border-opacity-20">
                    <input type="checkbox" checked={noPartsUsed} onChange={handleToggleNoPartsUsed} className="rounded border-[var(--border)] text-[var(--warning)]" />
                    <span className={noPartsUsed ? 'text-[var(--warning)] font-medium' : 'text-[var(--text-secondary)]'}>
                      No parts were used for this job
                    </span>
                    {noPartsUsed && <CheckCircle className="w-4 h-4 text-[var(--warning)] ml-auto" />}
                  </label>
                )}
              </div>
            )}

            {/* Technician hint: Use Spare Part Request instead of direct add */}
            {isTechnician && !canAddParts && (isInProgress || isAwaitingFinalization) && (
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <div className="p-3 bg-[var(--info-bg)] rounded-xl text-xs text-[var(--info)] flex items-center gap-2">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>Need additional parts? Use <strong>Spare Part Request</strong> in the In-Job Requests section below.</span>
                </div>
              </div>
            )}

            {canAddParts && (
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Add Part</p>
                  {/* Van Stock toggle - only show for admins/supervisors with Van Stock access */}
                  {vanStock && (isAdmin || isSupervisor) && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <span className={useFromVanStock ? 'text-blue-600 font-medium' : 'text-[var(--text-muted)]'}>
                        <Truck className="w-3.5 h-3.5 inline mr-1" />
                        Van Stock
                      </span>
                      <div
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          useFromVanStock ? 'bg-blue-600' : 'bg-slate-300'
                        }`}
                        onClick={() => {
                          setUseFromVanStock(!useFromVanStock);
                          setSelectedPartId('');
                          setSelectedVanStockItemId('');
                          setSelectedPartPrice('');
                        }}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            useFromVanStock ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </label>
                  )}
                </div>

                {/* Customer-owned forklift warning */}
                {useFromVanStock && isCustomerOwnedForklift && (
                  <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Customer-owned forklift: Van Stock usage requires admin approval</span>
                  </div>
                )}

                <div className="flex gap-2 items-start">
                  {useFromVanStock ? (
                    /* Van Stock part selector */
                    <div className="flex-1">
                      <Combobox
                        options={vanStockOptions}
                        value={selectedVanStockItemId}
                        onChange={(val) => {
                          setSelectedVanStockItemId(val);
                          const item = vanStock?.items?.find(i => i.item_id === val);
                          if (item?.part) setSelectedPartPrice(item.part.sell_price.toString());
                        }}
                        placeholder="Search Van Stock..."
                      />
                    </div>
                  ) : (
                    /* Warehouse part selector */
                    <div className="flex-1">
                      <Combobox
                        options={partOptions}
                        value={selectedPartId}
                        onChange={(val) => {
                          setSelectedPartId(val);
                          const p = parts.find(x => x.part_id === val);
                          if (p) setSelectedPartPrice(p.sell_price.toString());
                        }}
                        placeholder="Search parts..."
                      />
                    </div>
                  )}
                  {/* Only show price input for users who can view pricing */}
                  {canViewPricing && (
                    <div className="w-24">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">RM</span>
                        <input type="number" className="input-premium input-premium-prefix text-sm" placeholder="Price" value={selectedPartPrice} onChange={(e) => setSelectedPartPrice(e.target.value)} />
                      </div>
                    </div>
                  )}
                  <button onClick={handleAddPart} className="btn-premium btn-premium-primary"><Plus className="w-5 h-5" /></button>
                </div>
              </div>
            )}
          </div>

          {/* Extra Charges - Hidden from technicians */}
          {canViewPricing && (
          <div className="card-premium p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <h3 className="font-semibold text-[var(--text)]">Extra Charges</h3>
              </div>
              {canEditPrices && !showAddCharge && (
                <button onClick={() => setShowAddCharge(true)} className="btn-premium btn-premium-ghost text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>

            {job.extra_charges && job.extra_charges.length > 0 ? (
              <div className="space-y-2 mb-4">
                {job.extra_charges.map(charge => (
                  <div key={charge.charge_id} className="flex items-center justify-between p-3 bg-[var(--warning-bg)] rounded-xl">
                    <div>
                      <p className="font-medium text-[var(--text)]">{charge.name}</p>
                      {charge.description && <p className="text-xs text-[var(--text-muted)]">{charge.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[var(--text-secondary)]">RM{charge.amount.toFixed(2)}</span>
                      {canEditPrices && (
                        <button onClick={() => handleRemoveExtraCharge(charge.charge_id)} className="p-1 text-[var(--error)] hover:bg-[var(--error-bg)] rounded"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[var(--text-muted)] italic text-sm mb-4">No extra charges added.</p>
            )}

            {showAddCharge && canEditPrices && (
              <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Name *</label>
                  <input type="text" className="input-premium" placeholder="e.g., Emergency Call-Out Fee" value={chargeName} onChange={(e) => setChargeName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Description</label>
                  <input type="text" className="input-premium" placeholder="Optional details..." value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Amount *</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">RM</span>
                    <input type="number" className="input-premium input-premium-prefix" placeholder="0.00" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddExtraCharge} className="btn-premium btn-premium-primary flex-1">Add Charge</button>
                  <button onClick={() => { setShowAddCharge(false); setChargeName(''); setChargeDescription(''); setChargeAmount(''); }} className="btn-premium btn-premium-secondary">Cancel</button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Photos Section */}
          {(isTechnician || isAdmin || isSupervisor) && (
            <div className="card-premium p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                    <Camera className="w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text)]">Photos</h3>
                    <p className="text-xs text-[var(--text-muted)]">{job.media.length} uploaded</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(isNew || isAssigned || isInProgress || isAwaitingFinalization || isIncompleteContinuing || isIncompleteReassigned) && (
                    <>
                      <select
                        value={uploadPhotoCategory}
                        onChange={(e) => setUploadPhotoCategory(e.target.value)}
                        className="text-xs px-2 py-1 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-secondary)]"
                      >
                        {PHOTO_CATEGORIES.map(cat => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
                      </select>
                    </>
                  )}
                  {job.media.length > 0 && (
                    <button onClick={handleDownloadPhotos} disabled={downloadingPhotos} className="btn-premium btn-premium-ghost text-xs">
                      <Download className="w-3.5 h-3.5" /> {downloadingPhotos ? 'Downloading...' : 'ZIP'}
                    </button>
                  )}
                </div>
              </div>

              {job.media.length === 0 ? (
                <div
                  className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
                    isPhotoDragActive
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-subtle)]'
                  }`}
                  onDragOver={handlePhotoDragOver}
                  onDragEnter={handlePhotoDragEnter}
                  onDragLeave={handlePhotoDragLeave}
                  onDrop={handlePhotoDrop}
                >
                  {(isNew || isAssigned || isInProgress || isAwaitingFinalization || isIncompleteContinuing || isIncompleteReassigned) ? (
                    <>
                      <label className="cursor-pointer flex flex-col items-center justify-center text-center min-h-[180px]">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex items-center justify-center mb-3">
                          <Camera className="w-7 h-7 text-[var(--text-muted)]" />
                        </div>
                        <p className="text-sm font-semibold text-[var(--text)]">Drop photos here</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">or click to upload</p>
                        <p className="text-xs text-[var(--text-muted)] mt-3">
                          Uploads default to <span className="font-medium text-[var(--text-secondary)]">{PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other'}</span>
                        </p>
                        <span className="btn-premium btn-premium-primary mt-4 text-xs">Upload Photo</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                      </label>
                    </>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-sm text-[var(--text-muted)]">Photos can be uploaded once the job is active.</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Category Filter */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <button onClick={() => setPhotoCategoryFilter('all')} className={`px-2.5 py-1 text-xs font-medium rounded-full transition ${photoCategoryFilter === 'all' ? 'bg-[var(--text)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}>
                      All ({job.media.length})
                    </button>
                    {PHOTO_CATEGORIES.map(cat => {
                      const count = job.media.filter(m => m.category === cat.value).length;
                      if (count === 0) return null;
                      return (
                        <button key={cat.value} onClick={() => setPhotoCategoryFilter(cat.value)} className={`px-2.5 py-1 text-xs font-medium rounded-full transition ${photoCategoryFilter === cat.value ? `${cat.color} text-white` : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}>
                          {cat.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Photo Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {job.media.filter(m => photoCategoryFilter === 'all' || m.category === photoCategoryFilter).map(m => {
                      const catInfo = PHOTO_CATEGORIES.find(c => c.value === m.category) || PHOTO_CATEGORIES.find(c => c.value === 'other');
                      return (
                        <div key={m.media_id} className="relative group aspect-square">
                          <img src={m.url} alt="Job" className="w-full h-full object-cover rounded-xl border border-[var(--border)]" />
                          <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-medium text-white rounded ${catInfo?.color || 'bg-slate-500'}`}>
                            {catInfo?.label || 'Other'}
                          </span>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-2 py-1.5 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="truncate">{new Date(m.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Upload Button */}
                    {(isNew || isAssigned || isInProgress || isAwaitingFinalization || isIncompleteContinuing || isIncompleteReassigned) && (
                  <div className="aspect-square border-2 border-dashed border-[var(--border)] rounded-xl flex flex-col items-center justify-center text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                    <label className="cursor-pointer flex flex-col items-center">
                      <Camera className="w-5 h-5 mb-0.5" />
                      <span className="text-[9px]">Add</span>
                      <span className="text-[9px] text-[var(--text-muted)] mt-0.5">{PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Notes Section */}
          {(isTechnician || isAdmin || isSupervisor) && (
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

              {(isAssigned || isInProgress) && !isHelperOnly && (
                <div className="flex gap-2">
                  <input type="text" placeholder="Add a note..." className="input-premium flex-1" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
                  <button onClick={handleAddNote} className="btn-premium btn-premium-primary">Add</button>
                </div>
              )}
            </div>
          )}

          {/* Requests Section - Available when job is assigned or in progress */}
          {(isAssigned || isInProgress) && !isHelperOnly && (
            <div className="card-premium p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                    <MessageSquarePlus className="w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text)]">Requests</h3>
                    {jobRequests.filter(r => r.status === 'pending').length > 0 && (
                      <span className="badge badge-warning text-[10px]">{jobRequests.filter(r => r.status === 'pending').length} pending</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Request Buttons */}
              {(isTechnician || isAdmin || isSupervisor) && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button onClick={() => openRequestModal('assistance')} className="btn-premium btn-premium-secondary text-xs">
                    <HandHelping className="w-3.5 h-3.5" /> Assistance
                  </button>
                  <button onClick={() => openRequestModal('spare_part')} className="btn-premium btn-premium-secondary text-xs">
                    <Wrench className="w-3.5 h-3.5" /> Spare Part
                  </button>
                  <button onClick={() => openRequestModal('skillful_technician')} className="btn-premium btn-premium-secondary text-xs">
                    <HelpCircle className="w-3.5 h-3.5" /> Skillful Tech
                  </button>
                </div>
              )}

              {/* Existing Requests */}
              {jobRequests.length > 0 ? (
                <div className="space-y-2">
                  {jobRequests.map(req => (
                    <div key={req.request_id} className={`p-3 rounded-xl border ${req.status === 'pending' ? 'bg-[var(--warning-bg)] border-[var(--warning)] border-opacity-30' : req.status === 'approved' ? 'bg-[var(--success-bg)] border-[var(--success)] border-opacity-30' : 'bg-[var(--error-bg)] border-[var(--error)] border-opacity-30'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`badge text-[10px] ${req.request_type === 'assistance' ? 'badge-info' : req.request_type === 'spare_part' ? 'badge-warning' : 'bg-purple-100 text-purple-700'}`}>
                            {req.request_type === 'assistance' ? 'Assistance' : req.request_type === 'spare_part' ? 'Spare Part' : 'Skillful Tech'}
                          </span>
                          <span className={`badge text-[10px] ${req.status === 'pending' ? 'badge-warning' : req.status === 'approved' ? 'badge-success' : 'badge-error'}`}>
                            {req.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)]">{new Date(req.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{req.description}</p>
                      {req.admin_response_notes && (
                        <p className="text-xs text-[var(--text-muted)] mt-2 italic">Admin: {req.admin_response_notes}</p>
                      )}
                      {/* Edit button for own pending requests */}
                      {req.status === 'pending' && req.requested_by === currentUserId && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                          <button onClick={() => openEditRequestModal(req)} className="btn-premium btn-premium-secondary text-xs flex-1">
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                        </div>
                      )}
                      {/* Review button for admins */}
                      {req.status === 'pending' && (isAdmin || isSupervisor) && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                          <button onClick={() => openApprovalModal(req)} className="btn-premium btn-premium-primary text-xs flex-1">Review</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--text-muted)] text-sm text-center py-2">No requests yet</p>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-5">
          {/* Financial Summary - Hidden from technicians */}
          {canViewPricing && (
            <div className="card-premium-elevated card-tint-success p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--success-bg)] flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[var(--success)]" />
                </div>
                <h3 className="font-semibold text-[var(--text)]">Summary</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">Labor</span>
                  {editingLabor ? (
                    <div className="flex items-center gap-1">
                      <input type="number" className="input-premium w-20 text-sm py-1 pl-2" value={laborCostInput} onChange={(e) => setLaborCostInput(e.target.value)} autoFocus />
                      <button onClick={handleSaveLabor} className="p-1 text-[var(--success)]"><Save className="w-3 h-3" /></button>
                      <button onClick={handleCancelLaborEdit} className="p-1 text-[var(--text-muted)]"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-[var(--text)]">RM{laborCost.toFixed(2)}</span>
                      {canEditPrices && <button onClick={handleStartEditLabor} className="p-1 text-[var(--accent)]"><Edit2 className="w-3 h-3" /></button>}
                    </div>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Parts</span>
                  <span className="text-[var(--text)]">RM{totalPartsCost.toFixed(2)}</span>
                </div>
                {extraChargesCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Extra</span>
                    <span className="text-[var(--text)]">RM{extraChargesCost.toFixed(2)}</span>
                  </div>
                )}
                <div className="divider"></div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[var(--text)]">Total</span>
                  <span className="text-xl font-bold text-[var(--success)]">RM{totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
	          <div className="card-premium p-5">
	            <div className="flex items-center gap-3 mb-4">
	              <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
	                <Clock className="w-5 h-5 text-[var(--text-muted)]" />
	              </div>
	              <h3 className="font-semibold text-[var(--text)]">Timeline</h3>
	            </div>
	            <div className="space-y-3">
	              {job.created_at && (
	                <div className="flex items-start gap-3">
	                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0"></div>
	                  <div>
	                    <p className="text-sm font-medium text-[var(--text)]">Created</p>
	                    <p className="text-xs text-[var(--text-muted)]">{new Date(job.created_at).toLocaleString()}</p>
	                    {job.created_by_name && <p className="text-xs text-[var(--text-muted)]">By {job.created_by_name}</p>}
	                  </div>
	                </div>
	              )}
	              {job.assigned_at && (
	                <div className="flex items-start gap-3">
	                  <div className="w-2 h-2 rounded-full bg-[var(--warning)] mt-1.5 flex-shrink-0"></div>
	                  <div>
	                    <p className="text-sm font-medium text-[var(--text)]">Assigned</p>
	                    <p className="text-xs text-[var(--text-muted)]">{new Date(job.assigned_at).toLocaleString()}</p>
	                    {job.assigned_technician_name && <p className="text-xs text-[var(--text-muted)]">To {job.assigned_technician_name}</p>}
	                  </div>
	                </div>
	              )}
	              {job.started_at && (
	                <div className="flex items-start gap-3">
	                  <div className="w-2 h-2 rounded-full bg-[var(--success)] mt-1.5 flex-shrink-0"></div>
	                  <div>
	                    <p className="text-sm font-medium text-[var(--text)]">Started</p>
	                    <p className="text-xs text-[var(--text-muted)]">{new Date(job.started_at).toLocaleString()}</p>
	                  </div>
	                </div>
	              )}
	              {job.completed_at && (
	                <div className="flex items-start gap-3">
	                  <div className="w-2 h-2 rounded-full bg-[var(--success)] mt-1.5 flex-shrink-0"></div>
	                  <div>
	                    <p className="text-sm font-medium text-[var(--text)]">Completed</p>
	                    <p className="text-xs text-[var(--text-muted)]">{new Date(job.completed_at).toLocaleString()}</p>
	                    {job.completed_by_name && <p className="text-xs text-[var(--text-muted)]">By {job.completed_by_name}</p>}
	                  </div>
	                </div>
	              )}
	            </div>
	          </div>

	          {/* Signatures */}
	          <div className="card-premium p-5">
	            <div className="flex items-center gap-3 mb-4">
	              <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                <PenTool className="w-5 h-5 text-[var(--text-muted)]" />
              </div>
              <h3 className="font-semibold text-[var(--text)]">Signatures</h3>
            </div>

            {isInProgress && !hasBothSignatures && (
              <div className="p-3 bg-[var(--warning-bg)] rounded-xl text-xs text-[var(--warning)] mb-4">
                <strong>Required:</strong>
                <ul className="mt-1 ml-4 list-disc">
                  {!job.technician_signature && <li>Technician signature</li>}
                  {!job.customer_signature && <li>Customer signature</li>}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              {/* Technician Signature */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Technician</span>
                </div>
                {job.technician_signature ? (
                  <div>
                    <div className="flex items-center gap-1 text-[var(--success)] text-xs font-medium mb-2">
                      <CheckCircle className="w-3.5 h-3.5" /> Signed
                    </div>
                    <img src={job.technician_signature.signature_url} alt="Tech Signature" className="w-full h-16 object-contain bg-white rounded border border-[var(--border)]" />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{job.technician_signature.signed_by_name}</p>
                  </div>
                ) : (
                  isTechnician && !isHelperOnly && (isInProgress || isAwaitingFinalization) ? (
                    <button onClick={() => setShowTechSigPad(true)} className="w-full py-3 border-2 border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-2">
                      <PenTool className="w-4 h-4" /> Sign
                    </button>
                  ) : (
                    <div className="text-center py-3 text-[var(--text-muted)] text-xs">Waiting...</div>
                  )
                )}
              </div>

              {/* Customer Signature */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-[var(--success)]" />
                  <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Customer</span>
                </div>
                {job.customer_signature ? (
                  <div>
                    <div className="flex items-center gap-1 text-[var(--success)] text-xs font-medium mb-2">
                      <CheckCircle className="w-3.5 h-3.5" /> Signed
                    </div>
                    <img src={job.customer_signature.signature_url} alt="Customer Signature" className="w-full h-16 object-contain bg-white rounded border border-[var(--border)]" />
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">{job.customer_signature.signed_by_name}</p>
                  </div>
                ) : (
                  !isHelperOnly && (isInProgress || isAwaitingFinalization) ? (
                    <button onClick={() => setShowCustSigPad(true)} className="w-full py-3 border-2 border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:text-[var(--success)] hover:border-[var(--success)] transition-colors flex items-center justify-center gap-2">
                      <PenTool className="w-4 h-4" /> Collect Signature
                    </button>
                  ) : (
                    <div className="text-center py-3 text-[var(--text-muted)] text-xs">Waiting...</div>
                  )
                )}
              </div>
            </div>
          </div>

	          {/* AI Assistant */}
	          <div className="card-premium card-tint-info p-5">
	            <div className="flex items-center gap-3 mb-3">
	              <div className="w-10 h-10 rounded-xl bg-[var(--info-bg)] flex items-center justify-center">
	                <BrainCircuit className="w-5 h-5 text-[var(--info)]" />
	              </div>
	              <h3 className="font-semibold text-[var(--text)]">AI Assistant</h3>
	            </div>
	            {aiSummary ? (
	              <div className="bg-[var(--surface)] p-3 rounded-xl text-sm text-[var(--text-secondary)] italic border border-[var(--border)]">
	                "{aiSummary}"
	              </div>
	            ) : (
	              <>
	                <p className="text-xs text-[var(--text-muted)] mb-3">Generate a professional job summary.</p>
	                <button onClick={handleAiSummary} disabled={generatingAi} className="btn-premium btn-premium-secondary w-full text-xs disabled:opacity-50">
	                  {generatingAi ? 'Thinking...' : 'Generate Summary'}
	                </button>
	              </>
	            )}
	          </div>
        </div>
      </div>

      {/* All Modals */}
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

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4 text-[var(--text)]">Finalize Invoice</h4>
            <p className="text-sm text-[var(--text-muted)] mb-6">This action cannot be undone.</p>
            <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-6">
              <div className="flex justify-between mb-1"><span className="text-[var(--text-muted)]">Total:</span><span className="font-bold text-xl text-[var(--success)]">RM{totalCost.toFixed(2)}</span></div>
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

      {/* Helper Modal */}
      {showAssignHelperModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4 text-[var(--warning)] flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Assign Helper
            </h4>
            <p className="text-sm text-[var(--text-muted)] mb-4">Helper can upload photos only.</p>
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Helper</label>
              <Combobox options={techOptions.filter(t => t.id !== job?.assigned_technician_id)} value={selectedHelperId} onChange={setSelectedHelperId} placeholder="Select helper..." />
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Notes (optional)</label>
              <input type="text" value={helperNotes} onChange={(e) => setHelperNotes(e.target.value)} placeholder="e.g., Assist with heavy lifting" className="input-premium" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowAssignHelperModal(false); setSelectedHelperId(''); setHelperNotes(''); }} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
              <button onClick={handleAssignHelper} disabled={!selectedHelperId} className="btn-premium bg-[var(--warning)] text-white hover:opacity-90 flex-1 disabled:opacity-50">
                <UserPlus className="w-4 h-4" /> Assign
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

      {/* Deferred Completion Modal */}
      {showDeferredModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4 text-[var(--warning)] flex items-center gap-2">
              <UserIcon className="w-5 h-5" /> Complete Without Customer Signature
            </h4>
            <div className="bg-[var(--warning-bg)] rounded-xl p-3 mb-4">
              <p className="text-sm text-[var(--warning)] font-medium">{job?.title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Customer has 5 business days to acknowledge.</p>
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason *</label>
              <textarea className="input-premium resize-none h-20" value={deferredReason} onChange={(e) => setDeferredReason(e.target.value)} placeholder="e.g., Customer not on-site..." />
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">End Hourmeter *</label>
              <input type="number" className="input-premium" value={deferredHourmeter} onChange={(e) => setDeferredHourmeter(e.target.value)} placeholder="Enter reading" />
            </div>
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Evidence Photos * (min 1)</label>
              {jobMedia.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 bg-[var(--bg-subtle)] rounded-xl">
                  {jobMedia.map((media: any) => (
                    <div key={media.media_id} onClick={() => setSelectedEvidenceIds(prev => prev.includes(media.media_id) ? prev.filter(id => id !== media.media_id) : [...prev, media.media_id])}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedEvidenceIds.includes(media.media_id) ? 'border-[var(--warning)] ring-2 ring-[var(--warning)]/30' : 'border-transparent hover:border-[var(--warning)]/50'}`}>
                      <img src={media.url} alt="Evidence" className="w-full h-14 object-cover" />
                      {selectedEvidenceIds.includes(media.media_id) && (
                        <div className="absolute inset-0 bg-[var(--warning)]/30 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-white" /></div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)] italic">No photos. Upload evidence first.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeferredModal(false); setDeferredReason(''); setDeferredHourmeter(''); setSelectedEvidenceIds([]); }} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
              <button onClick={handleDeferredCompletion} disabled={!deferredReason.trim() || selectedEvidenceIds.length === 0 || submittingDeferred} className="btn-premium bg-[var(--warning)] text-white hover:opacity-90 flex-1 disabled:opacity-50">
                {submittingDeferred ? 'Processing...' : 'Complete & Notify'}
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

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
              {editingRequestId && <><Edit2 className="w-5 h-5 text-[var(--accent)]" /> Edit Request</>}
              {!editingRequestId && requestType === 'assistance' && <><HandHelping className="w-5 h-5 text-[var(--info)]" /> Request Assistance</>}
              {!editingRequestId && requestType === 'spare_part' && <><Wrench className="w-5 h-5 text-[var(--warning)]" /> Request Spare Part</>}
              {!editingRequestId && requestType === 'skillful_technician' && <><HelpCircle className="w-5 h-5 text-purple-600" /> Request Skillful Tech</>}
            </h4>
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Description *</label>
              <textarea value={requestDescription} onChange={(e) => setRequestDescription(e.target.value)} placeholder="Describe what you need..." className="input-premium resize-none h-24" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowRequestModal(false); setRequestDescription(''); setRequestPhotoUrl(''); setEditingRequestId(null); }} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
              <button onClick={handleSubmitRequest} disabled={!requestDescription.trim() || submittingRequest} className="btn-premium btn-premium-primary flex-1 disabled:opacity-50">
                {editingRequestId ? (
                  <><Save className="w-4 h-4" /> {submittingRequest ? 'Saving...' : 'Save'}</>
                ) : (
                  <><Send className="w-4 h-4" /> {submittingRequest ? 'Submitting...' : 'Submit'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && approvalRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <h4 className="font-bold text-lg mb-4">Review Request</h4>
            <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-4">
              <p className="text-sm text-[var(--text-secondary)]">{approvalRequest.description}</p>
            </div>
            {approvalRequest.request_type === 'spare_part' && (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-sm font-medium text-[var(--text-muted)] mb-1 block">Select Part *</label>
                  <select value={approvalPartId} onChange={(e) => setApprovalPartId(e.target.value)} className="input-premium">
                    <option value="">-- Select Part --</option>
                    {parts.map(p => (<option key={p.part_id} value={p.part_id}>{p.part_name} (Stock: {p.stock_quantity})</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--text-muted)] mb-1 block">Quantity *</label>
                  <input type="number" min="1" value={approvalQuantity} onChange={(e) => setApprovalQuantity(e.target.value)} className="input-premium" />
                </div>
              </div>
            )}
            {approvalRequest.request_type === 'assistance' && (
              <div className="mb-4">
                <label className="text-sm font-medium text-[var(--text-muted)] mb-1 block">Assign Helper *</label>
                <select value={approvalHelperId} onChange={(e) => setApprovalHelperId(e.target.value)} className="input-premium">
                  <option value="">-- Select Technician --</option>
                  {technicians.filter(t => t.user_id !== job?.assigned_technician_id).map(t => (<option key={t.user_id} value={t.user_id}>{t.full_name || t.name}</option>))}
                </select>
              </div>
            )}
            <div className="mb-4">
              <label className="text-sm font-medium text-[var(--text-muted)] mb-1 block">Notes</label>
              <textarea value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} placeholder="Add notes..." className="input-premium resize-none h-20" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowApprovalModal(false)} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
              <button onClick={() => handleApproval(false)} disabled={submittingApproval} className="btn-premium bg-[var(--error)] text-white hover:opacity-90 disabled:opacity-50">Reject</button>
              <button onClick={() => handleApproval(true)} disabled={submittingApproval} className="btn-premium btn-premium-primary flex-1 disabled:opacity-50">Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Warning Modal */}
      {showChecklistWarningModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="font-bold text-lg text-[var(--text)]">Checklist Incomplete</h4>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              The following mandatory checklist items must be checked before completing the job:
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto">
              <ul className="space-y-2">
                {missingChecklistItems.map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-amber-800">
                    <Square className="w-4 h-4 text-amber-500" />
                    {item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowChecklistWarningModal(false)}
                className="btn-premium btn-premium-secondary flex-1"
              >
                Go Back & Fix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check All Confirmation Modal */}
      {showCheckAllConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="font-bold text-lg text-[var(--text)]">Confirm Check All</h4>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              You are about to check all items. Please confirm that you have <strong>physically verified each item</strong> on the forklift.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-800">
                This action will be recorded for audit purposes.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCheckAllConfirmModal(false)}
                className="btn-premium btn-premium-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  // Set all items to OK
                  const allOk: ForkliftConditionChecklist = {};
                  CHECKLIST_CATEGORIES.forEach(cat => {
                    cat.items.forEach(item => {
                      allOk[item.key as keyof ForkliftConditionChecklist] = 'ok';
                    });
                  });
                  setChecklistEditData(allOk);
                  setShowCheckAllConfirmModal(false);
                  // Record that "Check All OK" was used
                  if (job) {
                    await MockDb.updateJob(job.job_id, {
                      checklist_used_check_all: true,
                      checklist_check_all_confirmed: true,
                    });
                  }
                  showToast.info('All items checked', 'Remember to verify each item physically');
                }}
                className="btn-premium btn-premium-primary flex-1"
              >
                <CheckCircle className="w-4 h-4" /> Confirm & Check All
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

export default JobDetail;

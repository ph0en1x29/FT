import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, JobStatus, UserRole, Part, JobPriority, JobType, SignatureEntry, User, ForkliftConditionChecklist, MediaCategory } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { generateJobSummary } from '../services/geminiService';
import { SignaturePad } from '../components/SignaturePad';
import { Combobox, ComboboxOption } from '../components/Combobox';
import { printServiceReport } from '../components/ServiceReportPDF';
import { printQuotation, generateQuotationFromJob } from '../components/QuotationPDF';
import { printInvoice } from '../components/InvoicePDF';
import { showToast } from '../services/toastService';
import { 
  ArrowLeft, MapPin, Phone, User as UserIcon, Calendar, 
  CheckCircle, Plus, Camera, PenTool, Box, DollarSign, BrainCircuit, 
  ShieldCheck, UserCheck, UserPlus, Edit2, Trash2, Save, X, FileText, 
  Info, FileDown, Truck, Gauge, ClipboardList, Receipt, Play, Clock, 
  AlertTriangle, CheckSquare, Square, FileCheck, RefreshCw, Download, Filter
} from 'lucide-react';

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
  { value: 'before', label: 'Before Service', color: 'bg-blue-500' },
  { value: 'after', label: 'After Service', color: 'bg-green-500' },
  { value: 'spare_part', label: 'Spare Parts', color: 'bg-amber-500' },
  { value: 'condition', label: 'Condition Check', color: 'bg-purple-500' },
  { value: 'evidence', label: 'Evidence', color: 'bg-red-500' },
  { value: 'other', label: 'Other', color: 'bg-slate-500' },
];

const JobDetail: React.FC<JobDetailProps> = ({ currentUser }) => {
  const currentUserRole = currentUser.role;
  const currentUserId = currentUser.user_id;
  const currentUserName = currentUser.name;
  
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [parts, setParts] = useState<Part[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  
  // Interaction States
  const [noteInput, setNoteInput] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedPartPrice, setSelectedPartPrice] = useState<string>('');
  const [selectedTechId, setSelectedTechId] = useState('');
  const [showTechSigPad, setShowTechSigPad] = useState(false);
  const [showCustSigPad, setShowCustSigPad] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  
  // Price editing states
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  
  // Labor cost editing
  const [editingLabor, setEditingLabor] = useState(false);
  const [laborCostInput, setLaborCostInput] = useState<string>('');
  
  // Extra charges
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [chargeName, setChargeName] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState<string>('');

  // Invoice modals
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);

  // Hourmeter editing
  const [editingHourmeter, setEditingHourmeter] = useState(false);
  const [hourmeterInput, setHourmeterInput] = useState<string>('');

  // NEW: Start Job Modal with Condition Checklist
  const [showStartJobModal, setShowStartJobModal] = useState(false);
  const [startJobHourmeter, setStartJobHourmeter] = useState<string>('');
  const [conditionChecklist, setConditionChecklist] = useState<ForkliftConditionChecklist>({});
  
  // NEW: Job Carried Out and Recommendation editing
  const [editingJobCarriedOut, setEditingJobCarriedOut] = useState(false);
  const [jobCarriedOutInput, setJobCarriedOutInput] = useState('');
  const [recommendationInput, setRecommendationInput] = useState('');

  // NEW: Condition Checklist editing
  const [editingChecklist, setEditingChecklist] = useState(false);
  const [checklistEditData, setChecklistEditData] = useState<ForkliftConditionChecklist>({});

  // NEW: No parts used flag
  const [noPartsUsed, setNoPartsUsed] = useState(false);

  // Photo categorization states
  const [photoCategoryFilter, setPhotoCategoryFilter] = useState<string>('all');
  const [uploadPhotoCategory, setUploadPhotoCategory] = useState<string>('other');
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);

  // NEW: Job Reassignment Modal
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignTechId, setReassignTechId] = useState('');

  // NEW: Active rental info for forklift
  const [activeRental, setActiveRental] = useState<{
    rental_id: string;
    customer_name: string;
    rental_location: string;
    start_date: string;
  } | null>(null);

  // NEW: Delete job modal with reason
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');

  useEffect(() => {
    loadJob();
    loadParts();
    if (currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.SUPERVISOR) {
        loadTechnicians();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentUserRole]);

  const loadJob = async () => {
    if (!id) return;
    setLoading(true);
    const data = await MockDb.getJobById(id);
    setJob(data ? { ...data } : null);
    
    // Load service record to get no_parts_used flag
    if (data) {
      const serviceRecord = await MockDb.getJobServiceRecord(id);
      if (serviceRecord) {
        setNoPartsUsed(serviceRecord.no_parts_used || false);
      }
      
      // Load active rental info if forklift exists
      if (data.forklift_id) {
        const rental = await MockDb.getActiveRentalForForklift(data.forklift_id);
        setActiveRental(rental);
      }
    }
    
    setLoading(false);
  };

  const loadParts = async () => {
    const data = await MockDb.getParts();
    setParts(data);
  };

  const loadTechnicians = async () => {
      const data = await MockDb.getTechnicians();
      setTechnicians(data);
  };

  // Handle opening the Start Job modal
  const handleOpenStartJobModal = () => {
    if (!job) return;
    setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
    setConditionChecklist({});
    setShowStartJobModal(true);
  };

  // Handle condition checklist toggle
  const handleChecklistToggle = (key: string) => {
    setConditionChecklist(prev => ({
      ...prev,
      [key]: !prev[key as keyof ForkliftConditionChecklist]
    }));
  };

  // Handle starting job with condition check
  const handleStartJobWithCondition = async () => {
    if (!job) return;
    
    const hourmeter = parseInt(startJobHourmeter);
    if (isNaN(hourmeter) || hourmeter < 0) {
      showToast.error('Please enter a valid hourmeter reading');
      return;
    }
    
    // Client-side validation: must be >= forklift's current reading
    const currentForkliftHourmeter = job.forklift?.hourmeter || 0;
    if (hourmeter < currentForkliftHourmeter) {
      showToast.error(`Hourmeter must be ≥ ${currentForkliftHourmeter} (forklift's current reading)`);
      return;
    }

    try {
      const updated = await MockDb.startJobWithCondition(
        job.job_id, 
        hourmeter, 
        conditionChecklist,
        currentUserId,    // Started by ID
        currentUserName   // Started by Name
      );
      setJob({ ...updated } as Job);
      setShowStartJobModal(false);
      showToast.success('Job started', 'Status changed to In Progress');
    } catch (error) {
      showToast.error('Failed to start job', (error as Error).message);
    }
  };

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (!job) return;
    
    try {
      const updated = await MockDb.updateJobStatus(
        job.job_id, 
        newStatus,
        currentUserId,    // Completed by ID (for AWAITING_FINALIZATION)
        currentUserName   // Completed by Name
      );
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
        const updated = await MockDb.assignJob(
          job.job_id, 
          tech.user_id, 
          tech.name,
          currentUserId,    // Assigned by ID
          currentUserName   // Assigned by Name
        );
        setJob({ ...updated } as Job);
        setSelectedTechId('');
      }
  };

  // Handle job reassignment
  const handleReassignJob = async () => {
    if (!job || !reassignTechId) return;
    const tech = technicians.find(t => t.user_id === reassignTechId);
    if (tech) {
      try {
        const updated = await MockDb.reassignJob(
          job.job_id,
          tech.user_id,
          tech.name,
          currentUserId,
          currentUserName
        );
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
    const updated = await MockDb.addNote(job.job_id, noteInput);
    setJob({ ...updated } as Job);
    setNoteInput('');
  };

  const handleAddPart = async () => {
    if (!job || !selectedPartId) return;
    
    let finalPrice = undefined;
    if (selectedPartPrice !== '') {
        const parsed = parseFloat(selectedPartPrice);
        if (isNaN(parsed) || parsed < 0) {
            showToast.error('Please enter a valid price');
            return;
        }
        finalPrice = parsed;
    }

    try {
      const updated = await MockDb.addPartToJob(job.job_id, selectedPartId, 1, finalPrice);
      setJob({ ...updated } as Job);
      setSelectedPartId('');
      setSelectedPartPrice('');
      showToast.success('Part added to job');
    } catch (e) {
      showToast.error('Could not add part', 'Check stock availability');
    }
  };

  const handleStartEditPrice = (jobPartId: string, currentPrice: number) => {
    setEditingPartId(jobPartId);
    setEditingPrice(currentPrice.toString());
  };

  const handleSavePartPrice = async (jobPartId: string) => {
    if (!job) return;
    
    const parsed = parseFloat(editingPrice);
    if (isNaN(parsed) || parsed < 0) {
      showToast.error('Please enter a valid price');
      return;
    }

    try {
      const updated = await MockDb.updatePartPrice(job.job_id, jobPartId, parsed);
      setJob({ ...updated } as Job);
      setEditingPartId(null);
      setEditingPrice('');
      showToast.success('Price updated');
    } catch (e) {
      showToast.error('Could not update price');
    }
  };

  const handleCancelEdit = () => {
    setEditingPartId(null);
    setEditingPrice('');
  };

  const handleRemovePart = async (jobPartId: string) => {
    if (!job) return;
    if (!confirm('Remove this part from the job?')) return;

    try {
      const updated = await MockDb.removePartFromJob(job.job_id, jobPartId);
      setJob({ ...updated } as Job);
      showToast.success('Part removed from job');
    } catch (e) {
      showToast.error('Could not remove part');
    }
  };

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

  const handleAddExtraCharge = async () => {
    if (!job) return;
    
    if (!chargeName.trim()) {
      showToast.error('Please enter a charge name');
      return;
    }

    const parsed = parseFloat(chargeAmount);
    if (isNaN(parsed) || parsed < 0) {
      showToast.error('Please enter a valid amount');
      return;
    }

    try {
      const updated = await MockDb.addExtraCharge(job.job_id, {
        name: chargeName.trim(),
        description: chargeDescription.trim(),
        amount: parsed
      });
      setJob({ ...updated } as Job);
      
      setChargeName('');
      setChargeDescription('');
      setChargeAmount('');
      setShowAddCharge(false);
      showToast.success('Extra charge added');
    } catch (e) {
      showToast.error('Could not add extra charge');
    }
  };

  const handleRemoveExtraCharge = async (chargeId: string) => {
    if (!job) return;
    if (!confirm('Remove this charge?')) return;

    try {
      const updated = await MockDb.removeExtraCharge(job.job_id, chargeId);
      setJob({ ...updated } as Job);
      showToast.success('Extra charge removed');
    } catch (e) {
      showToast.error('Could not remove charge');
    }
  };

  // Handle hourmeter update
  const handleStartEditHourmeter = () => {
    if (!job) return;
    setEditingHourmeter(true);
    setHourmeterInput((job.hourmeter_reading || job.forklift?.hourmeter || 0).toString());
  };

  const handleSaveHourmeter = async () => {
    if (!job) return;
    
    const parsed = parseInt(hourmeterInput);
    if (isNaN(parsed) || parsed < 0) {
      showToast.error('Please enter a valid hourmeter reading');
      return;
    }
    
    // Client-side validation: must be >= forklift's current reading
    const currentForkliftHourmeter = job.forklift?.hourmeter || 0;
    if (parsed < currentForkliftHourmeter) {
      showToast.error(`Hourmeter must be ≥ ${currentForkliftHourmeter} (forklift's current reading)`);
      return;
    }

    try {
      const updated = await MockDb.updateJobHourmeter(job.job_id, parsed);
      setJob({ ...updated } as Job);
      setEditingHourmeter(false);
      setHourmeterInput('');
      showToast.success('Hourmeter updated');
    } catch (e: any) {
      showToast.error(e.message || 'Could not update hourmeter');
    }
  };

  const handleCancelHourmeterEdit = () => {
    setEditingHourmeter(false);
    setHourmeterInput('');
  };

  // Handle Job Carried Out and Recommendation editing
  const handleStartEditJobCarriedOut = () => {
    if (!job) return;
    setEditingJobCarriedOut(true);
    setJobCarriedOutInput(job.job_carried_out || '');
    setRecommendationInput(job.recommendation || '');
  };

  const handleSaveJobCarriedOut = async () => {
    if (!job) return;
    
    try {
      const updated = await MockDb.updateJobCarriedOut(
        job.job_id, 
        jobCarriedOutInput, 
        recommendationInput
      );
      setJob({ ...updated } as Job);
      setEditingJobCarriedOut(false);
      showToast.success('Job details saved');
    } catch (e) {
      showToast.error('Could not save job details');
    }
  };

  const handleCancelJobCarriedOutEdit = () => {
    setEditingJobCarriedOut(false);
    setJobCarriedOutInput('');
    setRecommendationInput('');
  };

  // Handle Condition Checklist editing
  const handleStartEditChecklist = () => {
    if (!job) return;
    setEditingChecklist(true);
    setChecklistEditData(job.condition_checklist || {});
  };

  const handleSaveChecklist = async () => {
    if (!job) return;
    try {
      const updated = await MockDb.updateConditionChecklist(job.job_id, checklistEditData, currentUserId);
      setJob({ ...updated } as Job);
      setEditingChecklist(false);
      showToast.success('Checklist saved');
    } catch (e) {
      showToast.error('Could not save checklist', (e as Error).message);
    }
  };

  const handleCancelChecklistEdit = () => {
    setEditingChecklist(false);
    setChecklistEditData({});
  };

  const toggleChecklistItem = (key: string) => {
    setChecklistEditData(prev => ({
      ...prev,
      [key]: !prev[key as keyof ForkliftConditionChecklist]
    }));
  };

  // Handle no parts used toggle
  const handleToggleNoPartsUsed = async () => {
    if (!job) return;
    const newValue = !noPartsUsed;
    try {
      await MockDb.setNoPartsUsed(job.job_id, newValue);
      setNoPartsUsed(newValue);
    } catch (e) {
      showToast.error('Could not update', (e as Error).message);
    }
  };

  // Handle invoice finalization
  const handleFinalizeInvoice = async () => {
    if (!job) return;
    
    try {
      const updated = await MockDb.finalizeInvoice(job.job_id, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      setShowFinalizeModal(false);
      showToast.success('Invoice finalized');
    } catch (e) {
      showToast.error('Could not finalize invoice', (e as Error).message);
    }
  };

  // Handle delete job (Admin/Supervisor only, not if Completed)
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

  // Handle print service report
  const handlePrintServiceReport = () => {
    if (!job) return;
    printServiceReport(job);
  };

  // Handle print quotation
  const handlePrintQuotation = () => {
    if (!job) return;
    const quotation = generateQuotationFromJob(job);
    const quotationNumber = `Q-${new Date().getFullYear()}-${job.job_id.slice(0, 6).toUpperCase()}`;
    printQuotation(quotation, quotationNumber);
  };

  // Handle export invoice as PDF (print)
  const handleExportPDF = () => {
    if (!job) return;
    printInvoice(job);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && job) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const updated = await MockDb.addMedia(
          job.job_id, 
          {
            type: 'photo',
            url: reader.result as string,
            description: file.name,
            created_at: new Date().toISOString(),
            category: uploadPhotoCategory as MediaCategory,
          },
          currentUserId,
          currentUserName
        );
        setJob({ ...updated } as Job);
        showToast.success('Photo uploaded', `Category: ${PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other'}`);
      };
      reader.readAsDataURL(file);
    }
  };

  // Download all photos as ZIP
  const handleDownloadPhotos = async () => {
    if (!job || job.media.length === 0) {
      showToast.error('No photos to download');
      return;
    }
    
    setDownloadingPhotos(true);
    try {
      // Dynamic import JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // Group photos by category
      const photosToDownload = photoCategoryFilter === 'all' 
        ? job.media 
        : job.media.filter(m => m.category === photoCategoryFilter);
      
      if (photosToDownload.length === 0) {
        showToast.error('No photos in selected category');
        setDownloadingPhotos(false);
        return;
      }
      
      // Add photos to ZIP organized by category
      for (const photo of photosToDownload) {
        const category = photo.category || 'other';
        const folder = zip.folder(category);
        
        // Convert data URL to blob
        const response = await fetch(photo.url);
        const blob = await response.blob();
        
        // Generate filename
        const timestamp = new Date(photo.created_at).toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}_${photo.description || 'photo'}.jpg`;
        
        folder?.file(filename, blob);
      }
      
      // Generate and download ZIP
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
    } catch (e: any) {
      console.error('Failed to download photos:', e);
      showToast.error('Download failed', e.message);
    } finally {
      setDownloadingPhotos(false);
    }
  };

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

  const handleAiSummary = async () => {
    if (!job) return;
    setGeneratingAi(true);
    const summary = await generateJobSummary(job);
    setAiSummary(summary);
    setGeneratingAi(false);
  };

  // Calculate repair duration
  const getRepairDuration = () => {
    if (!job?.repair_start_time) return null;
    const start = new Date(job.repair_start_time);
    const end = job.repair_end_time ? new Date(job.repair_end_time) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, total: diffMs };
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Job Details...</div>;
  if (!job) return <div className="p-8 text-center text-red-500">Job not found</div>;

  // Normalize status and role for comparison
  const normalizedStatus = (job.status || '').toString().toLowerCase().trim();
  const normalizedRole = (currentUserRole || '').toString().toLowerCase().trim();
  
  const isAdmin = normalizedRole === 'admin';
  const isSupervisor = normalizedRole === 'supervisor';
  const isTechnician = normalizedRole === 'technician';
  const isAccountant = normalizedRole === 'accountant';
  const canReassign = isAdmin || isSupervisor;
  
  const isNew = normalizedStatus === 'new';
  const isAssigned = normalizedStatus === 'assigned';
  const isInProgress = normalizedStatus === 'in progress' || normalizedStatus === 'in_progress';
  const isAwaitingFinalization = normalizedStatus === 'awaiting finalization' || normalizedStatus === 'awaiting_finalization';
  const isCompleted = normalizedStatus === 'completed';

  // Check if both signatures are present
  const hasBothSignatures = !!(job.technician_signature && job.customer_signature);

  const totalPartsCost = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
  const laborCost = job.labor_cost || 150; 
  const extraChargesCost = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
  const totalCost = totalPartsCost + laborCost + extraChargesCost;

  const partOptions: ComboboxOption[] = parts.map(p => ({
      id: p.part_id,
      label: p.part_name,
      subLabel: `RM${p.sell_price} | Stock: ${p.stock_quantity} | ${p.category}`
  }));

  const techOptions: ComboboxOption[] = technicians.map(t => ({
      id: t.user_id,
      label: t.name,
      subLabel: t.email
  }));

  const canEditPrices = !isCompleted && (!isAwaitingFinalization || isAdmin || isAccountant);
  const repairDuration = getRepairDuration();

  const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

  const renderSignatureBlock = (
    title: string, 
    signature: SignatureEntry | undefined, 
    onSignClick: () => void,
    icon: React.ReactNode,
    canSign: boolean
  ) => (
    <div className="bg-white rounded-xl shadow p-5 border border-slate-100">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            {icon} {title}
        </h3>
        {signature ? (
            <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <div className="flex items-center gap-2 mb-2 text-green-600 font-bold text-sm">
                    <CheckCircle className="w-4 h-4" /> Signed
                </div>
                <img src={signature.signature_url} alt={`${title}`} className="w-full h-24 object-contain border-b border-slate-200 mb-2 bg-white" />
                <div className="text-xs text-slate-500">
                    <p><strong>Signed by:</strong> {signature.signed_by_name}</p>
                    <p><strong>Date:</strong> {new Date(signature.signed_at).toLocaleString()}</p>
                </div>
            </div>
        ) : (
            canSign ? (
                <button onClick={onSignClick} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                    <PenTool className="w-4 h-4" /> Click to Sign
                </button>
            ) : (
                <div className="text-center py-4 bg-slate-50 rounded border border-slate-100 text-slate-400 text-sm">
                    Waiting for job completion or assignment.
                </div>
            )
        )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
            <div className="flex gap-2 flex-wrap">
              {job.job_type && (
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  job.job_type === JobType.ACCIDENT ? 'bg-red-100 text-red-700' :
                  job.job_type === JobType.REPAIR ? 'bg-orange-100 text-orange-700' :
                  job.job_type === JobType.CHECKING ? 'bg-purple-100 text-purple-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {job.job_type}
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${job.priority === JobPriority.EMERGENCY ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {job.priority}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
           {(isTechnician || isAdmin || isSupervisor) && isAssigned && (
             <button type="button" onClick={handleOpenStartJobModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-blue-700 flex items-center gap-2">
               <Play className="w-4 h-4" /> Start Job
             </button>
           )}
           {(isTechnician || isAdmin || isSupervisor) && isInProgress && (
             <div className="relative group">
               <button type="button" onClick={() => handleStatusChange(JobStatus.AWAITING_FINALIZATION)} disabled={!hasBothSignatures}
                 className={`px-4 py-2 rounded-lg text-sm font-semibold shadow ${hasBothSignatures ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
                 Complete
               </button>
               {!hasBothSignatures && (
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
                   Both signatures required
                 </div>
               )}
             </div>
           )}
           {(isAccountant || isAdmin) && isAwaitingFinalization && (
             <button type="button" onClick={() => setShowFinalizeModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-purple-700">
               Finalize Invoice
             </button>
           )}
           {(isTechnician || isAdmin || isSupervisor) && (isInProgress || isAwaitingFinalization || isCompleted) && (
             <button type="button" onClick={handlePrintServiceReport} className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-amber-700 flex items-center gap-2">
               <FileCheck className="w-4 h-4" /> Service Report
             </button>
           )}
           {(isAccountant || isAdmin) && (isAwaitingFinalization || isCompleted) && (
             <button type="button" onClick={handleExportPDF} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-blue-700 flex items-center gap-2">
               <FileDown className="w-4 h-4" /> Invoice
             </button>
           )}
           {(isAdmin || isSupervisor) && !isCompleted && (
             <button type="button" onClick={() => setShowDeleteModal(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-red-700 flex items-center gap-2">
               <Trash2 className="w-4 h-4" /> Delete
             </button>
           )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="md:col-span-2 space-y-6">

          {/* Forklift/Equipment Info Card */}
          {job.forklift && (
            <div className="bg-amber-50 rounded-xl shadow p-5 border border-amber-200">
              <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" /> Equipment Being Serviced
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-amber-700 uppercase">Serial Number</span>
                  <div className="font-mono font-bold text-slate-800">{job.forklift.serial_number}</div>
                </div>
                <div>
                  <span className="text-xs text-amber-700 uppercase">Make / Model</span>
                  <div className="font-bold text-slate-800">{job.forklift.make} {job.forklift.model}</div>
                </div>
                <div>
                  <span className="text-xs text-amber-700 uppercase">Type</span>
                  <div className="text-slate-700">{job.forklift.type}</div>
                </div>
                <div>
                  <span className="text-xs text-amber-700 uppercase flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> Hourmeter Reading
                  </span>
                  {editingHourmeter ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input type="number" className="w-24 px-2 py-1 text-sm border border-blue-500 rounded" value={hourmeterInput} onChange={(e) => setHourmeterInput(e.target.value)} autoFocus />
                      <span className="text-xs text-slate-500">hrs</span>
                      <button type="button" onClick={handleSaveHourmeter} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                      <button type="button" onClick={handleCancelHourmeterEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{(job.hourmeter_reading || job.forklift.hourmeter).toLocaleString()} hrs</span>
                      {(isInProgress || (isAdmin && !isCompleted)) && (
                        <button type="button" onClick={handleStartEditHourmeter} className="p-1 text-amber-600 hover:bg-amber-100 rounded"><Edit2 className="w-3 h-3" /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Active Rental Info */}
              {activeRental && (
                <div className="mt-4 pt-4 border-t border-amber-200">
                  <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Current Rental Location
                  </h4>
                  <div className="bg-white/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-slate-800">{activeRental.customer_name}</span>
                    </div>
                    {activeRental.rental_location && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-amber-600 mt-0.5" />
                        <span className="text-slate-700">{activeRental.rental_location}</span>
                      </div>
                    )}
                    <div className="text-xs text-amber-600">
                      Rental started: {new Date(activeRental.start_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Repair Time Tracking */}
          {(isInProgress || isAwaitingFinalization || isCompleted) && job.repair_start_time && (
            <div className="bg-blue-50 rounded-xl shadow p-5 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" /> Repair Time
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-blue-700 uppercase">Started</span>
                  <div className="font-mono text-slate-800">{new Date(job.repair_start_time).toLocaleTimeString()}</div>
                  <div className="text-xs text-slate-500">{new Date(job.repair_start_time).toLocaleDateString()}</div>
                </div>
                <div>
                  <span className="text-xs text-blue-700 uppercase">Ended</span>
                  {job.repair_end_time ? (
                    <>
                      <div className="font-mono text-slate-800">{new Date(job.repair_end_time).toLocaleTimeString()}</div>
                      <div className="text-xs text-slate-500">{new Date(job.repair_end_time).toLocaleDateString()}</div>
                    </>
                  ) : (
                    <div className="text-slate-500 italic">In Progress</div>
                  )}
                </div>
                <div>
                  <span className="text-xs text-blue-700 uppercase">Duration</span>
                  {repairDuration && (
                    <div className="font-bold text-blue-800">{repairDuration.hours}h {repairDuration.minutes}m</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Condition Checklist Display */}
          {job.condition_checklist && Object.keys(job.condition_checklist).length > 0 && (
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" /> Condition Checklist
                </h3>
                {(isInProgress || isAwaitingFinalization) && !editingChecklist && (
                  <button type="button" onClick={handleStartEditChecklist} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 flex items-center gap-1">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
              
              {editingChecklist ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {CHECKLIST_CATEGORIES.map(cat => (
                      <div key={cat.name} className="bg-slate-50 p-3 rounded-lg">
                        <div className="font-medium text-slate-700 text-sm mb-2">{cat.name}</div>
                        <div className="space-y-1">
                          {cat.items.map(item => (
                            <label key={item.key} className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={!!checklistEditData[item.key as keyof ForkliftConditionChecklist]}
                                onChange={() => toggleChecklistItem(item.key)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className={checklistEditData[item.key as keyof ForkliftConditionChecklist] ? 'text-green-600' : 'text-slate-600'}>
                                {item.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleSaveChecklist} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">Save</button>
                    <button type="button" onClick={handleCancelChecklistEdit} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {CHECKLIST_CATEGORIES.map(cat => {
                    const checkedItems = cat.items.filter(item => job.condition_checklist?.[item.key as keyof ForkliftConditionChecklist]);
                    if (checkedItems.length === 0) return null;
                    return (
                      <div key={cat.name} className="bg-slate-50 p-2 rounded">
                        <div className="font-medium text-slate-700 text-xs mb-1">{cat.name}</div>
                        {checkedItems.map(item => (
                          <div key={item.key} className="flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle className="w-3 h-3" /> {item.label}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Job Carried Out & Recommendation */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5" /> Job Details
              </h3>
              {(isInProgress || isAwaitingFinalization) && !editingJobCarriedOut && (
                <button type="button" onClick={handleStartEditJobCarriedOut} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            
            {editingJobCarriedOut ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Job Carried Out</label>
                  <textarea className={`${inputClassName} min-h-[100px]`} placeholder="Describe the work performed..." value={jobCarriedOutInput} onChange={(e) => setJobCarriedOutInput(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Recommendation</label>
                  <textarea className={`${inputClassName} min-h-[80px]`} placeholder="Any recommendations for the customer..." value={recommendationInput} onChange={(e) => setRecommendationInput(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleSaveJobCarriedOut} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">Save</button>
                  <button type="button" onClick={handleCancelJobCarriedOutEdit} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-slate-500 uppercase">Job Carried Out</span>
                  <p className="text-slate-700 mt-1">{job.job_carried_out || <span className="italic text-slate-400">Not specified</span>}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase">Recommendation</span>
                  <p className="text-slate-700 mt-1">{job.recommendation || <span className="italic text-slate-400">None</span>}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Customer Info Card */}
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Customer Details</h3>
                {job.customer ? (
                  <>
                    <div className="flex items-center gap-2 text-slate-600 mt-2"><UserIcon className="w-4 h-4" /> <span>{job.customer.name}</span></div>
                    <div className="flex items-center gap-2 text-slate-600 mt-1"><MapPin className="w-4 h-4" /> <span>{job.customer.address}</span></div>
                    <div className="flex items-center gap-2 text-slate-600 mt-1"><Phone className="w-4 h-4" /> <a href={`tel:${job.customer.phone}`} className="text-blue-600">{job.customer.phone}</a></div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-700 font-medium">No Customer Assigned</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">Status</div>
                <div className="font-bold text-slate-800">{job.status}</div>
                {job.assigned_technician_name && (<div className="text-xs text-slate-500 mt-1">Tech: {job.assigned_technician_name}</div>)}
              </div>
            </div>
            <hr />
            <div>
              <h4 className="text-sm font-semibold text-slate-500 mb-1">Description</h4>
              <p className="text-slate-700">{job.description}</p>
            </div>
            {(isAdmin || isSupervisor) && isNew && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 mt-4">
                    <h4 className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Assign Technician</h4>
                    <div className="flex gap-2">
                        <div className="flex-1"><Combobox options={techOptions} value={selectedTechId} onChange={setSelectedTechId} placeholder="Select Technician..." /></div>
                        <button type="button" onClick={handleAssignJob} disabled={!selectedTechId} className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50">Assign</button>
                    </div>
                </div>
            )}
            {canReassign && job.assigned_technician_id && !isCompleted && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2"><UserIcon className="w-4 h-4" /> Assigned Technician</h4>
                            <p className="text-slate-700 mt-1">{job.assigned_technician_name}</p>
                        </div>
                        <button type="button" onClick={() => setShowReassignModal(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" /> Reassign
                        </button>
                    </div>
                </div>
            )}
          </div>

          {/* Parts Section */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><Box className="w-5 h-5" /> Parts Used</h3>
              {canEditPrices && (<span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">Prices Editable</span>)}
            </div>
            {job.parts_used.length > 0 ? (
              <div className="space-y-2 mb-4">
                {job.parts_used.map(p => (
                  <div key={p.job_part_id} className="flex items-center gap-2 bg-slate-50 p-3 rounded border border-slate-100">
                    <div className="flex-1"><span className="font-medium">{p.quantity}x {p.part_name}</span></div>
                    {editingPartId === p.job_part_id ? (
                      <div className="flex items-center gap-2">
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">RM</span>
                          <input type="number" className="w-full pl-8 pr-2 py-1 text-sm border border-blue-500 rounded" value={editingPrice} onChange={(e) => setEditingPrice(e.target.value)} autoFocus />
                        </div>
                        <button type="button" onClick={() => handleSavePartPrice(p.job_part_id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                        <button type="button" onClick={handleCancelEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-600 min-w-[70px] text-right">RM{p.sell_price_at_time.toFixed(2)}</span>
                        {canEditPrices && (
                          <>
                            <button type="button" onClick={() => handleStartEditPrice(p.job_part_id, p.sell_price_at_time)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                            <button type="button" onClick={() => handleRemovePart(p.job_part_id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-slate-400 italic mb-3">No parts added yet.</p>
                {/* No parts used checkbox */}
                {(isInProgress || isAwaitingFinalization) && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <input
                      type="checkbox"
                      checked={noPartsUsed}
                      onChange={handleToggleNoPartsUsed}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className={noPartsUsed ? 'text-amber-700 font-medium' : 'text-slate-600'}>
                      No parts were used for this job
                    </span>
                    {noPartsUsed && <CheckCircle className="w-4 h-4 text-amber-600 ml-auto" />}
                  </label>
                )}
              </div>
            )}
            {isInProgress && (
              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-slate-500 mb-2">Add New Part</p>
                <div className="flex gap-2 items-start">
                  <div className="flex-grow">
                      <Combobox options={partOptions} value={selectedPartId} onChange={(val) => { setSelectedPartId(val); const p = parts.find(x => x.part_id === val); if (p) setSelectedPartPrice(p.sell_price.toString()); }} placeholder="Search parts..." />
                  </div>
                  <div className="w-28">
                       <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">RM</span>
                          <input type="number" className={`${inputClassName} pl-9 text-sm`} placeholder="Price" value={selectedPartPrice} onChange={(e) => setSelectedPartPrice(e.target.value)} />
                       </div>
                  </div>
                  <button type="button" onClick={handleAddPart} className="bg-slate-800 text-white px-4 py-2.5 rounded-lg hover:bg-slate-700 shadow-sm"><Plus className="w-5 h-5" /></button>
                </div>
              </div>
            )}
          </div>

          {/* Extra Charges Section */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5" /> Extra Charges</h3>
              {canEditPrices && !showAddCharge && (
                <button type="button" onClick={() => setShowAddCharge(true)} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded hover:bg-green-100 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Charge</button>
              )}
            </div>
            {job.extra_charges && job.extra_charges.length > 0 ? (
              <div className="space-y-2 mb-4">
                {job.extra_charges.map(charge => (
                  <div key={charge.charge_id} className="flex items-center gap-2 bg-amber-50 p-3 rounded border border-amber-100">
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{charge.name}</div>
                      {charge.description && (<div className="text-xs text-slate-500 mt-0.5">{charge.description}</div>)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-600 min-w-[70px] text-right">RM{charge.amount.toFixed(2)}</span>
                      {canEditPrices && (<button type="button" onClick={() => handleRemoveExtraCharge(charge.charge_id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (<p className="text-slate-400 italic text-sm mb-4">No extra charges added.</p>)}
            {showAddCharge && canEditPrices && (
              <div className="border-t pt-4 space-y-3">
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Charge Name *</label><input type="text" className={inputClassName} placeholder="e.g., Emergency Call-Out Fee" value={chargeName} onChange={(e) => setChargeName(e.target.value)} /></div>
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Description / Notes</label><input type="text" className={inputClassName} placeholder="Optional details..." value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} /></div>
                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Amount *</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">RM</span><input type="number" className={`${inputClassName} pl-10`} placeholder="0.00" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} /></div></div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleAddExtraCharge} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium">Add Charge</button>
                  <button type="button" onClick={() => { setShowAddCharge(false); setChargeName(''); setChargeDescription(''); setChargeAmount(''); }} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Photos with Category Filter */}
          {(isTechnician || isAdmin || isSupervisor) && (
            <div className="bg-white rounded-xl shadow p-5">
              {/* Header with Download Button */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Camera className="w-5 h-5" /> Photos
                  <span className="text-sm font-normal text-slate-500">({job.media.length})</span>
                </h3>
                {job.media.length > 0 && (
                  <button
                    onClick={handleDownloadPhotos}
                    disabled={downloadingPhotos}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingPhotos ? 'Downloading...' : 'Download ZIP'}
                  </button>
                )}
              </div>

              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                <button
                  onClick={() => setPhotoCategoryFilter('all')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition ${
                    photoCategoryFilter === 'all' 
                      ? 'bg-slate-800 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({job.media.length})
                </button>
                {PHOTO_CATEGORIES.map(cat => {
                  const count = job.media.filter(m => m.category === cat.value).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setPhotoCategoryFilter(cat.value)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full transition ${
                        photoCategoryFilter === cat.value 
                          ? `${cat.color} text-white` 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Photo Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {job.media
                  .filter(m => photoCategoryFilter === 'all' || m.category === photoCategoryFilter)
                  .map(m => {
                    const catInfo = PHOTO_CATEGORIES.find(c => c.value === m.category) || PHOTO_CATEGORIES.find(c => c.value === 'other');
                    return (
                      <div key={m.media_id} className="relative group">
                        <img src={m.url} alt="Job" className="w-full h-24 object-cover rounded border" />
                        {/* Category Badge */}
                        <span className={`absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-medium text-white rounded ${catInfo?.color || 'bg-slate-500'}`}>
                          {catInfo?.label || 'Other'}
                        </span>
                        {/* Hover Info */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-1.5 py-1 rounded-b opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(m.created_at).toLocaleString()}
                          </div>
                          {m.uploaded_by_name && (
                            <div className="text-slate-300 truncate">By: {m.uploaded_by_name}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {/* Upload Button with Category Selector */}
                {isInProgress && (
                  <div className="border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center h-24 text-slate-400">
                    <select
                      value={uploadPhotoCategory}
                      onChange={(e) => setUploadPhotoCategory(e.target.value)}
                      className="text-[10px] mb-1 px-1 py-0.5 border rounded bg-white text-slate-600 w-20"
                    >
                      {PHOTO_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                    <label className="cursor-pointer hover:text-slate-600 transition-colors flex flex-col items-center">
                      <Camera className="w-5 h-5 mb-0.5" />
                      <span className="text-[10px]">Add Photo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                )}
              </div>

              {/* Empty state */}
              {job.media.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-4">No photos uploaded yet</p>
              )}
            </div>
          )}

          {/* Notes */}
          {(isTechnician || isAdmin || isSupervisor) && (
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><PenTool className="w-5 h-5" /> Job Notes</h3>
              <div className="max-h-40 overflow-y-auto space-y-2 mb-4 text-sm">
                {job.notes.map((note, idx) => (<div key={idx} className="bg-slate-50 p-3 rounded border-l-4 border-blue-400 text-slate-700">{note}</div>))}
              </div>
              {isInProgress && (
                <div className="flex gap-2">
                  <input type="text" placeholder="Add a note..." className={inputClassName} value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
                  <button type="button" onClick={handleAddNote} className="bg-slate-800 text-white px-4 rounded-lg text-sm font-medium hover:bg-slate-700">Add</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar / Summary Column */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2"><DollarSign className="w-5 h-5" /> Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium">Labor</span>
                {editingLabor ? (
                  <div className="flex items-center gap-2">
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">RM</span>
                      <input type="number" className="w-full pl-8 pr-2 py-1 text-sm border border-blue-500 rounded" value={laborCostInput} onChange={(e) => setLaborCostInput(e.target.value)} autoFocus />
                    </div>
                    <button type="button" onClick={handleSaveLabor} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-3 h-3" /></button>
                    <button type="button" onClick={handleCancelLaborEdit} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>RM{laborCost.toFixed(2)}</span>
                    {canEditPrices && (<button type="button" onClick={handleStartEditLabor} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-3 h-3" /></button>)}
                  </div>
                )}
              </div>
              <div className="flex justify-between"><span>Parts</span><span>RM{totalPartsCost.toFixed(2)}</span></div>
              {extraChargesCost > 0 && (<div className="flex justify-between"><span>Extra Charges</span><span>RM{extraChargesCost.toFixed(2)}</span></div>)}
              <hr className="my-2" />
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span>RM{totalCost.toFixed(2)}</span></div>
            </div>
          </div>

          {/* Invoice Information */}
          {isCompleted && (
            <div className="bg-purple-50 rounded-xl shadow p-5 border border-purple-100">
              <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wider mb-3 flex items-center gap-2"><Info className="w-4 h-4" /> Invoice Information</h3>
              <div className="space-y-2 text-sm">
                {job.invoiced_by_name && (<div><span className="text-slate-500">Finalized by:</span><div className="font-medium text-slate-800">{job.invoiced_by_name}</div></div>)}
                {job.invoiced_at && (<div><span className="text-slate-500">Finalized on:</span><div className="font-medium text-slate-800">{new Date(job.invoiced_at).toLocaleString()}</div></div>)}
              </div>
            </div>
          )}

          {/* Job Audit Trail */}
          <div className="bg-slate-50 rounded-xl shadow p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Job Audit Trail
            </h3>
            <div className="space-y-3 text-sm">
              {/* Created */}
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="font-medium text-slate-800">Job Created</div>
                  <div className="text-slate-500 text-xs">
                    {job.created_at && new Date(job.created_at).toLocaleString()}
                  </div>
                  {job.created_by_name && (
                    <div className="text-slate-600 text-xs mt-0.5">By: {job.created_by_name}</div>
                  )}
                </div>
              </div>
              
              {/* Assigned */}
              {job.assigned_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">Job Assigned</div>
                    <div className="text-slate-500 text-xs">
                      {new Date(job.assigned_at).toLocaleString()}
                    </div>
                    {job.assigned_by_name && (
                      <div className="text-slate-600 text-xs mt-0.5">By: {job.assigned_by_name}</div>
                    )}
                    {job.assigned_technician_name && (
                      <div className="text-slate-600 text-xs">To: {job.assigned_technician_name}</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Started */}
              {job.started_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">Job Started</div>
                    <div className="text-slate-500 text-xs">
                      {new Date(job.started_at).toLocaleString()}
                    </div>
                    {job.started_by_name && (
                      <div className="text-slate-600 text-xs mt-0.5">By: {job.started_by_name}</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Completed */}
              {job.completed_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">Job Completed</div>
                    <div className="text-slate-500 text-xs">
                      {new Date(job.completed_at).toLocaleString()}
                    </div>
                    {job.completed_by_name && (
                      <div className="text-slate-600 text-xs mt-0.5">By: {job.completed_by_name}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="space-y-4">
            {isInProgress && !hasBothSignatures && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>Required to complete job:</strong>
                <ul className="mt-1 ml-4 list-disc">
                  {!job.technician_signature && <li>Technician signature</li>}
                  {!job.customer_signature && <li>Customer signature</li>}
                </ul>
              </div>
            )}
            {renderSignatureBlock("Technician Sign-off", job.technician_signature, () => setShowTechSigPad(true), <ShieldCheck className="w-4 h-4 text-blue-600" />, isTechnician && (isInProgress || isAwaitingFinalization))}
            {renderSignatureBlock("Customer Acceptance", job.customer_signature, () => setShowCustSigPad(true), <UserCheck className="w-4 h-4 text-green-600" />, (isInProgress || isAwaitingFinalization))}
          </div>

          {/* AI Assistant */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow p-5 border border-indigo-100">
            <h3 className="text-lg font-semibold text-indigo-900 mb-2 flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-indigo-600" /> AI Assistant</h3>
            {aiSummary ? (<div className="bg-white p-3 rounded text-sm text-slate-700 italic border shadow-sm">"{aiSummary}"</div>
            ) : (<p className="text-xs text-indigo-700 mb-3">Generate a professional job summary for the invoice.</p>)}
            {!aiSummary && (<button type="button" onClick={handleAiSummary} disabled={generatingAi} className="w-full bg-indigo-600 text-white text-xs py-2 rounded hover:bg-indigo-700 disabled:opacity-50">{generatingAi ? 'Thinking...' : 'Generate Job Summary'}</button>)}
          </div>
        </div>
      </div>

      {/* Start Job Modal with Condition Checklist */}
      {showStartJobModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h4 className="font-bold text-xl mb-4 text-slate-900 flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-600" /> Start Job - Condition Check
            </h4>
            
            {/* Hourmeter Input */}
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-6">
              <label className="text-sm font-bold text-amber-800 mb-2 block flex items-center gap-2">
                <Gauge className="w-4 h-4" /> Current Hourmeter Reading *
              </label>
              <div className="flex items-center gap-2">
                <input type="number" className="w-40 px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" value={startJobHourmeter} onChange={(e) => setStartJobHourmeter(e.target.value)} placeholder="e.g., 5230" />
                <span className="text-slate-500">hours</span>
              </div>
            </div>

            {/* Condition Checklist */}
            <div className="mb-6">
              <h5 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <ClipboardList className="w-5 h-5" /> Forklift Condition Checklist
              </h5>
              <p className="text-sm text-slate-500 mb-4">Check all items that are in good/working condition:</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {CHECKLIST_CATEGORIES.map(category => (
                  <div key={category.name} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <h6 className="font-semibold text-slate-700 text-sm mb-2 border-b border-slate-200 pb-1">{category.name}</h6>
                    <div className="space-y-1">
                      {category.items.map(item => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded text-sm">
                          <input type="checkbox" checked={!!conditionChecklist[item.key as keyof ForkliftConditionChecklist]} onChange={() => handleChecklistToggle(item.key)} className="w-4 h-4 text-blue-600 rounded border-slate-300" />
                          <span className="text-slate-600">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end border-t pt-4">
              <button type="button" onClick={() => setShowStartJobModal(false)} className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
              <button type="button" onClick={handleStartJobWithCondition} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2">
                <Play className="w-4 h-4" /> Start Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modals */}
      {showTechSigPad && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-4 w-full max-w-md">
                <h4 className="font-bold mb-4">Technician Signature</h4>
                <p className="text-xs text-slate-500 mb-2">I certify that this work has been completed according to standards.</p>
                <SignaturePad onSave={handleTechnicianSignature} />
                <button onClick={() => setShowTechSigPad(false)} className="mt-4 text-sm text-red-500 underline w-full text-center">Cancel</button>
            </div>
        </div>
      )}

      {showCustSigPad && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-4 w-full max-w-md">
                <h4 className="font-bold mb-4">Customer Acceptance</h4>
                <p className="text-xs text-slate-500 mb-2">I acknowledge the service performed and agree to the charges.</p>
                <SignaturePad onSave={handleCustomerSignature} />
                <button onClick={() => setShowCustSigPad(false)} className="mt-4 text-sm text-red-500 underline w-full text-center">Cancel</button>
            </div>
        </div>
      )}

      {/* Finalize Invoice Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h4 className="font-bold text-lg mb-4 text-slate-900">Finalize Invoice</h4>
            <p className="text-sm text-slate-600 mb-6">Are you sure you want to finalize this invoice? This action cannot be undone.</p>
            <div className="bg-slate-50 rounded-lg p-3 mb-6 text-sm">
              <div className="flex justify-between mb-1"><span className="text-slate-600">Total Amount:</span><span className="font-bold text-lg">RM{totalCost.toFixed(2)}</span></div>
              <div className="text-xs text-slate-500 mt-2">Finalized by: {currentUserName}</div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowFinalizeModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleFinalizeInvoice} className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium">Finalize Invoice</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Job Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h4 className="font-bold text-lg mb-4 text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-blue-600" /> Reassign Job
            </h4>
            <p className="text-sm text-slate-600 mb-4">
              Change the technician assigned to this job. The new technician will be notified.
            </p>
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm">
              <div className="text-slate-500">Currently assigned to:</div>
              <div className="font-medium text-slate-800">{job?.assigned_technician_name || 'Unassigned'}</div>
            </div>
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-700 mb-2 block">New Technician</label>
              <Combobox 
                options={techOptions.filter(t => t.id !== job?.assigned_technician_id)} 
                value={reassignTechId} 
                onChange={setReassignTechId} 
                placeholder="Select new technician..." 
              />
            </div>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => { setShowReassignModal(false); setReassignTechId(''); }} 
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleReassignJob} 
                disabled={!reassignTechId}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Job Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h4 className="font-bold text-lg mb-4 text-red-700 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Cancel / Delete Job
            </h4>
            <div className="bg-red-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800 font-medium">{job?.title}</p>
              <p className="text-xs text-red-600 mt-1">This action will mark the job as cancelled.</p>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              The job will be removed from active views but preserved for audit. If this job recorded a hourmeter reading, it will be invalidated.
            </p>
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-700 mb-2 block">Reason for Cancellation <span className="text-red-500">*</span></label>
              <textarea
                className="w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/25 resize-none h-24"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="e.g., Customer cancelled request, Duplicate entry, Test job..."
              />
            </div>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={() => { setShowDeleteModal(false); setDeletionReason(''); }} 
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleDeleteJob} 
                disabled={!deletionReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetail;

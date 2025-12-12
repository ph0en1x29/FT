import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, JobStatus, UserRole, Part, JobPriority, SignatureEntry, User } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { generateJobSummary } from '../services/geminiService';
import { SignaturePad } from '../components/SignaturePad';
import { Combobox, ComboboxOption } from '../components/Combobox';
import { 
  ArrowLeft, MapPin, Phone, User as UserIcon, Calendar, 
  CheckCircle, Plus, Camera, PenTool, Box, DollarSign, BrainCircuit, ShieldCheck, UserCheck, UserPlus, Edit2, Trash2, Save, X, FileText, Mail, MessageSquare, Send, Info
} from 'lucide-react';

interface JobDetailProps {
  currentUserRole: UserRole;
  currentUserId: string;
  currentUserName: string;
}

const JobDetail: React.FC<JobDetailProps> = ({ currentUserRole, currentUserId, currentUserName }) => {
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

  // NEW: Invoice modals and sending
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showSendInvoiceModal, setShowSendInvoiceModal] = useState(false);
  const [sendMethod, setSendMethod] = useState<'email' | 'whatsapp' | 'both'>('email');
  const [sendingInvoice, setSendingInvoice] = useState(false);

  useEffect(() => {
    loadJob();
    loadParts();
    if (currentUserRole === UserRole.ADMIN) {
        loadTechnicians();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentUserRole]);

  const loadJob = async () => {
    if (!id) return;
    setLoading(true);
    const data = await MockDb.getJobById(id);
    setJob(data ? { ...data } : null);
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

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (!job) return;
    const updated = await MockDb.updateJobStatus(job.job_id, newStatus);
    setJob({ ...updated } as Job);
  };

  const handleAssignJob = async () => {
      if (!job || !selectedTechId) return;
      const tech = technicians.find(t => t.user_id === selectedTechId);
      if (tech) {
        const updated = await MockDb.assignJob(job.job_id, tech.user_id, tech.name);
        setJob({ ...updated } as Job);
        alert(`Job assigned to ${tech.name}`);
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
            alert("Please enter a valid price");
            return;
        }
        finalPrice = parsed;
    }

    try {
      const updated = await MockDb.addPartToJob(job.job_id, selectedPartId, 1, finalPrice);
      setJob({ ...updated } as Job);
      setSelectedPartId('');
      setSelectedPartPrice('');
    } catch (e) {
      alert('Could not add part. Check stock.');
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
      alert("Please enter a valid price");
      return;
    }

    try {
      const updated = await MockDb.updatePartPrice(job.job_id, jobPartId, parsed);
      setJob({ ...updated } as Job);
      setEditingPartId(null);
      setEditingPrice('');
    } catch (e) {
      alert('Could not update price.');
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
    } catch (e) {
      alert('Could not remove part.');
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
      alert("Please enter a valid labor cost");
      return;
    }

    try {
      const updated = await MockDb.updateLaborCost(job.job_id, parsed);
      setJob({ ...updated } as Job);
      setEditingLabor(false);
      setLaborCostInput('');
    } catch (e) {
      alert('Could not update labor cost.');
    }
  };

  const handleCancelLaborEdit = () => {
    setEditingLabor(false);
    setLaborCostInput('');
  };

  const handleAddExtraCharge = async () => {
    if (!job) return;
    
    if (!chargeName.trim()) {
      alert("Please enter a charge name");
      return;
    }

    const parsed = parseFloat(chargeAmount);
    if (isNaN(parsed) || parsed < 0) {
      alert("Please enter a valid amount");
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
    } catch (e) {
      alert('Could not add extra charge.');
    }
  };

  const handleRemoveExtraCharge = async (chargeId: string) => {
    if (!job) return;
    if (!confirm('Remove this charge?')) return;

    try {
      const updated = await MockDb.removeExtraCharge(job.job_id, chargeId);
      setJob({ ...updated } as Job);
    } catch (e) {
      alert('Could not remove charge.');
    }
  };

  // NEW: Handle invoice finalization
  const handleFinalizeInvoice = async () => {
    if (!job) return;
    
    try {
      const updated = await MockDb.finalizeInvoice(job.job_id, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      setShowFinalizeModal(false);
      alert('Invoice finalized successfully!');
    } catch (e) {
      alert('Could not finalize invoice.');
    }
  };

  // NEW: Handle sending invoice
  const handleSendInvoice = async () => {
    if (!job) return;
    setSendingInvoice(true);
    
    try {
      const invoiceText = MockDb.generateInvoiceText(job);
      
      // Send via WhatsApp
      if (sendMethod === 'whatsapp' || sendMethod === 'both') {
        const phone = job.customer.phone.replace(/\D/g, '');
        const message = encodeURIComponent(invoiceText);
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
      }
      
      // Send via Email
      if (sendMethod === 'email' || sendMethod === 'both') {
        alert('Email functionality needs to be implemented on your backend');
      }
      
      const updated = await MockDb.sendInvoice(job.job_id, sendMethod);
      setJob({ ...updated } as Job);
      setShowSendInvoiceModal(false);
      alert('Invoice sent successfully!');
    } catch (e) {
      alert('Could not send invoice.');
    } finally {
      setSendingInvoice(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && job) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const updated = await MockDb.addMedia(job.job_id, {
          type: 'photo',
          url: reader.result as string,
          description: file.name,
          created_at: new Date().toISOString()
        });
        setJob({ ...updated } as Job);
      };
      reader.readAsDataURL(file);
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
    const updated = await MockDb.signJob(job.job_id, 'customer', job.customer.name, dataUrl);
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

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Job Details...</div>;
  if (!job) return <div className="p-8 text-center text-red-500">Job not found</div>;

  const totalPartsCost = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
  const laborCost = job.labor_cost || 150; 
  const extraChargesCost = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
  const totalCost = totalPartsCost + laborCost + extraChargesCost;

  const partOptions: ComboboxOption[] = parts.map(p => ({
      id: p.part_id,
      label: p.part_name,
      subLabel: `$${p.sell_price} | Stock: ${p.stock_quantity}`
  }));

  const techOptions: ComboboxOption[] = technicians.map(t => ({
      id: t.user_id,
      label: t.name,
      subLabel: t.email
  }));

  // UPDATED: Allow admin/accountant to edit completed jobs
  const canEditPrices = 
    job.status !== JobStatus.INVOICED && 
    (job.status !== JobStatus.COMPLETED || 
     currentUserRole === UserRole.ADMIN || 
     currentUserRole === UserRole.ACCOUNTANT);

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
                <button 
                    onClick={onSignClick}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
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
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{job.title}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              job.priority === JobPriority.EMERGENCY ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {job.priority}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
           {currentUserRole === UserRole.TECHNICIAN && job.status === JobStatus.ASSIGNED && (
             <button 
               onClick={() => handleStatusChange(JobStatus.IN_PROGRESS)}
               className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-blue-700"
             >
               Start Job
             </button>
           )}
           {currentUserRole === UserRole.TECHNICIAN && job.status === JobStatus.IN_PROGRESS && (
             <button 
               onClick={() => handleStatusChange(JobStatus.COMPLETED)}
               className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-green-700"
             >
               Complete
             </button>
           )}
           {currentUserRole === UserRole.ACCOUNTANT && job.status === JobStatus.COMPLETED && (
             <button 
               onClick={() => setShowFinalizeModal(true)}
               className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-purple-700"
             >
               Finalize Invoice
             </button>
           )}
           {(currentUserRole === UserRole.ACCOUNTANT || currentUserRole === UserRole.ADMIN) && 
            job.status === JobStatus.INVOICED && (
             <button 
               onClick={() => setShowSendInvoiceModal(true)}
               className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-green-700 flex items-center gap-2"
             >
               <Send className="w-4 h-4" /> Send Invoice
             </button>
           )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Column */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Info Card */}
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Customer Details</h3>
                <div className="flex items-center gap-2 text-slate-600 mt-2">
                  <UserIcon className="w-4 h-4" /> <span>{job.customer.name}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 mt-1">
                  <MapPin className="w-4 h-4" /> <span>{job.customer.address}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 mt-1">
                  <Phone className="w-4 h-4" /> <a href={`tel:${job.customer.phone}`} className="text-blue-600">{job.customer.phone}</a>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-500">Status</div>
                <div className="font-bold text-slate-800">{job.status}</div>
                {job.assigned_technician_name && (
                    <div className="text-xs text-slate-500 mt-1">Tech: {job.assigned_technician_name}</div>
                )}
              </div>
            </div>
            <hr />
            <div>
              <h4 className="text-sm font-semibold text-slate-500 mb-1">Description</h4>
              <p className="text-slate-700">{job.description}</p>
            </div>

            {/* Admin Assignment Block */}
            {currentUserRole === UserRole.ADMIN && job.status === JobStatus.NEW && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 mt-4">
                    <h4 className="text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                        <UserPlus className="w-4 h-4" /> Assign Technician
                    </h4>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Combobox 
                                options={techOptions} 
                                value={selectedTechId} 
                                onChange={setSelectedTechId}
                                placeholder="Select Technician..."
                            />
                        </div>
                        <button 
                            onClick={handleAssignJob}
                            disabled={!selectedTechId}
                            className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50"
                        >
                            Assign
                        </button>
                    </div>
                </div>
            )}
          </div>

          {/* Parts Section */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Box className="w-5 h-5" /> Parts Used
              </h3>
              {canEditPrices && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                  Prices Editable
                </span>
              )}
            </div>

            {job.parts_used.length > 0 ? (
              <div className="space-y-2 mb-4">
                {job.parts_used.map(p => (
                  <div key={p.job_part_id} className="flex items-center gap-2 bg-slate-50 p-3 rounded border border-slate-100">
                    <div className="flex-1">
                      <span className="font-medium">{p.quantity}x {p.part_name}</span>
                    </div>
                    
                    {editingPartId === p.job_part_id ? (
                      <div className="flex items-center gap-2">
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                          <input
                            type="number"
                            className="w-full pl-5 pr-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={editingPrice}
                            onChange={(e) => setEditingPrice(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={() => handleSavePartPrice(p.job_part_id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Save"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-600 min-w-[60px] text-right">
                          ${p.sell_price_at_time.toFixed(2)}
                        </span>
                        {canEditPrices && (
                          <>
                            <button
                              onClick={() => handleStartEditPrice(p.job_part_id, p.sell_price_at_time)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit Price"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemovePart(p.job_part_id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Remove Part"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic mb-4">No parts added yet.</p>
            )}
            
            {/* Add new part */}
            {job.status === JobStatus.IN_PROGRESS && (
              <div className="border-t pt-4 mt-4">
                <p className="text-xs text-slate-500 mb-2">Add New Part</p>
                <div className="flex gap-2 items-start">
                  <div className="flex-grow">
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
                  <div className="w-24">
                       <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                          <input
                              type="number"
                              className={`${inputClassName} pl-6 text-sm`}
                              placeholder="Price"
                              value={selectedPartPrice}
                              onChange={(e) => setSelectedPartPrice(e.target.value)}
                          />
                       </div>
                  </div>
                  <button onClick={handleAddPart} className="bg-slate-800 text-white px-4 py-2.5 rounded-lg hover:bg-slate-700 shadow-sm">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Extra Charges Section */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5" /> Extra Charges
              </h3>
              {canEditPrices && !showAddCharge && (
                <button
                  onClick={() => setShowAddCharge(true)}
                  className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded hover:bg-green-100 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Charge
                </button>
              )}
            </div>

            {job.extra_charges && job.extra_charges.length > 0 ? (
              <div className="space-y-2 mb-4">
                {job.extra_charges.map(charge => (
                  <div key={charge.charge_id} className="flex items-center gap-2 bg-amber-50 p-3 rounded border border-amber-100">
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{charge.name}</div>
                      {charge.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{charge.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-600 min-w-[60px] text-right">
                        ${charge.amount.toFixed(2)}
                      </span>
                      {canEditPrices && (
                        <button
                          onClick={() => handleRemoveExtraCharge(charge.charge_id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Remove Charge"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic text-sm mb-4">No extra charges added.</p>
            )}

            {showAddCharge && canEditPrices && (
              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Charge Name *</label>
                  <input
                    type="text"
                    className={inputClassName}
                    placeholder="e.g., Emergency Call-Out Fee"
                    value={chargeName}
                    onChange={(e) => setChargeName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Description / Notes</label>
                  <input
                    type="text"
                    className={inputClassName}
                    placeholder="Optional details..."
                    value={chargeDescription}
                    onChange={(e) => setChargeDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      className={`${inputClassName} pl-8`}
                      placeholder="0.00"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddExtraCharge}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
                  >
                    Add Charge
                  </button>
                  <button
                    onClick={() => {
                      setShowAddCharge(false);
                      setChargeName('');
                      setChargeDescription('');
                      setChargeAmount('');
                    }}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Photos */}
          {(currentUserRole === UserRole.TECHNICIAN || currentUserRole === UserRole.ADMIN) && (
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5" /> Photos
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {job.media.map(m => (
                  <img key={m.media_id} src={m.url} alt="Job" className="w-full h-24 object-cover rounded border" />
                ))}
                {job.status === JobStatus.IN_PROGRESS && (
                  <label className="border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center h-24 text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-xs">Add Photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                )}
              </div>
            </div>
          )}

           {/* Notes */}
           {(currentUserRole === UserRole.TECHNICIAN || currentUserRole === UserRole.ADMIN) && (
             <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <PenTool className="w-5 h-5" /> Job Notes
              </h3>
              <div className="max-h-40 overflow-y-auto space-y-2 mb-4 text-sm">
                {job.notes.map((note, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded border-l-4 border-blue-400 text-slate-700">
                    {note}
                  </div>
                ))}
              </div>
              {job.status === JobStatus.IN_PROGRESS && (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Add a note..." 
                    className={inputClassName}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                  />
                  <button onClick={handleAddNote} className="bg-slate-800 text-white px-4 rounded-lg text-sm font-medium hover:bg-slate-700">Add</button>
                </div>
              )}
            </div>
           )}
        </div>

        {/* Sidebar / Summary Column */}
        <div className="space-y-6">
          
          {/* Financial Summary */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" /> Summary
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-medium">Labor</span>
                {editingLabor ? (
                  <div className="flex items-center gap-2">
                    <div className="relative w-20">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                      <input
                        type="number"
                        className="w-full pl-5 pr-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={laborCostInput}
                        onChange={(e) => setLaborCostInput(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handleSaveLabor}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                      title="Save"
                    >
                      <Save className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleCancelLaborEdit}
                      className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>${laborCost.toFixed(2)}</span>
                    {canEditPrices && (
                      <button
                        onClick={handleStartEditLabor}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit Labor Cost"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex justify-between">
                <span>Parts</span>
                <span>${totalPartsCost.toFixed(2)}</span>
              </div>
              
              {extraChargesCost > 0 && (
                <div className="flex justify-between">
                  <span>Extra Charges</span>
                  <span>${extraChargesCost.toFixed(2)}</span>
                </div>
              )}
              
              <hr className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* NEW: Invoice Information */}
          {job.status === JobStatus.INVOICED && (
            <div className="bg-purple-50 rounded-xl shadow p-5 border border-purple-100">
              <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" /> Invoice Information
              </h3>
              
              <div className="space-y-2 text-sm">
                {job.invoiced_by_name && (
                  <div>
                    <span className="text-slate-500">Finalized by:</span>
                    <div className="font-medium text-slate-800">{job.invoiced_by_name}</div>
                  </div>
                )}
                
                {job.invoiced_at && (
                  <div>
                    <span className="text-slate-500">Finalized on:</span>
                    <div className="font-medium text-slate-800">
                      {new Date(job.invoiced_at).toLocaleString()}
                    </div>
                  </div>
                )}
                
                {job.invoice_sent_at && (
                  <>
                    <hr className="my-2 border-purple-200" />
                    <div>
                      <span className="text-slate-500">Sent to customer:</span>
                      <div className="font-medium text-slate-800">
                        {new Date(job.invoice_sent_at).toLocaleString()}
                      </div>
                    </div>
                    
                    {job.invoice_sent_via && job.invoice_sent_via.length > 0 && (
                      <div>
                        <span className="text-slate-500">Via:</span>
                        <div className="flex gap-2 mt-1">
                          {job.invoice_sent_via.map((method) => (
                            <span 
                              key={method}
                              className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium"
                            >
                              {method === 'whatsapp' ? '📱 WhatsApp' : '📧 Email'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="space-y-4">
            {renderSignatureBlock(
                "Technician Sign-off",
                job.technician_signature,
                () => setShowTechSigPad(true),
                <ShieldCheck className="w-4 h-4 text-blue-600" />,
                currentUserRole === UserRole.TECHNICIAN && (job.status === JobStatus.IN_PROGRESS || job.status === JobStatus.COMPLETED)
            )}

            {renderSignatureBlock(
                "Customer Acceptance",
                job.customer_signature,
                () => setShowCustSigPad(true),
                <UserCheck className="w-4 h-4 text-green-600" />,
                (job.status === JobStatus.IN_PROGRESS || job.status === JobStatus.COMPLETED)
            )}
          </div>

          {/* AI Assistant */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow p-5 border border-indigo-100">
            <h3 className="text-lg font-semibold text-indigo-900 mb-2 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-indigo-600" /> AI Assistant
            </h3>
            {aiSummary ? (
              <div className="bg-white p-3 rounded text-sm text-slate-700 italic border shadow-sm">
                "{aiSummary}"
              </div>
            ) : (
              <p className="text-xs text-indigo-700 mb-3">
                Generate a professional job summary for the invoice/customer based on your notes and parts.
              </p>
            )}
            {!aiSummary && (
              <button 
                onClick={handleAiSummary}
                disabled={generatingAi}
                className="w-full bg-indigo-600 text-white text-xs py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {generatingAi ? 'Thinking...' : 'Generate Job Summary'}
              </button>
            )}
          </div>

        </div>
      </div>

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

      {/* NEW: Finalize Invoice Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h4 className="font-bold text-lg mb-4 text-slate-900">Finalize Invoice</h4>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to finalize this invoice? This action cannot be undone and will lock all price editing.
            </p>
            
            <div className="bg-slate-50 rounded-lg p-3 mb-6 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-slate-600">Total Amount:</span>
                <span className="font-bold text-lg">${totalCost.toFixed(2)}</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Finalized by: {currentUserName}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalizeInvoice}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
              >
                Finalize Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Send Invoice Modal */}
      {showSendInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h4 className="font-bold text-lg mb-4 text-slate-900">Send Invoice to Customer</h4>
            
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-3">Customer: {job.customer.name}</p>
              <p className="text-sm text-slate-600 mb-3">Email: {job.customer.email}</p>
              <p className="text-sm text-slate-600 mb-4">Phone: {job.customer.phone}</p>
            </div>
            
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Send via:
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="sendMethod"
                    value="email"
                    checked={sendMethod === 'email'}
                    onChange={(e) => setSendMethod(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">Email</span>
                </label>
                
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="sendMethod"
                    value="whatsapp"
                    checked={sendMethod === 'whatsapp'}
                    onChange={(e) => setSendMethod(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <MessageSquare className="w-4 h-4 text-green-600" />
                  <span className="text-sm">WhatsApp</span>
                </label>
                
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="sendMethod"
                    value="both"
                    checked={sendMethod === 'both'}
                    onChange={(e) => setSendMethod(e.target.value as any)}
                    className="w-4 h-4"
                  />
                  <Send className="w-4 h-4 text-purple-600" />
                  <span className="text-sm">Both (Email & WhatsApp)</span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowSendInvoiceModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                disabled={sendingInvoice}
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvoice}
                disabled={sendingInvoice}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingInvoice ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default JobDetail;
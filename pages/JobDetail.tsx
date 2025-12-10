import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, JobStatus, UserRole, Part, JobPriority, SignatureEntry, User } from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { generateJobSummary } from '../services/geminiService';
import { SignaturePad } from '../components/SignaturePad';
import { Combobox, ComboboxOption } from '../components/Combobox';
import { 
  ArrowLeft, MapPin, Phone, User as UserIcon, Calendar, 
  CheckCircle, Plus, Camera, PenTool, Box, DollarSign, BrainCircuit, ShieldCheck, UserCheck, UserPlus
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
    setJob(data ? { ...data } : null); // Clone to force re-render
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
    
    // Validate custom price
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && job) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const updated = await MockDb.addMedia(job.job_id, {
          media_id: Date.now().toString(),
          job_id: job.job_id,
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
  const laborCost = 150; 
  const totalCost = totalPartsCost + laborCost;

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

  // Styling
  const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

  // Helper to render signature block
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
               onClick={() => handleStatusChange(JobStatus.INVOICED)}
               className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-purple-700"
             >
               Finalize Invoice
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

          {/* Technician Actions Area */}
          {(currentUserRole === UserRole.TECHNICIAN || currentUserRole === UserRole.ADMIN) && (
            <div className="space-y-6">
              
              {/* Parts */}
              <div className="bg-white rounded-xl shadow p-5">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Box className="w-5 h-5" /> Parts Used
                </h3>
                {job.parts_used.length > 0 ? (
                  <ul className="space-y-2 mb-4">
                    {job.parts_used.map(p => (
                      <li key={p.job_part_id} className="flex justify-between bg-slate-50 p-2 rounded border border-slate-100">
                        <span>{p.quantity}x {p.part_name}</span>
                        <span className="font-mono text-slate-600">${p.sell_price_at_time.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400 italic mb-4">No parts added yet.</p>
                )}
                
                {job.status === JobStatus.IN_PROGRESS && (
                  <div className="flex gap-2 items-start">
                    <div className="flex-grow">
                        <Combobox 
                            options={partOptions}
                            value={selectedPartId}
                            onChange={(val) => {
                                setSelectedPartId(val);
                                // Auto-fill price when part is selected
                                const p = parts.find(x => x.part_id === val);
                                if (p) setSelectedPartPrice(p.sell_price.toString());
                            }}
                            placeholder="Search parts..."
                        />
                    </div>
                    {/* Editable Price Input */}
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
                )}
              </div>

              {/* Photos */}
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

               {/* Notes */}
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
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Labor</span>
                <span>${laborCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Parts</span>
                <span>${totalPartsCost.toFixed(2)}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="space-y-4">
            {/* Technician Signature */}
            {renderSignatureBlock(
                "Technician Sign-off",
                job.technician_signature,
                () => setShowTechSigPad(true),
                <ShieldCheck className="w-4 h-4 text-blue-600" />,
                currentUserRole === UserRole.TECHNICIAN && (job.status === JobStatus.IN_PROGRESS || job.status === JobStatus.COMPLETED)
            )}

            {/* Customer Signature */}
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

    </div>
  );
};

export default JobDetail;
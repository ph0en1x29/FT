import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Customer, Job, User, UserRole, ForkliftRental, Forklift, ForkliftServiceEntry, JobPartUsed, ExtraCharge } from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { generateCustomerAnalysis } from '../services/geminiService';
import { showToast } from '../services/toastService';
import { 
  ArrowLeft, MapPin, Phone, Mail, Calendar, DollarSign, 
  TrendingUp, AlertCircle, BrainCircuit, Wrench, CheckCircle, Clock, Trash2,
  Truck, ChevronRight, Building2, Edit2, X, Save, Receipt, Plus,
  Square, CheckSquare, CircleOff, Loader2, Search, Briefcase, Filter,
  XCircle, AlertOctagon, User as UserIcon2, Gauge
} from 'lucide-react';

interface CustomerProfileProps {
  currentUser: User;
}

type RentalTab = 'active' | 'past';
type ServiceTab = 'open' | 'completed' | 'all';

const CustomerProfile: React.FC<CustomerProfileProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<ForkliftServiceEntry[]>([]);
  const [rentals, setRentals] = useState<ForkliftRental[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showCancelledJobs, setShowCancelledJobs] = useState(false);
  
  // Tab states
  const [rentalTab, setRentalTab] = useState<RentalTab>('active');
  const [serviceTab, setServiceTab] = useState<ServiceTab>('all');
  
  // Edit rental modal
  const [editingRental, setEditingRental] = useState<ForkliftRental | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMonthlyRate, setEditMonthlyRate] = useState('');

  // Multi-select for ending rentals
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRentalIds, setSelectedRentalIds] = useState<Set<string>>(new Set());
  const [showBulkEndModal, setShowBulkEndModal] = useState(false);
  const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Result modal
  const [resultModal, setResultModal] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'mixed';
    title: string;
    message: string;
    details?: string[];
  }>({ show: false, type: 'success', title: '', message: '' });

  // Rent forklift modal states
  const [showRentModal, setShowRentModal] = useState(false);
  const [availableForklifts, setAvailableForklifts] = useState<Forklift[]>([]);
  const [selectedForkliftIds, setSelectedForkliftIds] = useState<Set<string>>(new Set());
  const [rentStartDate, setRentStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rentEndDate, setRentEndDate] = useState('');
  const [rentNotes, setRentNotes] = useState('');
  const [rentMonthlyRate, setRentMonthlyRate] = useState('');
  const [forkliftSearchQuery, setForkliftSearchQuery] = useState('');
  const [rentProcessing, setRentProcessing] = useState(false);

  const isAdmin = currentUser.role.toString().toLowerCase() === 'admin';
  const isSupervisor = currentUser.role.toString().toLowerCase() === 'supervisor';
  const canViewCancelled = isAdmin || isSupervisor;

  useEffect(() => {
    loadCustomerData();
  }, [id]);

  const loadCustomerData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const customers = await MockDb.getCustomers();
      const foundCustomer = customers.find(c => c.customer_id === id);
      setCustomer(foundCustomer || null);

      // Get jobs including cancelled ones
      const customerJobs = await MockDb.getCustomerJobsWithCancelled(id);
      setJobs(customerJobs.sort((a: ForkliftServiceEntry, b: ForkliftServiceEntry) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));

      const customerRentals = await MockDb.getCustomerRentals(id);
      setRentals(customerRentals);
    } catch (error) {
      console.error('Error loading customer:', error);
      showToast.error('Failed to load customer profile');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableForklifts = async () => {
    try {
      const forkliftsWithCustomers = await MockDb.getForkliftsWithCustomers();
      const available = forkliftsWithCustomers.filter(f => !f.current_customer_id);
      setAvailableForklifts(available);
    } catch (error) {
      console.error('Error loading available forklifts:', error);
      showToast.error('Failed to load available forklifts');
    }
  };

  const openRentModal = async () => {
    await loadAvailableForklifts();
    setSelectedForkliftIds(new Set());
    setRentStartDate(new Date().toISOString().split('T')[0]);
    setRentEndDate('');
    setRentNotes('');
    setRentMonthlyRate('');
    setForkliftSearchQuery('');
    setShowRentModal(true);
  };

  const filteredAvailableForklifts = useMemo(() => {
    if (!forkliftSearchQuery) return availableForklifts;
    const query = forkliftSearchQuery.toLowerCase();
    return availableForklifts.filter(f => 
      f.serial_number.toLowerCase().includes(query) ||
      f.make.toLowerCase().includes(query) ||
      f.model.toLowerCase().includes(query)
    );
  }, [availableForklifts, forkliftSearchQuery]);

  const toggleForkliftForRent = (forkliftId: string) => {
    const newSelected = new Set(selectedForkliftIds);
    if (newSelected.has(forkliftId)) {
      newSelected.delete(forkliftId);
    } else {
      newSelected.add(forkliftId);
    }
    setSelectedForkliftIds(newSelected);
  };

  const handleRentForklifts = async () => {
    if (!customer || selectedForkliftIds.size === 0 || !rentStartDate) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Validation Error',
        message: 'Please select at least one forklift and a start date'
      });
      return;
    }

    setRentProcessing(true);
    try {
      const forkliftIds: string[] = Array.from(selectedForkliftIds);
      
      if (forkliftIds.length === 1) {
        await MockDb.assignForkliftToCustomer(
          forkliftIds[0],
          customer.customer_id,
          rentStartDate,
          rentEndDate || undefined,
          rentNotes || undefined,
          currentUser.user_id,
          currentUser.name,
          rentMonthlyRate ? parseFloat(rentMonthlyRate) : undefined
        );
        
        const forklift = availableForklifts.find(f => f.forklift_id === forkliftIds[0]);
        setResultModal({
          show: true,
          type: 'success',
          title: 'Forklift Rented Successfully',
          message: `${forklift?.make} ${forklift?.model} (${forklift?.serial_number}) has been rented to ${customer.name}.`,
          details: [
            `✓ Rental created successfully`,
            `✓ Start date: ${new Date(rentStartDate).toLocaleDateString()}`,
            rentMonthlyRate ? `✓ Monthly rate: RM${parseFloat(rentMonthlyRate).toLocaleString()}` : ''
          ].filter(Boolean)
        });
      } else {
        const result = await MockDb.bulkAssignForkliftsToCustomer(
          forkliftIds,
          customer.customer_id,
          rentStartDate,
          rentEndDate || undefined,
          rentNotes || undefined,
          currentUser.user_id,
          currentUser.name,
          rentMonthlyRate ? parseFloat(rentMonthlyRate) : undefined
        );

        const details: string[] = [];
        result.success.forEach(r => {
          details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rented successfully`);
        });
        result.failed.forEach(f => {
          const forklift = availableForklifts.find(fl => fl.forklift_id === f.forkliftId);
          details.push(`✗ ${forklift?.serial_number || f.forkliftId} - ${f.error}`);
        });

        setResultModal({
          show: true,
          type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
          title: result.failed.length === 0 ? 'Forklifts Rented Successfully' : 'Bulk Rental Complete',
          message: `Successfully rented ${result.success.length} forklift(s) to ${customer.name}${result.failed.length > 0 ? `. ${result.failed.length} failed.` : '.'}`,
          details
        });
      }

      setShowRentModal(false);
      await loadCustomerData();
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message
      });
    } finally {
      setRentProcessing(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!customer || jobs.length === 0) return;
    
    setGeneratingAI(true);
    try {
      const analysis = await generateCustomerAnalysis(customer, jobs);
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('AI Analysis error:', error);
      setAiAnalysis('Unable to generate analysis at this time.');
      showToast.error('AI analysis failed');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    
    const confirmed = confirm(`Are you sure you want to delete customer: "${customer.name}"?\n\nThis action cannot be undone.`);
    if (!confirmed) return;
    
    try {
      await MockDb.deleteCustomer(customer.customer_id);
      navigate('/customers');
    } catch (e) {
      alert('Could not delete customer: ' + (e as Error).message);
    }
  };

  const handleEndRental = async (rentalId: string) => {
    if (!confirm('End this rental? The forklift will be marked as available.')) return;
    
    try {
      await MockDb.endRental(rentalId, undefined, currentUser.user_id, currentUser.name);
      await loadCustomerData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleEditRental = (rental: ForkliftRental) => {
    setEditingRental(rental);
    setEditStartDate(rental.start_date);
    setEditEndDate(rental.end_date || '');
    setEditNotes(rental.notes || '');
    setEditMonthlyRate(rental.monthly_rental_rate?.toString() || '0');
  };

  const handleSaveRentalEdit = async () => {
    if (!editingRental) return;
    
    try {
      await MockDb.updateRental(editingRental.rental_id, {
        start_date: editStartDate,
        end_date: editEndDate || undefined,
        notes: editNotes || undefined,
        monthly_rental_rate: parseFloat(editMonthlyRate) || 0,
      });
      setEditingRental(null);
      await loadCustomerData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  // Computed data
  const activeRentals = useMemo(() => rentals.filter(r => r.status === 'active'), [rentals]);
  const pastRentals = useMemo(() => rentals.filter(r => r.status !== 'active'), [rentals]);
  
  // Filter out cancelled jobs for active metrics
  const activeJobs = useMemo(() => jobs.filter(j => !j.is_cancelled), [jobs]);
  const cancelledJobs = useMemo(() => jobs.filter(j => j.is_cancelled), [jobs]);
  
  // Completed = work done (includes Awaiting Ack, Disputed - work was done)
  const completedStatuses = [
    'Completed', 
    'Awaiting Finalization',
    'Completed Awaiting Acknowledgement',
    'Disputed'
  ];
  const openJobs = useMemo(() => activeJobs.filter(j => !completedStatuses.includes(j.status)), [activeJobs]);
  const completedJobs = useMemo(() => activeJobs.filter(j => completedStatuses.includes(j.status)), [activeJobs]);
  
  const filteredJobs = useMemo(() => {
    switch (serviceTab) {
      case 'open': return openJobs;
      case 'completed': return completedJobs;
      default: return activeJobs;
    }
  }, [serviceTab, activeJobs, openJobs, completedJobs]);

  const selectedRentals = useMemo(() => {
    return activeRentals.filter(r => selectedRentalIds.has(r.rental_id));
  }, [activeRentals, selectedRentalIds]);

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedRentalIds(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const toggleRentalSelection = (rentalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedRentalIds);
    if (newSelected.has(rentalId)) {
      newSelected.delete(rentalId);
    } else {
      newSelected.add(rentalId);
    }
    setSelectedRentalIds(newSelected);
  };

  const selectAllActiveRentals = () => {
    const allIds = new Set(activeRentals.map(r => r.rental_id));
    setSelectedRentalIds(allIds);
  };

  const deselectAll = () => {
    setSelectedRentalIds(new Set());
  };

  const openBulkEndModal = () => {
    setBulkEndDate(new Date().toISOString().split('T')[0]);
    setShowBulkEndModal(true);
  };

  const handleBulkEndRentals = async () => {
    if (selectedRentals.length === 0) return;

    setBulkProcessing(true);
    try {
      const forkliftIds = selectedRentals.map(r => r.forklift_id);
      
      const result = await MockDb.bulkEndRentals(
        forkliftIds,
        bulkEndDate || undefined,
        currentUser.user_id,
        currentUser.name
      );

      const details: string[] = [];
      result.success.forEach(r => {
        details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rental ended`);
      });
      result.failed.forEach(f => {
        const rental = selectedRentals.find(r => r.forklift_id === f.forkliftId);
        details.push(`✗ ${rental?.forklift?.serial_number || f.forkliftId} - ${f.error}`);
      });

      setResultModal({
        show: true,
        type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
        title: result.failed.length === 0 ? 'Rentals Ended Successfully' : 'Bulk End Rental Complete',
        message: `Successfully ended ${result.success.length} rental(s)${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}.`,
        details
      });

      setShowBulkEndModal(false);
      setSelectedRentalIds(new Set());
      setIsSelectionMode(false);
      await loadCustomerData();
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>;
  }

  if (!customer) {
    return <div className="p-8 text-center text-red-500">Customer not found</div>;
  }

  // Calculate stats (use activeJobs to exclude cancelled jobs from metrics)
  const totalJobs = activeJobs.length;
  const totalServiceRevenue = activeJobs.reduce((acc, job) => {
    const partsCost = (job.parts_used || []).reduce((sum: number, p: JobPartUsed) => sum + (p.sell_price_at_time * p.quantity), 0);
    const laborCost = job.labor_cost || 150;
    const extraChargesCost = (job.extra_charges || []).reduce((sum: number, c: ExtraCharge) => sum + c.amount, 0);
    return acc + partsCost + laborCost + extraChargesCost;
  }, 0);
  
  const totalRentalRevenue = rentals.reduce((acc, rental) => {
    const monthlyRate = rental.monthly_rental_rate || 0;
    if (monthlyRate <= 0) return acc;
    
    const start = new Date(rental.start_date);
    const end = rental.end_date ? new Date(rental.end_date) : new Date();
    const months = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    return acc + (monthlyRate * months);
  }, 0);
  
  const totalRevenue = totalServiceRevenue + totalRentalRevenue;
  
  const avgResponseTime = activeJobs.filter(j => j.arrival_time).length > 0
    ? activeJobs.filter(j => j.arrival_time).reduce((acc, j) => {
        const created = new Date(j.created_at).getTime();
        const arrived = new Date(j.arrival_time!).getTime();
        return acc + ((arrived - created) / (1000 * 60 * 60));
      }, 0) / activeJobs.filter(j => j.arrival_time).length
    : 0;

  const issueFrequency: { [key: string]: number } = {};
  activeJobs.forEach(job => {
    const title = job.title.toLowerCase();
    const key = title.includes('ac') || title.includes('air') ? 'AC/HVAC' :
                title.includes('heat') ? 'Heating' :
                title.includes('plumb') || title.includes('pipe') ? 'Plumbing' :
                title.includes('electric') ? 'Electrical' :
                'General Maintenance';
    issueFrequency[key] = (issueFrequency[key] || 0) + 1;
  });

  const topIssues = Object.entries(issueFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const displayedRentals = rentalTab === 'active' ? activeRentals : pastRentals;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ========== HEADER ========== */}
      <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Customer Info */}
          <div className="flex items-start gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full mt-1">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded font-mono">
                  {customer.customer_id.slice(0, 8)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {customer.address}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openRentModal}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm"
            >
              <Truck className="w-4 h-4" />
              Rent Forklift
            </button>
            {(isAdmin || isSupervisor) && (
              <button
                onClick={() => navigate(`/jobs/new?customer_id=${customer.customer_id}`)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm"
              >
                <Briefcase className="w-4 h-4" />
                Create Job
              </button>
            )}
            <button
              onClick={() => navigate(`/customers/${customer.customer_id}/edit`)}
              className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            {isAdmin && (
              <button 
                onClick={handleDeleteCustomer}
                className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========== KPI STRIP ========== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 uppercase font-medium">Total Jobs</p>
          <p className="text-2xl font-bold text-blue-600">{totalJobs}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 uppercase font-medium">Active Rentals</p>
          <p className="text-2xl font-bold text-purple-600">{activeRentals.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 uppercase font-medium">Service Revenue</p>
          <p className="text-2xl font-bold text-green-600">RM{totalServiceRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 uppercase font-medium">Rental Revenue</p>
          <p className="text-2xl font-bold text-amber-600">RM{totalRentalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-500 uppercase font-medium">Total Revenue</p>
          <p className="text-2xl font-bold text-slate-800">RM{totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* ========== MAIN CONTENT ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ===== RENTALS ===== */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => { setRentalTab('active'); setIsSelectionMode(false); setSelectedRentalIds(new Set()); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  rentalTab === 'active' 
                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Active ({activeRentals.length})
              </button>
              <button
                onClick={() => { setRentalTab('past'); setIsSelectionMode(false); setSelectedRentalIds(new Set()); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  rentalTab === 'past' 
                    ? 'text-slate-600 border-b-2 border-slate-600 bg-slate-50' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Past ({pastRentals.length})
              </button>
            </div>

            {rentalTab === 'active' && activeRentals.length > 1 && (
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <button
                  onClick={toggleSelectionMode}
                  className={`text-xs font-medium flex items-center gap-1.5 ${
                    isSelectionMode ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {isSelectionMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {isSelectionMode ? 'Exit Select' : 'Multi-Select'}
                </button>
                {isSelectionMode && selectedRentalIds.size > 0 && (
                  <button
                    onClick={openBulkEndModal}
                    className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <CircleOff className="w-3.5 h-3.5" />
                    End {selectedRentalIds.size}
                  </button>
                )}
              </div>
            )}

            {isSelectionMode && rentalTab === 'active' && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex gap-3 text-xs">
                <button onClick={selectAllActiveRentals} className="text-blue-600 hover:underline">Select All</button>
                <button onClick={deselectAll} className="text-slate-500 hover:underline">Clear</button>
              </div>
            )}

            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {displayedRentals.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No {rentalTab} rentals</p>
                </div>
              ) : (
                displayedRentals.map(rental => {
                  const isSelected = selectedRentalIds.has(rental.rental_id);
                  const isActive = rental.status === 'active';
                  
                  return (
                    <div 
                      key={rental.rental_id}
                      onClick={() => {
                        if (isSelectionMode && isActive) {
                          const newSelected = new Set(selectedRentalIds);
                          if (newSelected.has(rental.rental_id)) {
                            newSelected.delete(rental.rental_id);
                          } else {
                            newSelected.add(rental.rental_id);
                          }
                          setSelectedRentalIds(newSelected);
                        } else if (rental.forklift) {
                          navigate(`/forklifts/${rental.forklift_id}`);
                        }
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-blue-50 border-2 border-blue-400' 
                          : isActive 
                            ? 'bg-green-50 border border-green-200 hover:border-green-300' 
                            : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isSelectionMode && isActive && (
                          <div className="mt-0.5">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-sm truncate">
                              {rental.forklift?.make} {rental.forklift?.model}
                            </span>
                            {!isSelectionMode && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-500 font-mono">{rental.forklift?.serial_number}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(rental.start_date).toLocaleDateString()}</span>
                            {!isActive && rental.end_date && (
                              <span className="text-slate-400">→ {new Date(rental.end_date).toLocaleDateString()}</span>
                            )}
                          </div>
                          {isActive && (rental.monthly_rental_rate || 0) > 0 && (
                            <div className="mt-1.5 text-xs font-medium text-green-700">
                              RM{(rental.monthly_rental_rate || 0).toLocaleString()}/mo
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isActive && !isSelectionMode && (
                        <div className="flex gap-2 mt-3 pt-2 border-t border-green-100">
                          {isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditRental(rental); }}
                              className="flex-1 text-xs py-1.5 text-blue-600 hover:bg-blue-50 rounded font-medium"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEndRental(rental.rental_id); }}
                            className="flex-1 text-xs py-1.5 text-red-600 hover:bg-red-50 rounded font-medium"
                          >
                            End
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ===== SERVICE HISTORY ===== */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => { setServiceTab('open'); setShowCancelledJobs(false); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  serviceTab === 'open' && !showCancelledJobs
                    ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Open ({openJobs.length})
              </button>
              <button
                onClick={() => { setServiceTab('completed'); setShowCancelledJobs(false); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  serviceTab === 'completed' && !showCancelledJobs
                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Completed ({completedJobs.length})
              </button>
              <button
                onClick={() => { setServiceTab('all'); setShowCancelledJobs(false); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  serviceTab === 'all' && !showCancelledJobs
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                All ({activeJobs.length})
              </button>
              {cancelledJobs.length > 0 && canViewCancelled && (
                <button
                  onClick={() => setShowCancelledJobs(true)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    showCancelledJobs
                      ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Cancelled ({cancelledJobs.length})
                </button>
              )}
            </div>

            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {showCancelledJobs ? (
                // Cancelled jobs view
                cancelledJobs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <XCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No cancelled jobs</p>
                  </div>
                ) : (
                  cancelledJobs.map(job => (
                    <div
                      key={job.job_id}
                      className="p-3 border border-red-200 bg-red-50/50 rounded-lg"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-600 text-sm line-through truncate">
                            {job.title}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{job.description}</p>
                          {job.forklift && (
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              {job.forklift.serial_number}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 bg-red-100 text-red-700">
                          Cancelled
                        </span>
                      </div>

                      {/* Cancellation info */}
                      <div className="mt-2 pt-2 border-t border-red-200 text-xs">
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="w-3 h-3" />
                          <span>Cancelled by {job.deleted_by_name || 'Unknown'}</span>
                        </div>
                        {job.deletion_reason && (
                          <div className="mt-1 text-slate-500 italic">
                            Reason: {job.deletion_reason}
                          </div>
                        )}
                        {job.deleted_at && (
                          <div className="mt-1 text-slate-400">
                            {new Date(job.deleted_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )
              ) : (
                // Normal jobs view
                filteredJobs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Wrench className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No {serviceTab === 'all' ? '' : serviceTab} jobs</p>
                  </div>
                ) : (
                  filteredJobs.map(job => (
                    <div
                      key={job.job_id}
                      onClick={() => navigate(`/jobs/${job.job_id}`)}
                      className="p-3 border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-300 transition cursor-pointer group"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 truncate">
                            {job.title}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{job.description}</p>
                          {job.forklift && (
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              {job.forklift.serial_number}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                          job.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          job.status === 'Awaiting Finalization' ? 'bg-purple-100 text-purple-700' :
                          job.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {job.status}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                        {job.parts_used && job.parts_used.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            {job.parts_used.length} parts
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>

        {/* ===== INSIGHTS SIDEBAR ===== */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" /> Service Stats
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                <span className="text-xs text-slate-600">Completed</span>
                <span className="font-bold text-green-600 text-sm">{completedJobs.length}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                <span className="text-xs text-slate-600">Avg Response</span>
                <span className="font-bold text-blue-600 text-sm">{avgResponseTime.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                <span className="text-xs text-slate-600">Avg Job Value</span>
                <span className="font-bold text-purple-600 text-sm">
                  RM{totalJobs > 0 ? Math.round(totalServiceRevenue / totalJobs) : 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-600" /> Common Issues
            </h3>
            {topIssues.length > 0 ? (
              <div className="space-y-2">
                {topIssues.map(([issue, count], idx) => (
                  <div key={issue} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                    <span className="text-xs text-slate-600">#{idx + 1} {issue}</span>
                    <span className="text-xs font-bold text-slate-500">{count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No service history yet</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm border border-purple-100 p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-2 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-purple-600" /> AI Insights
            </h3>
            
            {aiAnalysis ? (
              <div className="bg-white rounded-lg p-3 text-xs text-slate-700 space-y-2 max-h-48 overflow-y-auto">
                {aiAnalysis.split('\n').filter(Boolean).map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
                <button
                  onClick={() => setAiAnalysis('')}
                  className="text-purple-600 hover:underline text-xs mt-2"
                >
                  Regenerate
                </button>
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-xs text-slate-400">No service history to analyze</p>
            ) : (
              <button
                onClick={handleGenerateAnalysis}
                disabled={generatingAI}
                className="w-full mt-2 bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {generatingAI ? 'Analyzing...' : 'Generate Analysis'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========== MODALS ========== */}

      {/* Edit Rental Modal */}
      {editingRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Edit Rental</h3>
              <button onClick={() => setEditingRental(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">
                  {editingRental.forklift?.make} {editingRental.forklift?.model}
                </p>
                <p className="text-xs text-blue-600">{editingRental.forklift?.serial_number}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date (Optional)</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rate (RM)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">RM</span>
                    <input
                      type="number"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                      value={editMonthlyRate}
                      onChange={(e) => setEditMonthlyRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setEditingRental(null)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRentalEdit}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk End Rental Modal */}
      {showBulkEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-red-50">
              <h3 className="font-bold text-lg text-red-800">
                End {selectedRentals.length} Rental(s)
              </h3>
              <button onClick={() => setShowBulkEndModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Rentals to End:</p>
                <div className="space-y-1">
                  {selectedRentals.map(rental => (
                    <div key={rental.rental_id} className="text-sm p-2 bg-white rounded border border-slate-200 flex items-center gap-2">
                      <Truck className="w-3 h-3 text-slate-400" />
                      <span className="font-medium">{rental.forklift?.serial_number}</span>
                      <span className="text-slate-400">—</span>
                      <span className="text-slate-500">{rental.forklift?.make} {rental.forklift?.model}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>⚠️</strong> These forklifts will become available for new rentals.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowBulkEndModal(false)}
                  disabled={bulkProcessing}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkEndRentals}
                  disabled={bulkProcessing}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleOff className="w-4 h-4" />}
                  {bulkProcessing ? 'Processing...' : 'End Rentals'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rent Forklift Modal */}
      {showRentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-green-50 flex-shrink-0">
              <h3 className="font-bold text-lg text-green-800 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Rent to {customer?.name}
              </h3>
              <button onClick={() => setShowRentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search forklifts..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={forkliftSearchQuery}
                  onChange={(e) => setForkliftSearchQuery(e.target.value)}
                />
              </div>

              <div className="bg-slate-50 rounded-lg p-3 max-h-56 overflow-y-auto">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">
                  Available ({filteredAvailableForklifts.length})
                  {selectedForkliftIds.size > 0 && (
                    <span className="ml-2 text-green-600">• {selectedForkliftIds.size} selected</span>
                  )}
                </p>
                {filteredAvailableForklifts.length === 0 ? (
                  <div className="text-center py-6 text-slate-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No available forklifts</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAvailableForklifts.map(forklift => {
                      const isSelected = selectedForkliftIds.has(forklift.forklift_id);
                      return (
                        <div 
                          key={forklift.forklift_id}
                          onClick={() => toggleForkliftForRent(forklift.forklift_id)}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-green-100 border-2 border-green-400' 
                              : 'bg-white border border-slate-200 hover:border-green-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800 text-sm">
                                  {forklift.make} {forklift.model}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  forklift.type === 'Electric' ? 'bg-blue-100 text-blue-700' :
                                  forklift.type === 'Diesel' ? 'bg-slate-100 text-slate-700' :
                                  'bg-purple-100 text-purple-700'
                                }`}>
                                  {forklift.type}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-mono">{forklift.serial_number}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date *</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                    value={rentStartDate}
                    onChange={(e) => setRentStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                    value={rentEndDate}
                    onChange={(e) => setRentEndDate(e.target.value)}
                  />
                </div>
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rate (RM)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">RM</span>
                    <input
                      type="number"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                      value={rentMonthlyRate}
                      onChange={(e) => setRentMonthlyRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500 h-16 resize-none"
                  value={rentNotes}
                  onChange={(e) => setRentNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex gap-3 flex-shrink-0 bg-slate-50">
              <button
                onClick={() => setShowRentModal(false)}
                disabled={rentProcessing}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRentForklifts}
                disabled={rentProcessing || selectedForkliftIds.size === 0}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {rentProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {rentProcessing ? 'Processing...' : `Rent ${selectedForkliftIds.size || ''} Forklift${selectedForkliftIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`px-6 py-4 border-b flex justify-between items-center ${
              resultModal.type === 'success' ? 'bg-green-50 border-green-100' :
              resultModal.type === 'error' ? 'bg-red-50 border-red-100' :
              'bg-amber-50 border-amber-100'
            }`}>
              <h3 className={`font-bold text-lg flex items-center gap-2 ${
                resultModal.type === 'success' ? 'text-green-800' :
                resultModal.type === 'error' ? 'text-red-800' :
                'text-amber-800'
              }`}>
                {resultModal.type === 'success' && <CheckCircle className="w-5 h-5" />}
                {resultModal.type === 'error' && <AlertCircle className="w-5 h-5" />}
                {resultModal.type === 'mixed' && <AlertCircle className="w-5 h-5" />}
                {resultModal.title}
              </h3>
              <button 
                onClick={() => setResultModal({ ...resultModal, show: false })} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-700">{resultModal.message}</p>
              
              {resultModal.details && resultModal.details.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <div className="space-y-1 text-sm font-mono">
                    {resultModal.details.map((detail, idx) => (
                      <p key={idx} className={
                        detail.startsWith('✓') ? 'text-green-600' :
                        detail.startsWith('✗') ? 'text-red-600' :
                        'text-slate-600'
                      }>
                        {detail}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setResultModal({ ...resultModal, show: false })}
                className={`w-full py-2.5 rounded-lg font-medium shadow-sm ${
                  resultModal.type === 'success' ? 'bg-green-600 text-white hover:bg-green-700' :
                  resultModal.type === 'error' ? 'bg-red-600 text-white hover:bg-red-700' :
                  'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerProfile;

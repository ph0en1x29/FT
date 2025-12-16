import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Customer, Job, User, UserRole, ForkliftRental } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { generateCustomerAnalysis } from '../services/geminiService';
import { 
  ArrowLeft, MapPin, Phone, Mail, Calendar, DollarSign, 
  TrendingUp, AlertCircle, BrainCircuit, Wrench, CheckCircle, Clock, Trash2,
  Truck, ChevronRight, Building2, Edit2, X, Save, Receipt
} from 'lucide-react';

interface CustomerProfileProps {
  currentUser: User;
}

const CustomerProfile: React.FC<CustomerProfileProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rentals, setRentals] = useState<ForkliftRental[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  
  // Edit rental modal
  const [editingRental, setEditingRental] = useState<ForkliftRental | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMonthlyRate, setEditMonthlyRate] = useState('');

  const isAdmin = currentUser.role.toString().toLowerCase() === 'admin';

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

      const allJobs = await MockDb.getJobs(currentUser);
      const customerJobs = allJobs.filter(j => j.customer_id === id);
      setJobs(customerJobs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));

      // Load rentals for this customer
      const customerRentals = await MockDb.getCustomerRentals(id);
      setRentals(customerRentals);
    } catch (error) {
      console.error('Error loading customer:', error);
    } finally {
      setLoading(false);
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
    setEditMonthlyRate((rental as any).monthly_rental_rate?.toString() || '0');
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

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>;
  }

  if (!customer) {
    return <div className="p-8 text-center text-red-500">Customer not found</div>;
  }

  // Calculate stats
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'Completed' || j.status === 'Awaiting Finalization').length;
  const totalServiceRevenue = jobs.reduce((acc, job) => {
    const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
    const laborCost = job.labor_cost || 150;
    const extraChargesCost = (job.extra_charges || []).reduce((sum, c) => sum + c.amount, 0);
    return acc + partsCost + laborCost + extraChargesCost;
  }, 0);
  
  // Calculate rental revenue
  const totalRentalRevenue = rentals.reduce((acc, rental) => {
    const monthlyRate = (rental as any).monthly_rental_rate || 0;
    if (monthlyRate <= 0) return acc;
    
    const start = new Date(rental.start_date);
    const end = rental.end_date ? new Date(rental.end_date) : new Date();
    const months = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    return acc + (monthlyRate * months);
  }, 0);
  
  const totalRevenue = totalServiceRevenue + totalRentalRevenue;
  
  const lastService = jobs[0];
  const avgResponseTime = jobs.filter(j => j.arrival_time).length > 0
    ? jobs.filter(j => j.arrival_time).reduce((acc, j) => {
        const created = new Date(j.created_at).getTime();
        const arrived = new Date(j.arrival_time!).getTime();
        return acc + ((arrived - created) / (1000 * 60 * 60));
      }, 0) / jobs.filter(j => j.arrival_time).length
    : 0;

  const issueFrequency: { [key: string]: number } = {};
  jobs.forEach(job => {
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

  const activeRentals = rentals.filter(r => r.status === 'active');
  const pastRentals = rentals.filter(r => r.status !== 'active');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Customer Profile</h1>
        </div>
        {isAdmin && (
          <button 
            type="button"
            onClick={handleDeleteCustomer}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete Customer
          </button>
        )}
      </div>

      {/* Customer Info Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-100">
        <div className="flex justify-between items-start">
          <div className="space-y-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{customer.name}</h2>
              <p className="text-sm text-slate-500">Customer ID: {customer.customer_id.slice(0, 8)}</p>
            </div>
            
            <div className="space-y-2 text-slate-700">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>{customer.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{totalJobs}</p>
              <p className="text-xs text-slate-500">Total Jobs</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-green-600">RM{totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Total Revenue</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-purple-600">{activeRentals.length}</p>
              <p className="text-xs text-slate-500">Active Rentals</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-amber-600">RM{totalRentalRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Rental Revenue</p>
            </div>
          </div>
        </div>
      </div>


      {/* Rented Forklifts Section */}
      {rentals.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" /> Rented Forklifts ({rentals.length})
          </h3>
          
          {/* Active Rentals */}
          {activeRentals.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-green-700 mb-2">Active Rentals</h4>
              <div className="space-y-3">
                {activeRentals.map(rental => (
                  <div 
                    key={rental.rental_id} 
                    className="p-4 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div 
                        className="flex-1 cursor-pointer hover:opacity-80"
                        onClick={() => rental.forklift && navigate(`/forklifts/${rental.forklift_id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-green-600" />
                          <span className="font-semibold text-slate-800">
                            {rental.forklift?.make} {rental.forklift?.model}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-500 font-mono mt-1">
                          {rental.forklift?.serial_number}
                        </p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-slate-600">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            From: {new Date(rental.start_date).toLocaleDateString()}
                          </span>
                          {rental.end_date && (
                            <span className="text-slate-600">
                              <Calendar className="w-3 h-3 inline mr-1" />
                              Until: {new Date(rental.end_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {(rental as any).monthly_rental_rate > 0 && (
                          <div className="mt-2 text-sm font-medium text-green-700">
                            <DollarSign className="w-3 h-3 inline mr-1" />
                            RM{((rental as any).monthly_rental_rate || 0).toLocaleString()}/month
                          </div>
                        )}
                        {rental.notes && (
                          <p className="text-xs text-slate-500 mt-2 italic">{rental.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {isAdmin && (
                          <button
                            onClick={() => handleEditRental(rental)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit Rental & Rate"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEndRental(rental.rental_id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                        >
                          End Rental
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past Rentals */}
          {pastRentals.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-500 mb-2">Past Rentals</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pastRentals.map(rental => (
                  <div 
                    key={rental.rental_id} 
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100"
                    onClick={() => rental.forklift && navigate(`/forklifts/${rental.forklift_id}`)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-slate-700">
                          {rental.forklift?.make} {rental.forklift?.model}
                        </span>
                        <span className="text-sm text-slate-400 ml-2 font-mono">
                          {rental.forklift?.serial_number}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(rental.start_date).toLocaleDateString()} - {rental.end_date ? new Date(rental.end_date).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Stats */}
        <div className="space-y-6">
          {/* Service Stats */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" /> Service Stats
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">Completed</span>
                </div>
                <span className="font-bold text-green-600">{completedJobs}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">Avg Response</span>
                </div>
                <span className="font-bold text-blue-600">{avgResponseTime.toFixed(1)}h</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-slate-700">Avg Job Value</span>
                </div>
                <span className="font-bold text-purple-600">
                  RM{totalJobs > 0 ? Math.round(totalServiceRevenue / totalJobs) : 0}
                </span>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" /> Revenue Breakdown
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Service Revenue</span>
                <span className="font-bold text-green-600">RM{totalServiceRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Rental Revenue</span>
                <span className="font-bold text-amber-600">RM{totalRentalRevenue.toLocaleString()}</span>
              </div>
              <hr className="my-2" />
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-bold text-slate-800">Total Revenue</span>
                <span className="font-bold text-lg text-blue-600">RM{totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Top Issues */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" /> Common Issues
            </h3>
            {topIssues.length > 0 ? (
              <div className="space-y-2">
                {topIssues.map(([issue, count], idx) => (
                  <div key={issue} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                    <span className="text-sm text-slate-700">#{idx + 1} {issue}</span>
                    <span className="text-xs font-bold text-slate-500">{count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No service history yet</p>
            )}
          </div>

          {/* Last Service */}
          {lastService && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" /> Last Service
              </h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-800">{lastService.title}</p>
                <p className="text-slate-500">{lastService.description}</p>
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    {new Date(lastService.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                    lastService.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {lastService.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>


        {/* Right Column - History & AI */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Analysis */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm p-6 border border-purple-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                  <BrainCircuit className="w-5 h-5 text-purple-600" /> AI Customer Analysis
                </h3>
                <p className="text-xs text-slate-500">
                  Get intelligent insights about service patterns and trends
                </p>
              </div>
              {!aiAnalysis && (
                <button
                  onClick={handleGenerateAnalysis}
                  disabled={generatingAI || jobs.length === 0}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {generatingAI ? 'Analyzing...' : 'Generate Analysis'}
                </button>
              )}
            </div>

            {aiAnalysis ? (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="prose prose-sm max-w-none text-slate-700">
                  {aiAnalysis.split('\n').map((line, idx) => (
                    <p key={idx} className="mb-2">{line}</p>
                  ))}
                </div>
                <button
                  onClick={() => setAiAnalysis('')}
                  className="mt-4 text-xs text-purple-600 hover:underline"
                >
                  Generate New Analysis
                </button>
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-white rounded-lg p-4 text-center text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No service history to analyze yet</p>
              </div>
            ) : null}
          </div>

          {/* Service History */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4">Service History</h3>
            
            {jobs.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {jobs.map(job => (
                  <div
                    key={job.job_id}
                    onClick={() => navigate(`/jobs/${job.job_id}`)}
                    className="p-4 border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-300 transition cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 group-hover:text-blue-600">
                          {job.title}
                        </h4>
                        <p className="text-sm text-slate-500 line-clamp-1">{job.description}</p>
                        {job.forklift && (
                          <p className="text-xs text-slate-400 mt-1">
                            <Truck className="w-3 h-3 inline mr-1" />
                            {job.forklift.make} {job.forklift.model} ({job.forklift.serial_number})
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-3 ${
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
                      {job.parts_used.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          {job.parts_used.length} parts used
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No service history yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Rental Modal */}
      {editingRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Edit Rental</h3>
              <button 
                onClick={() => setEditingRental(null)} 
                className="text-slate-400 hover:text-slate-600"
              >
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    <Receipt className="w-3 h-3 inline mr-1" />
                    Monthly Rental Rate (RM)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">RM</span>
                    <input
                      type="number"
                      className="w-full pl-10 pr-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                      value={editMonthlyRate}
                      onChange={(e) => setEditMonthlyRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Set the monthly rental fee for this forklift</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Notes
                </label>
                <textarea
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRental(null)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRentalEdit}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerProfile;

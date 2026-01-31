import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Forklift, ForkliftRental, Job, User, ForkliftStatus, RentalStatus, Customer, ScheduledService, UserRole, ForkliftServiceEntry } from '../../types';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { 
  ArrowLeft, Truck, MapPin, Gauge, Calendar, Wrench, 
  CheckCircle, Clock, AlertCircle, Building2, User as UserIcon,
  FileText, Play, ChevronRight, History, Package, X, Save,
  DollarSign, Edit2, Plus, Bell, CalendarClock, Settings, Trash2,
  XCircle, AlertOctagon
} from 'lucide-react';

interface ForkliftProfileProps {
  currentUser: User;
}

const ForkliftProfile: React.FC<ForkliftProfileProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [forklift, setForklift] = useState<Forklift | null>(null);
  const [rentals, setRentals] = useState<ForkliftRental[]>([]);
  const [serviceHistory, setServiceHistory] = useState<ForkliftServiceEntry[]>([]);
  const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([]);
  const [hourmeterHistory, setHourmeterHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelledJobs, setShowCancelledJobs] = useState(false);
  const [showHourmeterHistory, setShowHourmeterHistory] = useState(false);
  
  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [monthlyRentalRate, setMonthlyRentalRate] = useState<string>('');

  // Edit Rental Rate Modal
  const [showEditRentalModal, setShowEditRentalModal] = useState(false);
  const [editingRentalId, setEditingRentalId] = useState<string | null>(null);
  const [editRentalRate, setEditRentalRate] = useState<string>('');

  // Schedule Service Modal
  const [showScheduleServiceModal, setShowScheduleServiceModal] = useState(false);
  const [serviceType, setServiceType] = useState('PM Service');
  const [serviceDueDate, setServiceDueDat] = useState('');
  const [serviceDueHourmeter, setServiceDueHourmeter] = useState<string>('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [assignedTechId, setAssignedTechId] = useState('');


  // Use dev mode context for role-based permissions
  const { displayRole, hasPermission } = useDevModeContext();

  // Check permissions
  const canEditRentalRates = hasPermission('canEditRentalRates');
  const canScheduleMaintenance = hasPermission('canScheduleMaintenance');
  const canManageRentals = hasPermission('canManageRentals');
  const isAdmin = displayRole === UserRole.ADMIN;
  const isSupervisor = displayRole === UserRole.SUPERVISOR;
  const canViewCancelled = isAdmin || isSupervisor;

  useEffect(() => {
    loadForkliftData();
  }, [id]);

  const loadForkliftData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const forkliftData = await MockDb.getForkliftWithCustomer(id);
      setForklift(forkliftData);

      const rentalData = await MockDb.getForkliftRentals(id);
      setRentals(rentalData);

      // Get service history including cancelled jobs
      const serviceData = await MockDb.getForkliftServiceHistoryWithCancelled(id);
      setServiceHistory(serviceData);

      const scheduledData = await MockDb.getScheduledServices({ forklift_id: id });
      setScheduledServices(scheduledData);

      const customersData = await MockDb.getCustomers();
      setCustomers(customersData);

      const techData = await MockDb.getTechnicians();
      setTechnicians(techData);

      // Load hourmeter history
      const hourmeterData = await MockDb.getForkliftHourmeterHistory(id);
      setHourmeterHistory(hourmeterData);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleAssignForklift = async () => {
    if (!forklift || !selectedCustomerId || !startDate) {
      alert('Please select a customer and start date');
      return;
    }

    try {
      await MockDb.assignForkliftToCustomer(
        forklift.forklift_id,
        selectedCustomerId,
        startDate,
        endDate || undefined,
        rentalNotes || undefined,
        currentUser.user_id,
        currentUser.name,
        monthlyRentalRate ? parseFloat(monthlyRentalRate) : undefined
      );
      
      setShowAssignModal(false);
      resetAssignForm();
      await loadForkliftData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const resetAssignForm = () => {
    setSelectedCustomerId('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setRentalNotes('');
    setMonthlyRentalRate('');
  };

  const handleEndRental = async (rentalId: string) => {
    if (!confirm('End this rental? The forklift will be marked as available.')) return;
    
    try {
      await MockDb.endRental(rentalId, undefined, currentUser.user_id, currentUser.name);
      await loadForkliftData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleEditRentalRate = (rental: ForkliftRental) => {
    setEditingRentalId(rental.rental_id);
    setEditRentalRate((rental.monthly_rental_rate || 0).toString());
    setShowEditRentalModal(true);
  };

  const handleSaveRentalRate = async () => {
    if (!editingRentalId) return;
    
    try {
      await MockDb.updateRentalRate(editingRentalId, parseFloat(editRentalRate) || 0);
      setShowEditRentalModal(false);
      setEditingRentalId(null);
      await loadForkliftData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleScheduleService = async () => {
    if (!forklift || !serviceDueDate) {
      alert('Please enter a due date');
      return;
    }

    try {
      const tech = technicians.find(t => t.user_id === assignedTechId);
      await MockDb.createScheduledService({
        forklift_id: forklift.forklift_id,
        service_type: serviceType,
        due_date: serviceDueDate,
        due_hourmeter: serviceDueHourmeter ? parseInt(serviceDueHourmeter) : undefined,
        notes: serviceNotes || undefined,
        assigned_technician_id: assignedTechId || undefined,
        assigned_technician_name: tech?.name,
        auto_create_job: true,
      }, currentUser.user_id, currentUser.name);

      setShowScheduleServiceModal(false);
      resetScheduleForm();
      await loadForkliftData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const resetScheduleForm = () => {
    setServiceType('PM Service');
    setServiceDueDat('');
    setServiceDueHourmeter('');
    setServiceNotes('');
    setAssignedTechId('');
  };


  const getStatusBadge = (status: ForkliftStatus) => {
    const styles = {
      [ForkliftStatus.ACTIVE]: 'bg-green-100 text-green-700',
      [ForkliftStatus.MAINTENANCE]: 'bg-amber-100 text-amber-700',
      [ForkliftStatus.INACTIVE]: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  const getJobStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'Completed': 'bg-green-100 text-green-700',
      'Awaiting Finalization': 'bg-purple-100 text-purple-700',
      'In Progress': 'bg-amber-100 text-amber-700',
      'Assigned': 'bg-blue-100 text-blue-700',
      'New': 'bg-slate-100 text-slate-700',
      // New statuses (#7 Multi-Day, #8 Deferred Ack)
      'Completed Awaiting Acknowledgement': 'bg-orange-100 text-orange-700',
      'Incomplete - Continuing': 'bg-amber-100 text-amber-700',
      'Incomplete - Reassigned': 'bg-rose-100 text-rose-700',
      'Disputed': 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  const getScheduledServiceStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'pending': 'bg-amber-100 text-amber-700',
      'scheduled': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700',
      'overdue': 'bg-red-100 text-red-700',
      'cancelled': 'bg-slate-100 text-slate-500',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  const activeRental = rentals.find(r => r.status === 'active');
  const pastRentals = rentals.filter(r => r.status !== 'active');
  const pendingServices = scheduledServices.filter(s => s.status === 'pending' || s.status === 'scheduled');

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading forklift profile...</div>;
  }

  if (!forklift) {
    return <div className="p-8 text-center text-red-500">Forklift not found</div>;
  }

  // Calculate stats (only active jobs, not cancelled)
  const activeServiceHistory = serviceHistory.filter(j => !j.is_cancelled);
  const cancelledJobs = serviceHistory.filter(j => j.is_cancelled);
  const totalServices = activeServiceHistory.length;
  // Completed = work done (includes Awaiting Ack, Disputed - work was done)
  const completedStatuses = ['Completed', 'Awaiting Finalization', 'Completed Awaiting Acknowledgement', 'Disputed'];
  const completedServices = activeServiceHistory.filter(j => completedStatuses.includes(j.status)).length;
  const totalPartsUsed = activeServiceHistory.reduce((acc, job) => acc + (job.parts_used?.length || 0), 0);

  // Calculate rental revenue
  const totalRentalRevenue = rentals.reduce((acc, rental) => {
    if (!rental.monthly_rental_rate) return acc;
    const start = new Date(rental.start_date);
    const end = rental.end_date ? new Date(rental.end_date) : new Date();
    const months = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    return acc + (rental.monthly_rental_rate * months);
  }, 0);


  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header - matches Customer Profile */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Forklift Profile</h1>
        </div>
        <div className="flex gap-2">
          {canScheduleMaintenance && (
            <button 
              onClick={() => setShowScheduleServiceModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-purple-700 flex items-center gap-2"
            >
              <CalendarClock className="w-4 h-4" /> Schedule Service
            </button>
          )}
          {!activeRental && canManageRentals && (
            <button 
              onClick={() => setShowAssignModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-blue-700 flex items-center gap-2"
            >
              <Building2 className="w-4 h-4" /> Rent to Customer
            </button>
          )}
        </div>
      </div>

      {/* Forklift Info Card - SAME STYLE AS CUSTOMER PROFILE */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-100">
        <div className="flex justify-between items-start">
          {/* Left Side - Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{forklift.make} {forklift.model}</h2>
                <p className="text-sm text-slate-500">S/N: {forklift.serial_number}</p>
              </div>
            </div>
            
            {/* Tags / Badges */}
            <div className="flex flex-wrap gap-2 items-center">
              {activeRental ? (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                  🔴 Rented Out
                </span>
              ) : (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(forklift.status)}`}>
                  {forklift.status}
                </span>
              )}
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
                {forklift.type}
              </span>
              {forklift.forklift_no && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                  {forklift.forklift_no}
                </span>
              )}
            </div>

            {/* Key Fields */}
            <div className="space-y-2 text-slate-700">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-blue-600" />
                <span>{forklift.hourmeter.toLocaleString()} hours</span>
              </div>
              {forklift.year && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Year: {forklift.year}</span>
                </div>
              )}
              {forklift.capacity_kg && (
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Capacity: {forklift.capacity_kg.toLocaleString()} kg</span>
                </div>
              )}
              {forklift.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>{forklift.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - KPI Stats Grid (2x2 like Customer Profile) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{totalServices}</p>
              <p className="text-xs text-slate-500">Total Services</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-green-600">{completedServices}</p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-purple-600">{totalPartsUsed}</p>
              <p className="text-xs text-slate-500">Parts Used</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-amber-600">RM{totalRentalRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Rental Revenue</p>
            </div>
          </div>
        </div>
      </div>


      {/* Next Service Due Alert */}
      {forklift.next_service_due && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 text-amber-800">
            <Bell className="w-5 h-5" />
            <span className="font-medium">Next Service Due:</span>
            <span>{new Date(forklift.next_service_due).toLocaleDateString()}</span>
            {forklift.next_service_type && (
              <span className="text-xs bg-amber-200 px-2 py-0.5 rounded ml-2">{forklift.next_service_type}</span>
            )}
          </div>
        </div>
      )}

      {/* Current Assignment Card */}
      {activeRental && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-green-200">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-green-800 flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5" /> Currently Rented To
              </h3>
              <p className="text-lg font-semibold text-slate-800">{activeRental.customer?.name}</p>
              <p className="text-sm text-slate-600">{activeRental.customer?.address}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Since: {new Date(activeRental.start_date).toLocaleDateString()}
                </span>
                {activeRental.end_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Until: {new Date(activeRental.end_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              {activeRental.notes && (
                <p className="mt-2 text-sm text-slate-500 italic">{activeRental.notes}</p>
              )}
            </div>
            
            {/* Rental Rate */}
            <div className="bg-green-50 rounded-lg p-4 min-w-[180px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 uppercase font-medium">Monthly Rate</span>
                {canEditRentalRates && (
                  <button 
                    onClick={() => handleEditRentalRate(activeRental)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">
                  {activeRental.monthly_rental_rate?.toLocaleString() || '0'}
                </span>
              </div>
              <span className="text-xs text-slate-400">{activeRental.currency || 'RM'}/month</span>
            </div>

            <button
              onClick={() => handleEndRental(activeRental.rental_id)}
              className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 self-start"
            >
              End Rental
            </button>
          </div>
        </div>
      )}

      {/* Scheduled Services Section */}
      {pendingServices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <CalendarClock className="w-5 h-5 text-amber-600" /> Upcoming Scheduled Services ({pendingServices.length})
          </h3>
          <div className="space-y-3">
            {pendingServices.map(service => (
              <div key={service.scheduled_id} className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{service.service_type}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScheduledServiceStatusBadge(service.status)}`}>
                        {service.status}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due: {new Date(service.due_date).toLocaleDateString()}
                      </span>
                      {service.due_hourmeter && (
                        <span className="flex items-center gap-1">
                          <Gauge className="w-3 h-3" />
                          At: {service.due_hourmeter} hrs
                        </span>
                      )}
                    </div>
                    {service.assigned_technician_name && (
                      <p className="text-xs text-slate-500 mt-1">Assigned to: {service.assigned_technician_name}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    service.priority === 'High' ? 'bg-red-100 text-red-700' :
                    service.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {service.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Service History & Rental History - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service History */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" /> Service History ({activeServiceHistory.length})
            </h3>
          </div>
          
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {activeServiceHistory.length > 0 ? (
              activeServiceHistory.map(job => (
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
                      <p className="text-xs text-slate-400 mt-1">
                        {job.customer?.name}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${getJobStatusBadge(job.status)}`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    {job.hourmeter_reading && (
                      <span className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        {job.hourmeter_reading} hrs
                      </span>
                    )}
                    {job.parts_used && job.parts_used.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {job.parts_used.length}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400">
                <Wrench className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No service history yet</p>
              </div>
            )}

            {/* Cancelled Jobs Section - Collapsible (Admin/Supervisor Only) */}
            {cancelledJobs.length > 0 && canViewCancelled && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCancelledJobs(!showCancelledJobs); }}
                  className="w-full flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-800">Cancelled Jobs ({cancelledJobs.length})</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-red-500 transition-transform ${showCancelledJobs ? 'rotate-90' : ''}`} />
                </button>

                {showCancelledJobs && (
                  <div className="mt-3 space-y-2">
                    {cancelledJobs.map(job => (
                      <div
                        key={job.job_id}
                        className="p-3 bg-red-50/50 border border-red-200 rounded-lg"
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-600 text-sm line-through opacity-70">
                              {job.title}
                            </h4>
                            <p className="text-xs text-slate-400 line-clamp-1">{job.description}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 flex-shrink-0">
                            Cancelled
                          </span>
                        </div>

                        {/* Cancellation details */}
                        <div className="text-xs space-y-1 mt-2 pt-2 border-t border-red-100">
                          <div className="flex items-center gap-2 text-red-700">
                            <UserIcon className="w-3 h-3" />
                            <span>Cancelled by: <span className="font-medium">{job.deleted_by_name || 'Unknown'}</span></span>
                          </div>
                          {job.deletion_reason && (
                            <div className="flex items-start gap-2 text-red-600">
                              <AlertOctagon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              <span>Reason: {job.deletion_reason}</span>
                            </div>
                          )}
                          {job.hourmeter_before_delete && (
                            <div className="flex items-center gap-2 text-amber-600">
                              <Gauge className="w-3 h-3" />
                              <span>{job.hourmeter_before_delete} hrs recorded (invalidated)</span>
                            </div>
                          )}
                          {job.deleted_at && (
                            <div className="flex items-center gap-2 text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(job.deleted_at).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rental History */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" /> Rental History ({rentals.length})
            </h3>
          </div>
          
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {rentals.length > 0 ? (
              rentals.map(rental => (
                <div 
                  key={rental.rental_id} 
                  onClick={() => rental.customer && navigate(`/customers/${rental.customer_id}`)}
                  className={`p-3 rounded-lg border cursor-pointer transition hover:shadow-sm ${
                    rental.status === 'active' 
                      ? 'bg-green-50 border-green-200 hover:border-green-300' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className={`w-4 h-4 flex-shrink-0 ${rental.status === 'active' ? 'text-green-600' : 'text-slate-400'}`} />
                        <span className="font-medium text-slate-800 text-sm truncate">{rental.customer?.name}</span>
                        {rental.status === 'active' && (
                          <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex-shrink-0">Active</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(rental.start_date).toLocaleDateString()} → {rental.end_date ? new Date(rental.end_date).toLocaleDateString() : 'Ongoing'}
                      </div>
                    </div>
                    {rental.monthly_rental_rate && (
                      <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                        RM{rental.monthly_rental_rate.toLocaleString()}/mo
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400">
                <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No rental history</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hourmeter History Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <button
          onClick={() => setShowHourmeterHistory(!showHourmeterHistory)}
          className="w-full px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition"
        >
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-purple-600" /> Hourmeter History ({hourmeterHistory.length})
          </h3>
          <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${showHourmeterHistory ? 'rotate-90' : ''}`} />
        </button>

        {showHourmeterHistory && (
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {hourmeterHistory.length > 0 ? (
              hourmeterHistory.map((entry, index) => (
                <div
                  key={entry.entry_id || index}
                  className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-slate-800">
                          {entry.reading?.toLocaleString()} hrs
                        </span>
                        {entry.previous_reading !== null && (
                          <span className={`text-sm font-medium ${
                            entry.hours_since_last >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ({entry.hours_since_last >= 0 ? '+' : ''}{entry.hours_since_last} hrs)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {entry.recorded_by_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        entry.source === 'manual' ? 'bg-purple-100 text-purple-700' :
                        entry.source === 'amendment' ? 'bg-amber-100 text-amber-700' :
                        entry.source === 'job_start' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {entry.source === 'manual' ? 'Direct Edit' :
                         entry.source === 'amendment' ? 'Amendment' :
                         entry.source === 'job_start' ? 'Job' :
                         entry.source}
                      </span>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(entry.recorded_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {entry.job && (
                    <div
                      onClick={() => navigate(`/jobs/${entry.job.job_id}`)}
                      className="mt-2 pt-2 border-t border-slate-100 text-xs text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      {entry.job.title}
                    </div>
                  )}
                  {entry.was_amended && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        This was an amended reading
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-400">
                <Gauge className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No hourmeter history recorded</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rent Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
              <h3 className="font-bold text-lg text-slate-800">Rent Forklift to Customer</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg mb-4">
                <p className="text-sm font-medium text-blue-800">{forklift.make} {forklift.model}</p>
                <p className="text-xs text-blue-600">{forklift.serial_number}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Customer *</label>
                <select
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rental Rate (RM)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                    value={monthlyRentalRate}
                    onChange={(e) => setMonthlyRentalRate(e.target.value)}
                    placeholder="e.g., 2500.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental Start Date *</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental End Date (Optional)</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty for ongoing/indefinite rental</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
                  value={rentalNotes}
                  onChange={(e) => setRentalNotes(e.target.value)}
                  placeholder="Optional notes about this rental..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button type="button" onClick={handleAssignForklift} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> Rent Forklift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Edit Rental Rate Modal */}
      {showEditRentalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Edit Rental Rate</h3>
              <button onClick={() => setShowEditRentalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rate (RM)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                    value={editRentalRate}
                    onChange={(e) => setEditRentalRate(e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowEditRentalModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button type="button" onClick={handleSaveRentalRate} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Service Modal */}
      {showScheduleServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
              <h3 className="font-bold text-lg text-slate-800">Schedule Service</h3>
              <button onClick={() => setShowScheduleServiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-purple-50 rounded-lg mb-4">
                <p className="text-sm font-medium text-purple-800">{forklift.make} {forklift.model}</p>
                <p className="text-xs text-purple-600">{forklift.serial_number}</p>
                <p className="text-xs text-purple-500 mt-1">Current: {forklift.hourmeter.toLocaleString()} hrs</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Service Type *</label>
                <select
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                >
                  <option value="PM Service">PM Service (250 hrs)</option>
                  <option value="PM Service 500">PM Service (500 hrs)</option>
                  <option value="Full Inspection">Full Inspection (1000 hrs)</option>
                  <option value="Oil Change">Oil Change</option>
                  <option value="Safety Inspection">Annual Safety Inspection</option>
                  <option value="Routine Check">Routine Check</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date *</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={serviceDueDate}
                  onChange={(e) => setServiceDueDat(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due at Hourmeter (Optional)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={serviceDueHourmeter}
                  onChange={(e) => setServiceDueHourmeter(e.target.value)}
                  placeholder={`e.g., ${forklift.hourmeter + 250}`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Technician (Optional)</label>
                <select
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={assignedTechId}
                  onChange={(e) => setAssignedTechId(e.target.value)}
                >
                  <option value="">-- Auto-assign later --</option>
                  {technicians.map(t => (
                    <option key={t.user_id} value={t.user_id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  placeholder="Any special instructions..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowScheduleServiceModal(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button type="button" onClick={handleScheduleService} className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm flex items-center justify-center gap-2">
                  <CalendarClock className="w-4 h-4" /> Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForkliftProfile;

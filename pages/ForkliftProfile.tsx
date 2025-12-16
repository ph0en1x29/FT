import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Forklift, ForkliftRental, Job, User, ForkliftStatus, RentalStatus, Customer, ScheduledService, UserRole, ROLE_PERMISSIONS } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { 
  ArrowLeft, Truck, MapPin, Gauge, Calendar, Wrench, 
  CheckCircle, Clock, AlertCircle, Building2, User as UserIcon,
  FileText, Play, ChevronRight, History, Package, X, Save,
  DollarSign, Edit2, Plus, Bell, CalendarClock, Settings
} from 'lucide-react';

interface ForkliftProfileProps {
  currentUser: User;
}

const ForkliftProfile: React.FC<ForkliftProfileProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [forklift, setForklift] = useState<Forklift | null>(null);
  const [rentals, setRentals] = useState<ForkliftRental[]>([]);
  const [serviceHistory, setServiceHistory] = useState<Job[]>([]);
  const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  // Check permissions
  const canEditRentalRates = ROLE_PERMISSIONS[currentUser.role]?.canEditRentalRates ?? false;
  const canScheduleMaintenance = ROLE_PERMISSIONS[currentUser.role]?.canScheduleMaintenance ?? false;
  const canManageRentals = ROLE_PERMISSIONS[currentUser.role]?.canManageRentals ?? false;

  useEffect(() => {
    loadForkliftData();
  }, [id]);

  const loadForkliftData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Load forklift details
      const forkliftData = await MockDb.getForkliftWithCustomer(id);
      setForklift(forkliftData);

      // Load rental history
      const rentalData = await MockDb.getForkliftRentals(id);
      setRentals(rentalData);

      // Load service history
      const serviceData = await MockDb.getForkliftServiceHistory(id);
      setServiceHistory(serviceData);

      // Load scheduled services
      const scheduledData = await MockDb.getScheduledServices({ forklift_id: id });
      setScheduledServices(scheduledData);

      // Load customers for assign modal
      const customersData = await MockDb.getCustomers();
      setCustomers(customersData);

      // Load technicians for scheduling
      const techData = await MockDb.getTechnicians();
      setTechnicians(techData);
    } catch (error) {
      console.error('Error loading forklift:', error);
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

  const getStatusIcon = (status: ForkliftStatus) => {
    switch (status) {
      case ForkliftStatus.ACTIVE: return <CheckCircle className="w-5 h-5 text-green-500" />;
      case ForkliftStatus.MAINTENANCE: return <Clock className="w-5 h-5 text-amber-500" />;
      case ForkliftStatus.INACTIVE: return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
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

  // Calculate stats
  const totalServices = serviceHistory.length;
  const completedServices = serviceHistory.filter(j => j.status === 'Completed' || j.status === 'Awaiting Finalization').length;
  const totalPartsUsed = serviceHistory.reduce((acc, job) => acc + job.parts_used.length, 0);

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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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

      {/* Forklift Info Card */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl shadow-sm p-6 border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{forklift.make} {forklift.model}</h2>
                <p className="text-sm text-slate-500 font-mono">{forklift.serial_number}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              {activeRental ? (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700 flex items-center gap-1">
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

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <Gauge className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{forklift.hourmeter.toLocaleString()} hrs</span>
              </div>
              {forklift.year && (
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{forklift.year}</span>
                </div>
              )}
              {forklift.capacity_kg && (
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{forklift.capacity_kg.toLocaleString()} kg</span>
                </div>
              )}
            </div>
            
            {forklift.location && (
              <div className="flex items-start gap-2 text-slate-600 text-sm pt-1">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{forklift.location}</span>
              </div>
            )}

            {/* Next Service Due */}
            {forklift.next_service_due && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800">
                  <Bell className="w-4 h-4" />
                  <span className="font-medium text-sm">Next Service Due:</span>
                  <span className="text-sm">{new Date(forklift.next_service_due).toLocaleDateString()}</span>
                  {forklift.next_service_type && (
                    <span className="text-xs bg-amber-200 px-2 py-0.5 rounded">{forklift.next_service_type}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-4 text-center shadow-sm min-w-[100px]">
              <p className="text-2xl font-bold text-blue-600">{totalServices}</p>
              <p className="text-xs text-slate-500 whitespace-nowrap">Total Services</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm min-w-[100px]">
              <p className="text-2xl font-bold text-green-600">{completedServices}</p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm min-w-[100px] col-span-2 lg:col-span-1 xl:col-span-2">
              <p className="text-2xl font-bold text-purple-600">RM{totalRentalRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Rental Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Assignment with Rental Rate */}
      {activeRental && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
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
            
            {/* Rental Rate Display */}
            <div className="bg-white rounded-lg p-4 shadow-sm min-w-[180px]">
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="font-bold text-amber-800 flex items-center gap-2 mb-4">
            <CalendarClock className="w-5 h-5" /> Upcoming Scheduled Services ({pendingServices.length})
          </h3>
          <div className="space-y-3">
            {pendingServices.map(service => (
              <div key={service.scheduled_id} className="bg-white p-4 rounded-lg border border-amber-100">
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
                      <p className="text-xs text-slate-500 mt-1">
                        Assigned to: {service.assigned_technician_name}
                      </p>
                    )}
                    {service.notes && (
                      <p className="text-xs text-slate-400 mt-1 italic">{service.notes}</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Last Service */}
          {serviceHistory[0] && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" /> Last Service
              </h3>
              <div className="space-y-2">
                <p className="font-medium text-slate-800">{serviceHistory[0].title}</p>
                <p className="text-sm text-slate-500">{serviceHistory[0].description}</p>
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-xs text-slate-400">
                    {new Date(serviceHistory[0].created_at).toLocaleDateString()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getJobStatusBadge(serviceHistory[0].status)}`}>
                    {serviceHistory[0].status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Service Stats */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" /> Service Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Total Services</span>
                <span className="font-bold text-blue-600">{totalServices}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Completed</span>
                <span className="font-bold text-green-600">{completedServices}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Parts Used</span>
                <span className="font-bold text-amber-600">{totalPartsUsed}</span>
              </div>
            </div>
          </div>

          {/* Rental History */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" /> Rental History
            </h3>
            {pastRentals.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {pastRentals.map(rental => (
                  <div key={rental.rental_id} className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-medium text-slate-800">{rental.customer?.name}</p>
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs text-slate-500">
                        {new Date(rental.start_date).toLocaleDateString()} → {rental.end_date ? new Date(rental.end_date).toLocaleDateString() : 'Ongoing'}
                      </div>
                      {rental.monthly_rental_rate && (
                        <span className="text-xs font-medium text-green-600">
                          RM{rental.monthly_rental_rate}/mo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic text-center py-4">No rental history</p>
            )}
          </div>
        </div>

        {/* Right Column - Service History */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" /> Service History
            </h3>
            
            {serviceHistory.length > 0 ? (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {serviceHistory.map(job => (
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
                        <p className="text-xs text-slate-400 mt-1">
                          Customer: {job.customer?.name}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-3 ${getJobStatusBadge(job.status)}`}>
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
                      {job.parts_used.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {job.parts_used.length} parts
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No service history yet</p>
              </div>
            )}
          </div>
        </div>
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

              {/* Customer Selection */}
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

              {/* Monthly Rental Rate */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Monthly Rental Rate (RM)
                </label>
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

              {/* Start Date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental Start Date *</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
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

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
                  value={rentalNotes}
                  onChange={(e) => setRentalNotes(e.target.value)}
                  placeholder="Optional notes about this rental..."
                />
              </div>

              {/* Buttons */}
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

              {/* Service Type */}
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

              {/* Due Date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date *</label>
                <input
                  type="date"
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={serviceDueDate}
                  onChange={(e) => setServiceDueDat(e.target.value)}
                />
              </div>

              {/* Due Hourmeter */}
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

              {/* Assign Technician */}
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

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  placeholder="Any special instructions..."
                />
              </div>

              {/* Buttons */}
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

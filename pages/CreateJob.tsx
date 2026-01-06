import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { Customer, JobPriority, JobStatus, JobType, User, UserRole, Forklift } from '../types_with_invoice_tracking';
import { ArrowLeft, Save, X, Truck, Gauge, CalendarCheck } from 'lucide-react';
import { Combobox, ComboboxOption } from '../components/Combobox';
import { showToast } from '../services/toastService';

interface CreateJobProps {
  currentUser: User;
}

const CreateJob: React.FC<CreateJobProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [forklifts, setForklifts] = useState<Forklift[]>([]);

  const canCreateJobs = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPERVISOR;
  
  // Check for pre-filled data from scheduled service
  const scheduledServiceId = searchParams.get('scheduled_id');
  const prefilledForkliftId = searchParams.get('forklift_id');
  const prefilledServiceType = searchParams.get('service_type');
  const prefilledCustomerId = searchParams.get('customer_id');
  
  const [formData, setFormData] = useState({
    customer_id: prefilledCustomerId || '',
    title: prefilledServiceType ? `${prefilledServiceType} - Scheduled Maintenance` : '',
    description: prefilledServiceType ? `Scheduled ${prefilledServiceType} service` : '',
    priority: JobPriority.MEDIUM,
    job_type: JobType.SERVICE,
    assigned_technician_id: '',
    forklift_id: prefilledForkliftId || '',
    hourmeter_reading: '',
  });

  // Selected forklift details
  const [selectedForklift, setSelectedForklift] = useState<Forklift | null>(null);

  // New Customer Modal State
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerNameQuery, setNewCustomerNameQuery] = useState('');
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const [customerData, forkliftData, technicianData] = await Promise.all([
          MockDb.getCustomers(),
          MockDb.getForklifts(),
          currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPERVISOR
            ? MockDb.getTechnicians()
            : Promise.resolve([]),
        ]);
        setCustomers(customerData);
        setForklifts(forkliftData);
        setTechnicians(technicianData);
      } catch (error) {
        console.error('Error loading job form data:', error);
        showToast.error('Failed to load job form data');
      }
    };

    loadFormData();
  }, [currentUser.role]);

  useEffect(() => {
    if (!canCreateJobs) {
      showToast.error('Permission denied', 'Only Admin/Supervisor can create jobs');
      navigate('/');
    }
  }, [canCreateJobs, navigate]);

  // Update selected forklift when forklift_id changes
  useEffect(() => {
    if (formData.forklift_id) {
      const forklift = forklifts.find(f => f.forklift_id === formData.forklift_id);
      setSelectedForklift(forklift || null);
      // Pre-fill hourmeter with current reading
      if (forklift) {
        setFormData(prev => ({ ...prev, hourmeter_reading: forklift.hourmeter.toString() }));
        // If forklift has a current customer, pre-fill it
        if (forklift.current_customer_id && !formData.customer_id) {
          setFormData(prev => ({ ...prev, customer_id: forklift.current_customer_id! }));
        }
      }
    } else {
      setSelectedForklift(null);
      setFormData(prev => ({ ...prev, hourmeter_reading: '' }));
    }
  }, [formData.forklift_id, forklifts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateJobs) {
      showToast.error('Permission denied', 'Only Admin/Supervisor can create jobs');
      return;
    }
    if (!formData.customer_id) {
      showToast.error('Please select a customer');
      return;
    }
    
    // Determine assignee
    let assignedId = '';
    let assignedName = '';
    let status = JobStatus.NEW;

    if ((currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPERVISOR) && formData.assigned_technician_id) {
      assignedId = formData.assigned_technician_id;
      const tech = technicians.find(t => t.user_id === assignedId);
      assignedName = tech ? tech.name : '';
      status = JobStatus.ASSIGNED;
    }

    // Parse hourmeter reading
    const hourmeterReading = formData.hourmeter_reading ? parseInt(formData.hourmeter_reading) : undefined;
    
    try {
      await MockDb.createJob(
        {
          customer_id: formData.customer_id,
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          job_type: formData.job_type,
          assigned_technician_id: assignedId,
          assigned_technician_name: assignedName,
          status: status,
          forklift_id: formData.forklift_id || undefined,
          hourmeter_reading: hourmeterReading,
        },
        currentUser.user_id,  // Created by ID
        currentUser.name      // Created by Name
      );
      
      showToast.success('Job created successfully');
      navigate('/jobs');
    } catch (error) {
      showToast.error('Failed to create job', (error as Error).message);
    }
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;

    try {
      const created = await MockDb.createCustomer(newCustomer);
      const updatedCustomers = [...customers, created];
      setCustomers(updatedCustomers);
      
      // Select the new customer
      setFormData(prev => ({ ...prev, customer_id: created.customer_id }));
      
      // Reset and close
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      setShowNewCustomerModal(false);
      showToast.success('Customer created');
    } catch (error) {
      showToast.error('Failed to create customer');
    }
  };

  const customerOptions: ComboboxOption[] = customers.map(c => ({
      id: c.customer_id,
      label: c.name,
      subLabel: c.address
  }));

  const techOptions: ComboboxOption[] = technicians.map(t => ({
      id: t.user_id,
      label: t.name,
      subLabel: t.email
  }));

  // Forklift options with detailed info for easy search
  const forkliftOptions: ComboboxOption[] = forklifts
    .filter(f => f.status === 'Active' || f.status === 'Under Maintenance')
    .map(f => ({
      id: f.forklift_id,
      label: `${f.serial_number} - ${f.make} ${f.model}`,
      subLabel: `${f.type} | ${f.hourmeter.toLocaleString()} hrs${f.location ? ` | ${f.location}` : ''}`
    }));

  const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">New Job Order</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-6">
        
        {/* Customer Selection */}
        <Combobox 
            label="Customer"
            options={customerOptions}
            value={formData.customer_id}
            onChange={(val) => setFormData({...formData, customer_id: val})}
            placeholder="Search customer..."
            onAddNew={(query) => {
                setNewCustomerNameQuery(query);
                setNewCustomer(prev => ({ ...prev, name: query }));
                setShowNewCustomerModal(true);
            }}
            addNewLabel="Create New Customer"
        />

        {/* Forklift Selection */}
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-amber-800">
            <Truck className="w-5 h-5" />
            <span className="font-semibold">Equipment Selection</span>
          </div>
          
          <Combobox 
              label="Select Forklift"
              options={forkliftOptions}
              value={formData.forklift_id}
              onChange={(val) => setFormData({...formData, forklift_id: val})}
              placeholder="Search by S/N, make, model..."
          />

          {/* Show selected forklift info */}
          {selectedForklift && (
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Serial Number:</span>
                  <div className="font-mono font-medium">{selectedForklift.serial_number}</div>
                </div>
                <div>
                  <span className="text-slate-500">Type:</span>
                  <div className="font-medium">{selectedForklift.type}</div>
                </div>
                <div>
                  <span className="text-slate-500">Make/Model:</span>
                  <div className="font-medium">{selectedForklift.make} {selectedForklift.model}</div>
                </div>
                <div>
                  <span className="text-slate-500">Current Hourmeter:</span>
                  <div className="font-medium">{selectedForklift.hourmeter.toLocaleString()} hrs</div>
                </div>
              </div>
            </div>
          )}

          {/* Hourmeter Reading Input */}
          {formData.forklift_id && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Gauge className="w-4 h-4" /> Current Hourmeter Reading
              </label>
              <input 
                type="number"
                className={inputClassName}
                value={formData.hourmeter_reading}
                onChange={e => setFormData({...formData, hourmeter_reading: e.target.value})}
                placeholder="Enter current hourmeter reading"
                min={selectedForklift?.hourmeter || 0}
              />
              {selectedForklift && formData.hourmeter_reading && parseInt(formData.hourmeter_reading) < selectedForklift.hourmeter && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠️ Reading is less than current recorded ({selectedForklift.hourmeter} hrs)
                </p>
              )}
            </div>
          )}
        </div>

        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Job Title</label>
            <input 
                type="text"
                className={inputClassName}
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., PM Service, Hydraulic Repair"
                required
            />
        </div>

        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
            <textarea 
                className={`${inputClassName} h-32 resize-none`}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Describe the issue or service required..."
                required
            />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Job Type</label>
                <select 
                    className={`${inputClassName} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.7em] bg-[right_1rem_center] bg-no-repeat pr-8`}
                    value={formData.job_type}
                    onChange={e => setFormData({...formData, job_type: e.target.value as JobType})}
                >
                    {Object.values(JobType).map(t => (
                        <option key={t} value={t} className="text-[#111827]">{t}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Priority</label>
                <select 
                    className={`${inputClassName} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.7em] bg-[right_1rem_center] bg-no-repeat pr-8`}
                    value={formData.priority}
                    onChange={e => setFormData({...formData, priority: e.target.value as JobPriority})}
                >
                    {Object.values(JobPriority).map(p => (
                        <option key={p} value={p} className="text-[#111827]">{p}</option>
                    ))}
                </select>
            </div>
            {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPERVISOR) && (
                <div>
                     <Combobox 
                        label="Assign Technician (Optional)"
                        options={techOptions}
                        value={formData.assigned_technician_id}
                        onChange={(val) => setFormData({...formData, assigned_technician_id: val})}
                        placeholder="Select Technician..."
                    />
                </div>
            )}
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 shadow-sm transition-colors focus:ring-4 focus:ring-blue-100">
                <Save className="w-4 h-4" /> Create Job
            </button>
        </div>
      </form>

      {/* New Customer Modal */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Add New Customer</h3>
              <button onClick={() => setShowNewCustomerModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                <input 
                  type="text" 
                  className={inputClassName}
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                <input 
                  type="tel" 
                  className={inputClassName}
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                <input 
                  type="email" 
                  className={inputClassName}
                  value={newCustomer.email}
                  onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
                <input 
                  type="text" 
                  className={inputClassName}
                  value={newCustomer.address}
                  onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                  placeholder="123 Main St, City"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowNewCustomerModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateJob;

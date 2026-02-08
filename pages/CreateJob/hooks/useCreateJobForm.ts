import React,{ useEffect,useState } from 'react';
import { useNavigate,useSearchParams } from 'react-router-dom';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { useCustomersForList,useForkliftsForList,useTechnicians } from '../../../hooks/useQueryHooks';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Customer,Forklift,JobPriority,JobStatus,JobType,User } from '../../../types';
import { CreateJobFormData,NewCustomerFormData } from '../types';

/**
 * Custom hook for managing CreateJob form state and submission logic.
 * Handles prefilled data from scheduled services, permission checks, and form submission.
 */
export function useCreateJobForm(currentUser: User) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Use cached data from React Query (shared across app, no duplicate fetches)
  const { data: cachedCustomers = [] } = useCustomersForList();
  const { data: cachedForklifts = [] } = useForkliftsForList();
  const { data: cachedTechnicians = [] } = useTechnicians();
  
  // Map cached data for compatibility
  const customers = cachedCustomers as unknown as Customer[];
  const forklifts = cachedForklifts as unknown as Forklift[];
  const technicians = cachedTechnicians as User[];

  // Use dev mode context for role-based permissions
  const { hasPermission } = useDevModeContext();
  const canCreateJobs = hasPermission('canCreateJobs');
  
  // Check for pre-filled data from scheduled service
  const prefilledForkliftId = searchParams.get('forklift_id');
  const prefilledServiceType = searchParams.get('service_type');
  const prefilledCustomerId = searchParams.get('customer_id');
  
  // Form state
  const [formData, setFormData] = useState<CreateJobFormData>({
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

  // Permission check - redirect if not allowed
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

  // Form submission handler
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

    if (canCreateJobs && formData.assigned_technician_id) {
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

  // Handle new customer creation
  const handleCreateCustomer = async (newCustomerData: NewCustomerFormData) => {
    if (!newCustomerData.name) return;

    try {
      const created = await MockDb.createCustomer(newCustomerData);
      
      // Select the new customer
      setFormData(prev => ({ ...prev, customer_id: created.customer_id }));
      
      // Reset and close
      setShowNewCustomerModal(false);
      setNewCustomerNameQuery('');
      showToast.success('Customer created');
    } catch (error) {
      showToast.error('Failed to create customer');
    }
  };

  // Open new customer modal with search query
  const openNewCustomerModal = (query: string) => {
    setNewCustomerNameQuery(query);
    setShowNewCustomerModal(true);
  };

  return {
    // Form state
    formData,
    setFormData,
    selectedForklift,
    
    // Data
    customers,
    forklifts,
    technicians,
    
    // Permissions
    canCreateJobs,
    
    // Modal state
    showNewCustomerModal,
    setShowNewCustomerModal,
    newCustomerNameQuery,
    
    // Handlers
    handleSubmit,
    handleCreateCustomer,
    openNewCustomerModal,
    
    // Navigation
    navigate,
  };
}

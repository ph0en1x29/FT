import { useQuery } from '@tanstack/react-query';
import React,{ useCallback,useEffect,useRef,useState } from 'react';
import { useNavigate,useSearchParams } from 'react-router-dom';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { useForkliftsForList,useSearchCustomers,useTechnicians } from '../../../hooks/useQueryHooks';
import { getCustomerById,getCustomerContacts,getCustomerSites } from '../../../services/customerService';
import { supabase } from '../../../services/supabaseClient';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Customer,Forklift,JobPriority,JobStatus,JobType,User } from '../../../types';
import { CreateJobFormData,DuplicateJobWarning,NewCustomerFormData } from '../types';

/**
 * Custom hook for managing CreateJob form state and submission logic.
 * Handles prefilled data from scheduled services, permission checks, and form submission.
 */
export function useCreateJobForm(currentUser: User) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Server-side customer search (20 results per keystroke instead of loading all 2,147)
  const { options: customerSearchResults, isSearching: isSearchingCustomers, search: searchCustomers } = useSearchCustomers();
  
  // Use cached data from React Query (shared across app, no duplicate fetches)
  const { data: cachedForklifts = [] } = useForkliftsForList();
  const { data: cachedTechnicians = [] } = useTechnicians();
  
  // Map cached data for compatibility
  const forklifts = cachedForklifts as unknown as Forklift[];
  const technicians = cachedTechnicians as User[];

  // Use dev mode context for role-based permissions
  const { hasPermission } = useDevModeContext();
  const canCreateJobs = hasPermission('canCreateJobs');
  
  // Check for pre-filled data from scheduled service
  const prefilledForkliftId = searchParams.get('forklift_id');
  const prefilledServiceType = searchParams.get('service_type');
  const prefilledCustomerId = searchParams.get('customer_id');
  const prefilledContactId = searchParams.get('contact_id');
  const prefilledSiteId = searchParams.get('site_id');
  
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
    contact_id: prefilledContactId || '',
    site_id: prefilledSiteId || '',
    billing_type: 'rental-inclusive',
  });

  // Fetch selected customer details for sidebar display
  const { data: selectedCustomer = null } = useQuery({
    queryKey: ['customer-detail', formData.customer_id],
    queryFn: () => getCustomerById(formData.customer_id),
    enabled: !!formData.customer_id,
  });

  // Fetch contacts and sites for selected customer
  const { data: contacts = [] } = useQuery({
    queryKey: ['customer-contacts', formData.customer_id],
    queryFn: () => getCustomerContacts(formData.customer_id),
    enabled: !!formData.customer_id,
  });
  const { data: sites = [] } = useQuery({
    queryKey: ['customer-sites', formData.customer_id],
    queryFn: () => getCustomerSites(formData.customer_id),
    enabled: !!formData.customer_id,
  });

  // Selected forklift details
  const [selectedForklift, setSelectedForklift] = useState<Forklift | null>(null);

  // New Customer Modal State
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerNameQuery, setNewCustomerNameQuery] = useState('');

  // Duplicate job warning state
  const [duplicateJobWarning, setDuplicateJobWarning] = useState<DuplicateJobWarning | null>(null);
  const skipDuplicateCheck = useRef(false);

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
        setFormData(prev => {
          const updates: Partial<CreateJobFormData> = { hourmeter_reading: forklift.hourmeter.toString() };
          // If forklift has a current customer, pre-fill it
          if (forklift.current_customer_id && !prev.customer_id) {
            updates.customer_id = forklift.current_customer_id;
          }
          // If forklift has a current site, pre-fill it
          if (forklift.current_site_id && !prev.site_id) {
            updates.site_id = forklift.current_site_id;
          }
          // Set billing_type based on ownership_type
          if (forklift.ownership_type === 'external') {
            updates.billing_type = 'chargeable';
          } else {
            updates.billing_type = 'rental-inclusive';
          }
          return { ...prev, ...updates };
        });
      }
    } else {
      setSelectedForklift(null);
      setFormData(prev => ({ ...prev, hourmeter_reading: '', billing_type: 'rental-inclusive' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    
    // Check for existing active job on the same forklift
    if (formData.forklift_id && !skipDuplicateCheck.current) {
      const { data: existingJobs } = await supabase
        .from('jobs')
        .select('job_id, title, status, customer:customers(name), customer_site:customer_sites!site_id(site_name)')
        .eq('forklift_id', formData.forklift_id)
        .is('deleted_at', null)
        .not('status', 'in', `("${JobStatus.COMPLETED}","${JobStatus.CANCELLED}")`)
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        const existing = existingJobs[0];
        setDuplicateJobWarning({
          job_id: existing.job_id,
          title: existing.title,
          status: existing.status,
          customer_name: (existing.customer as any)?.name ?? null,
          site_name: (existing.customer_site as any)?.site_name ?? null,
        });
        return;
      }
    }
    skipDuplicateCheck.current = false;

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
          contact_id: formData.contact_id || undefined,
          site_id: formData.site_id || undefined,
          billing_type: formData.billing_type,
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
    } catch (_error) {
      showToast.error('Failed to create customer');
    }
  };

  // Open new customer modal with search query
  const openNewCustomerModal = (query: string) => {
    setNewCustomerNameQuery(query);
    setShowNewCustomerModal(true);
  };

  // Handle creating external forklift
  const handleCreateExternalForklift = async (externalForkliftData: {
    serial_number: string;
    make: string;
    model: string;
    type: string;
    hourmeter: number;
  }) => {
    if (!formData.customer_id) {
      showToast.error('Please select a customer first');
      return;
    }

    try {
      const { createForklift } = await import('../../../services/forkliftService');
      const newForklift = await createForklift({
        serial_number: externalForkliftData.serial_number,
        make: externalForkliftData.make,
        model: externalForkliftData.model,
        type: externalForkliftData.type as any,
        hourmeter: externalForkliftData.hourmeter,
        ownership_type: 'external',
        current_customer_id: formData.customer_id,
        status: 'Active' as any,
      });

      // Auto-select the newly created forklift
      setFormData(prev => ({ ...prev, forklift_id: newForklift.forklift_id }));
      showToast.success('External forklift added and selected');
      return newForklift;
    } catch (error) {
      showToast.error('Failed to create external forklift', (error as Error).message);
      throw error;
    }
  };

  // Confirm duplicate job warning — proceed with creation
  const handleConfirmDuplicateJob = useCallback(() => {
    setDuplicateJobWarning(null);
    skipDuplicateCheck.current = true;
    // Re-submit the form programmatically
    const form = document.querySelector('form');
    if (form) {
      form.requestSubmit();
    }
  }, []);

  const handleDismissDuplicateWarning = useCallback(() => {
    setDuplicateJobWarning(null);
  }, []);

  return {
    // Form state
    formData,
    setFormData,
    selectedForklift,
    
    // Data
    customerSearchResults,
    isSearchingCustomers,
    searchCustomers,
    selectedCustomer,
    forklifts,
    technicians,
    contacts,
    sites,
    
    // Permissions
    canCreateJobs,
    
    // Modal state
    showNewCustomerModal,
    setShowNewCustomerModal,
    newCustomerNameQuery,
    
    // Duplicate job warning
    duplicateJobWarning,
    handleConfirmDuplicateJob,
    handleDismissDuplicateWarning,

    // Handlers
    handleSubmit,
    handleCreateCustomer,
    handleCreateExternalForklift,
    openNewCustomerModal,
    
    // Navigation
    navigate,
  };
}

/**
 * Context for sharing job data and actions across JobDetail components
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, JobStatus, Part, User, ForkliftConditionChecklist, VanStock, HourmeterFlagReason, JobRequest, UserRole } from '../../types';
import { SupabaseDb as MockDb, supabase } from '../../services/supabaseService';
import { useTechnicians, usePartsForList, useInvalidateQueries } from '../../hooks/useQueryHooks';
import { showToast } from '../../services/toastService';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { generateJobSummary } from '../../services/geminiService';
import { ActiveRental } from './types';
import { PHOTO_CATEGORIES, getDefaultPhotoCategory } from './constants';

// ===== CONTEXT TYPE =====

interface JobDetailContextValue {
  // Core data
  job: Job | null;
  loading: boolean;
  isRealtimeConnected: boolean;
  currentUser: User;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  
  // Related data
  parts: Part[];
  technicians: User[];
  vanStock: VanStock | null;
  jobRequests: JobRequest[];
  activeRental: ActiveRental | null;
  noPartsUsed: boolean;
  
  // Helper state
  isCurrentUserHelper: boolean;
  helperAssignmentId: string | null;
  
  // Hourmeter flags
  hourmeterFlagReasons: HourmeterFlagReason[];
  
  // Acknowledgement data
  jobAcknowledgement: any;
  
  // Navigation
  navigate: ReturnType<typeof useNavigate>;
  
  // Refresh functions
  loadJob: () => Promise<void>;
  loadRequests: () => Promise<void>;
  loadVanStock: () => Promise<void>;
  setJob: (job: Job | null | ((prev: Job | null) => Job | null)) => void;
  setNoPartsUsed: (value: boolean) => void;
  setHourmeterFlagReasons: (reasons: HourmeterFlagReason[]) => void;
}

const JobDetailContext = createContext<JobDetailContextValue | null>(null);

// ===== HOOK =====

export function useJobDetail(): JobDetailContextValue {
  const context = useContext(JobDetailContext);
  if (!context) {
    throw new Error('useJobDetail must be used within JobDetailProvider');
  }
  return context;
}

// ===== PROVIDER =====

interface JobDetailProviderProps {
  children: React.ReactNode;
  currentUser: User;
}

export function JobDetailProvider({ children, currentUser }: JobDetailProviderProps) {
  const { displayRole } = useDevModeContext();
  const currentUserRole = displayRole;
  const currentUserId = currentUser.user_id;
  const currentUserName = currentUser.name;
  
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Core state
  const [job, setJobRaw] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  
  // Related data
  const { data: cachedParts = [] } = usePartsForList();
  const { data: cachedTechnicians = [] } = useTechnicians();
  const parts = cachedParts as unknown as Part[];
  const technicians = cachedTechnicians as User[];
  
  const [vanStock, setVanStock] = useState<VanStock | null>(null);
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [activeRental, setActiveRental] = useState<ActiveRental | null>(null);
  const [noPartsUsed, setNoPartsUsed] = useState(false);
  
  // Helper state
  const [isCurrentUserHelper, setIsCurrentUserHelper] = useState(false);
  const [helperAssignmentId, setHelperAssignmentId] = useState<string | null>(null);
  
  // Hourmeter flags
  const [hourmeterFlagReasons, setHourmeterFlagReasons] = useState<HourmeterFlagReason[]>([]);
  
  // Acknowledgement
  const [jobAcknowledgement, setJobAcknowledgement] = useState<any>(null);
  
  // Normalize job data to ensure arrays are never null/undefined
  const normalizeJob = (j: Job | null): Job | null => {
    if (!j) return null;
    return {
      ...j,
      parts_used: j.parts_used || [],
      media: j.media || [],
      extra_charges: j.extra_charges || []
    };
  };
  
  const setJob = (j: Job | null | ((prev: Job | null) => Job | null)) => {
    if (typeof j === 'function') {
      setJobRaw(prev => normalizeJob(j(prev)));
    } else {
      setJobRaw(normalizeJob(j));
    }
  };
  
  // Load job data
  const loadJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await MockDb.getJobById(id);
      setJob(data ? { ...data } : null);
      if (data) {
        const serviceRecord = await MockDb.getJobServiceRecord(id);
        if (serviceRecord) setNoPartsUsed(serviceRecord.no_parts_used || false);
        if (data.forklift_id) {
          const rental = await MockDb.getActiveRentalForForklift(data.forklift_id);
          setActiveRental(rental);
        }
        if (data.helper_assignment) {
          const isHelper = data.helper_assignment.technician_id === currentUserId;
          setIsCurrentUserHelper(isHelper);
          if (isHelper) setHelperAssignmentId(data.helper_assignment.assignment_id);
        } else {
          setIsCurrentUserHelper(false);
          setHelperAssignmentId(null);
        }
      }
    } catch (error) {
      console.error('Error loading job:', error);
      showToast.error('Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [id, currentUserId]);
  
  // Load requests
  const loadRequests = useCallback(async () => {
    if (!id) return;
    try {
      const requests = await MockDb.getJobRequests(id);
      setJobRequests(requests);
    } catch (error) {
      console.error('Error loading requests:', error);
      showToast.error('Failed to load requests');
    }
  }, [id]);
  
  // Load van stock
  const loadVanStock = useCallback(async () => {
    if (currentUserRole !== UserRole.TECHNICIAN) return;
    try {
      const data = await MockDb.getVanStockByTechnician(currentUserId);
      setVanStock(data);
    } catch (error) {
      console.error('Error loading Van Stock:', error);
    }
  }, [currentUserRole, currentUserId]);
  
  // Load acknowledgement
  const loadAcknowledgement = useCallback(async () => {
    if (job && (job.status === 'Completed Awaiting Acknowledgement' || job.status === 'Disputed')) {
      const ack = await MockDb.getJobAcknowledgement(job.job_id);
      setJobAcknowledgement(ack);
    }
  }, [job]);
  
  // Initial data load
  useEffect(() => {
    loadJob();
    loadRequests();
    loadVanStock();
  }, [id]);
  
  // Load acknowledgement when status changes
  useEffect(() => {
    if (job) loadAcknowledgement();
  }, [job?.status]);
  
  // Real-time subscription for job updates
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`job-detail-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `job_id=eq.${id}`
        },
        (payload) => {
          const updatedJob = payload.new as any;
          const oldJob = payload.old as any;
          
          if (updatedJob?.deleted_at !== null && oldJob?.deleted_at === null) {
            showToast.warning('Job deleted', 'This job has been cancelled or deleted by admin');
            navigate('/jobs');
            return;
          }
          
          if (oldJob?.status !== updatedJob?.status) {
            showToast.info('Job updated', `Status changed to ${updatedJob.status}`);
          }
          
          if (oldJob?.assigned_technician_id !== updatedJob?.assigned_technician_id) {
            if (updatedJob.assigned_technician_id === currentUserId) {
              showToast.success('Job assigned to you', 'You have been assigned to this job');
            } else if (oldJob?.assigned_technician_id === currentUserId) {
              showToast.warning('Job reassigned', `Job has been reassigned to ${updatedJob.assigned_technician_name || 'another technician'}`);
            } else {
              showToast.info('Job reassigned', `Now assigned to ${updatedJob.assigned_technician_name || 'another technician'}`);
            }
          }
          
          loadJob();
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('[JobDetail] ✅ Real-time connected for job:', id);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, navigate, currentUserId, loadJob]);

  // Real-time subscription for job requests
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`job-requests-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_requests',
          filter: `job_id=eq.${id}`
        },
        (payload) => {
          const updatedRequest = payload.new as any;
          const oldRequest = payload.old as any;
          
          if (oldRequest?.status !== updatedRequest?.status) {
            if (updatedRequest.status === 'approved') {
              showToast.success('Request approved', `Your ${updatedRequest.request_type?.replace('_', ' ')} request has been approved`);
            } else if (updatedRequest.status === 'rejected') {
              showToast.error('Request rejected', `Your ${updatedRequest.request_type?.replace('_', ' ')} request has been rejected`);
            }
          }
          
          loadRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_requests',
          filter: `job_id=eq.${id}`
        },
        (payload) => {
          showToast.info('New request', 'A new request has been submitted for this job');
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, loadRequests]);
  
  const value: JobDetailContextValue = {
    job,
    loading,
    isRealtimeConnected,
    currentUser,
    currentUserId,
    currentUserName,
    currentUserRole,
    parts,
    technicians,
    vanStock,
    jobRequests,
    activeRental,
    noPartsUsed,
    isCurrentUserHelper,
    helperAssignmentId,
    hourmeterFlagReasons,
    jobAcknowledgement,
    navigate,
    loadJob,
    loadRequests,
    loadVanStock,
    setJob,
    setNoPartsUsed,
    setHourmeterFlagReasons,
  };
  
  return (
    <JobDetailContext.Provider value={value}>
      {children}
    </JobDetailContext.Provider>
  );
}

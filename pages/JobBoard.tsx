import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Job, JobStatus, JobType, User, DeletedJob, UserRole } from '../types';
import { SupabaseDb as MockDb, supabase } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import { Briefcase, Calendar, MapPin, User as UserIcon, Search, Filter, X, ChevronDown, AlertTriangle, Trash2, ChevronRight, Clock, Zap, CheckCircle, XCircle } from 'lucide-react';
import SlotInSLABadge, { getSLAStatus } from '../components/SlotInSLABadge';
import { useDevModeContext } from '../contexts/DevModeContext';

interface JobBoardProps {
  currentUser: User;
  hideHeader?: boolean;
}

type DateFilter = 'today' | 'unfinished' | 'week' | 'month' | 'all' | 'custom';
type SpecialFilter = 'overdue' | 'unassigned' | 'escalated' | 'awaiting-ack' | null;

const JobBoard: React.FC<JobBoardProps> = ({ currentUser, hideHeader = false }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Use dev mode context for role-based permissions
  const { displayRole, hasPermission } = useDevModeContext();

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('unfinished');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  // Read URL filter parameter on mount
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam) {
      switch (filterParam) {
        case 'overdue':
          setSpecialFilter('overdue');
          setDateFilter('all');
          setStatusFilter('all');
          break;
        case 'unassigned':
          setSpecialFilter('unassigned');
          setDateFilter('all');
          setStatusFilter('all');
          break;
        case 'escalated':
          setSpecialFilter('escalated');
          setDateFilter('all');
          setStatusFilter('all');
          break;
        case 'in-progress':
          setSpecialFilter(null);
          setDateFilter('all');
          setStatusFilter(JobStatus.IN_PROGRESS);
          break;
        case 'awaiting-ack':
          setSpecialFilter('awaiting-ack');
          setDateFilter('all');
          setStatusFilter('all');
          break;
        default:
          // Check if it's a valid JobStatus
          if (Object.values(JobStatus).includes(filterParam as JobStatus)) {
            setStatusFilter(filterParam);
            setDateFilter('all');
          }
      }
    }
  }, [searchParams]);

  // Recently deleted jobs (admin/supervisor only)
  const [deletedJobs, setDeletedJobs] = useState<DeletedJob[]>([]);
  const [showDeletedSection, setShowDeletedSection] = useState(false);
  const canViewDeleted = displayRole === UserRole.ADMIN || displayRole === UserRole.SUPERVISOR;

  // On-Call Accept/Reject state
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const isTechnician = displayRole === UserRole.TECHNICIAN;

  // Accept job handler
  const handleAcceptJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation(); // Prevent navigation to job detail
    setProcessingJobId(jobId);
    try {
      await MockDb.acceptJobAssignment(jobId, currentUser.user_id, currentUser.name);
      showToast.success('Job accepted', 'You can now start the job when ready.');
      fetchJobs(); // Refresh job list
    } catch (err) {
      showToast.error('Failed to accept job', (err as Error).message);
    } finally {
      setProcessingJobId(null);
    }
  };

  // Open reject modal
  const handleOpenRejectModal = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation(); // Prevent navigation to job detail
    setRejectingJobId(jobId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // Reject job handler
  const handleRejectJob = async () => {
    if (!rejectingJobId || !rejectReason.trim()) {
      showToast.error('Please provide a reason for rejection');
      return;
    }
    setProcessingJobId(rejectingJobId);
    try {
      await MockDb.rejectJobAssignment(rejectingJobId, currentUser.user_id, currentUser.name, rejectReason.trim());
      showToast.success('Job rejected', 'Admin has been notified for reassignment.');
      setShowRejectModal(false);
      setRejectingJobId(null);
      setRejectReason('');
      fetchJobs(); // Refresh job list
    } catch (err) {
      showToast.error('Failed to reject job', (err as Error).message);
    } finally {
      setProcessingJobId(null);
    }
  };

  // Helper to check if job needs acceptance (15-min window)
  const jobNeedsAcceptance = (job: Job): boolean => {
    if (job.status !== JobStatus.ASSIGNED) return false;
    if (job.assigned_technician_id !== currentUser.user_id) return false;
    if (job.technician_accepted_at || job.technician_rejected_at) return false;
    return true;
  };

  // Helper to get remaining response time
  const getResponseTimeRemaining = (job: Job): { text: string; isExpired: boolean; urgency: 'ok' | 'warning' | 'critical' } => {
    if (!job.technician_response_deadline) return { text: '', isExpired: false, urgency: 'ok' };
    const deadline = new Date(job.technician_response_deadline);
    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();
    if (remaining <= 0) return { text: 'Expired', isExpired: true, urgency: 'critical' };
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const urgency = minutes < 5 ? 'critical' : minutes < 10 ? 'warning' : 'ok';
    return { text: `${minutes}:${seconds.toString().padStart(2, '0')}`, isExpired: false, urgency };
  };

  // Fetch jobs function (extracted for reuse)
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await MockDb.getJobs(currentUser);
      setJobs(data);
      
      // Fetch recently deleted jobs for admin/supervisor
      if (canViewDeleted) {
        try {
          const deleted = await MockDb.getRecentlyDeletedJobs();
          setDeletedJobs(deleted);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Error loading deleted jobs:', error);
          }
          showToast.error('Failed to load deleted jobs');
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading jobs:', error);
      }
      showToast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [currentUser, canViewDeleted]);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Real-time WebSocket connection state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Real-time subscription for job changes (deletions, status changes, assignments)
  // This ensures all users see job updates immediately without manual refresh
  useEffect(() => {
    const channel = supabase
      .channel('job-board-realtime')
      // Job deletions
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          const updatedJob = payload.new as Job;
          const oldJob = payload.old as Partial<Job>;
          
          // Handle soft-deleted jobs
          if (updatedJob?.deleted_at !== null && oldJob?.deleted_at === null) {
            setJobs(prevJobs => {
              const wasInList = prevJobs.some(j => j.job_id === updatedJob.job_id);
              if (wasInList) {
                showToast.info('Job removed', 'A job has been cancelled or deleted');
              }
              return prevJobs.filter(j => j.job_id !== updatedJob.job_id);
            });
            
            // Refresh deleted jobs list for admins
            if (canViewDeleted) {
              MockDb.getRecentlyDeletedJobs().then(setDeletedJobs).catch(console.error);
            }
            return;
          }
          
          // Handle job status changes - update in place
          setJobs(prevJobs => {
            const jobIndex = prevJobs.findIndex(j => j.job_id === updatedJob.job_id);
            if (jobIndex === -1) return prevJobs;
            
            const previousStatus = prevJobs[jobIndex].status;
            const newStatus = updatedJob.status;
            
            // Show toast for significant status changes
            if (previousStatus !== newStatus) {
              if (newStatus === JobStatus.IN_PROGRESS) {
                showToast.info('Job started', `${updatedJob.title || 'A job'} is now in progress`);
              } else if (newStatus === JobStatus.COMPLETED) {
                showToast.success('Job completed', `${updatedJob.title || 'A job'} has been completed`);
              } else if (newStatus === JobStatus.AWAITING_FINALIZATION) {
                showToast.info('Job awaiting finalization', `${updatedJob.title || 'A job'} needs finalization`);
              }
            }
            
            // Update job assignment notification
            if (updatedJob.assigned_technician_id !== prevJobs[jobIndex].assigned_technician_id && updatedJob.assigned_technician_name) {
              showToast.info('Job assigned', `${updatedJob.title || 'A job'} assigned to ${updatedJob.assigned_technician_name}`);
            }
            
            // Update job in list
            const updatedJobs = [...prevJobs];
            updatedJobs[jobIndex] = { ...updatedJobs[jobIndex], ...updatedJob };
            return updatedJobs;
          });
        }
      )
      // New job created (for admins/supervisors)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          const newJob = payload.new as Job;
          if (newJob && !newJob.deleted_at) {
            // Only add if user should see it (will be filtered by role in getJobs)
            showToast.info('New job created', newJob.title || 'A new job has been added');
            fetchJobs(); // Refresh to get full job data with relations
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('[JobBoard] ✅ Real-time connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[JobBoard] ⚠️ Real-time connection issue:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canViewDeleted, fetchJobs]);

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    const today = new Date();
    const todayStr = today.toDateString();
    today.setHours(0, 0, 0, 0);

    // Special filter (from URL params like ?filter=overdue)
    if (specialFilter) {
      switch (specialFilter) {
        case 'overdue':
          result = result.filter(job => {
            if (['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(job.status)) return false;
            const scheduled = job.scheduled_date ? new Date(job.scheduled_date) : null;
            return scheduled && scheduled < today && job.status !== 'New';
          });
          break;
        case 'unassigned':
          result = result.filter(job =>
            !job.assigned_technician_id &&
            !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(job.status)
          );
          break;
        case 'escalated':
          result = result.filter(job => job.is_escalated && !job.escalation_acknowledged_at);
          break;
        case 'awaiting-ack':
          result = result.filter(job => job.status === JobStatus.COMPLETED_AWAITING_ACK);
          break;
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(job =>
        job.title?.toLowerCase().includes(query) ||
        job.description?.toLowerCase().includes(query) ||
        job.customer?.name?.toLowerCase().includes(query) ||
        job.customer?.address?.toLowerCase().includes(query) ||
        job.assigned_technician_name?.toLowerCase().includes(query) ||
        job.forklift?.serial_number?.toLowerCase().includes(query) ||
        job.forklift?.model?.toLowerCase().includes(query)
      );
    }

    // Status filter (only if no special filter active)
    if (statusFilter !== 'all' && !specialFilter) {
      result = result.filter(job => job.status === statusFilter);
    }

    // Date filter (skip if special filter active)
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Skip date filter if special filter is active
    if (!specialFilter) {
      switch (dateFilter) {
        case 'today':
          result = result.filter(job => {
            const jobDate = new Date(job.scheduled_date || job.created_at);
            return jobDate >= today && jobDate <= todayEnd;
          });
          break;
        case 'unfinished':
          // Unfinished = needs work or attention
          // Excludes: Completed, Completed Awaiting Ack (work done, just pending customer)
          result = result.filter(job =>
            job.status !== JobStatus.COMPLETED &&
            job.status !== JobStatus.COMPLETED_AWAITING_ACK
          );
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          result = result.filter(job => {
            const jobDate = new Date(job.scheduled_date || job.created_at);
            return jobDate >= weekAgo;
          });
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          result = result.filter(job => {
            const jobDate = new Date(job.scheduled_date || job.created_at);
            return jobDate >= monthAgo;
          });
          break;
        case 'custom':
          if (customDateFrom) {
            const fromDate = new Date(customDateFrom);
            fromDate.setHours(0, 0, 0, 0);
            result = result.filter(job => {
              const jobDate = new Date(job.scheduled_date || job.created_at);
              return jobDate >= fromDate;
            });
          }
          if (customDateTo) {
            const toDate = new Date(customDateTo);
            toDate.setHours(23, 59, 59, 999);
            result = result.filter(job => {
              const jobDate = new Date(job.scheduled_date || job.created_at);
              return jobDate <= toDate;
            });
          }
          break;
        case 'all':
        default:
          // No date filtering
          break;
      }
    }

    // Sort by date (newest first), with priority for emergency and Slot-In jobs
    result.sort((a, b) => {
      // Slot-In jobs pending acknowledgement sorted by SLA urgency (most urgent first)
      const aIsSlotInPending = a.job_type === JobType.SLOT_IN && !a.acknowledged_at;
      const bIsSlotInPending = b.job_type === JobType.SLOT_IN && !b.acknowledged_at;

      if (aIsSlotInPending && bIsSlotInPending) {
        // Both are Slot-In pending - sort by SLA remaining time (least time first)
        const aState = getSLAStatus(a.created_at, a.acknowledged_at, a.sla_target_minutes || 15);
        const bState = getSLAStatus(b.created_at, b.acknowledged_at, b.sla_target_minutes || 15);
        return aState.remainingMs - bState.remainingMs;
      }

      if (aIsSlotInPending && !bIsSlotInPending) return -1;
      if (bIsSlotInPending && !aIsSlotInPending) return 1;

      // Emergency jobs next
      if (a.priority === 'Emergency' && b.priority !== 'Emergency') return -1;
      if (b.priority === 'Emergency' && a.priority !== 'Emergency') return 1;

      // Then by date
      const dateA = new Date(a.scheduled_date || a.created_at).getTime();
      const dateB = new Date(b.scheduled_date || b.created_at).getTime();
      return dateB - dateA;
    });

    return result;
  }, [jobs, searchQuery, dateFilter, statusFilter, specialFilter, customDateFrom, customDateTo]);

  const getStatusColor = (status: JobStatus) => {
    switch(status) {
      case JobStatus.NEW: return 'bg-blue-100 text-blue-800';
      case JobStatus.ASSIGNED: return 'bg-indigo-100 text-indigo-800';
      case JobStatus.IN_PROGRESS: return 'bg-amber-100 text-amber-800';
      case JobStatus.AWAITING_FINALIZATION: return 'bg-purple-100 text-purple-800';
      case JobStatus.COMPLETED: return 'bg-green-100 text-green-800';
      // New statuses (#7 Multi-Day, #8 Deferred Ack)
      case JobStatus.COMPLETED_AWAITING_ACK: return 'bg-orange-100 text-orange-800';
      case JobStatus.INCOMPLETE_CONTINUING: return 'bg-amber-100 text-amber-800';
      case JobStatus.INCOMPLETE_REASSIGNED: return 'bg-rose-100 text-rose-800';
      case JobStatus.DISPUTED: return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getJobTypeColor = (type?: JobType) => {
    switch(type) {
      case JobType.SERVICE: return 'bg-green-50 text-green-700 border-green-200';
      case JobType.REPAIR: return 'bg-orange-50 text-orange-700 border-orange-200';
      case JobType.CHECKING: return 'bg-purple-50 text-purple-700 border-purple-200';
      case JobType.SLOT_IN: return 'bg-red-50 text-red-700 border-red-200';
      case JobType.COURIER: return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('unfinished');
    setStatusFilter('all');
    setSpecialFilter(null);
    setCustomDateFrom('');
    setCustomDateTo('');
    // Clear URL params
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || dateFilter !== 'unfinished' || statusFilter !== 'all' || specialFilter !== null;

  // Count jobs by status for quick stats
  const statusCounts = useMemo(() => {
    const completedCount = jobs.filter(j => j.status === JobStatus.COMPLETED).length;
    const awaitingAckCount = jobs.filter(j => j.status === JobStatus.COMPLETED_AWAITING_ACK).length;
    const disputedCount = jobs.filter(j => j.status === JobStatus.DISPUTED).length;
    const incompleteContinuingCount = jobs.filter(j => j.status === JobStatus.INCOMPLETE_CONTINUING).length;
    const incompleteReassignedCount = jobs.filter(j => j.status === JobStatus.INCOMPLETE_REASSIGNED).length;

    // Slot-In jobs pending acknowledgement (urgent attention needed)
    const slotInPendingAck = jobs.filter(j =>
      j.job_type === JobType.SLOT_IN &&
      !j.acknowledged_at &&
      j.status !== JobStatus.COMPLETED &&
      j.status !== JobStatus.CANCELLED
    ).length;

    // "Completed" for totals includes: Completed + Awaiting Ack + Disputed (work was done)
    const totalCompleted = completedCount + awaitingAckCount + disputedCount;

    return {
      total: jobs.length,
      new: jobs.filter(j => j.status === JobStatus.NEW).length,
      assigned: jobs.filter(j => j.status === JobStatus.ASSIGNED).length,
      inProgress: jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
      awaiting: jobs.filter(j => j.status === JobStatus.AWAITING_FINALIZATION).length,
      completed: totalCompleted,
      // Separate counts for admin visibility
      awaitingAck: awaitingAckCount,
      disputed: disputedCount,
      incompleteContinuing: incompleteContinuingCount,
      incompleteReassigned: incompleteReassignedCount,
      // Slot-In SLA tracking
      slotInPendingAck,
    };
  }, [jobs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-theme">
            {displayRole === UserRole.TECHNICIAN ? 'My Jobs' : 'Job Board'}
          </h1>
          {hasPermission('canCreateJobs') && (
            <button
              onClick={() => navigate('/jobs/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition"
            >
              + New Job
            </button>
          )}
        </div>
      )}

      {/* Quick Stats - Industry Standard Color Mapping */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {/* Active - Green (work happening) */}
        <button
          onClick={() => { setStatusFilter('all'); setDateFilter('unfinished'); }}
          className={`p-3 rounded-lg text-center transition-all ${
            statusFilter === 'all' && dateFilter === 'unfinished' 
              ? 'text-white shadow-lg scale-[1.02] ring-2' 
              : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
          }`}
          style={statusFilter === 'all' && dateFilter === 'unfinished' ? {
            backgroundColor: '#16A34A',
            '--tw-ring-color': '#86EFAC'
          } as React.CSSProperties : {}}
        >
          <div className="text-2xl font-bold">{statusCounts.total - statusCounts.completed}</div>
          <div className="text-xs opacity-80">Active</div>
        </button>
        
        {/* New - Slate/Gray (unassigned) */}
        <button
          onClick={() => setStatusFilter(JobStatus.NEW)}
          className={`p-3 rounded-lg text-center transition-all ${
            statusFilter === JobStatus.NEW 
              ? 'text-white shadow-lg scale-[1.02]' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
          }`}
          style={statusFilter === JobStatus.NEW ? {
            backgroundColor: '#475569'
          } : {}}
        >
          <div className="text-2xl font-bold">{statusCounts.new}</div>
          <div className="text-xs opacity-80">New</div>
        </button>
        
        {/* Assigned - Cyan (queued/allocated) */}
        <button
          onClick={() => setStatusFilter(JobStatus.ASSIGNED)}
          className={`p-3 rounded-lg text-center transition-all ${
            statusFilter === JobStatus.ASSIGNED 
              ? 'text-white shadow-lg scale-[1.02]' 
              : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200'
          }`}
          style={statusFilter === JobStatus.ASSIGNED ? {
            backgroundColor: '#0891B2'
          } : {}}
        >
          <div className="text-2xl font-bold">{statusCounts.assigned}</div>
          <div className="text-xs opacity-80">Assigned</div>
        </button>
        
        {/* In Progress - Bright Green (work happening now) */}
        <button
          onClick={() => setStatusFilter(JobStatus.IN_PROGRESS)}
          className={`p-3 rounded-lg text-center transition-all ${
            statusFilter === JobStatus.IN_PROGRESS 
              ? 'text-white shadow-lg scale-[1.02]' 
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
          }`}
          style={statusFilter === JobStatus.IN_PROGRESS ? {
            backgroundColor: '#22C55E'
          } : {}}
        >
          <div className="text-2xl font-bold">{statusCounts.inProgress}</div>
          <div className="text-xs opacity-80">In Progress</div>
        </button>
        
        {/* Awaiting - Amber (needs attention) */}
        <button
          onClick={() => setStatusFilter(JobStatus.AWAITING_FINALIZATION)}
          className={`p-3 rounded-lg text-center transition-all ${
            statusFilter === JobStatus.AWAITING_FINALIZATION 
              ? 'text-white shadow-lg scale-[1.02]' 
              : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
          }`}
          style={statusFilter === JobStatus.AWAITING_FINALIZATION ? {
            backgroundColor: '#D97706'
          } : {}}
        >
          <div className="text-2xl font-bold">{statusCounts.awaiting}</div>
          <div className="text-xs opacity-80">Awaiting</div>
        </button>
        
        {/* Completed - Dark Green (finished/settled) */}
        <button
          onClick={() => { setStatusFilter(JobStatus.COMPLETED); setDateFilter('all'); }}
          className={`p-3 rounded-lg text-center transition-all ${
            statusFilter === JobStatus.COMPLETED
              ? 'text-white shadow-lg scale-[1.02]'
              : 'bg-green-100 hover:bg-green-200 text-green-800 border border-green-300'
          }`}
          style={statusFilter === JobStatus.COMPLETED ? {
            backgroundColor: '#166534'
          } : {}}
        >
          <div className="text-2xl font-bold">{statusCounts.completed}</div>
          <div className="text-xs opacity-80">Completed</div>
        </button>
      </div>

      {/* Slot-In SLA Alert Banner - shows if there are pending Slot-In jobs */}
      {statusCounts.slotInPendingAck > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <Zap className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="font-semibold text-red-800">
                {statusCounts.slotInPendingAck} Slot-In {statusCounts.slotInPendingAck === 1 ? 'Job' : 'Jobs'} Pending Acknowledgement
              </div>
              <div className="text-sm text-red-600">15-minute SLA countdown active</div>
            </div>
          </div>
          <button
            onClick={() => {
              setSearchQuery('');
              setDateFilter('all');
              setStatusFilter('all');
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
          >
            View All Slot-In Jobs
          </button>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="card-theme p-4 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
            <input
              type="text"
              placeholder="Search jobs, customers, forklifts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-theme bg-theme-surface text-theme focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Filter Dropdown */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-lg border border-theme bg-theme-surface text-theme focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer min-w-[160px]"
            >
              <option value="unfinished">🔄 Unfinished</option>
              <option value="today">📅 Today</option>
              <option value="week">📆 This Week</option>
              <option value="month">🗓️ This Month</option>
              <option value="all">📋 All Jobs</option>
              <option value="custom">🔍 Custom Range</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
          </div>

          {/* Toggle Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-lg border transition flex items-center gap-2 ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-theme text-theme-muted hover:bg-theme-surface-2'}`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {/* Custom Date Range */}
        {dateFilter === 'custom' && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-theme-muted">
            <div className="flex items-center gap-2">
              <label className="text-sm text-theme-muted">From:</label>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-theme bg-theme-surface text-theme text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-theme-muted">To:</label>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-theme bg-theme-surface text-theme text-sm"
              />
            </div>
          </div>
        )}

        {/* Additional Filters (expandable) */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-theme-muted">
            <div className="flex items-center gap-2">
              <label className="text-sm text-theme-muted">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-theme bg-theme-surface text-theme text-sm"
              >
                <option value="all">All Statuses</option>
                <option value={JobStatus.NEW}>New</option>
                <option value={JobStatus.ASSIGNED}>Assigned</option>
                <option value={JobStatus.IN_PROGRESS}>In Progress</option>
                <option value={JobStatus.AWAITING_FINALIZATION}>Awaiting Finalization</option>
                <option value={JobStatus.COMPLETED}>Completed</option>
                <option value={JobStatus.COMPLETED_AWAITING_ACK}>Awaiting Customer Ack</option>
                <option value={JobStatus.INCOMPLETE_CONTINUING}>Incomplete - Continuing</option>
                <option value={JobStatus.INCOMPLETE_REASSIGNED}>Incomplete - Reassigned</option>
                <option value={JobStatus.DISPUTED}>Disputed</option>
              </select>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="text-sm text-theme-muted">
          Showing {filteredJobs.length} of {jobs.length} jobs
        </div>
      </div>

      {/* Special Filter Banner */}
      {specialFilter && (
        <div className={`flex items-center justify-between p-4 rounded-xl ${
          specialFilter === 'overdue' ? 'bg-red-50 border border-red-200' :
          specialFilter === 'unassigned' ? 'bg-orange-50 border border-orange-200' :
          specialFilter === 'escalated' ? 'bg-red-50 border border-red-200' :
          'bg-purple-50 border border-purple-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${
              specialFilter === 'overdue' ? 'bg-red-100' :
              specialFilter === 'unassigned' ? 'bg-orange-100' :
              specialFilter === 'escalated' ? 'bg-red-100' :
              'bg-purple-100'
            }`}>
              {specialFilter === 'overdue' && <Clock className="w-5 h-5 text-red-600" />}
              {specialFilter === 'unassigned' && <UserIcon className="w-5 h-5 text-orange-600" />}
              {specialFilter === 'escalated' && <AlertTriangle className="w-5 h-5 text-red-600" />}
              {specialFilter === 'awaiting-ack' && <Clock className="w-5 h-5 text-purple-600" />}
            </div>
            <div>
              <div className={`font-semibold ${
                specialFilter === 'overdue' ? 'text-red-800' :
                specialFilter === 'unassigned' ? 'text-orange-800' :
                specialFilter === 'escalated' ? 'text-red-800' :
                'text-purple-800'
              }`}>
                {specialFilter === 'overdue' && `${filteredJobs.length} Overdue Jobs`}
                {specialFilter === 'unassigned' && `${filteredJobs.length} Unassigned Jobs`}
                {specialFilter === 'escalated' && `${filteredJobs.length} Escalated Jobs`}
                {specialFilter === 'awaiting-ack' && `${filteredJobs.length} Awaiting Customer Acknowledgement`}
              </div>
              <div className={`text-sm ${
                specialFilter === 'overdue' ? 'text-red-600' :
                specialFilter === 'unassigned' ? 'text-orange-600' :
                specialFilter === 'escalated' ? 'text-red-600' :
                'text-purple-600'
              }`}>
                {specialFilter === 'overdue' && 'Past scheduled date, not yet completed'}
                {specialFilter === 'unassigned' && 'No technician assigned yet'}
                {specialFilter === 'escalated' && 'Requires immediate attention'}
                {specialFilter === 'awaiting-ack' && 'Completed, pending customer sign-off'}
              </div>
            </div>
          </div>
          <button
            onClick={clearFilters}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
              specialFilter === 'overdue' ? 'bg-red-600 text-white hover:bg-red-700' :
              specialFilter === 'unassigned' ? 'bg-orange-600 text-white hover:bg-orange-700' :
              specialFilter === 'escalated' ? 'bg-red-600 text-white hover:bg-red-700' :
              'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Job Cards Grid */}
      {loading ? (
        <div className="text-center py-12 text-theme-muted">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p>Loading jobs...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredJobs.map(job => (
            <div 
              key={job.job_id} 
              onClick={() => navigate(`/jobs/${job.job_id}`)}
              className="card-theme p-5 rounded-xl clickable-card group theme-transition"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                  {job.job_type && (
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getJobTypeColor(job.job_type as JobType)}`}>
                      {job.job_type}
                    </span>
                  )}
                  {/* Helper badge for technicians viewing helper assignments */}
                  {(job as any)._isHelperAssignment && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                      Helper
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {job.priority === 'Emergency' && (
                    <span className="text-xs font-bold text-red-600 animate-pulse">EMERGENCY</span>
                  )}
                  {/* Slot-In SLA Badge */}
                  {job.job_type === JobType.SLOT_IN && (
                    <SlotInSLABadge
                      createdAt={job.created_at}
                      acknowledgedAt={job.acknowledged_at}
                      slaTargetMinutes={job.sla_target_minutes || 15}
                      size="sm"
                    />
                  )}
                </div>
              </div>
              
              <h3 className="font-bold text-lg text-theme group-hover:text-blue-600 mb-1">{job.title}</h3>
              <p className="text-theme-muted text-sm mb-4 line-clamp-2">{job.description}</p>
              
              <div className="space-y-2 text-sm text-theme-muted">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 opacity-60" />
                  <span className="truncate">{job.customer?.address || 'No address'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 opacity-60" />
                  {job.customer ? (
                    <span>{job.customer.name}</span>
                  ) : (
                    <span className="text-amber-600 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> No Customer
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 opacity-60" />
                  <span>{new Date(job.scheduled_date || job.created_at).toLocaleDateString()}</span>
                </div>
                {job.assigned_technician_name && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <UserIcon className="w-4 h-4" />
                    <span className="font-medium">{job.assigned_technician_name}</span>
                  </div>
                )}
              </div>

              {/* On-Call Accept/Reject Buttons for Technicians */}
              {isTechnician && jobNeedsAcceptance(job) && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                  {/* Response timer */}
                  {job.technician_response_deadline && (
                    <div className={`flex items-center gap-1 mb-2 text-xs ${
                      getResponseTimeRemaining(job).urgency === 'critical' ? 'text-red-600' :
                      getResponseTimeRemaining(job).urgency === 'warning' ? 'text-amber-600' :
                      'text-slate-500'
                    }`}>
                      <Clock className="w-3 h-3" />
                      <span>
                        {getResponseTimeRemaining(job).isExpired 
                          ? 'Response time expired' 
                          : `Respond within: ${getResponseTimeRemaining(job).text}`}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handleAcceptJob(e, job.job_id)}
                      disabled={processingJobId === job.job_id}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {processingJobId === job.job_id ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      onClick={(e) => handleOpenRejectModal(e, job.job_id)}
                      disabled={processingJobId === job.job_id}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Show acceptance status for already accepted jobs */}
              {isTechnician && job.assigned_technician_id === currentUser.user_id && job.technician_accepted_at && (
                <div className="mt-3 pt-2 border-t border-green-200">
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Accepted - Ready to start
                  </span>
                </div>
              )}
            </div>
          ))}

          {filteredJobs.length === 0 && (
            <div className="col-span-full text-center py-12 text-theme-muted">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="mb-2">No jobs found.</p>
              {hasActiveFilters && (
                <button 
                  onClick={clearFilters}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Clear filters to see all jobs
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recently Deleted Section - Admin/Supervisor Only */}
      {canViewDeleted && deletedJobs.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowDeletedSection(!showDeletedSection)}
            className="w-full flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-500" />
              <span className="font-semibold text-red-800">Recently Deleted ({deletedJobs.length})</span>
              <span className="text-xs text-red-500">Last 30 days</span>
            </div>
            <ChevronRight className={`w-5 h-5 text-red-500 transition-transform ${showDeletedSection ? 'rotate-90' : ''}`} />
          </button>

          {showDeletedSection && (
            <div className="mt-3 space-y-3">
              {deletedJobs.map(job => (
                <div
                  key={job.job_id}
                  className="bg-red-50/50 border border-red-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-slate-800 line-through opacity-60">{job.title}</h4>
                      <p className="text-sm text-slate-500 line-clamp-1">{job.description}</p>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                      Cancelled
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                    <div>
                      <span className="text-xs text-slate-400 uppercase">Customer</span>
                      <p className="text-slate-600">{job.customer_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase">Equipment</span>
                      <p className="text-slate-600">{job.forklift_serial || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase">Cancelled By</span>
                      <p className="text-slate-600">{job.deleted_by_name || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase">Cancelled On</span>
                      <p className="text-slate-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(job.deleted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {job.deletion_reason && (
                    <div className="mt-3 p-2 bg-white/50 rounded border border-red-100">
                      <span className="text-xs text-red-600 font-medium">Reason: </span>
                      <span className="text-sm text-slate-700">{job.deletion_reason}</span>
                    </div>
                  )}

                  {job.hourmeter_before_delete && (
                    <div className="mt-2 text-xs text-amber-600">
                      ⚠️ Hourmeter {job.hourmeter_before_delete} hrs was recorded but invalidated due to cancellation
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reject Job Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Reject Job Assignment</h3>
            <p className="text-sm text-slate-600 mb-4">
              Please provide a reason for rejecting this job. Admin will be notified and can reassign it.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRejectModal(false); setRejectingJobId(null); setRejectReason(''); }}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectJob}
                disabled={!rejectReason.trim() || processingJobId === rejectingJobId}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                {processingJobId === rejectingJobId ? 'Rejecting...' : 'Reject Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobBoard;

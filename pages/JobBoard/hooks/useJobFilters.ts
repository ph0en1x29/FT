import { useEffect,useMemo,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSLAStatus } from '../../../components/SlotInSLABadge';
import { JobStatus,JobType } from '../../../types';
import { DateFilter,JobWithHelperFlag,SpecialFilter,StatusCounts } from '../types';

interface UseJobFiltersProps {
  jobs: JobWithHelperFlag[];
}

interface UseJobFiltersReturn {
  // Filter states
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dateFilter: DateFilter;
  setDateFilter: (filter: DateFilter) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  specialFilter: SpecialFilter;
  setSpecialFilter: (filter: SpecialFilter) => void;
  customDateFrom: string;
  setCustomDateFrom: (date: string) => void;
  customDateTo: string;
  setCustomDateTo: (date: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  
  // Computed values
  filteredJobs: JobWithHelperFlag[];
  statusCounts: StatusCounts;
  hasActiveFilters: boolean;
  
  // Actions
  clearFilters: () => void;
}

/**
 * Hook for managing job board filtering and search
 */
export function useJobFilters({ jobs }: UseJobFiltersProps): UseJobFiltersReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  
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

  // Count jobs by status for quick stats
  const statusCounts = useMemo((): StatusCounts => {
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
      awaitingAck: awaitingAckCount,
      disputed: disputedCount,
      incompleteContinuing: incompleteContinuingCount,
      incompleteReassigned: incompleteReassignedCount,
      slotInPendingAck,
    };
  }, [jobs]);

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    const today = new Date();
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
          result = result.filter(job => (job.is_escalated || job.escalation_triggered_at) && !job.escalation_acknowledged_at);
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
        job.forklift?.model?.toLowerCase().includes(query) ||
        job.job_number?.toLowerCase().includes(query)
      );
    }

    // Status filter (only if no special filter active)
    if (statusFilter !== 'all' && !specialFilter) {
      result = result.filter(job => job.status === statusFilter);
    }

    // Date filter (skip if special filter active)
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    if (!specialFilter) {
      switch (dateFilter) {
        case 'today':
          result = result.filter(job => {
            const jobDate = new Date(job.scheduled_date || job.created_at);
            return jobDate >= today && jobDate <= todayEnd;
          });
          break;
        case 'unfinished':
          result = result.filter(job =>
            job.status !== JobStatus.COMPLETED &&
            job.status !== JobStatus.COMPLETED_AWAITING_ACK
          );
          break;
        case 'week': {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          result = result.filter(job => {
            const jobDate = new Date(job.scheduled_date || job.created_at);
            return jobDate >= weekAgo;
          });
          break;
        }
        case 'month': {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          result = result.filter(job => {
            const jobDate = new Date(job.scheduled_date || job.created_at);
            return jobDate >= monthAgo;
          });
          break;
        }
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
          break;
      }
    }

    // Sort by date (newest first), with priority for emergency and Slot-In jobs
    result.sort((a, b) => {
      // Slot-In jobs pending acknowledgement sorted by SLA urgency
      const aIsSlotInPending = a.job_type === JobType.SLOT_IN && !a.acknowledged_at;
      const bIsSlotInPending = b.job_type === JobType.SLOT_IN && !b.acknowledged_at;

      if (aIsSlotInPending && bIsSlotInPending) {
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

  const hasActiveFilters = searchQuery || dateFilter !== 'unfinished' || statusFilter !== 'all' || specialFilter !== null;

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('unfinished');
    setStatusFilter('all');
    setSpecialFilter(null);
    setCustomDateFrom('');
    setCustomDateTo('');
    setSearchParams({});
  };

  return {
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    specialFilter,
    setSpecialFilter,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    showFilters,
    setShowFilters,
    filteredJobs,
    statusCounts,
    hasActiveFilters,
    clearFilters,
  };
}

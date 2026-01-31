import { useState, useMemo } from 'react';
import { Job } from '../../../types';

export type FilterMode = 'current' | 'history' | 'all';

export interface JobFilters {
  filterMode: FilterMode;
  statusFilter: string;
  typeFilter: string;
  dateFrom: string;
  dateTo: string;
}

export interface JobStats {
  currentJobs: Job[];
  completedTotal: number;
  completedThisMonth: number;
}

export function useJobFilters(jobs: Job[]) {
  const [filterMode, setFilterMode] = useState<FilterMode>('current');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Calculate stats
  const stats = useMemo((): JobStats => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const currentJobs = jobs.filter(
      (j) => !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)
    );
    const completedTotal = jobs.filter((j) => j.status === 'Completed').length;
    const completedThisMonth = jobs.filter(
      (j) => j.status === 'Completed' && j.completed_at && new Date(j.completed_at) >= monthStart
    ).length;

    return { currentJobs, completedTotal, completedThisMonth };
  }, [jobs]);

  // Apply filters
  const filteredJobs = useMemo(() => {
    return jobs
      .filter((job) => {
        // Filter mode
        const isCompleted = ['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(job.status);
        if (filterMode === 'current' && isCompleted) return false;
        if (filterMode === 'history' && !isCompleted) return false;

        // Status filter
        if (statusFilter !== 'all' && job.status !== statusFilter) return false;

        // Type filter
        if (typeFilter !== 'all' && job.job_type !== typeFilter) return false;

        // Date range filter
        const jobDate = job.scheduled_date ? new Date(job.scheduled_date) : new Date(job.created_at);
        if (dateFrom) {
          const from = new Date(dateFrom);
          if (jobDate < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          if (jobDate > to) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by date descending (most recent first)
        const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(a.created_at);
        const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(b.created_at);
        return dateB.getTime() - dateA.getTime();
      });
  }, [jobs, filterMode, statusFilter, typeFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo;

  return {
    // Filter state
    filterMode,
    setFilterMode,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    // Computed
    filteredJobs,
    stats,
    hasActiveFilters,
    clearFilters,
  };
}

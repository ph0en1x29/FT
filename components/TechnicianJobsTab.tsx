import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Job, JobStatus, JobType, Employee } from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import {
  Briefcase, Clock, CheckCircle, Play, Calendar, Filter,
  ChevronRight, Loader2, Search, Wrench, AlertTriangle, Package
} from 'lucide-react';

interface TechnicianJobsTabProps {
  employee: Employee;
  currentUser: User;
}

type FilterMode = 'current' | 'history' | 'all';

const TechnicianJobsTab: React.FC<TechnicianJobsTabProps> = ({ employee, currentUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('current');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    loadJobs();
  }, [employee.user_id]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      // Fetch all jobs (as admin/supervisor would see them all)
      const allJobs = await MockDb.getJobs(currentUser);

      // Filter to jobs assigned to this technician
      const techJobs = (allJobs || []).filter(
        (j) => j.assigned_technician_id === employee.user_id
      );

      setJobs(techJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
      showToast.error('Failed to load job history');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filteredJobs = jobs.filter((job) => {
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
  }).sort((a, b) => {
    // Sort by date descending (most recent first)
    const dateA = a.scheduled_date ? new Date(a.scheduled_date) : new Date(a.created_at);
    const dateB = b.scheduled_date ? new Date(b.scheduled_date) : new Date(b.created_at);
    return dateB.getTime() - dateA.getTime();
  });

  // Stats
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const currentJobs = jobs.filter(
    (j) => !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)
  );
  const completedTotal = jobs.filter((j) => j.status === 'Completed').length;
  const completedThisMonth = jobs.filter(
    (j) => j.status === 'Completed' && j.completed_at && new Date(j.completed_at) >= monthStart
  ).length;

  type ToneStyle = { bg: string; text: string };
  const toneStyles: Record<string, ToneStyle> = {
    success: { bg: 'bg-[var(--success-bg)]', text: 'text-[var(--success)]' },
    warning: { bg: 'bg-[var(--warning-bg)]', text: 'text-[var(--warning)]' },
    error: { bg: 'bg-[var(--error-bg)]', text: 'text-[var(--error)]' },
    info: { bg: 'bg-[var(--info-bg)]', text: 'text-[var(--info)]' },
    accent: { bg: 'bg-theme-accent-subtle', text: 'text-theme-accent' },
    neutral: { bg: 'bg-theme-surface-2', text: 'text-theme-secondary' },
  };

  const getStatusTone = (status: string): ToneStyle => {
    switch (status) {
      case JobStatus.COMPLETED:
        return toneStyles.success;
      case JobStatus.IN_PROGRESS:
        return toneStyles.info;
      case JobStatus.ASSIGNED:
        return toneStyles.accent;
      case JobStatus.NEW:
        return toneStyles.info;
      case JobStatus.AWAITING_FINALIZATION:
        return toneStyles.warning;
      case 'Completed Awaiting Ack':
        return toneStyles.accent;
      case 'Cancelled':
        return toneStyles.error;
      default:
        return toneStyles.neutral;
    }
  };

  const getJobTypeTone = (type?: string): ToneStyle => {
    switch (type) {
      case JobType.SLOT_IN:
        return toneStyles.error;
      case JobType.REPAIR:
        return toneStyles.warning;
      case JobType.SERVICE:
        return toneStyles.success;
      case JobType.CHECKING:
        return toneStyles.info;
      case JobType.COURIER:
        return toneStyles.warning;
      default:
        return toneStyles.neutral;
    }
  };

  const getJobTypeIcon = (type?: string) => {
    switch (type) {
      case JobType.SLOT_IN:
        return <AlertTriangle className="w-5 h-5" />;
      case JobType.COURIER:
        return <Package className="w-5 h-5" />;
      default:
        return <Wrench className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-theme-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-theme rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--info-bg)] rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[var(--info)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--info)]">{currentJobs.length}</p>
              <p className="text-xs text-theme-muted">Current Jobs</p>
            </div>
          </div>
        </div>

        <div className="card-theme rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--success-bg)] rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--success)]">{completedTotal}</p>
              <p className="text-xs text-theme-muted">Completed Total</p>
            </div>
          </div>
        </div>

        <div className="card-theme rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-theme-accent-subtle rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-theme-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme-accent">{completedThisMonth}</p>
              <p className="text-xs text-theme-muted">This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 bg-theme-surface-2 p-1 rounded-lg">
          <button
            onClick={() => setFilterMode('current')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMode === 'current'
                ? 'bg-theme-surface text-theme-accent shadow-sm'
                : 'text-theme-muted hover:text-[var(--text)]'
            }`}
          >
            Current ({currentJobs.length})
          </button>
          <button
            onClick={() => setFilterMode('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMode === 'history'
                ? 'bg-theme-surface text-theme-accent shadow-sm'
                : 'text-theme-muted hover:text-[var(--text)]'
            }`}
          >
            History ({completedTotal})
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-theme-surface text-theme-accent shadow-sm'
                : 'text-theme-muted hover:text-[var(--text)]'
            }`}
          >
            All ({jobs.length})
          </button>
        </div>

        {/* Additional Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
          >
            <option value="all">All Status</option>
            <option value={JobStatus.NEW}>New</option>
            <option value={JobStatus.ASSIGNED}>Assigned</option>
            <option value={JobStatus.IN_PROGRESS}>In Progress</option>
            <option value={JobStatus.AWAITING_FINALIZATION}>Awaiting Finalization</option>
            <option value={JobStatus.COMPLETED}>Completed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
          >
            <option value="all">All Types</option>
            <option value={JobType.SERVICE}>Service</option>
            <option value={JobType.REPAIR}>Repair</option>
            <option value={JobType.CHECKING}>Checking</option>
            <option value={JobType.SLOT_IN}>Slot-In</option>
            <option value={JobType.COURIER}>Courier</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
            placeholder="From"
          />
          <span className="text-theme-muted">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
            placeholder="To"
          />

          {(statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setTypeFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="px-3 py-2 text-sm text-[var(--error)] hover:bg-[var(--error-bg)] rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <Briefcase className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme-secondary mb-2">No jobs found</h3>
          <p className="text-sm text-theme-muted">
            {filterMode === 'current'
              ? 'No active jobs assigned'
              : filterMode === 'history'
              ? 'No completed jobs yet'
              : 'No jobs match the current filters'}
          </p>
        </div>
      ) : (
        <div className="card-theme rounded-xl overflow-hidden divide-y divide-[var(--border-subtle)]">
          {filteredJobs.map((job) => {
            const statusTone = getStatusTone(job.status);
            const typeTone = getJobTypeTone(job.job_type);
            const TypeIcon = () => getJobTypeIcon(job.job_type);

            return (
              <div
                key={job.job_id}
                onClick={() => navigate(`/jobs/${job.job_id}`)}
                className="p-4 cursor-pointer hover:bg-theme-surface-2 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Job Type Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeTone.bg} ${typeTone.text}`}
                    >
                      <TypeIcon />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-theme truncate">
                          {(job as any).job_number || job.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-theme-muted">
                        <span>{job.customer?.name || 'No customer'}</span>
                        {job.forklift && (
                          <span>&middot; {job.forklift.model || job.forklift.serial_number}</span>
                        )}
                        {job.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(job.scheduled_date).toLocaleDateString('en-MY', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status badge */}
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${statusTone.bg} ${statusTone.text}`}
                    >
                      {job.status.replace(/_/g, ' ')}
                    </span>
                    {/* Job type badge */}
                    {job.job_type && (
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${typeTone.bg} ${typeTone.text}`}
                      >
                        {job.job_type}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-theme-muted flex-shrink-0" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TechnicianJobsTab;

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Job, JobStatus, JobType, User } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { Briefcase, Calendar, MapPin, User as UserIcon, Search, Filter, X, ChevronDown } from 'lucide-react';

interface JobBoardProps {
  currentUser: User;
}

type DateFilter = 'today' | 'unfinished' | 'week' | 'month' | 'all' | 'custom';

const JobBoard: React.FC<JobBoardProps> = ({ currentUser }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('unfinished');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      const data = await MockDb.getJobs(currentUser);
      setJobs(data);
      setLoading(false);
    };
    fetchJobs();
  }, [currentUser]);

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

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

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(job => job.status === statusFilter);
    }

    // Date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    switch (dateFilter) {
      case 'today':
        result = result.filter(job => {
          const jobDate = new Date(job.scheduled_date || job.created_at);
          return jobDate >= today && jobDate <= todayEnd;
        });
        break;
      case 'unfinished':
        result = result.filter(job => 
          job.status !== JobStatus.COMPLETED
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

    // Sort by date (newest first), with priority for emergency jobs
    result.sort((a, b) => {
      // Emergency jobs first
      if (a.priority === 'Emergency' && b.priority !== 'Emergency') return -1;
      if (b.priority === 'Emergency' && a.priority !== 'Emergency') return 1;
      
      // Then by date
      const dateA = new Date(a.scheduled_date || a.created_at).getTime();
      const dateB = new Date(b.scheduled_date || b.created_at).getTime();
      return dateB - dateA;
    });

    return result;
  }, [jobs, searchQuery, dateFilter, statusFilter, customDateFrom, customDateTo]);

  const getStatusColor = (status: JobStatus) => {
    switch(status) {
      case JobStatus.NEW: return 'bg-blue-100 text-blue-800';
      case JobStatus.ASSIGNED: return 'bg-indigo-100 text-indigo-800';
      case JobStatus.IN_PROGRESS: return 'bg-amber-100 text-amber-800';
      case JobStatus.AWAITING_FINALIZATION: return 'bg-purple-100 text-purple-800';
      case JobStatus.COMPLETED: return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getJobTypeColor = (type?: JobType) => {
    switch(type) {
      case JobType.SERVICE: return 'bg-green-50 text-green-700 border-green-200';
      case JobType.REPAIR: return 'bg-orange-50 text-orange-700 border-orange-200';
      case JobType.CHECKING: return 'bg-purple-50 text-purple-700 border-purple-200';
      case JobType.ACCIDENT: return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('unfinished');
    setStatusFilter('all');
    setCustomDateFrom('');
    setCustomDateTo('');
  };

  const hasActiveFilters = searchQuery || dateFilter !== 'unfinished' || statusFilter !== 'all';

  // Count jobs by status for quick stats
  const statusCounts = useMemo(() => {
    return {
      total: jobs.length,
      new: jobs.filter(j => j.status === JobStatus.NEW).length,
      assigned: jobs.filter(j => j.status === JobStatus.ASSIGNED).length,
      inProgress: jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
      awaiting: jobs.filter(j => j.status === JobStatus.AWAITING_FINALIZATION).length,
      completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
    };
  }, [jobs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-theme">
          {currentUser.role === 'technician' ? 'My Jobs' : 'Job Board'}
        </h1>
        {(currentUser.role === 'admin' || currentUser.role === 'supervisor') && (
          <button 
            onClick={() => navigate('/jobs/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition"
          >
            + New Job
          </button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <button
          onClick={() => { setStatusFilter('all'); setDateFilter('unfinished'); }}
          className={`p-3 rounded-lg text-center transition ${statusFilter === 'all' && dateFilter === 'unfinished' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          <div className="text-2xl font-bold">{statusCounts.total - statusCounts.completed}</div>
          <div className="text-xs opacity-70">Active</div>
        </button>
        <button
          onClick={() => setStatusFilter(JobStatus.NEW)}
          className={`p-3 rounded-lg text-center transition ${statusFilter === JobStatus.NEW ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          <div className="text-2xl font-bold">{statusCounts.new}</div>
          <div className="text-xs opacity-70">New</div>
        </button>
        <button
          onClick={() => setStatusFilter(JobStatus.ASSIGNED)}
          className={`p-3 rounded-lg text-center transition ${statusFilter === JobStatus.ASSIGNED ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          <div className="text-2xl font-bold">{statusCounts.assigned}</div>
          <div className="text-xs opacity-70">Assigned</div>
        </button>
        <button
          onClick={() => setStatusFilter(JobStatus.IN_PROGRESS)}
          className={`p-3 rounded-lg text-center transition ${statusFilter === JobStatus.IN_PROGRESS ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          <div className="text-2xl font-bold">{statusCounts.inProgress}</div>
          <div className="text-xs opacity-70">In Progress</div>
        </button>
        <button
          onClick={() => setStatusFilter(JobStatus.AWAITING_FINALIZATION)}
          className={`p-3 rounded-lg text-center transition ${statusFilter === JobStatus.AWAITING_FINALIZATION ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          <div className="text-2xl font-bold">{statusCounts.awaiting}</div>
          <div className="text-xs opacity-70">Awaiting</div>
        </button>
        <button
          onClick={() => { setStatusFilter(JobStatus.COMPLETED); setDateFilter('all'); }}
          className={`p-3 rounded-lg text-center transition ${statusFilter === JobStatus.COMPLETED ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          <div className="text-2xl font-bold">{statusCounts.completed}</div>
          <div className="text-xs opacity-70">Completed</div>
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="card-theme p-4 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search jobs, customers, forklifts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-theme focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
              className="appearance-none pl-4 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-theme focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer min-w-[160px]"
            >
              <option value="unfinished">🔄 Unfinished</option>
              <option value="today">📅 Today</option>
              <option value="week">📆 This Week</option>
              <option value="month">🗓️ This Month</option>
              <option value="all">📋 All Jobs</option>
              <option value="custom">🔍 Custom Range</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Toggle Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 rounded-lg border transition flex items-center gap-2 ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-slate-200 dark:border-slate-600 text-theme-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}
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
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <label className="text-sm text-theme-muted">From:</label>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-theme text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-theme-muted">To:</label>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-theme text-sm"
              />
            </div>
          </div>
        )}

        {/* Additional Filters (expandable) */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <label className="text-sm text-theme-muted">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-theme text-sm"
              >
                <option value="all">All Statuses</option>
                <option value={JobStatus.NEW}>New</option>
                <option value={JobStatus.ASSIGNED}>Assigned</option>
                <option value={JobStatus.IN_PROGRESS}>In Progress</option>
                <option value={JobStatus.AWAITING_FINALIZATION}>Awaiting Finalization</option>
                <option value={JobStatus.COMPLETED}>Completed</option>
              </select>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="text-sm text-theme-muted">
          Showing {filteredJobs.length} of {jobs.length} jobs
        </div>
      </div>

      {/* Job Cards Grid */}
      {loading ? (
        <div className="text-center py-12 text-theme-muted">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p>Loading jobs...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map(job => (
            <div 
              key={job.job_id} 
              onClick={() => navigate(`/jobs/${job.job_id}`)}
              className="card-theme p-5 rounded-xl hover:shadow-theme transition cursor-pointer group theme-transition"
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
                </div>
                {job.priority === 'Emergency' && (
                  <span className="text-xs font-bold text-red-600 animate-pulse">EMERGENCY</span>
                )}
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
                  <span>{job.customer?.name || 'Unknown customer'}</span>
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
    </div>
  );
};

export default JobBoard;

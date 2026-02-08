import { Loader2 } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { Employee,Job,User } from '../../types';

import EmptyState from './components/EmptyState';
import FilterBar from './components/FilterBar';
import JobCard from './components/JobCard';
import StatsGrid from './components/StatsGrid';
import { useJobFilters } from './hooks/useJobFilters';

interface TechnicianJobsTabProps {
  employee: Employee;
  currentUser: User;
}

const TechnicianJobsTab: React.FC<TechnicianJobsTabProps> = ({ employee, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);

  const {
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
    filteredJobs,
    stats,
    hasActiveFilters,
    clearFilters,
  } = useJobFilters(jobs);

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
    } catch (_error) {
      showToast.error('Failed to load job history');
    } finally {
      setLoading(false);
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
      <StatsGrid
        currentJobsCount={stats.currentJobs.length}
        completedTotal={stats.completedTotal}
        completedThisMonth={stats.completedThisMonth}
      />

      {/* Filter Tabs */}
      <FilterBar
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        currentJobsCount={stats.currentJobs.length}
        completedTotal={stats.completedTotal}
        totalJobs={jobs.length}
      />

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <EmptyState filterMode={filterMode} />
      ) : (
        <div className="card-theme rounded-xl overflow-hidden divide-y divide-[var(--border-subtle)]">
          {filteredJobs.map((job) => (
            <JobCard key={job.job_id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TechnicianJobsTab;

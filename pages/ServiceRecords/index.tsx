import React,{ useEffect,useMemo,useState } from 'react';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { Job,JobStatus,User } from '../../types';
import ServiceRecordsFilters from './ServiceRecordsFilters';
import ServiceRecordsLoading from './ServiceRecordsLoading';
import ServiceRecordsTable from './ServiceRecordsTable';
import { openServiceReportPDF } from './ServiceReportPDF';

interface ServiceRecordsProps {
  currentUser: User;
  hideHeader?: boolean;
}

/**
 * Service Records page - displays completed jobs with service reports
 * Allows filtering by customer, technician, and date range
 */
const ServiceRecords: React.FC<ServiceRecordsProps> = ({ currentUser, hideHeader = false }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter state
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterTechnician, setFilterTechnician] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getJobs(currentUser);
      // Only show completed or awaiting finalization jobs (have service reports)
      const completedJobs = data.filter(j => 
        j.status === JobStatus.COMPLETED || 
        j.status === JobStatus.AWAITING_FINALIZATION
      );
      setJobs(completedJobs);
    } catch (_error) {
      showToast.error('Failed to load service records');
    }
    setLoading(false);
  };

  // Get unique values for filters
  const uniqueCustomers = useMemo(() => {
    const customers = [...new Set(jobs.map(j => j.customer?.name))].filter(Boolean).sort();
    return customers as string[];
  }, [jobs]);

  const uniqueTechnicians = useMemo(() => {
    const techs = [...new Set(jobs.map(j => j.assigned_technician_name))].filter(Boolean).sort();
    return techs as string[];
  }, [jobs]);

  // Filtered jobs based on search and filter criteria
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        (job.title || '').toLowerCase().includes(searchLower) ||
        (job.customer?.name || '').toLowerCase().includes(searchLower) ||
        (job.forklift?.serial_number || '').toLowerCase().includes(searchLower) ||
        (job.forklift?.make || '').toLowerCase().includes(searchLower) ||
        (job.forklift?.model || '').toLowerCase().includes(searchLower) ||
        (job.assigned_technician_name || '').toLowerCase().includes(searchLower) ||
        (job.job_id || '').toLowerCase().includes(searchLower);

      // Customer filter
      const matchesCustomer = filterCustomer === 'all' || job.customer?.name === filterCustomer;

      // Technician filter
      const matchesTechnician = filterTechnician === 'all' || job.assigned_technician_name === filterTechnician;

      // Date filter
      const jobDate = new Date(job.completion_time || job.created_at);
      const matchesDateFrom = !filterDateFrom || jobDate >= new Date(filterDateFrom);
      const matchesDateTo = !filterDateTo || jobDate <= new Date(filterDateTo + 'T23:59:59');

      return matchesSearch && matchesCustomer && matchesTechnician && matchesDateFrom && matchesDateTo;
    });
  }, [jobs, searchQuery, filterCustomer, filterTechnician, filterDateFrom, filterDateTo]);

  // Check if any filters are active (for empty state message)
  const hasActiveFilters = searchQuery || filterCustomer !== 'all' || filterTechnician !== 'all' || filterDateFrom || filterDateTo;

  // Handle viewing/printing service report
  const handleViewServiceReport = (job: Job) => {
    openServiceReportPDF(job);
  };

  if (loading) {
    return <ServiceRecordsLoading hideHeader={hideHeader} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-theme">Service Records</h1>
            <p className="text-sm text-theme-muted mt-1">
              {filteredJobs.length} of {jobs.length} records
            </p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <ServiceRecordsFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterCustomer={filterCustomer}
        setFilterCustomer={setFilterCustomer}
        filterTechnician={filterTechnician}
        setFilterTechnician={setFilterTechnician}
        filterDateFrom={filterDateFrom}
        setFilterDateFrom={setFilterDateFrom}
        filterDateTo={filterDateTo}
        setFilterDateTo={setFilterDateTo}
        uniqueCustomers={uniqueCustomers}
        uniqueTechnicians={uniqueTechnicians}
      />

      {/* Records Table */}
      <ServiceRecordsTable
        jobs={filteredJobs}
        onViewServiceReport={handleViewServiceReport}
        hasFilters={hasActiveFilters}
      />
    </div>
  );
};

export default ServiceRecords;

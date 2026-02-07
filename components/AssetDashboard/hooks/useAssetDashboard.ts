import { useState, useEffect, useMemo } from 'react';
import { User } from '../../../types';
import { SupabaseDb, supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import {
  OperationalStatus, ForkliftWithStatus, ForkliftDbRow,
  RentalQueryResult, StatusCounts, DashboardMetrics
} from '../types';

interface UseAssetDashboardParams {
  currentUser: User;
}

export function useAssetDashboard({ currentUser }: UseAssetDashboardParams) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forklifts, setForklifts] = useState<ForkliftWithStatus[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({ 
    jobs_completed_30d: 0, 
    avg_job_duration_hours: 0 
  });
  const [activeFilter, setActiveFilter] = useState<OperationalStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(5);

  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const forkliftData = await SupabaseDb.getForkliftsWithCustomers();
      
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('forklift_rentals')
        .select(`
          rental_id,
          forklift_id,
          customer_id,
          status,
          customers (name)
        `)
        .eq('status', 'active');
      
      if (rentalsError) {
        console.error('Error fetching rentals:', rentalsError);
      }
      
      const jobsData = await SupabaseDb.getJobs(currentUser);
      const openJobs = jobsData.filter(j => 
        !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)
      );

      // Build lookups
      const rentalLookup = new Map<string, { customer_id: string; customer_name: string }>();
      ((rentalsData || []) as unknown as RentalQueryResult[]).forEach((r) => {
        rentalLookup.set(r.forklift_id, {
          customer_id: r.customer_id,
          customer_name: r.customers?.name || 'Unknown'
        });
      });

      const openJobLookup = new Map<string, string>();
      openJobs.forEach(j => {
        if (j.forklift_id) openJobLookup.set(j.forklift_id, j.job_id);
      });

      // Process forklifts
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const processedForklifts: ForkliftWithStatus[] = (forkliftData as ForkliftDbRow[]).map((f) => {
        const rental = rentalLookup.get(f.forklift_id);
        const openJobId = openJobLookup.get(f.forklift_id);
        const hasOpenJob = !!openJobId;

        const isServiceDueByDate = f.next_service_due && new Date(f.next_service_due) <= sevenDaysFromNow;
        const hoursUntilService = f.next_service_hourmeter ? f.next_service_hourmeter - f.hourmeter : null;
        const isServiceDueByHours = hoursUntilService !== null && hoursUntilService <= 50;
        const isServiceDue = isServiceDueByDate || isServiceDueByHours;

        let operationalStatus: OperationalStatus;
        const secondaryBadges: string[] = [];

        if (f.status === 'Inactive' || f.status === 'Out of Service') {
          operationalStatus = 'out_of_service';
        } else if (f.status === 'Awaiting Parts') {
          operationalStatus = 'awaiting_parts';
          if (isServiceDue) secondaryBadges.push('Due');
        } else if (f.status === 'Reserved') {
          operationalStatus = 'reserved';
          if (isServiceDue) secondaryBadges.push('Due');
        } else if (rental) {
          operationalStatus = 'rented_out';
          if (hasOpenJob) secondaryBadges.push('In Service');
          if (isServiceDue) secondaryBadges.push('Due');
        } else if (hasOpenJob) {
          operationalStatus = 'in_service';
          if (isServiceDue) secondaryBadges.push('Due');
        } else if (isServiceDue) {
          operationalStatus = 'service_due';
        } else {
          operationalStatus = 'available';
        }

        return {
          forklift_id: f.forklift_id,
          serial_number: f.serial_number,
          make: f.make,
          model: f.model,
          type: f.type,
          hourmeter: f.hourmeter,
          status: f.status,
          next_service_due: f.next_service_due,
          next_service_hourmeter: f.next_service_hourmeter ?? null,
          current_customer_id: f.current_customer_id ?? null,
          current_customer_name: f.current_customer?.name || null,
          rental_customer_id: rental?.customer_id || null,
          rental_customer_name: rental?.customer_name || null,
          has_open_job: hasOpenJob,
          open_job_id: openJobId || null,
          operational_status: operationalStatus,
          secondary_badges: secondaryBadges
        };
      });

      setForklifts(processedForklifts);

      // Calculate metrics
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const completedJobs = jobsData.filter(j => 
        j.status === 'Completed' && 
        j.completed_at && 
        new Date(j.completed_at) >= thirtyDaysAgo
      );

      let totalDurationHours = 0;
      let jobsWithDuration = 0;
      completedJobs.forEach(j => {
        if (j.started_at && j.completed_at) {
          const duration = (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / (1000 * 60 * 60);
          if (duration > 0 && duration < 24 * 7) {
            totalDurationHours += duration;
            jobsWithDuration++;
          }
        }
      });

      setMetrics({
        jobs_completed_30d: completedJobs.length,
        avg_job_duration_hours: jobsWithDuration > 0 ? totalDurationHours / jobsWithDuration : 0
      });

    } catch (error) {
      console.error('Dashboard load error:', error);
      showToast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Computed: status counts
  const statusCounts = useMemo<StatusCounts>(() => {
    const counts: StatusCounts = {
      out_of_service: 0,
      rented_out: 0,
      in_service: 0,
      service_due: 0,
      awaiting_parts: 0,
      reserved: 0,
      available: 0,
      total: forklifts.length
    };
    forklifts.forEach(f => counts[f.operational_status]++);
    return counts;
  }, [forklifts]);

  // Computed: filtered forklifts
  const filteredForklifts = useMemo(() => {
    let result = forklifts;

    if (activeFilter !== 'all') {
      result = result.filter(f => f.operational_status === activeFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.serial_number.toLowerCase().includes(query) ||
        f.make.toLowerCase().includes(query) ||
        f.model.toLowerCase().includes(query) ||
        (f.rental_customer_name || '').toLowerCase().includes(query) ||
        (f.current_customer_name || '').toLowerCase().includes(query)
      );
    }

    return result;
  }, [forklifts, activeFilter, searchQuery]);

  const displayedForklifts = useMemo(() => {
    return filteredForklifts.slice(0, displayLimit);
  }, [filteredForklifts, displayLimit]);

  const hasMore = filteredForklifts.length > displayLimit;

  const handleFilterChange = (status: OperationalStatus | 'all') => {
    setActiveFilter(status);
    setDisplayLimit(5);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setDisplayLimit(5);
  };

  return {
    loading,
    refreshing,
    forklifts: displayedForklifts,
    filteredCount: filteredForklifts.length,
    totalCount: forklifts.length,
    statusCounts,
    metrics,
    activeFilter,
    searchQuery,
    displayLimit,
    hasMore,
    refresh: () => loadDashboardData(true),
    setActiveFilter: handleFilterChange,
    setSearchQuery: handleSearchChange,
    setDisplayLimit,
    clearFilter: () => handleFilterChange('all')
  };
}

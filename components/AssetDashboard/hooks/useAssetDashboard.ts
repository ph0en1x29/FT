import { useEffect,useMemo,useState } from 'react';
import { getForkliftsDueForService } from '../../../services/servicePredictionService';
import { SupabaseDb,supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { User,UserRole } from '../../../types';
import {
DashboardMetrics,
ForkliftDbRow,
ForkliftWithStatus,
OperationalStatus,
RentalQueryResult,StatusCounts
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
      // Open jobs — lightweight: only job_id, forklift_id, status (no relations)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      let openJobsQuery = supabase
        .from('jobs')
        .select('job_id, forklift_id, status')
        .is('deleted_at', null)
        .not('status', 'in', '("Completed","Cancelled","Completed Awaiting Ack")');

      // Respect technician role: only show assigned jobs
      if (currentUser.role === UserRole.TECHNICIAN) {
        openJobsQuery = openJobsQuery.eq('assigned_technician_id', currentUser.user_id);
      }

      // Completed jobs in last 30 days — lightweight for metrics
      let metricsQuery = supabase
        .from('jobs')
        .select('job_id, started_at, completed_at')
        .is('deleted_at', null)
        .eq('status', 'Completed')
        .gte('completed_at', thirtyDaysAgo);

      if (currentUser.role === UserRole.TECHNICIAN) {
        metricsQuery = metricsQuery.eq('assigned_technician_id', currentUser.user_id);
      }

      // Active rentals query
      const rentalsQuery = supabase
        .from('forklift_rentals')
        .select(`
          rental_id,
          forklift_id,
          customer_id,
          status,
          end_date,
          customers (name)
        `)
        .eq('status', 'active');

      // Parallel fetch: lightweight forklifts, fleet counts RPC, rentals, jobs, metrics
      const [
        forkliftData,
        fleetCounts,
        { data: rentalsData, error: rentalsError },
        { data: openJobsData, error: openJobsError },
        { data: completedJobsData }
      ] = await Promise.all([
        SupabaseDb.getForkliftsLightweightForDashboard(),
        SupabaseDb.getFleetStatusCounts(),
        rentalsQuery,
        openJobsQuery,
        metricsQuery,
      ]);

      if (openJobsError) {
        console.error('Error fetching open jobs:', openJobsError);
      }

      // Build lookups
      const rentalLookup = new Map<string, { customer_id: string; customer_name: string; end_date: string | null }>();
      ((rentalsData || []) as unknown as RentalQueryResult[]).forEach((r) => {
        rentalLookup.set(r.forklift_id, {
          customer_id: r.customer_id,
          customer_name: r.customers?.name || 'Unknown',
          end_date: r.end_date || null
        });
      });

      const openJobLookup = new Map<string, string>();
      (openJobsData || []).forEach((j: { job_id: string; forklift_id: string | null; status: string }) => {
        if (j.forklift_id) openJobLookup.set(j.forklift_id, j.job_id);
      });

      // Get service-due forklifts from unified source (same as Service Due tab)
      const serviceDueList = await getForkliftsDueForService(7);
      const serviceDueIds = new Set(serviceDueList.map(f => f.forklift_id));

      // Process forklifts
      const processedForklifts: ForkliftWithStatus[] = (forkliftData as ForkliftDbRow[]).map((f) => {
        const rental = rentalLookup.get(f.forklift_id);
        const openJobId = openJobLookup.get(f.forklift_id);
        const hasOpenJob = !!openJobId;

        const isServiceDue = serviceDueIds.has(f.forklift_id);

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
      setRpcFleetCounts(fleetCounts);

      // Calculate metrics from the lightweight completed-jobs query
      let totalDurationHours = 0;
      let jobsWithDuration = 0;
      (completedJobsData || []).forEach((j: { job_id: string; started_at: string | null; completed_at: string | null }) => {
        if (j.started_at && j.completed_at) {
          const duration = (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / (1000 * 60 * 60);
          if (duration > 0 && duration < 24 * 7) {
            totalDurationHours += duration;
            jobsWithDuration++;
          }
        }
      });

      setMetrics({
        jobs_completed_30d: (completedJobsData || []).length,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store RPC fleet counts for header
  const [rpcFleetCounts, setRpcFleetCounts] = useState<{
    total: number;
    rented_out: number;
    available: number;
    out_of_service: number;
    awaiting_parts: number;
    reserved: number;
  } | null>(null);

  // Computed: status counts
  const statusCounts = useMemo<StatusCounts>(() => {
    // Start with client-side counts from forklifts array (capped at 1000 by PostgREST)
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

    // Override with accurate RPC counts where available (not capped by max_rows)
    if (rpcFleetCounts) {
      counts.total = rpcFleetCounts.total;
      counts.rented_out = rpcFleetCounts.rented_out;
      counts.available = rpcFleetCounts.available;
      counts.out_of_service = rpcFleetCounts.out_of_service;
      counts.awaiting_parts = rpcFleetCounts.awaiting_parts;
      counts.reserved = rpcFleetCounts.reserved;
    }
    
    return counts;
  }, [forklifts, rpcFleetCounts]);

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
    allFilteredForklifts: filteredForklifts,
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

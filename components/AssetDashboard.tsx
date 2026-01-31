import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { SupabaseDb } from '../services/supabaseService';
import { supabase } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import {
  Truck, Wrench, AlertTriangle, CheckCircle, XCircle,
  Clock, Building2, Loader2, Plus, Search, Filter,
  ChevronRight, Gauge, Calendar, RefreshCw, ChevronDown, ChevronUp,
  Package, CalendarClock
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AssetDashboardProps {
  currentUser: User;
}

type OperationalStatus = 'out_of_service' | 'rented_out' | 'in_service' | 'service_due' | 'awaiting_parts' | 'reserved' | 'available';

interface ForkliftWithStatus {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: string;
  hourmeter: number;
  status: string; // DB status: Active/Inactive
  next_service_due: string | null;
  next_service_hourmeter: number | null;
  current_customer_id: string | null;
  current_customer_name: string | null;
  rental_customer_id: string | null;
  rental_customer_name: string | null;
  has_open_job: boolean;
  open_job_id: string | null;
  operational_status: OperationalStatus;
  secondary_badges: string[];
}

interface StatusCounts {
  out_of_service: number;
  rented_out: number;
  in_service: number;
  service_due: number;
  awaiting_parts: number;
  reserved: number;
  available: number;
  total: number;
}

interface DashboardMetrics {
  jobs_completed_30d: number;
  avg_job_duration_hours: number;
}

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

const STATUS_CONFIG: Record<OperationalStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  description: string;
}> = {
  out_of_service: {
    label: 'Out of Service',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: XCircle,
    description: 'Decommissioned or major repair'
  },
  rented_out: {
    label: 'Rented Out',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: Building2,
    description: 'Currently with customers'
  },
  in_service: {
    label: 'In Service',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: Wrench,
    description: 'Under maintenance/repair'
  },
  service_due: {
    label: 'Service Due',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: AlertTriangle,
    description: 'Due within 7 days or 50 hours'
  },
  awaiting_parts: {
    label: 'Awaiting Parts',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: Package,
    description: 'Waiting for parts to complete repair'
  },
  reserved: {
    label: 'Reserved',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    icon: CalendarClock,
    description: 'Reserved for upcoming rental/job'
  },
  available: {
    label: 'Available',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    icon: CheckCircle,
    description: 'Ready for rental'
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AssetDashboard: React.FC<AssetDashboardProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forklifts, setForklifts] = useState<ForkliftWithStatus[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({ jobs_completed_30d: 0, avg_job_duration_hours: 0 });
  const [activeFilter, setActiveFilter] = useState<OperationalStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(5);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch all forklifts with customer info
      const forkliftData = await SupabaseDb.getForkliftsWithCustomers();
      
      // Fetch active rentals directly from Supabase
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('forklift_rentals')
        .select(`
          rental_id,
          forklift_id,
          customer_id,
          status,
          customers (
            name
          )
        `)
        .eq('status', 'active');
      
      if (rentalsError) {
      }
      
      // Fetch open jobs (not completed, not cancelled, not awaiting ack)
      const jobsData = await SupabaseDb.getJobs(currentUser);
      const openJobs = jobsData.filter(j => 
        !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)
      );

      // Build rental lookup
      const rentalLookup = new Map<string, { customer_id: string; customer_name: string }>();
      (rentalsData || []).forEach((r: any) => {
        rentalLookup.set(r.forklift_id, {
          customer_id: r.customer_id,
          customer_name: r.customers?.name || 'Unknown'
        });
      });

      // Build open job lookup
      const openJobLookup = new Map<string, string>();
      openJobs.forEach(j => {
        if (j.forklift_id) {
          openJobLookup.set(j.forklift_id, j.job_id);
        }
      });

      // Calculate operational status for each forklift
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const processedForklifts: ForkliftWithStatus[] = forkliftData.map((f: any) => {
        const rental = rentalLookup.get(f.forklift_id);
        const openJobId = openJobLookup.get(f.forklift_id);
        const hasOpenJob = !!openJobId;

        // Check service due conditions
        const isServiceDueByDate = f.next_service_due && new Date(f.next_service_due) <= sevenDaysFromNow;
        const hoursUntilService = f.next_service_hourmeter ? f.next_service_hourmeter - f.hourmeter : null;
        const isServiceDueByHours = hoursUntilService !== null && hoursUntilService <= 50;
        const isServiceDue = isServiceDueByDate || isServiceDueByHours;

        // Determine operational status (precedence order)
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
          next_service_hourmeter: f.next_service_hourmeter,
          current_customer_id: f.current_customer_id,
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
          if (duration > 0 && duration < 24 * 7) { // Exclude outliers > 1 week
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
      showToast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

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

    forklifts.forEach(f => {
      counts[f.operational_status]++;
    });

    return counts;
  }, [forklifts]);

  const filteredForklifts = useMemo(() => {
    let result = forklifts;

    // Filter by status
    if (activeFilter !== 'all') {
      result = result.filter(f => f.operational_status === activeFilter);
    }

    // Filter by search
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

  // Displayed forklifts (with limit)
  const displayedForklifts = useMemo(() => {
    return filteredForklifts.slice(0, displayLimit);
  }, [filteredForklifts, displayLimit]);

  const hasMore = filteredForklifts.length > displayLimit;

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateJob = (forklift: ForkliftWithStatus) => {
    // Navigate to create job with prefilled data
    const customerId = forklift.rental_customer_id || forklift.current_customer_id || '';
    navigate(`/jobs/create?forklift_id=${forklift.forklift_id}&customer_id=${customerId}`);
  };

  const handleCardClick = (status: OperationalStatus) => {
    setActiveFilter(activeFilter === status ? 'all' : status);
    setDisplayLimit(5); // Reset to collapsed when filter changes
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-theme">Fleet Overview</h2>
          <p className="text-sm text-theme-muted">
            {statusCounts.total} total units • Last updated just now
          </p>
        </div>
        <button
          onClick={() => loadDashboardData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Cards - Primary Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {(['rented_out', 'in_service', 'service_due', 'available', 'out_of_service'] as OperationalStatus[]).map((status) => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          const count = statusCounts[status];
          const isActive = activeFilter === status;

          return (
            <button
              key={status}
              onClick={() => handleCardClick(status)}
              className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                isActive
                  ? `${config.bgColor} ${config.borderColor} ring-2 ring-offset-2 ${config.borderColor.replace('border-', 'ring-')}`
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-3xl font-bold ${isActive ? config.color : 'text-slate-800'}`}>
                    {count}
                  </p>
                  <p className={`text-sm font-medium mt-1 ${isActive ? config.color : 'text-slate-600'}`}>
                    {config.label}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
              </div>
              {status === 'service_due' && (
                <p className="text-xs text-slate-500 mt-2">7 days / 50 hrs</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Status Cards - Secondary Row (Awaiting Parts & Reserved) */}
      {(statusCounts.awaiting_parts > 0 || statusCounts.reserved > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['awaiting_parts', 'reserved'] as OperationalStatus[]).map((status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            const count = statusCounts[status];
            const isActive = activeFilter === status;

            if (count === 0) return null;

            return (
              <button
                key={status}
                onClick={() => handleCardClick(status)}
                className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                  isActive
                    ? `${config.bgColor} ${config.borderColor} ring-2 ring-offset-2 ${config.borderColor.replace('border-', 'ring-')}`
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${isActive ? config.color : 'text-slate-800'}`}>
                      {count}
                    </p>
                    <p className={`text-xs font-medium ${isActive ? config.color : 'text-slate-600'}`}>
                      {config.label}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Metrics Bar */}
      <div className="flex flex-wrap gap-6 px-4 py-3 bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Jobs (30d):</span>
          <span className="text-sm font-semibold text-slate-800">{metrics.jobs_completed_30d}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Avg Duration:</span>
          <span className="text-sm font-semibold text-slate-800">
            {metrics.avg_job_duration_hours > 0 ? `${metrics.avg_job_duration_hours.toFixed(1)} hrs` : '-'}
          </span>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by S/N, make, model, customer..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDisplayLimit(5); // Reset to collapsed when searching
            }}
          />
        </div>

        {activeFilter !== 'all' && (
          <button
            onClick={() => {
              setActiveFilter('all');
              setDisplayLimit(5);
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Results Count */}
      <p className="text-sm text-slate-500">
        Showing {displayedForklifts.length} of {filteredForklifts.length} units
        {activeFilter !== 'all' && ` • Filtered by: ${STATUS_CONFIG[activeFilter].label}`}
      </p>

      {/* Forklift Table */}
      <div className="card-theme rounded-xl border border-theme overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-theme-surface-2 border-b border-theme">
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase">Serial / Model</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase">Hourmeter</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {displayedForklifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No forklifts found</p>
                  </td>
                </tr>
              ) : (
                displayedForklifts.map((forklift) => {
                  const statusConfig = STATUS_CONFIG[forklift.operational_status];
                  const StatusIcon = statusConfig.icon;
                  const customerName = forklift.rental_customer_name || forklift.current_customer_name || '-';

                  return (
                    <tr
                      key={forklift.forklift_id}
                      className="clickable-row"
                      onClick={() => navigate(`/forklifts/${forklift.forklift_id}`)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-800">{forklift.serial_number}</p>
                          <p className="text-sm text-slate-500">{forklift.make} {forklift.model}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={customerName === '-' ? 'text-slate-400' : 'text-slate-700'}>
                          {customerName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.label}
                          </span>
                          {forklift.secondary_badges.map((badge, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
                            >
                              ⚠️ {badge}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Gauge className="w-4 h-4 text-slate-400" />
                          {forklift.hourmeter.toLocaleString()} hrs
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateJob(forklift);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Create Job
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Show More / Show Less */}
        {filteredForklifts.length > 5 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-4">
            {hasMore ? (
              <>
                <button
                  onClick={() => setDisplayLimit(prev => prev + 20)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  <ChevronDown className="w-4 h-4" />
                  Show more (+20)
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => setDisplayLimit(filteredForklifts.length)}
                  className="text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Show all ({filteredForklifts.length})
                </button>
              </>
            ) : (
              <button
                onClick={() => setDisplayLimit(5)}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                <ChevronUp className="w-4 h-4" />
                Collapse
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetDashboard;

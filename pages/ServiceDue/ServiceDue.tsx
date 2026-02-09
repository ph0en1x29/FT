import { Clock, Play, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { SupabaseDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { ServiceDueTable, ServiceStatsCards } from './components';

const CALENDAR_INTERVAL_DAYS = 90;

export interface ForkliftDue {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: string;
  hourmeter: number;
  tracking_type: 'hourmeter' | 'calendar';
  // Hourmeter-based fields
  current_hourmeter: number | null;
  last_service_hourmeter: number | null;
  next_service_hourmeter: number | null;
  hours_until_service: number | null;
  avg_daily_hours: number | null;
  confidence: string | null;
  // Shared fields
  last_service_date: string | null;
  predicted_date: string | null;
  days_remaining: number | null;
  service_urgency: string;
  is_overdue: boolean;
  has_open_job: boolean;
}

const validFilters = ['all', 'overdue', 'due_soon', 'job_created'] as const;
type FilterType = typeof validFilters[number];

const ServiceDue: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  const [loading, setLoading] = useState(true);
  const [dueForklifts, setDueForklifts] = useState<ForkliftDue[]>([]);
  const [filter, setFilter] = useState<FilterType>(
    validFilters.includes(initialFilter as FilterType) ? initialFilter as FilterType : 'all'
  );
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Get hourmeter-based forklifts from prediction view
      const { data: hourmeterData, error: hmError } = await supabase
        .from('v_forklift_service_predictions')
        .select('*')
        .order('days_remaining', { ascending: true, nullsFirst: false });

      if (hmError) throw hmError;

      // 2. Get electric forklifts for calendar-based tracking
      const { data: electricData, error: elError } = await supabase
        .from('forklifts')
        .select('forklift_id, serial_number, make, model, type, hourmeter, last_service_date, status')
        .in('type', ['Electric']);

      if (elError) throw elError;

      // 3. Check for open service jobs
      const allForkliftIds = [
        ...(hourmeterData || []).map(f => f.forklift_id),
        ...(electricData || []).map(f => f.forklift_id),
      ];

      const { data: openJobs } = await supabase
        .from('jobs')
        .select('forklift_id')
        .in('forklift_id', allForkliftIds)
        .in('job_type', ['Service', 'Full Service', 'Minor Service'])
        .not('status', 'in', '("Completed","Cancelled")')
        .is('deleted_at', null);

      const forkliftIdsWithJobs = new Set((openJobs || []).map(j => j.forklift_id));

      // 4. Map hourmeter-based forklifts
      const hourmeterForklifts: ForkliftDue[] = (hourmeterData || []).map(f => {
        const hoursUntil = f.hours_until_service ? Number(f.hours_until_service) : null;
        const daysRem = f.days_remaining ?? null;
        const isOverdue = hoursUntil !== null && hoursUntil <= 0;
        return {
          forklift_id: f.forklift_id,
          serial_number: f.serial_number,
          make: f.make,
          model: f.model,
          type: f.type,
          hourmeter: f.current_hourmeter,
          tracking_type: 'hourmeter' as const,
          current_hourmeter: f.current_hourmeter,
          last_service_hourmeter: f.last_service_hourmeter,
          next_service_hourmeter: f.next_service_hourmeter ? Number(f.next_service_hourmeter) : null,
          hours_until_service: hoursUntil,
          avg_daily_hours: f.avg_daily_hours ? Number(f.avg_daily_hours) : null,
          confidence: f.confidence,
          last_service_date: f.last_service_date,
          predicted_date: f.predicted_date,
          days_remaining: daysRem,
          service_urgency: f.service_urgency,
          is_overdue: isOverdue,
          has_open_job: forkliftIdsWithJobs.has(f.forklift_id),
        };
      });

      // 5. Map electric forklifts (calendar-based)
      const electricForklifts: ForkliftDue[] = (electricData || []).map(f => {
        const lastService = f.last_service_date ? new Date(f.last_service_date) : null;
        const nextServiceDate = lastService
          ? new Date(lastService.getTime() + CALENDAR_INTERVAL_DAYS * 24 * 60 * 60 * 1000)
          : null;
        const today = new Date();
        const daysRem = nextServiceDate
          ? Math.ceil((nextServiceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const isOverdue = daysRem !== null && daysRem <= 0;
        const urgency = isOverdue ? 'overdue'
          : daysRem !== null && daysRem <= 7 ? 'due_soon'
          : daysRem !== null && daysRem <= 14 ? 'upcoming'
          : 'ok';

        return {
          forklift_id: f.forklift_id,
          serial_number: f.serial_number,
          make: f.make,
          model: f.model,
          type: f.type,
          hourmeter: f.hourmeter || 0,
          tracking_type: 'calendar' as const,
          current_hourmeter: null,
          last_service_hourmeter: null,
          next_service_hourmeter: null,
          hours_until_service: null,
          avg_daily_hours: null,
          confidence: null,
          last_service_date: f.last_service_date,
          predicted_date: nextServiceDate?.toISOString().split('T')[0] || null,
          days_remaining: daysRem,
          service_urgency: urgency,
          is_overdue: isOverdue,
          has_open_job: forkliftIdsWithJobs.has(f.forklift_id),
        };
      });

      // 6. Combine and sort — overdue first, then by days remaining
      const all = [...hourmeterForklifts, ...electricForklifts].sort((a, b) => {
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        return (a.days_remaining ?? 999) - (b.days_remaining ?? 999);
      });

      setDueForklifts(all);
    } catch (_e) {
      showToast.error('Failed to load service due data');
    } finally {
      setLoading(false);
    }
  };

  const runDailyCheck = async () => {
    setRunning(true);
    setLastResult(null);

    try {
      const result = await SupabaseDb.runDailyServiceCheck();
      setLastResult(`Created ${result.jobs_created} jobs, ${result.notifications_created} notifications`);
      showToast.success(`Created ${result.jobs_created} jobs`);
      await loadData();
    } catch (e) {
      setLastResult(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      showToast.error('Daily service check failed');
    } finally {
      setRunning(false);
    }
  };

  // Filter
  const filteredForklifts = dueForklifts.filter(f => {
    if (filter === 'overdue') return f.is_overdue;
    if (filter === 'due_soon') return !f.is_overdue && !f.has_open_job;
    if (filter === 'job_created') return f.has_open_job;
    return true;
  });

  // Stats
  const stats = {
    total: dueForklifts.length,
    overdue: dueForklifts.filter(f => f.is_overdue).length,
    dueSoon: dueForklifts.filter(f => !f.is_overdue && !f.has_open_job).length,
    withJobs: dueForklifts.filter(f => f.has_open_job).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-theme">Service Due</h1>
        <div className="text-center py-12 text-theme-muted">Loading service data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme">Service Due</h1>
          <p className="text-theme-muted text-sm mt-1">All forklifts — hourmeter &amp; calendar-based tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-theme-surface-2 border border-theme rounded-lg text-theme hover:bg-theme-surface-3 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={runDailyCheck}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            {running ? 'Running...' : 'Run Service Check'}
          </button>
        </div>
      </div>

      {/* Result Message */}
      {lastResult && (
        <div className={`p-3 rounded-lg text-sm ${
          lastResult.startsWith('Error')
            ? 'bg-red-500/20 text-red-600 border border-red-500/30'
            : 'bg-green-500/20 text-green-600 border border-green-500/30'
        }`}>
          {lastResult.startsWith('Error') ? '❌' : '✅'} {lastResult}
        </div>
      )}

      {/* Stats Cards */}
      <ServiceStatsCards stats={stats} filter={filter} setFilter={setFilter} />

      {/* Forklifts Table */}
      <ServiceDueTable forklifts={filteredForklifts} filter={filter} setFilter={setFilter} />

      {/* Info Box */}
      <div className="card-theme p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-theme-muted">
            <p className="font-medium text-theme mb-1">Service Tracking</p>
            <p>Diesel/LPG/Petrol units tracked by hourmeter (hours-based intervals). Electric units tracked by calendar (every 90 days). Click any row to view full service details.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDue;

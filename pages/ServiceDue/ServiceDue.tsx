import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SupabaseDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { Clock, RefreshCw, Play } from 'lucide-react';
import { ServiceStatsCards, ServiceDueTable } from './components';

interface ForkliftDue {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: string;
  hourmeter: number;
  next_service_due: string | null;
  next_service_hourmeter: number | null;
  days_until_due: number | null;
  hours_until_due: number | null;
  is_overdue: boolean;
  has_open_job: boolean;
  current_customer_id?: string;
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
      const forklifts = await SupabaseDb.getForkliftsDueForService(30);
      setDueForklifts(forklifts);
    } catch (e) {
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

  // Filter data
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
          <p className="text-theme-muted text-sm mt-1">Forklifts requiring scheduled maintenance</p>
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
            <p className="font-medium text-theme mb-1">Automatic Service Checks</p>
            <p>Service checks run daily at 8:00 AM. Jobs are automatically created for overdue forklifts, and notifications are sent to supervisors.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDue;

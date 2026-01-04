import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SupabaseDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import { 
  AlertTriangle, Calendar, CheckCircle, Clock, Truck, 
  ChevronRight, Filter, RefreshCw, Play, Wrench
} from 'lucide-react';

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

const ServiceDue: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';
  
  const [loading, setLoading] = useState(true);
  const [dueForklifts, setDueForklifts] = useState<ForkliftDue[]>([]);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'due_soon' | 'job_created'>(initialFilter as any);
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
      console.error('Failed to load service due data:', e);
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
    } catch (e: any) {
      setLastResult(`Error: ${e.message}`);
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter('all')}
          className={`card-theme p-4 rounded-xl text-left transition-all ${
            filter === 'all' ? 'ring-2 ring-blue-500' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-theme-muted text-sm mb-1">
            <Truck className="w-4 h-4" />
            Total Due
          </div>
          <div className="text-2xl font-bold text-theme">{stats.total}</div>
        </button>

        <button
          onClick={() => setFilter('overdue')}
          className={`card-theme p-4 rounded-xl text-left transition-all ${
            filter === 'overdue' ? 'ring-2 ring-red-500' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-theme-muted text-sm mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Overdue
          </div>
          <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
        </button>

        <button
          onClick={() => setFilter('due_soon')}
          className={`card-theme p-4 rounded-xl text-left transition-all ${
            filter === 'due_soon' ? 'ring-2 ring-yellow-500' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-theme-muted text-sm mb-1">
            <Calendar className="w-4 h-4 text-yellow-500" />
            Due Soon
          </div>
          <div className="text-2xl font-bold text-yellow-500">{stats.dueSoon}</div>
        </button>

        <button
          onClick={() => setFilter('job_created')}
          className={`card-theme p-4 rounded-xl text-left transition-all ${
            filter === 'job_created' ? 'ring-2 ring-green-500' : ''
          }`}
        >
          <div className="flex items-center gap-2 text-theme-muted text-sm mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Job Created
          </div>
          <div className="text-2xl font-bold text-green-500">{stats.withJobs}</div>
        </button>
      </div>

      {/* Forklifts Table */}
      <div className="card-theme rounded-xl overflow-hidden">
        <div className="p-4 border-b border-theme flex items-center justify-between">
          <h2 className="font-semibold text-theme">
            {filter === 'all' ? 'All Forklifts Due' : 
             filter === 'overdue' ? 'Overdue Forklifts' :
             filter === 'due_soon' ? 'Due Soon (No Job Yet)' :
             'With Service Job Created'}
            <span className="ml-2 text-theme-muted font-normal">({filteredForklifts.length})</span>
          </h2>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-sm text-blue-500 hover:text-blue-600"
            >
              Show All
            </button>
          )}
        </div>

        {filteredForklifts.length === 0 ? (
          <div className="p-8 text-center text-theme-muted">
            <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No forklifts match this filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-theme-muted bg-theme-surface-2">
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Serial Number</th>
                  <th className="px-4 py-3 font-medium">Make / Model</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Hourmeter</th>
                  <th className="px-4 py-3 font-medium">Next Service</th>
                  <th className="px-4 py-3 font-medium">Time Until Due</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {filteredForklifts.map(f => (
                  <tr 
                    key={f.forklift_id} 
                    className="hover:bg-theme-surface-2 transition-colors cursor-pointer"
                    onClick={() => navigate(`/forklifts/${f.forklift_id}`)}
                  >
                    <td className="px-4 py-3">
                      {f.has_open_job ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-600 rounded text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Job Created
                        </span>
                      ) : f.is_overdue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-600 rounded text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          Overdue
                        </span>
                      ) : f.days_until_due !== null && f.days_until_due <= 3 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-600 rounded text-xs font-medium">
                          <Clock className="w-3 h-3" />
                          Urgent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-600 rounded text-xs font-medium">
                          <Calendar className="w-3 h-3" />
                          Upcoming
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-theme">{f.serial_number}</td>
                    <td className="px-4 py-3 text-theme">{f.make} {f.model}</td>
                    <td className="px-4 py-3 text-theme-muted">{f.type}</td>
                    <td className="px-4 py-3 text-theme">{f.hourmeter?.toLocaleString()} hrs</td>
                    <td className="px-4 py-3 text-theme">
                      {f.next_service_due 
                        ? new Date(f.next_service_due).toLocaleDateString()
                        : <span className="text-theme-muted">Not set</span>}
                    </td>
                    <td className="px-4 py-3">
                      {f.days_until_due !== null && (
                        <span className={f.days_until_due < 0 ? 'text-red-500 font-medium' : 'text-theme'}>
                          {f.days_until_due < 0 ? `${Math.abs(f.days_until_due)} days ago` : `${f.days_until_due} days`}
                        </span>
                      )}
                      {f.hours_until_due !== null && (
                        <span className={`ml-2 text-xs ${f.hours_until_due <= 0 ? 'text-red-400' : 'text-theme-muted'}`}>
                          ({f.hours_until_due} hrs)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-theme-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole, FleetServiceOverview, DailyUsageResult } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { getFleetServiceOverview, getForkliftDailyUsage } from '../../../services/serviceTrackingService';
import { showToast } from '../../../services/toastService';
import {
  CheckCircle, Clock, AlertTriangle, ChevronRight, Loader2, Play, TrendingUp, TrendingDown, Minus, AlertOctagon
} from 'lucide-react';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { TabProps, ForkliftDue } from '../types';

const ServiceDueTab: React.FC<TabProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dueForklifts, setDueForklifts] = useState<ForkliftDue[]>([]);
  const [fleetOverview, setFleetOverview] = useState<FleetServiceOverview[]>([]);
  const [dailyUsage, setDailyUsage] = useState<Record<string, DailyUsageResult>>({});
  const [filter, setFilter] = useState<'all' | 'overdue' | 'due_soon' | 'job_created' | 'stale'>('all');
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const { displayRole } = useDevModeContext();

  const isAdmin = [
    UserRole.ADMIN,
    UserRole.ADMIN_SERVICE,
    UserRole.ADMIN_STORE,
    UserRole.SUPERVISOR,
  ].includes(displayRole);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load both old data and new fleet overview
      const [forklifts, overview] = await Promise.all([
        MockDb.getForkliftsDueForService(30),
        getFleetServiceOverview()
      ]);
      setDueForklifts(forklifts);
      setFleetOverview(overview);
      
      // Load daily usage for each forklift (in background)
      loadDailyUsage(overview.map(f => f.forklift_id));
    } catch (e) {
      showToast.error('Failed to load service due data');
    } finally {
      setLoading(false);
    }
  };
  
  const loadDailyUsage = async (forkliftIds: string[]) => {
    const usageMap: Record<string, DailyUsageResult> = {};
    // Load in parallel batches of 5
    for (let i = 0; i < forkliftIds.length; i += 5) {
      const batch = forkliftIds.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(id => getForkliftDailyUsage(id).catch(() => null))
      );
      batch.forEach((id, idx) => {
        if (results[idx]) usageMap[id] = results[idx]!;
      });
    }
    setDailyUsage(usageMap);
  };

  const runDailyCheck = async () => {
    setRunning(true);
    setLastResult(null);
    
    try {
      const result = await MockDb.runDailyServiceCheck();
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

  const filteredForklifts = dueForklifts.filter(f => {
    if (filter === 'overdue') return f.is_overdue;
    if (filter === 'due_soon') return !f.is_overdue && !f.has_open_job;
    if (filter === 'job_created') return f.has_open_job;
    if (filter === 'stale') {
      const overview = fleetOverview.find(o => o.forklift_id === f.forklift_id);
      return overview?.is_stale_data;
    }
    return true;
  });

  const stats = {
    overdue: dueForklifts.filter(f => f.is_overdue).length,
    dueSoon: dueForklifts.filter(f => !f.is_overdue && !f.has_open_job).length,
    jobCreated: dueForklifts.filter(f => f.has_open_job).length,
    stale: fleetOverview.filter(f => f.is_stale_data).length,
  };
  
  // Helper to get overview data for a forklift
  const getOverview = (forkliftId: string) => fleetOverview.find(o => o.forklift_id === forkliftId);
  
  // Helper to render trend icon
  const TrendIcon = ({ trend }: { trend?: string }) => {
    if (trend === 'increasing') return <TrendingUp className="w-3 h-3 text-red-500" />;
    if (trend === 'decreasing') return <TrendingDown className="w-3 h-3 text-green-500" />;
    return <Minus className="w-3 h-3 text-slate-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter('overdue')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'overdue' ? 'border-red-500 bg-red-50' : 'border-transparent bg-white hover:border-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              <p className="text-sm text-slate-600">Overdue</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('due_soon')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'due_soon' ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-white hover:border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.dueSoon}</p>
              <p className="text-sm text-slate-600">Due Soon</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('job_created')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'job_created' ? 'border-green-500 bg-green-50' : 'border-transparent bg-white hover:border-green-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.jobCreated}</p>
              <p className="text-sm text-slate-600">Jobs Created</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('stale')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'stale' ? 'border-purple-500 bg-purple-50' : 'border-transparent bg-white hover:border-purple-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <AlertOctagon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{stats.stale}</p>
              <p className="text-sm text-slate-600">Stale Data</p>
            </div>
          </div>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setFilter('all')}
          className={`text-sm font-medium ${filter === 'all' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Show All ({dueForklifts.length})
        </button>

        {isAdmin && (
          <div className="flex items-center gap-3">
            {lastResult && (
              <span className={`text-sm ${lastResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {lastResult}
              </span>
            )}
            <button
              onClick={runDailyCheck}
              disabled={running}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Service Check
            </button>
          </div>
        )}
      </div>

      {/* Forklifts List */}
      {filteredForklifts.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">All caught up!</h3>
          <p className="text-sm text-theme-muted">No forklifts due for service in this category</p>
        </div>
      ) : (
        <div className="card-theme rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-theme-surface-2 border-b border-theme">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Forklift</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Last Serviced</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Next Target</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Current</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Daily Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Est. Service Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-theme-muted uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {filteredForklifts.map(forklift => {
                  const overview = getOverview(forklift.forklift_id);
                  const usage = dailyUsage[forklift.forklift_id];
                  return (
                    <tr key={forklift.forklift_id} className="clickable-row hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{forklift.make} {forklift.model}</p>
                          <p className="text-sm text-slate-500 font-mono">{forklift.serial_number}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">{forklift.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {overview?.last_serviced_hourmeter != null ? (
                            <p>{overview.last_serviced_hourmeter.toLocaleString()} hrs</p>
                          ) : (
                            <p className="text-slate-400">—</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {overview?.next_target_service_hour != null ? (
                            <p>{overview.next_target_service_hour.toLocaleString()} hrs</p>
                          ) : (
                            <p className="text-slate-400">—</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="font-medium">{forklift.hourmeter?.toLocaleString() ?? '—'} hrs</p>
                          {overview?.hours_overdue != null && overview.hours_overdue > 0 && (
                            <p className="text-xs text-red-600">+{overview.hours_overdue} overdue</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm flex items-center gap-1">
                          {usage?.avg_daily_hours != null ? (
                            <>
                              <span>{usage.avg_daily_hours} hrs/day</span>
                              <TrendIcon trend={usage.usage_trend} />
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {(() => {
                            // Calculate hours remaining: next target - current hourmeter
                            const hoursRemaining = overview?.next_target_service_hour != null && forklift.hourmeter != null
                              ? overview.next_target_service_hour - forklift.hourmeter
                              : null;
                            
                            if (hoursRemaining != null && usage?.avg_daily_hours != null && usage.avg_daily_hours > 0) {
                              const daysUntilService = hoursRemaining / usage.avg_daily_hours;
                              
                              // Already overdue - show "Overdue" badge instead of past date
                              if (daysUntilService < 0) {
                                return (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    Overdue
                                  </span>
                                );
                              }
                              
                              // Cap extreme estimates (more than 2 years out)
                              if (daysUntilService > 730) {
                                return <span className="text-slate-500">2+ years</span>;
                              }
                              
                              const estDate = new Date(Date.now() + daysUntilService * 24 * 60 * 60 * 1000);
                              return (
                                <span>
                                  {estDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              );
                            }
                            return <span className="text-slate-400">—</span>;
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {forklift.has_open_job ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 w-fit">Job Created</span>
                          ) : forklift.is_overdue ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 w-fit">Overdue</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 w-fit">Due Soon</span>
                          )}
                          {overview?.is_stale_data && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 w-fit">
                              Stale ({overview.days_since_update}d)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/forklifts/${forklift.forklift_id}`)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 ml-auto"
                        >
                          View <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceDueTab;

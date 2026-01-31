import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import {
  CheckCircle, Clock, AlertTriangle, ChevronRight, Loader2, Play
} from 'lucide-react';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { TabProps, ForkliftDue } from '../types';

const ServiceDueTab: React.FC<TabProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dueForklifts, setDueForklifts] = useState<ForkliftDue[]>([]);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'due_soon' | 'job_created'>('all');
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
      const forklifts = await MockDb.getForkliftsDueForService(30);
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
    return true;
  });

  const stats = {
    overdue: dueForklifts.filter(f => f.is_overdue).length,
    dueSoon: dueForklifts.filter(f => !f.is_overdue && !f.has_open_job).length,
    jobCreated: dueForklifts.filter(f => f.has_open_job).length,
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <table className="w-full">
            <thead className="bg-theme-surface-2 border-b border-theme">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Forklift</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Hourmeter</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-theme-muted uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {filteredForklifts.map(forklift => (
                <tr key={forklift.forklift_id} className="clickable-row">
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
                      <p>{forklift.hourmeter.toLocaleString()} hrs</p>
                      {forklift.hours_until_due !== null && (
                        <p className={`text-xs ${forklift.hours_until_due < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {forklift.hours_until_due < 0 ? `${Math.abs(forklift.hours_until_due)} hrs overdue` : `${forklift.hours_until_due} hrs until due`}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {forklift.has_open_job ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Job Created</span>
                    ) : forklift.is_overdue ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Overdue</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Due Soon</span>
                    )}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ServiceDueTab;

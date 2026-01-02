import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SupabaseDb } from '../services/supabaseService';
import { Calendar, AlertTriangle, CheckCircle, Clock, Settings, Play, ChevronRight } from 'lucide-react';

interface ServiceStats {
  totalActive: number;
  dueSoon: number;
  overdue: number;
  withOpenJobs: number;
}

interface Props {
  onViewAll?: () => void;
}

const ServiceAutomationWidget: React.FC<Props> = ({ onViewAll }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Get forklifts due within 7 days
      const dueForklifts = await SupabaseDb.getForkliftsDueForService(7);
      
      setStats({
        totalActive: dueForklifts.length,
        dueSoon: dueForklifts.filter(f => !f.is_overdue).length,
        overdue: dueForklifts.filter(f => f.is_overdue).length,
        withOpenJobs: dueForklifts.filter(f => f.has_open_job).length,
      });
    } catch (e) {
      console.error('Failed to load service stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const runDailyCheck = async () => {
    setRunning(true);
    setLastResult(null);
    
    try {
      const result = await SupabaseDb.runDailyServiceCheck();
      setLastResult(`✅ Created ${result.jobs_created} jobs, ${result.notifications_created} notifications`);
      await loadStats(); // Refresh stats
    } catch (e: any) {
      setLastResult(`❌ Error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="card-theme p-6 rounded-xl theme-transition animate-pulse">
        <div className="h-6 bg-theme-surface-2 rounded w-48 mb-4"></div>
        <div className="h-20 bg-theme-surface-2 rounded"></div>
      </div>
    );
  }

  return (
    <div className="card-theme p-6 rounded-xl theme-transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-theme">Service Automation</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-theme-muted">
          <Clock className="w-3 h-3" />
          <span>Runs daily at 8:00 AM</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div 
          onClick={() => navigate('/service-due?filter=overdue')}
          className="bg-theme-surface-2 rounded-lg p-3 text-center border border-theme cursor-pointer hover:border-red-300 hover:shadow-md transition-all group"
        >
          <div className="text-2xl font-bold text-red-500 group-hover:text-red-600">{stats?.overdue || 0}</div>
          <div className="text-xs text-theme-muted flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Overdue
          </div>
          <ChevronRight className="w-3 h-3 mx-auto mt-1 text-slate-300 group-hover:text-red-400 transition-colors" />
        </div>
        <div 
          onClick={() => navigate('/service-due?filter=due_soon')}
          className="bg-theme-surface-2 rounded-lg p-3 text-center border border-theme cursor-pointer hover:border-yellow-300 hover:shadow-md transition-all group"
        >
          <div className="text-2xl font-bold text-yellow-500 group-hover:text-yellow-600">{stats?.dueSoon || 0}</div>
          <div className="text-xs text-theme-muted flex items-center justify-center gap-1">
            <Calendar className="w-3 h-3" />
            Due in 7 days
          </div>
          <ChevronRight className="w-3 h-3 mx-auto mt-1 text-slate-300 group-hover:text-yellow-400 transition-colors" />
        </div>
        <div 
          onClick={() => navigate('/service-due?filter=job_created')}
          className="bg-theme-surface-2 rounded-lg p-3 text-center border border-theme cursor-pointer hover:border-green-300 hover:shadow-md transition-all group"
        >
          <div className="text-2xl font-bold text-green-500 group-hover:text-green-600">{stats?.withOpenJobs || 0}</div>
          <div className="text-xs text-theme-muted flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Jobs Created
          </div>
          <ChevronRight className="w-3 h-3 mx-auto mt-1 text-slate-300 group-hover:text-green-400 transition-colors" />
        </div>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className={`text-sm p-2 rounded mb-4 ${
          lastResult.startsWith('✅') ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
        }`}>
          {lastResult}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={runDailyCheck}
          disabled={running}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Play className="w-4 h-4" />
          {running ? 'Running...' : 'Run Check Now'}
        </button>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="px-4 py-2 bg-theme-surface-2 hover:bg-theme-surface-3 text-theme border border-theme rounded-lg text-sm font-medium transition-colors"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
};

export default ServiceAutomationWidget;

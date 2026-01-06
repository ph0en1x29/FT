import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SupabaseDb } from '../services/supabaseService';
import { AlertTriangle, CheckCircle, Clock, Settings, Play, ArrowRight, Zap } from 'lucide-react';

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
      setLastResult(`Created ${result.jobs_created} jobs, ${result.notifications_created} notifications`);
      await loadStats();
    } catch (e: any) {
      setLastResult(`Error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="card-premium p-5 animate-pulse h-full flex flex-col">
        <div className="h-5 rounded w-40 mb-4 bg-[var(--bg-subtle)]"></div>
        <div className="flex-1 rounded bg-[var(--bg-subtle)]"></div>
      </div>
    );
  }

  const totalIssues = (stats?.overdue || 0) + (stats?.dueSoon || 0);

  return (
    <div className="card-premium flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)]">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text)] text-sm">Service Automation</h3>
              <p className="text-[10px] text-[var(--text-muted)]">Daily at 8:00 AM</p>
            </div>
          </div>
          {totalIssues > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[var(--warning-bg)] text-[var(--warning)]">
              {totalIssues} pending
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        {/* Stat Items */}
        <div 
          onClick={() => navigate('/service-due?filter=overdue')}
          className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--error)] hover:shadow-sm group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-500/10">
              <AlertTriangle className="w-4 h-4 text-[var(--error)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Overdue</p>
              <p className="text-lg font-bold text-[var(--error)]">{stats?.overdue || 0}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div 
          onClick={() => navigate('/service-due?filter=due_soon')}
          className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--warning)] hover:shadow-sm group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-500/10">
              <Clock className="w-4 h-4 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Due Soon</p>
              <p className="text-lg font-bold text-[var(--warning)]">{stats?.dueSoon || 0}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div 
          onClick={() => navigate('/service-due?filter=job_created')}
          className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--success)] hover:shadow-sm group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-50 dark:bg-green-500/10">
              <CheckCircle className="w-4 h-4 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Jobs Created</p>
              <p className="text-lg font-bold text-[var(--success)]">{stats?.withOpenJobs || 0}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Last Result */}
        {lastResult && (
          <div className={`text-xs p-2.5 rounded-lg flex items-center gap-2 ${
            !lastResult.startsWith('Error') 
              ? 'bg-[var(--success-bg)] text-[var(--success)]' 
              : 'bg-[var(--error-bg)] text-[var(--error)]'
          }`}>
            {!lastResult.startsWith('Error') ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {lastResult}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 pt-0 mt-auto">
        <button
          onClick={runDailyCheck}
          disabled={running}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white hover:shadow-md hover:shadow-[var(--accent)]/20"
        >
          {running ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Run Check Now
            </>
          )}
        </button>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="w-full mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            View all service details →
          </button>
        )}
      </div>
    </div>
  );
};

export default ServiceAutomationWidget;

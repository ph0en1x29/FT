import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SupabaseDb } from '../services/supabaseService';
import { AlertTriangle, CheckCircle, Clock, Settings, Zap } from 'lucide-react';

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
    } finally {
      setLoading(false);
    }
  };

  const runDailyCheck = async () => {
    setRunning(true);
    setLastResult(null);
    
    try {
      const result = await SupabaseDb.runDailyServiceCheck();
      setLastResult(`Created ${result.jobs_created} jobs, ${result.notifications_created} alerts`);
      await loadStats();
    } catch (e: unknown) {
      setLastResult(`Error: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="card-premium p-4 animate-pulse h-full flex flex-col">
        <div className="h-5 rounded w-40 mb-3 bg-[var(--bg-subtle)]"></div>
        <div className="flex-1 rounded bg-[var(--bg-subtle)]"></div>
      </div>
    );
  }

  const totalIssues = (stats?.overdue || 0) + (stats?.dueSoon || 0);

  return (
    <div className="card-premium flex flex-col h-full overflow-hidden">
      {/* Header - Compact */}
      <div className="p-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)]">
              <Settings className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text)] text-sm">Service Automation</h3>
              <p className="text-[10px] text-[var(--text-muted)]">Daily at 8:00 AM</p>
            </div>
          </div>
          {totalIssues > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--warning-bg)] text-[var(--warning)]">
              {totalIssues}
            </span>
          )}
        </div>
      </div>

      {/* Stats - Compact */}
      <div className="flex-1 p-3 flex flex-col gap-2 overflow-hidden">
        {/* Stat Items - Horizontal layout */}
        <div 
          onClick={() => navigate('/forklifts?tab=service-due&filter=overdue')}
          className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--error)] group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
              <AlertTriangle className="w-4 h-4 text-[var(--error)]" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)]">Overdue</p>
              <p className="text-base font-bold text-[var(--error)]">{stats?.overdue || 0}</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => navigate('/forklifts?tab=service-due&filter=due_soon')}
          className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--warning)] group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50">
              <Clock className="w-4 h-4 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)]">Due Soon</p>
              <p className="text-base font-bold text-[var(--warning)]">{stats?.dueSoon || 0}</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => navigate('/forklifts?tab=service-due&filter=job_created')}
          className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[var(--success)] group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-50">
              <CheckCircle className="w-4 h-4 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)]">Jobs Created</p>
              <p className="text-base font-bold text-[var(--success)]">{stats?.withOpenJobs || 0}</p>
            </div>
          </div>
        </div>

        {/* Last Result - Compact */}
        {lastResult && (
          <div className={`text-[11px] p-2 rounded-lg flex items-center gap-1.5 ${
            !lastResult.startsWith('Error') 
              ? 'bg-[var(--success-bg)] text-[var(--success)]' 
              : 'bg-[var(--error-bg)] text-[var(--error)]'
          }`}>
            {!lastResult.startsWith('Error') ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            {lastResult}
          </div>
        )}
      </div>

      {/* Actions - Compact */}
      <div className="p-3 pt-0 mt-auto">
        <button
          onClick={runDailyCheck}
          disabled={running}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-xs transition-all disabled:opacity-50 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white hover:shadow-md hover:shadow-[var(--accent)]/20"
        >
          {running ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              Run Check Now
            </>
          )}
        </button>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="w-full mt-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            View all service details →
          </button>
        )}
      </div>
    </div>
  );
};

export default ServiceAutomationWidget;

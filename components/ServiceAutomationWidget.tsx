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
      await loadStats();
    } catch (e: any) {
      setLastResult(`❌ Error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="card-premium p-6 animate-pulse h-full flex flex-col">
        <div className="h-6 rounded w-48 mb-4 bg-[var(--bg-subtle)]"></div>
        <div className="h-20 rounded bg-[var(--bg-subtle)]"></div>
        <div className="mt-auto h-10 rounded bg-[var(--bg-subtle)]"></div>
      </div>
    );
  }

  return (
    <div className="card-premium p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-subtle)]">
            <Settings className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <h3 className="font-semibold text-[var(--text)]">Service Automation</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <Clock className="w-3 h-3" />
          <span>Runs daily at 8:00 AM</span>
        </div>
      </div>

      <div className="flex-1">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div 
            onClick={() => navigate('/service-due?filter=overdue')}
            className="rounded-xl p-3 text-center cursor-pointer transition-all hover:shadow-md bg-[var(--bg-subtle)] border border-[var(--border)] hover:border-[var(--error)]"
          >
            <div className="text-2xl font-bold text-[var(--error)]">{stats?.overdue || 0}</div>
            <div className="text-xs flex items-center justify-center gap-1 text-[var(--text-muted)]">
              <AlertTriangle className="w-3 h-3" />
              Overdue
            </div>
          </div>
          <div 
            onClick={() => navigate('/service-due?filter=due_soon')}
            className="rounded-xl p-3 text-center cursor-pointer transition-all hover:shadow-md bg-[var(--bg-subtle)] border border-[var(--border)] hover:border-[var(--warning)]"
          >
            <div className="text-2xl font-bold text-[var(--warning)]">{stats?.dueSoon || 0}</div>
            <div className="text-xs flex items-center justify-center gap-1 text-[var(--text-muted)]">
              <Calendar className="w-3 h-3" />
              Due Soon
            </div>
          </div>
          <div 
            onClick={() => navigate('/service-due?filter=job_created')}
            className="rounded-xl p-3 text-center cursor-pointer transition-all hover:shadow-md bg-[var(--bg-subtle)] border border-[var(--border)] hover:border-[var(--success)]"
          >
            <div className="text-2xl font-bold text-[var(--success)]">{stats?.withOpenJobs || 0}</div>
            <div className="text-xs flex items-center justify-center gap-1 text-[var(--text-muted)]">
              <CheckCircle className="w-3 h-3" />
              Jobs Created
            </div>
          </div>
        </div>

        {/* Last Result */}
        {lastResult && (
          <div className={`text-sm p-3 rounded-xl mt-4 ${
            lastResult.startsWith('✅') 
              ? 'bg-[var(--success-bg)] text-[var(--success)]' 
              : 'bg-[var(--error-bg)] text-[var(--error)]'
          }`}>
            {lastResult}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border-subtle)]">
        <button
          onClick={runDailyCheck}
          disabled={running}
          className="btn-premium btn-premium-primary flex-1 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {running ? 'Running...' : 'Run Check Now'}
        </button>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="btn-premium btn-premium-secondary"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
};

export default ServiceAutomationWidget;

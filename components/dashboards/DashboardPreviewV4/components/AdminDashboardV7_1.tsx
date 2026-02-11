/* eslint-disable max-lines */
/**
 * AdminDashboardV7_1 - "Command Center" (Enhanced)
 * 
 * Philosophy: See everything, act on everything — without leaving the dashboard.
 * 
 * Key features:
 * - Approval Queue: All pending items in one actionable stream with bulk actions
 * - Pipeline View: Jobs flow left→right (kanban-style status columns)
 * - Inline Actions: Approve, assign, finalize directly from dashboard cards
 * - Smart Summary Bar: Urgent counts that pulse when attention needed
 * - Collapsible Sections: Admin controls what's visible
 */

import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  DollarSign,
  FileText,
  Package,
  Play,
  Plus,
  RefreshCw,
  Send,
  Square,
  CheckSquare,
  Target,
  TrendingUp,
  Users,
  UserX,
  Zap,
  X,
  ArrowRight,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotifications } from '../../../../hooks/useQueryHooks';
import { getGlobalLowStockCount } from '../../../../services/inventoryService';
import { SupabaseDb } from '../../../../services/supabaseService';
import { supabase } from '../../../../services/supabaseClient';
import { Job, User, UserRole, JobStatus } from '../../../../types';
import { showToast } from '../../../../services/toastService';
import { colors, EscalationBanner } from './DashboardWidgets';

interface AdminDashboardV7_1Props {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

// ============================================
// REUSABLE COMPONENTS
// ============================================

// Collapsible Section
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: number;
  badgeColor?: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, badge, badgeColor, defaultOpen = true, actions, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between transition-colors hover:opacity-90"
        style={{ borderBottom: open ? '1px solid var(--border-subtle)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</h3>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: badgeColor || colors.red.bg, color: badgeColor ? 'white' : colors.red.text }}>
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && actions}
          {open ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
};

// Bulk Action Bar (floating)
const BulkActionBar: React.FC<{
  count: number;
  onClear: () => void;
  actions: { label: string; icon: React.ReactNode; onClick: () => void; variant?: 'primary' | 'danger' | 'default' }[];
}> = ({ count, onClear, actions }) => {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
      style={{ background: 'var(--text)', color: 'white', minWidth: 320 }}>
      <span className="text-sm font-medium">{count} selected</span>
      <div className="flex items-center gap-2 ml-auto">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95 ${
              a.variant === 'primary' ? 'bg-white text-gray-900' :
              a.variant === 'danger' ? 'bg-red-500 text-white' :
              'bg-white/20 text-white'
            }`}
          >
            {a.icon} {a.label}
          </button>
        ))}
        <button onClick={onClear} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Selectable Job Row
const SelectableJobRow: React.FC<{
  job: Job;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
  badge: { label: string; color: string; bg: string };
  techName?: string;
  showActions?: React.ReactNode;
}> = ({ job, selected, onToggle, onClick, badge, techName, showActions }) => (
  <div
    className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:scale-[1.005]"
    style={{ background: selected ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'transparent', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}` }}
  >
    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-0.5 flex-shrink-0">
      {selected
        ? <CheckSquare className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        : <Square className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      }
    </button>
    <button onClick={onClick} className="flex-1 text-left min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
          {job.job_number || job.title}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{ background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{job.customer?.name || 'Unknown'}</span>
        {techName && (
          <>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>•</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{techName}</span>
          </>
        )}
      </div>
    </button>
    {showActions && <div className="flex-shrink-0">{showActions}</div>}
  </div>
);

// Pipeline Column
const PipelineColumn: React.FC<{
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ title, count, color, children, onClick }) => (
  <div className="flex-1 min-w-[160px]">
    <button onClick={onClick} className="flex items-center gap-2 mb-2 w-full text-left hover:opacity-80">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>
      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>{count}</span>
    </button>
    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {count === 0 ? (
        <div className="py-4 text-center rounded-lg" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No jobs</p>
        </div>
      ) : children}
    </div>
  </div>
);

// Mini job card for pipeline with inline assignment
const PipelineCard: React.FC<{
  job: Job;
  techName?: string;
  onClick: () => void;
  accent: string;
  technicians?: { user_id: string; name: string }[];
  onAssign?: (jobId: string, techId: string) => void;
}> = ({ job, techName, onClick, accent, technicians, onAssign }) => {
  const [showAssign, setShowAssign] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const isUnassigned = !job.assigned_technician_id;

  // Click outside to close dropdown
  React.useEffect(() => {
    if (!showAssign) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAssign(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAssign]);
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onClick}
        className="w-full text-left p-2 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: 'var(--surface-2)', borderLeft: `3px solid ${accent}` }}
      >
        <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{job.job_number || job.title}</p>
        <div className="flex items-center gap-1">
          {isUnassigned && onAssign ? (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAssign(!showAssign); }}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:opacity-80 transition-colors"
              style={{ color: colors.orange.text, background: colors.orange.bg }}
            >
              + Assign
            </button>
          ) : (
            <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{techName || 'Unassigned'}</span>
          )}
          <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>• {job.customer?.name || ''}</span>
        </div>
      </button>
      {showAssign && technicians && onAssign && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-lg shadow-xl py-1 max-h-[150px] overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {technicians.map(t => (
            <button
              key={t.user_id}
              onClick={() => { onAssign(job.job_id, t.user_id); setShowAssign(false); }}
              className="w-full text-left px-3 py-1.5 text-xs transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Stat pill for summary bar
const StatPill: React.FC<{
  label: string;
  value: string | number;
  color: string;
  pulse?: boolean;
  onClick?: () => void;
}> = ({ label, value, color, pulse, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97] ${pulse ? 'animate-pulse' : ''}`}
    style={{ background: `${color}15`, border: `1px solid ${color}30` }}
  >
    <span className="text-lg font-bold" style={{ color }}>{value}</span>
    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
  </button>
);

// ============================================
// MAIN COMPONENT
// ============================================

const AdminDashboardV7_1: React.FC<AdminDashboardV7_1Props> = ({ currentUser, jobs, users, onRefresh, navigate }) => {
  const today = new Date();
  const todayStr = today.toDateString();
  // Selection state for bulk actions
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<{ name: string; quantity: number; min: number }[]>([]);

  // Fetch notifications
  const { data: notifications = [] } = useNotifications(currentUser.user_id, true);
  const unreadCount = notifications.length;

  useEffect(() => {
    getGlobalLowStockCount().then(setLowStockCount).catch(() => {});
    // Fetch top low stock items
    Promise.resolve(supabase.from('van_stock_items').select('quantity, min_quantity, part:parts(part_name)'))
      .then(({ data }) => {
        if (data) {
          const low = data
            .filter((i: Record<string, unknown>) => (i.quantity as number) <= (i.min_quantity as number))
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => (a.quantity as number) - (b.quantity as number))
            .slice(0, 3)
            .map((i: Record<string, unknown>) => ({ name: (i.part as Record<string, string>)?.part_name || 'Unknown', quantity: i.quantity as number, min: i.min_quantity as number }));
          setLowStockItems(low);
        }
      }).catch(() => {});
  }, []);

  // ---- Data categorization ----
  const technicians = users.filter(u => u.role === UserRole.TECHNICIAN && u.is_active);
  
  const jobsByStatus = useMemo(() => {
    const newJobs = jobs.filter(j => j.status === 'New');
    const assigned = jobs.filter(j => j.status === 'Assigned');
    const inProgress = jobs.filter(j => j.status === 'In Progress');
    const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');
    const completed = jobs.filter(j => j.status === 'Completed');
    const overdue = jobs.filter(j => {
      if (['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)) return false;
      const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
      return scheduled && scheduled < new Date(todayStr) && j.status !== 'New';
    });
    const unassigned = jobs.filter(j => !j.assigned_technician_id && !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
    const escalated = jobs.filter(j => (j.is_escalated || j.escalation_triggered_at) && !j.escalation_acknowledged_at);
    const awaitingAck = jobs.filter(j => j.status === 'Completed Awaiting Ack');
    const disputed = jobs.filter(j => j.status === 'Disputed');
    const incompleteContinuing = jobs.filter(j => j.status === 'Incomplete - Continuing');

    // Due today
    const dueToday = jobs.filter(j => {
      if (['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)) return false;
      const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
      return scheduled && scheduled.toDateString() === todayStr;
    });
    const completedToday = jobs.filter(j => {
      if (j.status !== 'Completed') return false;
      const done = j.completed_at ? new Date(j.completed_at) : null;
      return done && done.toDateString() === todayStr;
    });

    return { newJobs, assigned, inProgress, awaitingFinalization, completed, overdue, unassigned, escalated, awaitingAck, disputed, incompleteContinuing, dueToday, completedToday };
  }, [jobs, todayStr]);

  // Approval queue: jobs needing parts confirmation or job confirmation
  // Approval queue: one entry per job, highest priority type wins
  const approvalQueue = useMemo(() => {
    const jobMap = new Map<string, { job: Job; type: 'parts' | 'job' | 'escalation' | 'dispute' | 'ack'; priority: number }>();
    
    const addOrUpgrade = (job: Job, type: 'parts' | 'job' | 'escalation' | 'dispute' | 'ack', priority: number) => {
      const existing = jobMap.get(job.job_id);
      if (!existing || priority < existing.priority) {
        jobMap.set(job.job_id, { job, type, priority });
      }
    };

    jobs.forEach(j => {
      // Escalations (highest priority)
      if ((j.is_escalated || j.escalation_triggered_at) && !j.escalation_acknowledged_at) {
        addOrUpgrade(j, 'escalation', 0);
      }
      // Disputes
      if (j.status === 'Disputed') {
        addOrUpgrade(j, 'dispute', 1);
      }
      // Parts needing verification
      if (j.parts_used?.length > 0 && !j.parts_confirmed_at && !j.parts_confirmation_skipped &&
          ['Awaiting Finalization', 'Completed', 'Completed Awaiting Ack'].includes(j.status)) {
        addOrUpgrade(j, 'parts', 2);
      }
      // Awaiting acknowledgement
      if (j.status === 'Completed Awaiting Ack') {
        addOrUpgrade(j, 'ack', 3);
      }
    });

    return Array.from(jobMap.values()).sort((a, b) => a.priority - b.priority);
  }, [jobs]);

  // SLA metrics
  const slaMetrics = useMemo(() => {
    const completedJobs = jobs.filter(j => j.status === 'Completed' && j.completed_at);
    const onTimeJobs = completedJobs.filter(j => {
      const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
      const done = j.completed_at ? new Date(j.completed_at) : null;
      if (!scheduled || !done) return true;
      return done <= new Date(scheduled.getTime() + 24 * 60 * 60 * 1000);
    });
    return {
      onTimeRate: completedJobs.length > 0 ? Math.round((onTimeJobs.length / completedJobs.length) * 100) : 100,
    };
  }, [jobs]);

  // Revenue
  const weeklyRevenue = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const completedLastWeek = jobs.filter(j => j.status === 'Completed' && j.completed_at && new Date(j.completed_at) >= weekAgo);
    return completedLastWeek.reduce((acc, job) => {
      const partsCost = (job.parts_used || []).reduce((sum, p) => sum + ((p.sell_price_at_time || 0) * (p.quantity || 0)), 0);
      return acc + partsCost + 150;
    }, 0);
  }, [jobs]);

  // Team status
  const teamStatus = useMemo(() => {
    return technicians.map(tech => {
      const techJobs = jobs.filter(j => j.assigned_technician_id === tech.user_id && !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
      const activeCount = techJobs.length;
      const status = activeCount === 0 ? 'available' : activeCount >= 3 ? 'overloaded' : 'busy';
      return { tech, activeCount, status: status as 'available' | 'busy' | 'overloaded' };
    });
  }, [technicians, jobs]);

  const availableTechs = teamStatus.filter(t => t.status === 'available').length;

  // Today's schedule
  const todaySchedule = useMemo(() => {
    return jobsByStatus.dueToday
      .map(j => {
        const tech = users.find(u => u.user_id === j.assigned_technician_id);
        const scheduledTime = j.scheduled_date ? new Date(j.scheduled_date) : new Date();
        let status: 'completed' | 'in-progress' | 'upcoming' = 'upcoming';
        if (j.status === 'Completed') status = 'completed';
        else if (j.status === 'In Progress') status = 'in-progress';
        return { job: j, tech: tech?.name?.split(' ')[0] || 'Unassigned', time: scheduledTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), status };
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [jobsByStatus.dueToday, users]);

  // Tech name lookup
  const techNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(u => map.set(u.user_id, u.name?.split(' ')[0] || 'Unknown'));
    return map;
  }, [users]);

  // ---- Selection handlers ----
  const toggleSelection = useCallback((id: string) => {
    setSelectedApprovalIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedApprovalIds.size === approvalQueue.length) {
      setSelectedApprovalIds(new Set());
    } else {
      setSelectedApprovalIds(new Set(approvalQueue.map(i => i.job.job_id)));
    }
  }, [approvalQueue, selectedApprovalIds.size]);

  // Bulk confirm parts
  const handleBulkConfirmParts = useCallback(async () => {
    const partsItems = approvalQueue.filter(i => i.type === 'parts' && selectedApprovalIds.has(i.job.job_id));
    if (partsItems.length === 0) {
      showToast.error('No parts verification items selected');
      return;
    }
    setProcessing(true);
    let success = 0;
    let failed = 0;
    for (const item of partsItems) {
      try {
        await SupabaseDb.confirmParts(item.job.job_id, currentUser.user_id, currentUser.name);
        success++;
      } catch {
        failed++;
      }
    }
    setProcessing(false);
    setSelectedApprovalIds(new Set());
    onRefresh();
    if (failed === 0) {
      showToast.success(`${success} job${success > 1 ? 's' : ''} parts confirmed`);
    } else {
      showToast.error(`${success} confirmed, ${failed} failed`);
    }
  }, [approvalQueue, selectedApprovalIds, currentUser, onRefresh]);

  // Bulk finalize invoices
  const handleBulkFinalize = useCallback(async () => {
    const selectedJobs = jobs.filter(j => selectedApprovalIds.has(j.job_id) && j.status === 'Awaiting Finalization');
    if (selectedJobs.length === 0) {
      showToast.error('No finalization-ready jobs selected');
      return;
    }
    setProcessing(true);
    let success = 0;
    let failed = 0;
    for (const job of selectedJobs) {
      try {
        await SupabaseDb.finalizeInvoice(job.job_id, currentUser.user_id, currentUser.name);
        success++;
      } catch {
        failed++;
      }
    }
    setProcessing(false);
    setSelectedApprovalIds(new Set());
    onRefresh();
    if (failed === 0) {
      showToast.success(`${success} invoice${success > 1 ? 's' : ''} finalized`);
    } else {
      showToast.error(`${success} finalized, ${failed} failed`);
    }
  }, [jobs, selectedApprovalIds, currentUser, onRefresh]);

  // Inline assign handler
  const handleInlineAssign = useCallback(async (jobId: string, techId: string) => {
    try {
      const tech = users.find(u => u.user_id === techId);
      await SupabaseDb.updateJob(jobId, { assigned_technician_id: techId, assigned_technician_name: tech?.name || '', status: JobStatus.ASSIGNED });
      showToast.success(`Assigned to ${tech?.name?.split(' ')[0]}`);
      onRefresh();
    } catch {
      showToast.error('Failed to assign');
    }
  }, [users, onRefresh]);

  // Recent activity (last 5 completed/status-changed jobs)
  const recentActivity = useMemo(() => {
    return jobs
      .filter(j => j.completed_at || j.updated_at)
      .sort((a, b) => {
        const aTime = a.completed_at || a.updated_at;
        const bTime = b.completed_at || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      })
      .slice(0, 5)
      .map(j => {
        const time = j.completed_at || j.updated_at;
        const ago = Math.round((Date.now() - new Date(time).getTime()) / 60000);
        const agoText = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
        return { job: j, status: j.status, agoText, techName: j.assigned_technician_id ? techNameMap.get(j.assigned_technician_id) : undefined };
      });
  }, [jobs, techNameMap]);

  // Technician list for inline assignment
  const techList = useMemo(() => technicians.map(t => ({ user_id: t.user_id, name: t.name })), [technicians]);

  // ---- Greeting ----
  const greeting = useMemo(() => {
    const hour = today.getHours();
    const base = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = currentUser.name?.split(' ')[0] || 'Admin';
    return `${base}, ${firstName}`;
  }, [currentUser, today]);

  // Badge helpers
  const getApprovalBadge = (type: string) => {
    switch (type) {
      case 'escalation': return { label: 'ESCALATED', color: colors.red.text, bg: colors.red.bg };
      case 'dispute': return { label: 'DISPUTED', color: '#9333ea', bg: '#f3e8ff' };
      case 'parts': return { label: 'VERIFY PARTS', color: colors.orange.text, bg: colors.orange.bg };
      case 'ack': return { label: 'AWAITING ACK', color: colors.blue.text, bg: colors.blue.bg };
      case 'job': return { label: 'CONFIRM JOB', color: colors.green.text, bg: colors.green.bg };
      default: return { label: type.toUpperCase(), color: 'var(--text-muted)', bg: 'var(--surface-2)' };
    }
  };

  const urgentCount = jobsByStatus.escalated.length + jobsByStatus.overdue.length + jobsByStatus.disputed.length;
  const totalDueToday = jobsByStatus.dueToday.length + jobsByStatus.completedToday.length;
  const completionPct = totalDueToday > 0 ? Math.round((jobsByStatus.completedToday.length / totalDueToday) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{greeting}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {jobsByStatus.dueToday.length} jobs today • {availableTechs}/{technicians.length} techs available
            {urgentCount > 0 && <span style={{ color: colors.red.text }}> • ⚠️ {urgentCount} need attention</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white">
            ⚡ V7.1
          </span>
          <button onClick={() => navigate('/notifications')} className="relative p-2 rounded-xl transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Bell className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: colors.red.text, color: 'white' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={onRefresh} className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
          <button onClick={() => navigate('/jobs/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95" style={{ background: colors.blue.text, color: 'white' }}>
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>
      </div>

      {/* ===== ESCALATION BANNER ===== */}
      <EscalationBanner count={jobsByStatus.escalated.length} onClick={() => navigate('/jobs?filter=escalated')} />

      {/* ===== SUMMARY BAR ===== */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatPill label="Overdue" value={jobsByStatus.overdue.length} color={colors.red.text} pulse={jobsByStatus.overdue.length > 2} onClick={() => navigate('/jobs?filter=overdue')} />
        <StatPill label="Unassigned" value={jobsByStatus.unassigned.length} color={colors.orange.text} onClick={() => navigate('/jobs?filter=unassigned')} />
        <StatPill label="In Progress" value={jobsByStatus.inProgress.length} color={colors.blue.text} onClick={() => navigate('/jobs?filter=in-progress')} />
        <StatPill label="To Finalize" value={jobsByStatus.awaitingFinalization.length} color="#9333ea" onClick={() => navigate('/jobs?filter=awaiting-finalization')} />
        <StatPill label="On-Time" value={`${slaMetrics.onTimeRate}%`} color={colors.green.text} />
        <StatPill label="Revenue 7d" value={`RM${(weeklyRevenue / 1000).toFixed(1)}k`} color={colors.green.text} onClick={() => navigate('/invoices')} />
        {lowStockCount > 0 && (
          <StatPill label="Low Stock" value={lowStockCount} color={colors.orange.text} onClick={() => navigate('/inventory?filter=low-stock')} />
        )}
      </div>

      {/* ===== TWO COLUMN: APPROVAL QUEUE (wider) + ACTION REQUIRED (narrower) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* Approval Queue */}
        <Section
          title="Approval Queue"
          icon={<Zap className="w-4 h-4" style={{ color: colors.orange.text }} />}
          badge={approvalQueue.length}
          badgeColor={colors.orange.bg}
          actions={
            approvalQueue.length > 0 ? (
              <button onClick={selectAll} className="text-xs font-medium px-2 py-1 rounded-lg hover:opacity-80" style={{ color: 'var(--accent)', background: 'var(--accent-bg, rgba(59,130,246,0.08))' }}>
                {selectedApprovalIds.size === approvalQueue.length ? 'Deselect All' : 'Select All'}
              </button>
            ) : undefined
          }
        >
          {approvalQueue.length === 0 ? (
            <div className="py-4 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-1" style={{ color: colors.green.text, opacity: 0.4 }} />
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>All clear</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[270px] overflow-y-auto pr-1">
              {approvalQueue.map(item => {
                const badge = getApprovalBadge(item.type);
                return (
                  <SelectableJobRow
                    key={`${item.type}-${item.job.job_id}`}
                    job={item.job}
                    selected={selectedApprovalIds.has(item.job.job_id)}
                    onToggle={() => toggleSelection(item.job.job_id)}
                    onClick={() => navigate(`/jobs/${item.job.job_id}`)}
                    badge={badge}
                    techName={item.job.assigned_technician_id ? techNameMap.get(item.job.assigned_technician_id) : undefined}
                    showActions={
                      item.type === 'parts' ? (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await SupabaseDb.confirmParts(item.job.job_id, currentUser.user_id, currentUser.name);
                              showToast.success('Parts verified');
                              onRefresh();
                            } catch (err) {
                              showToast.error('Could not verify parts', (err as Error).message);
                            }
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                          style={{ background: colors.green.text, color: 'white' }}
                        >
                          Verify
                        </button>
                      ) : item.type === 'escalation' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${item.job.job_id}`); }}
                          className="px-3 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                          style={{ background: colors.red.text, color: 'white' }}
                        >
                          Review
                        </button>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </Section>

        {/* Action Required (Escalations, Overdue, Disputed) */}
        <Section
          title="Action Required"
          icon={<AlertTriangle className="w-4 h-4" style={{ color: colors.red.text }} />}
          badge={urgentCount}
        >
          {urgentCount === 0 ? (
            <div className="py-4 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-1" style={{ color: colors.green.text, opacity: 0.4 }} />
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>No urgent items</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[270px] overflow-y-auto pr-1">
              {[
                ...jobsByStatus.escalated.map(j => ({ job: j, label: '🔥 Escalated', color: colors.red.text, bg: colors.red.bg })),
                ...jobsByStatus.overdue.map(j => ({ job: j, label: '⏰ Overdue', color: colors.orange.text, bg: colors.orange.bg })),
                ...jobsByStatus.disputed.map(j => ({ job: j, label: '⚠️ Disputed', color: '#9333ea', bg: '#f3e8ff' })),
              ].map(({ job, label, color, bg }) => (
                <button
                  key={job.job_id}
                  onClick={() => navigate(`/jobs/${job.job_id}`)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all hover:opacity-80"
                  style={{ background: `${bg}` }}
                >
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{ color }}>{label}</span>
                  <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{job.job_number || job.title}</span>
                  <span className="text-[10px] truncate max-w-[80px]" style={{ color: 'var(--text-muted)' }}>{job.customer?.name || ''}</span>
                  <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ===== JOB PIPELINE ===== */}
      <Section
        title="Job Pipeline"
        icon={<ArrowRight className="w-4 h-4" style={{ color: colors.blue.text }} />}
        badge={jobs.filter(j => !['Completed', 'Cancelled'].includes(j.status)).length}
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          <PipelineColumn title="New" count={jobsByStatus.newJobs.length} color={colors.blue.text} onClick={() => navigate('/jobs?filter=new')}>
            {jobsByStatus.newJobs.slice(0, 4).map(j => (
              <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => navigate(`/jobs/${j.job_id}`)} accent={colors.blue.text} technicians={techList} onAssign={handleInlineAssign} />
            ))}
            {jobsByStatus.newJobs.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{jobsByStatus.newJobs.length - 4} more</p>}
          </PipelineColumn>

          <PipelineColumn title="Assigned" count={jobsByStatus.assigned.length} color={colors.orange.text} onClick={() => navigate('/jobs?filter=assigned')}>
            {jobsByStatus.assigned.slice(0, 4).map(j => (
              <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => navigate(`/jobs/${j.job_id}`)} accent={colors.orange.text} />
            ))}
            {jobsByStatus.assigned.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{jobsByStatus.assigned.length - 4} more</p>}
          </PipelineColumn>

          <PipelineColumn title="In Progress" count={jobsByStatus.inProgress.length} color={colors.green.text} onClick={() => navigate('/jobs?filter=in-progress')}>
            {jobsByStatus.inProgress.slice(0, 4).map(j => (
              <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => navigate(`/jobs/${j.job_id}`)} accent={colors.green.text} />
            ))}
            {jobsByStatus.inProgress.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{jobsByStatus.inProgress.length - 4} more</p>}
          </PipelineColumn>

          <PipelineColumn title="Finalization" count={jobsByStatus.awaitingFinalization.length} color="#9333ea" onClick={() => navigate('/jobs?filter=awaiting-finalization')}>
            {jobsByStatus.awaitingFinalization.slice(0, 4).map(j => (
              <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => navigate(`/jobs/${j.job_id}`)} accent="#9333ea" />
            ))}
            {jobsByStatus.awaitingFinalization.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{jobsByStatus.awaitingFinalization.length - 4} more</p>}
          </PipelineColumn>

          <PipelineColumn title="Completed" count={jobsByStatus.completedToday.length} color={colors.green.text} onClick={() => navigate('/jobs?filter=completed')}>
            {jobsByStatus.completedToday.slice(0, 4).map(j => (
              <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => navigate(`/jobs/${j.job_id}`)} accent={colors.green.text} />
            ))}
            {jobsByStatus.completedToday.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{jobsByStatus.completedToday.length - 4} more</p>}
          </PipelineColumn>
        </div>
      </Section>

      {/* ===== TODAY'S SCHEDULE ===== */}
      <Section
        title="Today's Schedule"
        icon={<Clock className="w-4 h-4" style={{ color: colors.blue.text }} />}
        badge={todaySchedule.length}
        defaultOpen={todaySchedule.length > 0}
        actions={
          <button onClick={() => navigate('/calendar')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            Calendar <ChevronRight className="w-3 h-3" />
          </button>
        }
      >
        {todaySchedule.length === 0 ? (
          <div className="py-3 text-center">
            <Clock className="w-8 h-8 mx-auto mb-1 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No jobs scheduled today</p>
          </div>
        ) : (
          <div className="max-h-[200px] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-1.5">
              {todaySchedule.map(({ job, tech, time, status }) => {
                const statusStyles = {
                  completed: { bg: colors.green.bg, dot: colors.green.text },
                  'in-progress': { bg: colors.blue.bg, dot: colors.blue.text },
                  upcoming: { bg: 'var(--surface-2)', dot: 'var(--text-muted)' },
                };
                const s = statusStyles[status];
                return (
                  <button
                    key={job.job_id}
                    onClick={() => navigate(`/jobs/${job.job_id}`)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all hover:opacity-80"
                    style={{ background: s.bg }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                    <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{time}</span>
                    <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{job.job_number || job.title}</span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{tech}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* ===== TWO COLUMN: TEAM + TODAY'S PROGRESS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team Status */}
        <Section
          title="Team"
          icon={<Users className="w-4 h-4" style={{ color: colors.blue.text }} />}
          actions={
            <button onClick={() => navigate('/people?tab=employees')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          }
        >
          <div className="max-h-[200px] overflow-y-auto pr-1">
            {teamStatus.length === 0 ? (
              <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>No technicians</p>
            ) : (
              teamStatus
                .sort((a, b) => {
                  const order = { overloaded: 0, busy: 1, available: 2 };
                  return order[a.status] - order[b.status];
                })
                .map(({ tech, activeCount, status }) => {
                  const statusConfig = {
                    available: { color: colors.green.text, bg: colors.green.bg, label: 'Available' },
                    busy: { color: colors.blue.text, bg: colors.blue.bg, label: `${activeCount} jobs` },
                    overloaded: { color: colors.red.text, bg: colors.red.bg, label: `${activeCount} jobs` },
                  };
                  const config = statusConfig[status];
                  return (
                    <div key={tech.user_id} className="flex items-center gap-3 py-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                        {tech.name?.charAt(0) || '?'}
                      </div>
                      <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{tech.name}</span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: config.bg }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
                        <span className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </Section>

        {/* Today's Progress + Financial */}
        <div className="space-y-4">
          <Section
            title="Today's Progress"
            icon={<TrendingUp className="w-4 h-4" style={{ color: colors.green.text }} />}
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: 'var(--text-muted)' }}>Completed</span>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>{jobsByStatus.completedToday.length}/{totalDueToday}</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${completionPct}%`, background: `linear-gradient(90deg, ${colors.green.text}, ${colors.blue.text})` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold" style={{ color: completionPct >= 80 ? colors.green.text : completionPct >= 50 ? colors.blue.text : colors.orange.text }}>
                  {completionPct}%
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="Financial"
            icon={<DollarSign className="w-4 h-4" style={{ color: colors.green.text }} />}
            actions={
              <button onClick={() => navigate('/invoices')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                Billing <ChevronRight className="w-3 h-3" />
              </button>
            }
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl text-center" style={{ background: colors.orange.bg }}>
                <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{jobsByStatus.awaitingFinalization.length}</p>
                <p className="text-[10px]" style={{ color: colors.orange.text }}>To Invoice</p>
              </div>
              <div className="p-2.5 rounded-xl text-center" style={{ background: colors.blue.bg }}>
                <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{jobsByStatus.awaitingAck.length}</p>
                <p className="text-[10px]" style={{ color: colors.blue.text }}>Awaiting Ack</p>
              </div>
              <div className="p-2.5 rounded-xl text-center" style={{ background: colors.green.bg }}>
                <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>RM{(weeklyRevenue / 1000).toFixed(1)}k</p>
                <p className="text-[10px]" style={{ color: colors.green.text }}>7-Day Rev</p>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* ===== TWO COLUMN: LOW STOCK + RECENT ACTIVITY ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Low Stock Alert */}
        <Section
          title="Low Stock"
          icon={<Package className="w-4 h-4" style={{ color: colors.orange.text }} />}
          badge={lowStockCount}
          defaultOpen={lowStockCount > 0}
          actions={
            <button onClick={() => navigate('/inventory?filter=low-stock')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              All items <ChevronRight className="w-3 h-3" />
            </button>
          }
        >
          {lowStockItems.length === 0 ? (
            <div className="py-3 text-center">
              <Package className="w-8 h-8 mx-auto mb-1 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Stock levels OK</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {lowStockItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: colors.orange.bg }}>
                  <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--text)' }}>{item.name}</span>
                  <span className="text-xs font-bold" style={{ color: item.quantity === 0 ? colors.red.text : colors.orange.text }}>
                    {item.quantity}/{item.min}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Recent Activity */}
        <Section
          title="Recent Activity"
          icon={<Clock className="w-4 h-4" style={{ color: colors.blue.text }} />}
        >
          {recentActivity.length === 0 ? (
            <div className="py-3 text-center">
              <Clock className="w-8 h-8 mx-auto mb-1 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentActivity.map(({ job, status, agoText, techName: tech }) => {
                const statusColor = status === 'Completed' ? colors.green.text : status === 'In Progress' ? colors.blue.text : 'var(--text-muted)';
                return (
                  <button
                    key={job.job_id}
                    onClick={() => navigate(`/jobs/${job.job_id}`)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all hover:opacity-80"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor }} />
                    <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{job.job_number || job.title}</span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{tech}</span>
                    <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{agoText}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {/* ===== BULK ACTION BAR (floating) ===== */}
      <BulkActionBar
        count={selectedApprovalIds.size}
        onClear={() => setSelectedApprovalIds(new Set())}
        actions={[
          {
            label: processing ? 'Processing...' : 'Confirm Parts',
            icon: <CheckCircle className="w-3.5 h-3.5" />,
            onClick: handleBulkConfirmParts,
            variant: 'primary',
          },
          {
            label: processing ? 'Processing...' : 'Finalize Invoices',
            icon: <FileText className="w-3.5 h-3.5" />,
            onClick: handleBulkFinalize,
            variant: 'default',
          },
        ]}
      />
    </div>
  );
};

export default AdminDashboardV7_1;

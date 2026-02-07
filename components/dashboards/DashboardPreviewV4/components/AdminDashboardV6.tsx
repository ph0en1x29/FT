/**
 * AdminDashboardV6 - Full-Featured Prototype
 * 
 * New features over V5:
 * - Smarter context-aware greeting
 * - Quick Actions row (1-click common tasks)
 * - Outstanding Invoices card
 * - Today's Schedule Timeline
 * - SLA Metrics
 * - Low Stock Alert
 * - Notification Filters
 * 
 * Toggle: Only visible to dev@test.com for testing
 */

import React, { useState, useMemo } from 'react';
import { Job, User, UserRole } from '../../../../types';
import {
  AlertTriangle, Clock, CheckCircle, Users,
  Plus, Bell, UserX, Timer,
  RefreshCw, Play, DollarSign, ChevronRight,
  Wrench, MessageSquare, Package, FileText,
  Send, Zap, TrendingUp, AlertCircle,
  Filter, Calendar, Target
} from 'lucide-react';
import { colors, EscalationBanner } from './DashboardWidgets';
import { useNotifications } from '../../../../hooks/useQueryHooks';

interface AdminDashboardV6Props {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

// Compact KPI Card
const KPICard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: 'red' | 'orange' | 'blue' | 'green' | 'purple';
  alert?: boolean;
  onClick?: () => void;
  subtext?: string;
}> = ({ label, value, icon, accent, alert, onClick, subtext }) => (
  <button
    onClick={onClick}
    className={`relative p-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${alert ? 'animate-pulse' : ''}`}
    style={{ background: colors[accent].bg, border: `1px solid ${colors[accent].text}30` }}
  >
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs font-medium" style={{ color: colors[accent].text }}>{label}</span>
      <div style={{ color: colors[accent].text }}>{icon}</div>
    </div>
    <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
    {subtext && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtext}</p>}
  </button>
);

// Quick Action Button
const QuickAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, count, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
  >
    <span style={{ color: 'var(--accent)' }}>{icon}</span>
    <span style={{ color: 'var(--text)' }}>{label}</span>
    {count !== undefined && count > 0 && (
      <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: 'var(--accent)', color: 'white' }}>
        {count}
      </span>
    )}
  </button>
);

// Action Card
const ActionCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  detail: string;
  accent: 'red' | 'orange' | 'blue' | 'purple' | 'green';
  onClick: () => void;
}> = ({ icon, label, detail, accent, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-left flex-1 min-w-[180px]"
    style={{ background: colors[accent].bg, border: `1px solid ${colors[accent].text}20` }}
  >
    <div className="p-2 rounded-lg" style={{ background: `${colors[accent].text}20` }}>
      <div style={{ color: colors[accent].text }}>{icon}</div>
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{label}</p>
      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{detail}</p>
    </div>
  </button>
);

// Team Chip
const TeamChip: React.FC<{
  name: string;
  count: number;
  status: 'available' | 'busy' | 'overloaded';
}> = ({ name, count, status }) => {
  const statusColors = { available: colors.green, busy: colors.blue, overloaded: colors.red };
  const c = statusColors[status];
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: c.bg, border: `1px solid ${c.text}30` }}>
      <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{name.split(' ')[0]}</span>
      {count > 0 && (
        <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: c.text, color: 'white' }}>{count}</span>
      )}
    </div>
  );
};

// Schedule Timeline Item
const ScheduleItem: React.FC<{
  time: string;
  tech: string;
  job: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  onClick: () => void;
}> = ({ time, tech, job, status, onClick }) => {
  const statusStyles = {
    completed: { bg: colors.green.bg, border: colors.green.text, dot: colors.green.text },
    'in-progress': { bg: colors.blue.bg, border: colors.blue.text, dot: colors.blue.text },
    upcoming: { bg: 'var(--surface-2)', border: 'var(--border)', dot: 'var(--text-muted)' },
  };
  const s = statusStyles[status];
  return (
    <button onClick={onClick} className="flex items-center gap-3 p-2 rounded-lg transition-all hover:opacity-80 w-full text-left" style={{ background: s.bg }}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      <span className="text-xs font-mono w-12 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{time}</span>
      <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--text)' }}>{job}</span>
      <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>{tech}</span>
    </button>
  );
};

// Notification type filter
type NotificationFilter = 'all' | 'jobs' | 'requests' | 'system';

const AdminDashboardV6: React.FC<AdminDashboardV6Props> = ({ currentUser, jobs, users, onRefresh, navigate }) => {
  const today = new Date();
  const todayStr = today.toDateString();
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>('all');
  
  // Fetch notifications
  const { data: notifications = [] } = useNotifications(currentUser.user_id, false);

  const technicians = users.filter(u => u.role === UserRole.TECHNICIAN && u.is_active);
  
  // Job categorization
  const overdueJobs = jobs.filter(j => {
    if (['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)) return false;
    const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
    return scheduled && scheduled < new Date(todayStr) && j.status !== 'New';
  });
  const unassignedJobs = jobs.filter(j => !j.assigned_technician_id && !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
  const inProgressJobs = jobs.filter(j => j.status === 'In Progress');
  const escalatedJobs = jobs.filter(j => j.is_escalated && !j.escalation_acknowledged_at);
  const awaitingAckJobs = jobs.filter(j => j.status === 'Completed Awaiting Ack');
  const disputedJobs = jobs.filter(j => j.status === 'Disputed');
  const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');
  const dueTodayJobs = jobs.filter(j => {
    if (['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)) return false;
    const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
    return scheduled && scheduled.toDateString() === todayStr;
  });
  const completedTodayJobs = jobs.filter(j => {
    if (j.status !== 'Completed') return false;
    const completed = j.completed_at ? new Date(j.completed_at) : null;
    return completed && completed.toDateString() === todayStr;
  });

  // Revenue calculations
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const completedLastWeek = jobs.filter(j => j.status === 'Completed' && j.completed_at && new Date(j.completed_at) >= weekAgo);
  const laborRate = 150;
  const weeklyRevenue = completedLastWeek.reduce((acc, job) => {
    const partsUsed = job.parts_used || [];
    const partsCost = partsUsed.reduce((sum, p) => sum + ((p.sell_price_at_time || 0) * (p.quantity || 0)), 0);
    return acc + partsCost + laborRate;
  }, 0);

  // SLA calculations
  const slaMetrics = useMemo(() => {
    const completedJobs = jobs.filter(j => j.status === 'Completed' && j.completed_at);
    const onTimeJobs = completedJobs.filter(j => {
      const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
      const completed = j.completed_at ? new Date(j.completed_at) : null;
      if (!scheduled || !completed) return true;
      return completed <= new Date(scheduled.getTime() + 24 * 60 * 60 * 1000); // Within 24h of scheduled
    });
    const avgResponseMinutes = completedJobs.length > 0 
      ? completedJobs.reduce((acc, j) => {
          const created = new Date(j.created_at);
          const started = j.started_at ? new Date(j.started_at) : null;
          if (!started) return acc;
          return acc + (started.getTime() - created.getTime()) / 60000;
        }, 0) / completedJobs.filter(j => j.started_at).length
      : 0;
    
    return {
      onTimeRate: completedJobs.length > 0 ? Math.round((onTimeJobs.length / completedJobs.length) * 100) : 100,
      avgResponseHours: Math.round(avgResponseMinutes / 60 * 10) / 10 || 0,
      completionRate: jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0,
    };
  }, [jobs]);

  // Team status
  const getTeamStatus = (tech: User) => {
    const techJobs = jobs.filter(j => j.assigned_technician_id === tech.user_id && !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
    const activeCount = techJobs.length;
    if (activeCount === 0) return { status: 'available' as const, count: 0 };
    if (activeCount >= 3) return { status: 'overloaded' as const, count: activeCount };
    return { status: 'busy' as const, count: activeCount };
  };
  const availableTechs = technicians.filter(t => getTeamStatus(t).status === 'available').length;
  const techsByStatus = {
    overloaded: technicians.filter(t => getTeamStatus(t).status === 'overloaded'),
    busy: technicians.filter(t => getTeamStatus(t).status === 'busy'),
    available: technicians.filter(t => getTeamStatus(t).status === 'available'),
  };

  // Action items
  const actionItems = [
    ...escalatedJobs.map(j => ({ job: j, type: 'escalated' as const, icon: <AlertTriangle className="w-4 h-4" />, accent: 'red' as const })),
    ...overdueJobs.map(j => ({ job: j, type: 'overdue' as const, icon: <Clock className="w-4 h-4" />, accent: 'orange' as const })),
    ...disputedJobs.map(j => ({ job: j, type: 'disputed' as const, icon: <MessageSquare className="w-4 h-4" />, accent: 'purple' as const })),
    ...awaitingAckJobs.map(j => ({ job: j, type: 'awaiting' as const, icon: <CheckCircle className="w-4 h-4" />, accent: 'blue' as const })),
  ];

  // Today's schedule (mock timeline from actual jobs)
  const todaySchedule = useMemo(() => {
    return dueTodayJobs
      .map(j => {
        const tech = users.find(u => u.user_id === j.assigned_technician_id);
        const scheduledTime = j.scheduled_date ? new Date(j.scheduled_date) : new Date();
        let status: 'completed' | 'in-progress' | 'upcoming' = 'upcoming';
        if (j.status === 'Completed') status = 'completed';
        else if (j.status === 'In Progress') status = 'in-progress';
        return {
          job: j,
          tech: tech?.name?.split(' ')[0] || 'Unassigned',
          time: scheduledTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          status,
        };
      })
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 5);
  }, [dueTodayJobs, users]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'all') return notifications;
    return notifications.filter(n => {
      const type = n.type?.toLowerCase() || '';
      if (notifFilter === 'jobs') return type.includes('job') || type.includes('assign') || type.includes('complete');
      if (notifFilter === 'requests') return type.includes('request') || type.includes('leave');
      if (notifFilter === 'system') return type.includes('system') || type.includes('alert');
      return true;
    });
  }, [notifications, notifFilter]);

  // Smart greeting
  const getSmartGreeting = () => {
    const hour = today.getHours();
    const base = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = currentUser.name?.split(' ')[0] || 'Admin';
    
    const alerts: string[] = [];
    if (escalatedJobs.length > 0) alerts.push(`${escalatedJobs.length} escalation${escalatedJobs.length > 1 ? 's' : ''}`);
    if (overdueJobs.length > 0) alerts.push(`${overdueJobs.length} overdue`);
    if (unassignedJobs.length > 0) alerts.push(`${unassignedJobs.length} unassigned`);
    
    const summary = `${dueTodayJobs.length} jobs today, ${availableTechs} tech${availableTechs !== 1 ? 's' : ''} available`;
    const alertText = alerts.length > 0 ? ` • ⚠️ ${alerts.join(', ')}` : '';
    
    return { greeting: `${base}, ${firstName}`, summary: summary + alertText };
  };

  const { greeting, summary } = getSmartGreeting();

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'escalated': return '🔥 Escalated';
      case 'overdue': return '⏰ Overdue';
      case 'disputed': return '⚠️ Disputed';
      case 'awaiting': return '✓ Awaiting Ack';
      default: return type;
    }
  };

  // Placeholder: Low stock would come from inventory service
  const lowStockCount = 0; // TODO: Integrate with inventory service

  return (
    <div className="space-y-4">
      {/* Header with Smart Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{greeting}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            🚀 V6
          </span>
          <button onClick={onRefresh} className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
          <button onClick={() => navigate('/jobs/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95" style={{ background: colors.blue.text, color: 'white' }}>
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>
      </div>

      {/* Escalation Banner */}
      <EscalationBanner count={escalatedJobs.length} onClick={() => navigate('/jobs?filter=escalated')} />

      {/* Quick Actions Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium mr-2" style={{ color: 'var(--text-muted)' }}>Quick Actions:</span>
        <QuickAction icon={<UserX className="w-4 h-4" />} label="Assign Jobs" count={unassignedJobs.length} onClick={() => navigate('/jobs?filter=unassigned')} disabled={unassignedJobs.length === 0} />
        <QuickAction icon={<FileText className="w-4 h-4" />} label="Generate Invoices" count={awaitingFinalization.length} onClick={() => navigate('/jobs?filter=awaiting-finalization')} disabled={awaitingFinalization.length === 0} />
        <QuickAction icon={<Send className="w-4 h-4" />} label="Send Reminders" onClick={() => navigate('/notifications')} />
        {lowStockCount > 0 && (
          <QuickAction icon={<Package className="w-4 h-4" />} label="Low Stock" count={lowStockCount} onClick={() => navigate('/inventory?filter=low-stock')} />
        )}
      </div>

      {/* KPI Row - 6 cards */}
      <div className="grid grid-cols-6 gap-3">
        <KPICard label="Overdue" value={overdueJobs.length} icon={<Clock className="w-4 h-4" />} accent="red" alert={overdueJobs.length > 0} onClick={() => navigate('/jobs?filter=overdue')} />
        <KPICard label="Unassigned" value={unassignedJobs.length} icon={<UserX className="w-4 h-4" />} accent="orange" onClick={() => navigate('/jobs?filter=unassigned')} />
        <KPICard label="In Progress" value={inProgressJobs.length} icon={<Play className="w-4 h-4" />} accent="blue" onClick={() => navigate('/jobs?filter=in-progress')} />
        <KPICard label="On-Time %" value={`${slaMetrics.onTimeRate}%`} icon={<Target className="w-4 h-4" />} accent="green" subtext="SLA" />
        <KPICard label="Avg Response" value={`${slaMetrics.avgResponseHours}h`} icon={<Timer className="w-4 h-4" />} accent="purple" subtext="to start" />
        <KPICard label="Revenue (7d)" value={`RM ${(weeklyRevenue / 1000).toFixed(1)}k`} icon={<DollarSign className="w-4 h-4" />} accent="green" onClick={() => navigate('/invoices')} />
      </div>

      {/* Main Content - 2 columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Action Required */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: colors.red.text }} />
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Action Required</h3>
                {actionItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: colors.red.bg, color: colors.red.text }}>{actionItems.length}</span>
                )}
              </div>
              {actionItems.length > 5 && (
                <button onClick={() => navigate('/jobs?filter=action-required')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="p-3">
              {actionItems.length === 0 ? (
                <div className="py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: colors.green.text, opacity: 0.5 }} />
                  <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>All clear!</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {actionItems.slice(0, 5).map(({ job, type, icon, accent }) => (
                    <ActionCard key={job.job_id} icon={icon} label={job.job_number || job.title} detail={`${getTypeLabel(type)} • ${job.customer?.name || 'Unknown'}`} accent={accent} onClick={() => navigate(`/jobs/${job.job_id}`)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: colors.blue.text }} />
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Today's Schedule</h3>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{dueTodayJobs.length} jobs</span>
              </div>
              <button onClick={() => navigate('/calendar')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                Full calendar <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2 space-y-1">
              {todaySchedule.length === 0 ? (
                <div className="py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No jobs scheduled today</p>
                </div>
              ) : (
                todaySchedule.map(({ job, tech, time, status }) => (
                  <ScheduleItem key={job.job_id} time={time} tech={tech} job={job.job_number || job.title} status={status} onClick={() => navigate(`/jobs/${job.job_id}`)} />
                ))
              )}
            </div>
          </div>

          {/* Team Status */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: colors.blue.text }} />
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Team</h3>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{availableTechs}/{technicians.length} available</span>
              </div>
              <button onClick={() => navigate('/people?tab=employees')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              {technicians.length === 0 ? (
                <div className="py-2 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No technicians</div>
              ) : (
                <>
                  {techsByStatus.overloaded.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium w-16" style={{ color: colors.red.text }}>🔴</span>
                      {techsByStatus.overloaded.map(tech => <TeamChip key={tech.user_id} name={tech.name} count={getTeamStatus(tech).count} status="overloaded" />)}
                    </div>
                  )}
                  {techsByStatus.busy.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium w-16" style={{ color: colors.blue.text }}>🔵</span>
                      {techsByStatus.busy.map(tech => <TeamChip key={tech.user_id} name={tech.name} count={getTeamStatus(tech).count} status="busy" />)}
                    </div>
                  )}
                  {techsByStatus.available.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium w-16" style={{ color: colors.green.text }}>🟢</span>
                      {techsByStatus.available.map(tech => <TeamChip key={tech.user_id} name={tech.name} count={0} status="available" />)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Notifications with Filter */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: colors.purple.text }} />
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Notifications</h3>
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'jobs', 'requests', 'system'] as NotificationFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setNotifFilter(f)}
                    className="px-2 py-1 rounded text-[10px] font-medium transition-colors"
                    style={{
                      background: notifFilter === f ? 'var(--accent)' : 'transparent',
                      color: notifFilter === f ? 'white' : 'var(--text-muted)',
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                filteredNotifications.slice(0, 8).map(n => (
                  <button
                    key={n.id}
                    onClick={() => n.link && navigate(n.link)}
                    className="w-full text-left p-2 rounded-lg transition-colors hover:opacity-80"
                    style={{ background: n.is_read ? 'transparent' : colors.blue.bg }}
                  >
                    <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{n.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                  </button>
                ))
              )}
            </div>
            {filteredNotifications.length > 8 && (
              <div className="px-4 py-2 border-t text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                <button onClick={() => navigate('/notifications')} className="text-xs font-medium hover:opacity-70" style={{ color: 'var(--accent)' }}>
                  View all {filteredNotifications.length} notifications →
                </button>
              </div>
            )}
          </div>

          {/* Outstanding Invoices */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" style={{ color: colors.orange.text }} />
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Outstanding</h3>
              </div>
              <button onClick={() => navigate('/invoices?filter=outstanding')} className="text-xs font-medium hover:opacity-70" style={{ color: 'var(--accent)' }}>
                View all →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl" style={{ background: colors.orange.bg }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Awaiting Invoice</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{awaitingFinalization.length}</p>
                <p className="text-[10px]" style={{ color: colors.orange.text }}>jobs ready</p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: colors.red.bg }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Awaiting Ack</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text)' }}>{awaitingAckJobs.length}</p>
                <p className="text-[10px]" style={{ color: colors.red.text }}>need customer sign</p>
              </div>
            </div>
          </div>

          {/* Daily Stats */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4" style={{ color: colors.green.text }} />
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Today's Progress</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>Completed</span>
                  <span style={{ color: 'var(--text)' }}>{completedTodayJobs.length}/{dueTodayJobs.length + completedTodayJobs.length}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${dueTodayJobs.length + completedTodayJobs.length > 0 ? (completedTodayJobs.length / (dueTodayJobs.length + completedTodayJobs.length)) * 100 : 0}%`,
                      background: colors.green.text,
                    }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: colors.green.text }}>
                  {dueTodayJobs.length + completedTodayJobs.length > 0 ? Math.round((completedTodayJobs.length / (dueTodayJobs.length + completedTodayJobs.length)) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardV6;

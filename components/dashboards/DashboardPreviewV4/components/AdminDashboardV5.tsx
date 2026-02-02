/**
 * AdminDashboardV5 - Option C Style Layout
 * 
 * Changes from V4:
 * - Full-width sections with top 5 items
 * - "View all" links for each section
 * - Cleaner vertical flow
 * 
 * Toggle: Only visible to dev@test.com for testing
 */

import React, { useState } from 'react';
import { Job, User, UserRole } from '../../../../types';
import {
  AlertTriangle, Clock, CheckCircle, Users,
  Plus, Bell, UserX, Timer, FileText,
  RefreshCw, Play, DollarSign, ChevronRight,
  Wrench, MessageSquare, Package
} from 'lucide-react';
import { colors, EscalationBanner, KPICard, TeamRow } from './DashboardWidgets';
import DashboardNotificationCard from '../../../DashboardNotificationCard';

interface AdminDashboardV5Props {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

// Action item card component
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
    style={{ 
      background: colors[accent].bg, 
      border: `1px solid ${colors[accent].text}20`
    }}
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

// Team chip component
const TeamChip: React.FC<{
  name: string;
  count: number;
  status: 'available' | 'busy' | 'overloaded';
  onClick?: () => void;
}> = ({ name, count, status, onClick }) => {
  const statusColors = {
    available: colors.green,
    busy: colors.blue,
    overloaded: colors.red,
  };
  const c = statusColors[status];
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:scale-[1.02]"
      style={{ background: c.bg, border: `1px solid ${c.text}30` }}
    >
      <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>
        {name.split(' ')[0]}
      </span>
      {count > 0 && (
        <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: c.text, color: 'white' }}>
          {count}
        </span>
      )}
    </button>
  );
};

const AdminDashboardV5: React.FC<AdminDashboardV5Props> = ({ currentUser, jobs, users, onRefresh, navigate }) => {
  const today = new Date();
  const todayStr = today.toDateString();

  const technicians = users.filter(u => u.role === UserRole.TECHNICIAN && u.is_active);
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
  const dueTodayJobs = jobs.filter(j => {
    if (['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)) return false;
    const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
    return scheduled && scheduled.toDateString() === todayStr;
  });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const completedLastWeek = jobs.filter(j => j.status === 'Completed' && j.completed_at && new Date(j.completed_at) >= weekAgo);
  const laborRate = 150;
  const weeklyRevenue = completedLastWeek.reduce((acc, job) => {
    const partsUsed = job.parts_used || [];
    const partsCost = partsUsed.reduce((sum, p) => sum + ((p.sell_price_at_time || 0) * (p.quantity || 0)), 0);
    return acc + partsCost + laborRate;
  }, 0);

  const getTeamStatus = (tech: User) => {
    const techJobs = jobs.filter(j => j.assigned_technician_id === tech.user_id && !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
    const activeCount = techJobs.length;
    if (activeCount === 0) return { status: 'available' as const, count: 0 };
    if (activeCount >= 3) return { status: 'overloaded' as const, count: activeCount };
    return { status: 'busy' as const, count: activeCount };
  };

  const availableTechs = technicians.filter(t => getTeamStatus(t).status === 'available').length;
  
  // Build action items list
  const actionItems = [
    ...escalatedJobs.map(j => ({ job: j, type: 'escalated' as const, icon: <AlertTriangle className="w-4 h-4" />, accent: 'red' as const })),
    ...overdueJobs.map(j => ({ job: j, type: 'overdue' as const, icon: <Clock className="w-4 h-4" />, accent: 'orange' as const })),
    ...disputedJobs.map(j => ({ job: j, type: 'disputed' as const, icon: <MessageSquare className="w-4 h-4" />, accent: 'purple' as const })),
    ...awaitingAckJobs.map(j => ({ job: j, type: 'awaiting' as const, icon: <CheckCircle className="w-4 h-4" />, accent: 'blue' as const })),
  ];
  
  const totalActionItems = actionItems.length;

  // Group technicians by status
  const techsByStatus = {
    overloaded: technicians.filter(t => getTeamStatus(t).status === 'overloaded'),
    busy: technicians.filter(t => getTeamStatus(t).status === 'busy'),
    available: technicians.filter(t => getTeamStatus(t).status === 'available'),
  };

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'escalated': return '🔥 Escalated';
      case 'overdue': return '⏰ Overdue';
      case 'disputed': return '⚠️ Disputed';
      case 'awaiting': return '✓ Awaiting Ack';
      default: return type;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {getGreeting()}, {currentUser.name?.split(' ')[0] || 'Admin'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-600 text-white">
            🧪 V5
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

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Overdue" value={overdueJobs.length} icon={<Clock className="w-4 h-4" />} accent="red" alert={overdueJobs.length > 0} onClick={() => navigate('/jobs?filter=overdue')} />
        <KPICard label="Unassigned" value={unassignedJobs.length} icon={<UserX className="w-4 h-4" />} accent="orange" onClick={() => navigate('/jobs?filter=unassigned')} />
        <KPICard label="In Progress" value={inProgressJobs.length} icon={<Play className="w-4 h-4" />} accent="blue" onClick={() => navigate('/jobs?filter=in-progress')} />
        <KPICard label="Revenue (7d)" value={`RM ${(weeklyRevenue / 1000).toFixed(1)}k`} icon={<DollarSign className="w-4 h-4" />} accent="green" onClick={() => navigate('/invoices')} />
      </div>

      {/* Action Required - Full Width, Top 5 */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" style={{ color: colors.red.text }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Action Required</h3>
            {totalActionItems > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: colors.red.bg, color: colors.red.text }}>
                {totalActionItems}
              </span>
            )}
          </div>
          {totalActionItems > 5 && (
            <button onClick={() => navigate('/jobs?filter=action-required')} className="text-xs font-medium hover:opacity-70 transition-opacity flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              View all {totalActionItems} jobs <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="p-3">
          {actionItems.length === 0 ? (
            <div className="py-6 text-center" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{ color: colors.green.text, opacity: 0.5 }} />
              <p className="font-medium" style={{ color: 'var(--text)' }}>All clear!</p>
              <p className="text-xs">No urgent items need attention</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {actionItems.slice(0, 5).map(({ job, type, icon, accent }) => (
                <ActionCard
                  key={job.job_id}
                  icon={icon}
                  label={job.job_number || job.title}
                  detail={`${getTypeLabel(type)} • ${job.customer?.name || 'Unknown'}`}
                  accent={accent}
                  onClick={() => navigate(`/jobs/${job.job_id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notifications - Full Width, Top 5 */}
      <DashboardNotificationCard maxItems={5} expandable={true} />

      {/* Team Status - Full Width, Grouped Chips */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: colors.blue.text }} />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Team Status</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {availableTechs} of {technicians.length} available
            </span>
          </div>
          <button onClick={() => navigate('/people?tab=employees')} className="text-xs font-medium hover:opacity-70 transition-opacity flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            View all {technicians.length} technicians <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {technicians.length === 0 ? (
            <div className="py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No technicians configured</p>
            </div>
          ) : (
            <>
              {/* Overloaded */}
              {techsByStatus.overloaded.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium w-20" style={{ color: colors.red.text }}>
                    🔴 Overloaded
                  </span>
                  {techsByStatus.overloaded.map(tech => (
                    <TeamChip
                      key={tech.user_id}
                      name={tech.name}
                      count={getTeamStatus(tech).count}
                      status="overloaded"
                    />
                  ))}
                </div>
              )}
              
              {/* Busy */}
              {techsByStatus.busy.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium w-20" style={{ color: colors.blue.text }}>
                    🔵 Busy
                  </span>
                  {techsByStatus.busy.map(tech => (
                    <TeamChip
                      key={tech.user_id}
                      name={tech.name}
                      count={getTeamStatus(tech).count}
                      status="busy"
                    />
                  ))}
                </div>
              )}
              
              {/* Available */}
              {techsByStatus.available.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium w-20" style={{ color: colors.green.text }}>
                    🟢 Available
                  </span>
                  {techsByStatus.available.map(tech => (
                    <TeamChip
                      key={tech.user_id}
                      name={tech.name}
                      count={0}
                      status="available"
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Due Today</span>
            <Clock className="w-4 h-4" style={{ color: colors.blue.text }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{dueTodayJobs.length}</p>
          <button onClick={() => navigate('/jobs?filter=today')} className="text-xs mt-1 hover:opacity-70" style={{ color: 'var(--accent)' }}>
            View schedule →
          </button>
        </div>
        
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Completed (7d)</span>
            <CheckCircle className="w-4 h-4" style={{ color: colors.green.text }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{completedLastWeek.length}</p>
          <button onClick={() => navigate('/jobs?filter=completed')} className="text-xs mt-1 hover:opacity-70" style={{ color: 'var(--accent)' }}>
            View history →
          </button>
        </div>
        
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Active Jobs</span>
            <Wrench className="w-4 h-4" style={{ color: colors.purple.text }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{inProgressJobs.length + jobs.filter(j => j.status === 'Assigned').length}</p>
          <button onClick={() => navigate('/jobs')} className="text-xs mt-1 hover:opacity-70" style={{ color: 'var(--accent)' }}>
            View all jobs →
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardV5;

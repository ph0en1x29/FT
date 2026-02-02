/**
 * AdminDashboardV5 - Prototype with integrated notifications
 * 
 * Changes from V4:
 * - Added DashboardNotificationCard to main view
 * - Reorganized layout: 3-column bottom row instead of 2
 * - Notifications visible alongside Job Status and Quick Stats
 * 
 * Toggle: Only visible to dev@test.com for testing
 */

import React, { useState, useRef, useEffect } from 'react';
import { Job, User, UserRole } from '../../../../types';
import {
  AlertTriangle, Clock, CheckCircle, Users,
  Plus, Bell, UserX, Timer, FileText,
  RefreshCw, Play, DollarSign, ChevronRight, X
} from 'lucide-react';
import { colors, EscalationBanner, KPICard, QueueItem, TeamRow, QuickChip, QueueItemType } from './DashboardWidgets';
import DashboardNotificationCard from '../../../DashboardNotificationCard';

interface AdminDashboardV5Props {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

const AdminDashboardV5: React.FC<AdminDashboardV5Props> = ({ currentUser, jobs, users, onRefresh, navigate }) => {
  const today = new Date();
  const todayStr = today.toDateString();
  const [activeTab, setActiveTab] = useState<'action' | 'today' | 'unassigned'>('action');

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
  const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');

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
  const actionRequiredCount = escalatedJobs.length + disputedJobs.length + awaitingAckJobs.length + overdueJobs.length;

  const getQueueItems = (): { job: Job; type: QueueItemType; urgent: boolean }[] => {
    switch (activeTab) {
      case 'action':
        return [
          ...escalatedJobs.map(j => ({ job: j, type: 'escalated' as const, urgent: true })),
          ...overdueJobs.map(j => ({ job: j, type: 'overdue' as const, urgent: false })),
          ...disputedJobs.map(j => ({ job: j, type: 'disputed' as const, urgent: false })),
          ...awaitingAckJobs.map(j => ({ job: j, type: 'awaiting' as const, urgent: false })),
        ];
      case 'today':
        return dueTodayJobs.map(j => ({ job: j, type: 'due-today' as const, urgent: false }));
      case 'unassigned':
        return unassignedJobs.map(j => ({ job: j, type: 'unassigned' as const, urgent: false }));
      default:
        return [];
    }
  };

  const queueItems = getQueueItems();

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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
          {/* Prototype Badge */}
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-600 text-white">
            🧪 V5 Prototype
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

      {/* Work Queue + Team Status + Notifications (NEW: 3-column layout) */}
      <div className="grid grid-cols-12 gap-5">
        {/* Work Queue - 5 cols */}
        <div className="col-span-5 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-1">
              <button onClick={() => setActiveTab('action')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ background: activeTab === 'action' ? colors.red.bg : 'transparent', color: activeTab === 'action' ? colors.red.text : 'var(--text-muted)' }}>Action ({actionRequiredCount})</button>
              <button onClick={() => setActiveTab('today')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ background: activeTab === 'today' ? colors.blue.bg : 'transparent', color: activeTab === 'today' ? colors.blue.text : 'var(--text-muted)' }}>Today ({dueTodayJobs.length})</button>
              <button onClick={() => setActiveTab('unassigned')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ background: activeTab === 'unassigned' ? colors.orange.bg : 'transparent', color: activeTab === 'unassigned' ? colors.orange.text : 'var(--text-muted)' }}>New ({unassignedJobs.length})</button>
            </div>
            <button onClick={() => navigate('/jobs')} className="text-xs font-medium hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)' }}>All →</button>
          </div>
          <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
            {queueItems.length === 0 ? (
              <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: colors.green.text }} />
                <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>All clear!</p>
              </div>
            ) : (
              queueItems.slice(0, 6).map(({ job, type, urgent }) => (
                <QueueItem key={job.job_id} type={type} jobNumber={job.job_number || job.title} customer={job.customer?.name || 'Unknown'} detail={job.job_type || ''} urgent={urgent} onClick={() => navigate(`/jobs/${job.job_id}`)} />
              ))
            )}
          </div>
        </div>

        {/* Team Status - 3 cols */}
        <div className="col-span-3 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Team</h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{availableTechs}/{technicians.length} available</p>
            </div>
          </div>
          <div className="p-2 space-y-1 max-h-56 overflow-y-auto">
            {technicians.length === 0 ? (
              <div className="py-4 text-center" style={{ color: 'var(--text-muted)' }}><Users className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-xs">No technicians</p></div>
            ) : (
              technicians.map(tech => {
                const status = getTeamStatus(tech);
                return <TeamRow key={tech.user_id} name={tech.name} status={status.status} jobCount={status.count} />;
              })
            )}
          </div>
        </div>

        {/* Notifications - 4 cols (NEW) */}
        <div className="col-span-4">
          <DashboardNotificationCard maxItems={5} expandable={true} />
        </div>
      </div>

      {/* Job Status + Quick Stats (2 columns) */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Job Status</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Current</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Completed', color: colors.green.text, value: jobs.filter(j => j.status === 'Completed').length },
              { label: 'In Progress', color: colors.blue.text, value: inProgressJobs.length },
              { label: 'Assigned', color: colors.purple.text, value: jobs.filter(j => j.status === 'Assigned').length },
              { label: 'New', color: colors.orange.text, value: jobs.filter(j => j.status === 'New').length },
            ].map(item => {
              const total = jobs.length || 1;
              const percent = (item.value / total) * 100;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Quick Stats</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Today</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: colors.green.bg }}>
              <p className="text-2xl font-semibold" style={{ color: colors.green.text }}>{jobs.filter(j => ['Completed', 'Completed Awaiting Ack'].includes(j.status) && j.completed_at && new Date(j.completed_at).toDateString() === todayStr).length}</p>
              <p className="text-xs" style={{ color: colors.green.text }}>Completed</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: colors.purple.bg }}>
              <p className="text-2xl font-semibold" style={{ color: colors.purple.text }}>{awaitingFinalization.length}</p>
              <p className="text-xs" style={{ color: colors.purple.text }}>To Finalize</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: colors.blue.bg }}>
              <p className="text-2xl font-semibold" style={{ color: colors.blue.text }}>{jobs.filter(j => new Date(j.created_at).toDateString() === todayStr).length}</p>
              <p className="text-xs" style={{ color: colors.blue.text }}>Created</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: colors.orange.bg }}>
              <p className="text-2xl font-semibold" style={{ color: colors.orange.text }}>{escalatedJobs.length}</p>
              <p className="text-xs" style={{ color: colors.orange.text }}>Escalated</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardV5;

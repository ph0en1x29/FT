/**
 * SupervisorDashboardV5 - Prototype with team-focused layout
 * 
 * Changes from Admin:
 * - Removed Revenue KPI (not supervisor focus)
 * - Larger Team Status section (primary focus)
 * - Added technician workload distribution
 * - Job assignment overview
 * - Notifications inline
 */

import React, { useState } from 'react';
import { Job, User, UserRole } from '../../../../types';
import {
  Clock, CheckCircle, Users, UserX, Play, AlertTriangle,
  RefreshCw, Plus, ChevronRight
} from 'lucide-react';
import { colors, EscalationBanner, KPICard, QueueItem, QueueItemType } from './DashboardWidgets';
import DashboardNotificationCard from '../../../DashboardNotificationCard';

interface SupervisorDashboardV5Props {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

const SupervisorDashboardV5: React.FC<SupervisorDashboardV5Props> = ({ 
  currentUser, jobs, users, onRefresh, navigate 
}) => {
  const today = new Date();
  const todayStr = today.toDateString();
  const [activeTab, setActiveTab] = useState<'action' | 'today' | 'unassigned'>('action');

  // Data calculations
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

  // Team workload calculations
  const getTeamStatus = (tech: User) => {
    const techJobs = jobs.filter(j => j.assigned_technician_id === tech.user_id && !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
    const activeCount = techJobs.length;
    if (activeCount === 0) return { status: 'available' as const, count: 0, jobs: techJobs };
    if (activeCount >= 3) return { status: 'overloaded' as const, count: activeCount, jobs: techJobs };
    return { status: 'busy' as const, count: activeCount, jobs: techJobs };
  };

  const techsWithStatus = technicians.map(tech => ({
    ...tech,
    workload: getTeamStatus(tech)
  })).sort((a, b) => b.workload.count - a.workload.count);

  const availableTechs = techsWithStatus.filter(t => t.workload.status === 'available').length;
  const overloadedTechs = techsWithStatus.filter(t => t.workload.status === 'overloaded').length;
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

  const getStatusColor = (status: 'available' | 'busy' | 'overloaded') => {
    switch (status) {
      case 'available': return colors.green;
      case 'busy': return colors.blue;
      case 'overloaded': return colors.red;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {getGreeting()}, {currentUser.name?.split(' ')[0] || 'Supervisor'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-600 text-white">
            🧪 V5 Supervisor
          </span>
          <button onClick={onRefresh} className="p-2 rounded-xl transition-all hover:scale-105" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
          <button onClick={() => navigate('/jobs/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: colors.blue.text, color: 'white' }}>
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>
      </div>

      {/* Escalation Banner */}
      <EscalationBanner count={escalatedJobs.length} onClick={() => navigate('/jobs?filter=escalated')} />

      {/* KPI Cards - Supervisor focused (no revenue) */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Overdue" value={overdueJobs.length} icon={<Clock className="w-4 h-4" />} accent="red" alert={overdueJobs.length > 0} onClick={() => navigate('/jobs?filter=overdue')} />
        <KPICard label="Unassigned" value={unassignedJobs.length} icon={<UserX className="w-4 h-4" />} accent="orange" onClick={() => navigate('/jobs?filter=unassigned')} />
        <KPICard label="In Progress" value={inProgressJobs.length} icon={<Play className="w-4 h-4" />} accent="blue" onClick={() => navigate('/jobs?filter=in-progress')} />
        <KPICard 
          label="Team Available" 
          value={`${availableTechs}/${technicians.length}`} 
          icon={<Users className="w-4 h-4" />} 
          accent={overloadedTechs > 0 ? "orange" : "green"} 
          alert={overloadedTechs > 0}
          onClick={() => {}} 
        />
      </div>

      {/* Main Content: Work Queue + Team Workload */}
      <div className="grid grid-cols-2 gap-5">
        {/* Work Queue */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-1">
              <button onClick={() => setActiveTab('action')} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: activeTab === 'action' ? colors.red.bg : 'transparent', color: activeTab === 'action' ? colors.red.text : 'var(--text-muted)' }}>Action ({actionRequiredCount})</button>
              <button onClick={() => setActiveTab('today')} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: activeTab === 'today' ? colors.blue.bg : 'transparent', color: activeTab === 'today' ? colors.blue.text : 'var(--text-muted)' }}>Today ({dueTodayJobs.length})</button>
              <button onClick={() => setActiveTab('unassigned')} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: activeTab === 'unassigned' ? colors.orange.bg : 'transparent', color: activeTab === 'unassigned' ? colors.orange.text : 'var(--text-muted)' }}>New ({unassignedJobs.length})</button>
            </div>
            <button onClick={() => navigate('/jobs')} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>All →</button>
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

        {/* Notifications */}
        <DashboardNotificationCard maxItems={6} expandable={true} />
      </div>

      {/* Team Workload - PRIMARY SECTION FOR SUPERVISOR */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Team Workload</h3>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {availableTechs} available · {techsWithStatus.filter(t => t.workload.status === 'busy').length} busy · {overloadedTechs} overloaded
            </p>
          </div>
          <button onClick={() => navigate('/team')} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
            Manage Team →
          </button>
        </div>
        <div className="p-3">
          {technicians.length === 0 ? (
            <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No technicians in team</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {techsWithStatus.map(tech => {
                const statusColor = getStatusColor(tech.workload.status);
                return (
                  <div
                    key={tech.user_id}
                    className="p-3 rounded-xl cursor-pointer hover:scale-[1.02] transition-transform"
                    style={{ background: statusColor.bg, border: `1px solid ${statusColor.text}20` }}
                    onClick={() => navigate(`/team?user=${tech.user_id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>
                        {tech.name || tech.full_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: statusColor.text, color: 'white' }}>
                        {tech.workload.count} jobs
                      </span>
                    </div>
                    <p className="text-[10px] capitalize" style={{ color: statusColor.text }}>
                      {tech.workload.status === 'available' ? '✓ Available for assignment' : 
                       tech.workload.status === 'overloaded' ? '⚠ Overloaded' : 'Working'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboardV5;

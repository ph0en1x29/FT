import React, { useState, useRef, useEffect } from 'react';
import { Job, User, UserRole } from '../../../../types';
import {
  AlertTriangle, Clock, CheckCircle, Users,
  Plus, Bell, UserX, Timer, FileText,
  RefreshCw, Play, DollarSign, ChevronRight, X, FlaskConical
} from 'lucide-react';
import { colors, EscalationBanner, KPICard, QueueItem, TeamRow, QuickChip, QueueItemType } from './DashboardWidgets';
import AdminDashboardV5 from './AdminDashboardV5';
import AdminDashboardV6 from './AdminDashboardV6';

interface AdminDashboardProps {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
  hideV5Toggle?: boolean; // Hide V5 toggle when used inside SupervisorDashboard
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, jobs, users, onRefresh, navigate, hideV5Toggle = false }) => {
  const today = new Date();
  const todayStr = today.toDateString();
  const [activeTab, setActiveTab] = useState<'action' | 'today' | 'unassigned'>('action');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // Prototype toggle - only for dev@test.com (and not hidden by parent)
  const isDevUser = currentUser.email === 'dev@test.com' && !hideV5Toggle;
  const [protoVersion, setProtoVersion] = useState<'v4' | 'v5' | 'v6'>('v4');

  // Click outside handler for notification dropdown (MUST be before any early return)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Prototype versions - render if enabled (after all hooks)
  if (isDevUser && protoVersion !== 'v4') {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Prototype:</span>
            <button
              onClick={() => setProtoVersion('v5')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${protoVersion === 'v5' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'}`}
            >
              V5
            </button>
            <button
              onClick={() => setProtoVersion('v6')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${protoVersion === 'v6' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
            >
              🚀 V6
            </button>
          </div>
          <button
            onClick={() => setProtoVersion('v4')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            ← Back to V4
          </button>
        </div>
        {protoVersion === 'v5' && (
          <AdminDashboardV5 currentUser={currentUser} jobs={jobs} users={users} onRefresh={onRefresh} navigate={navigate} />
        )}
        {protoVersion === 'v6' && (
          <AdminDashboardV6 currentUser={currentUser} jobs={jobs} users={users} onRefresh={onRefresh} navigate={navigate} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{getGreeting()}, {currentUser.name.split(' ')[0]}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          {unassignedJobs.length > 0 && <QuickChip icon={<UserX className="w-3.5 h-3.5" />} label="Assign" count={unassignedJobs.length} accent="#FF9500" onClick={() => navigate('/jobs?filter=unassigned')} />}
          {awaitingFinalization.length > 0 && <QuickChip icon={<FileText className="w-3.5 h-3.5" />} label="Finalize" count={awaitingFinalization.length} accent="#AF52DE" onClick={() => navigate('/invoices')} />}
          {/* Notification Bell with Dropdown */}
          <div ref={notificationRef} className="relative">
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="relative p-2 rounded-xl transition-all hover:scale-105 active:scale-95"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              title="Action Required"
            >
              <Bell className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              {actionRequiredCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-[10px] font-semibold rounded-full" style={{ background: colors.red.text, color: 'white' }}>
                  {actionRequiredCount > 9 ? '9+' : actionRequiredCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {notificationOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-lg overflow-hidden z-50"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Action Required</h3>
                  <button
                    onClick={() => setNotificationOpen(false)}
                    className="p-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="max-h-96 overflow-y-auto">
                  {actionRequiredCount === 0 ? (
                    <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                      <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: colors.green.text }} />
                      <p className="font-medium" style={{ color: 'var(--text)' }}>All clear!</p>
                      <p className="text-sm">No items need attention</p>
                    </div>
                  ) : (
                    <>
                      {/* Escalated Section */}
                      {escalatedJobs.length > 0 && (
                        <div>
                          <div className="px-4 py-2 flex items-center gap-2" style={{ background: colors.red.bg }}>
                            <AlertTriangle className="w-3.5 h-3.5" style={{ color: colors.red.text }} />
                            <span className="text-xs font-semibold uppercase" style={{ color: colors.red.text }}>
                              Escalated ({escalatedJobs.length})
                            </span>
                          </div>
                          {escalatedJobs.slice(0, 5).map(job => (
                            <div
                              key={job.job_id}
                              onClick={() => { setNotificationOpen(false); navigate(`/jobs/${job.job_id}`); }}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                                  {job.job_number || job.title}
                                </p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                  {job.customer?.name || 'Unknown'}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Overdue Section */}
                      {overdueJobs.length > 0 && (
                        <div>
                          <div className="px-4 py-2 flex items-center gap-2" style={{ background: colors.red.bg }}>
                            <Clock className="w-3.5 h-3.5" style={{ color: colors.red.text }} />
                            <span className="text-xs font-semibold uppercase" style={{ color: colors.red.text }}>
                              Overdue ({overdueJobs.length})
                            </span>
                          </div>
                          {overdueJobs.slice(0, 5).map(job => (
                            <div
                              key={job.job_id}
                              onClick={() => { setNotificationOpen(false); navigate(`/jobs/${job.job_id}`); }}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                                  {job.job_number || job.title}
                                </p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                  {job.customer?.name || 'Unknown'}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Disputed Section */}
                      {disputedJobs.length > 0 && (
                        <div>
                          <div className="px-4 py-2 flex items-center gap-2" style={{ background: colors.orange.bg }}>
                            <AlertTriangle className="w-3.5 h-3.5" style={{ color: colors.orange.text }} />
                            <span className="text-xs font-semibold uppercase" style={{ color: colors.orange.text }}>
                              Disputed ({disputedJobs.length})
                            </span>
                          </div>
                          {disputedJobs.slice(0, 5).map(job => (
                            <div
                              key={job.job_id}
                              onClick={() => { setNotificationOpen(false); navigate(`/jobs/${job.job_id}`); }}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                                  {job.job_number || job.title}
                                </p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                  {job.customer?.name || 'Unknown'}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Awaiting Ack Section */}
                      {awaitingAckJobs.length > 0 && (
                        <div>
                          <div className="px-4 py-2 flex items-center gap-2" style={{ background: colors.purple.bg }}>
                            <Timer className="w-3.5 h-3.5" style={{ color: colors.purple.text }} />
                            <span className="text-xs font-semibold uppercase" style={{ color: colors.purple.text }}>
                              Awaiting Ack ({awaitingAckJobs.length})
                            </span>
                          </div>
                          {awaitingAckJobs.slice(0, 5).map(job => (
                            <div
                              key={job.job_id}
                              onClick={() => { setNotificationOpen(false); navigate(`/jobs/${job.job_id}`); }}
                              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                                  {job.job_number || job.title}
                                </p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                  {job.customer?.name || 'Unknown'}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    onClick={() => { setNotificationOpen(false); navigate('/jobs?tab=active'); }}
                    className="w-full text-center text-sm font-medium py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    View All Jobs →
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Prototype Toggle - only for dev user */}
          {isDevUser && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setProtoVersion('v5')}
                className="px-3 py-2 rounded-l-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 bg-purple-600 text-white hover:bg-purple-700"
                title="Try Dashboard V5"
              >
                🧪 V5
              </button>
              <button
                onClick={() => setProtoVersion('v6')}
                className="px-3 py-2 rounded-r-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90"
                title="Try Dashboard V6 (Full Featured)"
              >
                🚀 V6
              </button>
            </div>
          )}
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

      {/* Work Queue + Team Status */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-1">
              <button onClick={() => setActiveTab('action')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ background: activeTab === 'action' ? colors.red.bg : 'transparent', color: activeTab === 'action' ? colors.red.text : 'var(--text-muted)' }}>Action Required ({actionRequiredCount})</button>
              <button onClick={() => setActiveTab('today')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ background: activeTab === 'today' ? colors.blue.bg : 'transparent', color: activeTab === 'today' ? colors.blue.text : 'var(--text-muted)' }}>Due Today ({dueTodayJobs.length})</button>
              <button onClick={() => setActiveTab('unassigned')} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ background: activeTab === 'unassigned' ? colors.orange.bg : 'transparent', color: activeTab === 'unassigned' ? colors.orange.text : 'var(--text-muted)' }}>Unassigned ({unassignedJobs.length})</button>
            </div>
            <button onClick={() => navigate('/jobs')} className="text-xs font-medium hover:opacity-70 transition-opacity" style={{ color: 'var(--accent)' }}>View All →</button>
          </div>
          <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
            {queueItems.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: colors.green.text }} />
                <p className="font-medium" style={{ color: 'var(--text)' }}>All clear!</p>
                <p className="text-sm">No items in this queue</p>
              </div>
            ) : (
              queueItems.slice(0, 8).map(({ job, type, urgent }) => (
                <QueueItem key={job.job_id} type={type} jobNumber={job.job_number || job.title} customer={job.customer?.name || 'Unknown'} detail={job.job_type || ''} urgent={urgent} onClick={() => navigate(`/jobs/${job.job_id}`)} />
              ))
            )}
          </div>
        </div>
        <div className="col-span-4 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Team Status</h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{availableTechs} of {technicians.length} available</p>
            </div>
          </div>
          <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
            {technicians.length === 0 ? (
              <div className="py-6 text-center" style={{ color: 'var(--text-muted)' }}><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No technicians</p></div>
            ) : (
              technicians.map(tech => {
                const status = getTeamStatus(tech);
                return <TeamRow key={tech.user_id} name={tech.name} status={status.status} jobCount={status.count} />;
              })
            )}
          </div>
        </div>
      </div>

      {/* Job Status + Quick Stats */}
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
            {(() => {
              const completedToday = jobs.filter(j => ['Completed', 'Completed Awaiting Ack'].includes(j.status) && j.completed_at && new Date(j.completed_at).toDateString() === todayStr).length;
              const toFinalize = awaitingFinalization.length;
              const createdToday = jobs.filter(j => new Date(j.created_at).toDateString() === todayStr).length;
              const escalated = escalatedJobs.length;
              
              // Dynamic colors based on values
              const toFinalizeColor = toFinalize === 0 ? colors.green : colors.purple;
              const escalatedColor = escalated === 0 ? colors.green : colors.red;
              
              return (
                <>
                  <div className="p-3 rounded-xl" style={{ background: colors.green.bg }}>
                    <p className="text-2xl font-semibold" style={{ color: colors.green.text }}>{completedToday}</p>
                    <p className="text-xs" style={{ color: colors.green.text }}>Completed Today</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: toFinalizeColor.bg }}>
                    <p className="text-2xl font-semibold" style={{ color: toFinalizeColor.text }}>{toFinalize}</p>
                    <p className="text-xs" style={{ color: toFinalizeColor.text }}>To Finalize</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: colors.blue.bg }}>
                    <p className="text-2xl font-semibold" style={{ color: colors.blue.text }}>{createdToday}</p>
                    <p className="text-xs" style={{ color: colors.blue.text }}>Created Today</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: escalatedColor.bg }}>
                    <p className="text-2xl font-semibold" style={{ color: escalatedColor.text }}>{escalated}</p>
                    <p className="text-xs" style={{ color: escalatedColor.text }}>Escalated</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

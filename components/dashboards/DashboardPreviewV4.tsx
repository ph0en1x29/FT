import React, { useState, useRef, useEffect } from 'react';
import { Job, User, UserRole } from '../../types';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Clock, CheckCircle, Users,
  ChevronRight, Play, DollarSign, UserX, Timer, FileText,
  Plus, BarChart3, Bell, ArrowUpRight, ArrowDownRight,
  Calendar, RefreshCw, ArrowRight, TrendingUp, X
} from 'lucide-react';

/**
 * Dashboard Preview V4 - "Calm Focus"
 *
 * Role-aware dashboard with calm design principles:
 * - Admin/Supervisor: Full operational view
 * - Technician: Personal "My Jobs" focus
 * - Accountant: Financial/invoice focus
 */

interface DashboardPreviewV4Props {
  currentUser: User;
  displayRole: UserRole; // The role to display dashboard for
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
}

// ============================================
// DESIGN TOKENS
// ============================================
const colors = {
  red: { bg: 'rgba(255, 59, 48, 0.08)', text: '#FF3B30', border: 'rgba(255, 59, 48, 0.15)' },
  orange: { bg: 'rgba(255, 149, 0, 0.08)', text: '#FF9500', border: 'rgba(255, 149, 0, 0.15)' },
  green: { bg: 'rgba(52, 199, 89, 0.08)', text: '#34C759', border: 'rgba(52, 199, 89, 0.15)' },
  blue: { bg: 'rgba(0, 122, 255, 0.08)', text: '#007AFF', border: 'rgba(0, 122, 255, 0.15)' },
  purple: { bg: 'rgba(175, 82, 222, 0.08)', text: '#AF52DE', border: 'rgba(175, 82, 222, 0.15)' },
};

// ============================================
// SHARED COMPONENTS
// ============================================

const EscalationBanner: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => {
  if (count === 0) return null;
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.995]"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 59, 48, 0.06) 0%, rgba(255, 149, 0, 0.04) 100%)',
        border: '1px solid rgba(255, 59, 48, 0.12)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: colors.red.bg }}>
          <AlertTriangle className="w-4 h-4" style={{ color: colors.red.text }} />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {count} escalation{count !== 1 ? 's' : ''} need attention
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Review and acknowledge to resolve</p>
        </div>
      </div>
      <button
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
        style={{ background: colors.red.text, color: 'white' }}
      >
        Review <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

const KPICard: React.FC<{
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  accent: keyof typeof colors;
  alert?: boolean;
  onClick?: () => void;
}> = ({ label, value, sublabel, icon, accent, alert, onClick }) => {
  const c = colors[accent];
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl p-4 transition-all ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${alert ? c.text : 'var(--border)'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-2xl font-semibold mt-1" style={{ color: alert ? c.text : 'var(--text)', letterSpacing: '-0.02em' }}>{value}</p>
          {sublabel && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
          <div style={{ color: c.text }}>{icon}</div>
        </div>
      </div>
    </div>
  );
};

const QueueItem: React.FC<{
  type: 'overdue' | 'escalated' | 'unassigned' | 'awaiting' | 'due-today' | 'disputed' | 'assigned' | 'in-progress';
  jobNumber: string;
  customer: string;
  detail: string;
  urgent?: boolean;
  onClick?: () => void;
}> = ({ type, jobNumber, customer, detail, urgent, onClick }) => {
  const typeConfig = {
    overdue: { icon: <Clock className="w-4 h-4" />, color: colors.red },
    escalated: { icon: <AlertTriangle className="w-4 h-4" />, color: colors.red },
    unassigned: { icon: <UserX className="w-4 h-4" />, color: colors.orange },
    awaiting: { icon: <Timer className="w-4 h-4" />, color: colors.purple },
    disputed: { icon: <AlertTriangle className="w-4 h-4" />, color: colors.orange },
    'due-today': { icon: <Calendar className="w-4 h-4" />, color: colors.blue },
    assigned: { icon: <CheckCircle className="w-4 h-4" />, color: colors.blue },
    'in-progress': { icon: <Play className="w-4 h-4" />, color: colors.orange },
  };
  const config = typeConfig[type];

  return (
    <div onClick={onClick} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-2)] cursor-pointer transition-colors">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: config.color.bg }}>
        <div style={{ color: config.color.text }}>{config.icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{jobNumber}</p>
          {urgent && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: colors.red.bg, color: colors.red.text }}>URGENT</span>
          )}
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{customer} · {detail}</p>
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
    </div>
  );
};

const TeamRow: React.FC<{ name: string; status: 'available' | 'busy' | 'overloaded'; jobCount: number }> = ({ name, status, jobCount }) => {
  const statusConfig = {
    available: { color: colors.green.text, bg: colors.green.bg, label: 'Available' },
    busy: { color: colors.orange.text, bg: colors.orange.bg, label: `${jobCount} jobs` },
    overloaded: { color: colors.red.text, bg: colors.red.bg, label: `${jobCount} jobs` },
  };
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
        {name.charAt(0)}
      </div>
      <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{name}</span>
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: config.bg }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
        <span className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</span>
      </div>
    </div>
  );
};

const QuickChip: React.FC<{ icon: React.ReactNode; label: string; count?: number; accent?: string; onClick?: () => void }> = ({ icon, label, count, accent, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
    style={{ background: accent ? `${accent}10` : 'var(--surface)', border: '1px solid var(--border)', color: accent || 'var(--text)' }}
  >
    {icon}
    <span>{label}</span>
    {count !== undefined && count > 0 && (
      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: accent ? `${accent}15` : 'var(--surface-2)', color: accent || 'var(--text-muted)' }}>{count}</span>
    )}
  </button>
);

// ============================================
// ADMIN/SUPERVISOR DASHBOARD
// ============================================
const AdminDashboard: React.FC<{
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}> = ({ currentUser, jobs, users, onRefresh, navigate }) => {
  const today = new Date();
  const todayStr = today.toDateString();
  const [activeTab, setActiveTab] = useState<'action' | 'today' | 'unassigned'>('action');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Click outside handler for notification dropdown
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

  const getQueueItems = () => {
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
                                  {(job as any).job_number || job.title}
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
                                  {(job as any).job_number || job.title}
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
                                  {(job as any).job_number || job.title}
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
                                  {(job as any).job_number || job.title}
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
                <QueueItem key={job.job_id} type={type} jobNumber={(job as any).job_number || job.title} customer={job.customer?.name || 'Unknown'} detail={job.job_type || ''} urgent={urgent} onClick={() => navigate(`/jobs/${job.job_id}`)} />
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
            <div className="p-3 rounded-xl" style={{ background: colors.green.bg }}>
              <p className="text-2xl font-semibold" style={{ color: colors.green.text }}>{jobs.filter(j => ['Completed', 'Completed Awaiting Ack'].includes(j.status) && j.completed_at && new Date(j.completed_at).toDateString() === todayStr).length}</p>
              <p className="text-xs" style={{ color: colors.green.text }}>Completed Today</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: colors.purple.bg }}>
              <p className="text-2xl font-semibold" style={{ color: colors.purple.text }}>{awaitingFinalization.length}</p>
              <p className="text-xs" style={{ color: colors.purple.text }}>To Finalize</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: colors.blue.bg }}>
              <p className="text-2xl font-semibold" style={{ color: colors.blue.text }}>{jobs.filter(j => new Date(j.created_at).toDateString() === todayStr).length}</p>
              <p className="text-xs" style={{ color: colors.blue.text }}>Created Today</p>
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

// ============================================
// TECHNICIAN DASHBOARD
// ============================================
const TechnicianDashboard: React.FC<{
  currentUser: User;
  jobs: Job[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}> = ({ currentUser, jobs, onRefresh, navigate }) => {
  const today = new Date();
  const todayStr = today.toDateString();

  const myJobs = jobs.filter(j => j.assigned_technician_id === currentUser.user_id && !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
  const todayJobs = myJobs.filter(j => {
    const jobDate = new Date(j.scheduled_date || j.created_at);
    return jobDate.toDateString() === todayStr;
  });
  const inProgressJob = myJobs.find(j => j.status === 'In Progress');
  const assignedJobs = myJobs.filter(j => j.status === 'Assigned');
  const completedToday = jobs.filter(j => {
    const isCompleted = ['Completed', 'Completed Awaiting Ack'].includes(j.status);
    const completedDate = j.completed_at ? new Date(j.completed_at) : null;
    return isCompleted && completedDate?.toDateString() === todayStr && j.assigned_technician_id === currentUser.user_id;
  }).length;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const completedThisWeek = jobs.filter(j =>
    ['Completed', 'Completed Awaiting Ack'].includes(j.status) && j.completed_at && new Date(j.completed_at) >= weekAgo && j.assigned_technician_id === currentUser.user_id
  ).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>My Jobs</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={onRefresh} className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Current Job Banner */}
      {inProgressJob && (
        <div className="p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(255, 149, 0, 0.12) 0%, rgba(255, 149, 0, 0.06) 100%)', border: '1px solid rgba(255, 149, 0, 0.2)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255, 149, 0, 0.15)' }}>
                <Play className="w-6 h-6" style={{ color: '#FF9500' }} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#FF9500' }}>Currently Working</p>
                <p className="font-semibold text-lg" style={{ color: 'var(--text)' }}>{(inProgressJob as any).job_number || inProgressJob.title}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{inProgressJob.customer?.name}</p>
              </div>
            </div>
            <button onClick={() => navigate(`/jobs/${inProgressJob.job_id}`)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105" style={{ background: '#FF9500', color: 'white' }}>
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Today" value={todayJobs.length} sublabel="Scheduled" icon={<Calendar className="w-4 h-4" />} accent="blue" />
        <KPICard label="Completed" value={completedToday} sublabel="Today" icon={<CheckCircle className="w-4 h-4" />} accent="green" />
        <KPICard label="This Week" value={completedThisWeek} sublabel="Completed" icon={<TrendingUp className="w-4 h-4" />} accent="purple" />
      </div>

      {/* Job Queue */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>My Queue</h3>
          <button onClick={() => navigate('/jobs')} className="text-xs font-medium hover:opacity-70" style={{ color: 'var(--accent)' }}>View All →</button>
        </div>
        <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
          {assignedJobs.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: colors.green.text }} />
              <p className="font-medium" style={{ color: 'var(--text)' }}>Queue clear!</p>
              <p className="text-sm">No pending jobs</p>
            </div>
          ) : (
            assignedJobs.map(job => (
              <QueueItem key={job.job_id} type="assigned" jobNumber={(job as any).job_number || job.title} customer={job.customer?.name || 'Unknown'} detail={job.job_type || ''} onClick={() => navigate(`/jobs/${job.job_id}`)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// ACCOUNTANT DASHBOARD
// ============================================
const AccountantDashboard: React.FC<{
  jobs: Job[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}> = ({ jobs, onRefresh, navigate }) => {
  const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');
  const completedJobs = jobs.filter(j => j.status === 'Completed');
  const laborRate = 150;
  const pendingInvoiceValue = awaitingFinalization.length * 850;
  const monthlyRevenue = completedJobs.reduce((acc, job) => {
    const partsUsed = job.parts_used || [];
    const partsCost = partsUsed.reduce((sum, p) => sum + ((p.sell_price_at_time || 0) * (p.quantity || 0)), 0);
    return acc + partsCost + laborRate;
  }, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Financial Overview</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Invoice and payment management</p>
        </div>
        <button onClick={onRefresh} className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Pending Invoices" value={awaitingFinalization.length} sublabel="Ready to finalize" icon={<FileText className="w-4 h-4" />} accent="blue" />
        <KPICard label="Pending Value" value={`RM ${pendingInvoiceValue.toLocaleString()}`} sublabel="Estimated" icon={<Clock className="w-4 h-4" />} accent="orange" />
        <KPICard label="Completed" value={completedJobs.length} sublabel="Month to date" icon={<CheckCircle className="w-4 h-4" />} accent="green" />
        <KPICard label="Revenue" value={`RM ${monthlyRevenue.toLocaleString()}`} sublabel="Month to date" icon={<TrendingUp className="w-4 h-4" />} accent="purple" />
      </div>

      {/* Jobs Ready for Finalization */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Ready for Finalization</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{awaitingFinalization.length} jobs awaiting invoice</p>
          </div>
          <button onClick={() => navigate('/invoices')} className="text-xs font-medium hover:opacity-70" style={{ color: 'var(--accent)' }}>View All →</button>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {awaitingFinalization.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: colors.green.text }} />
              <p className="font-medium" style={{ color: 'var(--text)' }}>All caught up!</p>
              <p className="text-sm">No jobs pending finalization</p>
            </div>
          ) : (
            awaitingFinalization.slice(0, 5).map(job => (
              <div key={job.job_id} onClick={() => navigate(`/jobs/${job.job_id}`)} className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--text)' }}>{(job as any).job_number || job.title}</p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{job.customer?.name} · {job.job_type}</p>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN V4 COMPONENT - ROLE ROUTER
// ============================================
const DashboardPreviewV4: React.FC<DashboardPreviewV4Props> = ({ currentUser, displayRole, jobs, users, onRefresh }) => {
  const navigate = useNavigate();

  switch (displayRole) {
    case UserRole.TECHNICIAN:
      return <TechnicianDashboard currentUser={currentUser} jobs={jobs} onRefresh={onRefresh} navigate={navigate} />;
    case UserRole.ACCOUNTANT:
      return <AccountantDashboard jobs={jobs} onRefresh={onRefresh} navigate={navigate} />;
    case UserRole.ADMIN:
    case UserRole.SUPERVISOR:
    default:
      return <AdminDashboard currentUser={currentUser} jobs={jobs} users={users} onRefresh={onRefresh} navigate={navigate} />;
  }
};

export default DashboardPreviewV4;

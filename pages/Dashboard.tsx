import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, Check, MessageSquare, Calendar, TrendingUp, Briefcase, DollarSign, Zap, ArrowRight, AlertCircle, CheckCircle2, XCircle, Timer, Eye, StickyNote } from 'lucide-react';
import { UserRole, Job, JobStatus, User } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import ServiceAutomationWidget from '../components/ServiceAutomationWidget';
import { showToast } from '../services/toastService';
import NotificationPanel from '../components/NotificationPanel';
import { useRealtimeNotifications } from '../utils/useRealtimeNotifications';

interface DashboardProps {
  role: UserRole;
  currentUser: User;
}

type ActionTab = 'all' | 'escalated' | 'awaiting' | 'disputed';

// Centralized status config for consistency
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  [JobStatus.COMPLETED]: { label: 'Completed', color: '#166534', bg: '#dcfce7' },
  [JobStatus.AWAITING_FINALIZATION]: { label: 'Awaiting Final', color: '#7c3aed', bg: '#f3e8ff' },
  [JobStatus.IN_PROGRESS]: { label: 'In Progress', color: '#0066cc', bg: '#dbeafe' },
  [JobStatus.NEW]: { label: 'New', color: '#0369a1', bg: '#e0f2fe' },
  [JobStatus.ASSIGNED]: { label: 'Assigned', color: '#4f46e5', bg: '#e0e7ff' },
  [JobStatus.COMPLETED_AWAITING_ACK]: { label: 'Awaiting Ack', color: '#c2410c', bg: '#ffedd5' },
  [JobStatus.DISPUTED]: { label: 'Disputed', color: '#dc2626', bg: '#fee2e2' },
  [JobStatus.INCOMPLETE_CONTINUING]: { label: 'Continuing', color: '#a16207', bg: '#fef3c7' },
  [JobStatus.INCOMPLETE_REASSIGNED]: { label: 'Reassigned', color: '#be185d', bg: '#fce7f3' },
  [JobStatus.CANCELLED]: { label: 'Cancelled', color: '#71717a', bg: '#f4f4f5' },
};

// Chart colors matching status config
const CHART_COLORS: Record<string, string> = {
  [JobStatus.COMPLETED]: '#22c55e',
  [JobStatus.AWAITING_FINALIZATION]: '#8b5cf6',
  [JobStatus.IN_PROGRESS]: '#0066cc',
  [JobStatus.NEW]: '#06b6d4',
  [JobStatus.ASSIGNED]: '#6366f1',
  [JobStatus.COMPLETED_AWAITING_ACK]: '#f97316',
  [JobStatus.DISPUTED]: '#ef4444',
  [JobStatus.INCOMPLETE_CONTINUING]: '#eab308',
  [JobStatus.INCOMPLETE_REASSIGNED]: '#ec4899',
};

const Dashboard: React.FC<DashboardProps> = ({ role, currentUser }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalatedJobs, setEscalatedJobs] = useState<any[]>([]);
  const [escalationChecked, setEscalationChecked] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [actionTab, setActionTab] = useState<ActionTab>('all');
  const navigate = useNavigate();

  // Real-time notifications with sound and browser alerts
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    refresh: refreshNotifications,
  } = useRealtimeNotifications(currentUser, {
    playSound: true,
    showBrowserNotifications: true,
    onJobUpdate: () => {
      // Refresh dashboard when job updates come in
      loadDashboardData();
    },
  });

  const isAdmin = role === UserRole.ADMIN;
  const isSupervisor = role === UserRole.SUPERVISOR;
  const showServiceAutomation = isAdmin || isSupervisor;

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  useEffect(() => {
    if ((isAdmin || isSupervisor) && !escalationChecked) {
      checkEscalations();
    }
  }, [isAdmin, isSupervisor, escalationChecked]);

  const checkEscalations = async () => {
    try {
      const result = await MockDb.checkAndTriggerEscalations();
      if (result.escalated > 0) {
        showToast.warning(
          `${result.escalated} job(s) escalated`,
          'Jobs exceeded time limit without completion'
        );
      }
      const allEscalated = await MockDb.getEscalatedJobs();
      setEscalatedJobs(allEscalated);
      
      const autoResult = await MockDb.checkAndAutoCompleteJobs();
      if (autoResult.completed > 0) {
        showToast.info(
          `${autoResult.completed} job(s) auto-completed`,
          'Customer acknowledgement deadline passed'
        );
      }
      
      setEscalationChecked(true);
    } catch (e) {
      console.error('Escalation check error:', e);
    }
  };

  const loadDashboardData = async () => {
    try {
      const jobsData = await MockDb.getJobs(currentUser);
      setJobs(jobsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      showToast.error('Failed to load dashboard data', 'Please refresh the page');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeEscalation = async (jobId: string) => {
    const success = await MockDb.acknowledgeEscalation(jobId, currentUser.user_id);
    if (success) {
      showToast.success('Escalation acknowledged');
      const updated = await MockDb.getEscalatedJobs();
      setEscalatedJobs(updated);
    } else {
      showToast.error('Failed to acknowledge escalation');
    }
  };

  const handleSaveNotes = async (jobId: string) => {
    const success = await MockDb.updateEscalationNotes(jobId, notesInput);
    if (success) {
      showToast.success('Notes saved');
      setEditingNotesId(null);
      const updated = await MockDb.getEscalatedJobs();
      setEscalatedJobs(updated);
    } else {
      showToast.error('Failed to save notes');
    }
  };

  const handleMarkOvertime = async (jobId: string) => {
    const success = await MockDb.markJobAsOvertime(jobId, true);
    if (success) {
      showToast.success('Job marked as overtime (escalation disabled)');
      const updated = await MockDb.getEscalatedJobs();
      setEscalatedJobs(updated);
    } else {
      showToast.error('Failed to mark as overtime');
    }
  };

  const getDaysOverdue = (escalationTriggeredAt: string): number => {
    const escalated = new Date(escalationTriggeredAt);
    const now = new Date();
    const diffMs = now.getTime() - escalated.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  // Calculate stats
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const jobsThisWeek = jobs.filter(j => new Date(j.created_at) >= oneWeekAgo);
  
  // Count by status
  const statusCounts = Object.values(JobStatus).reduce((acc, status) => {
    acc[status] = jobs.filter(j => j.status === status).length;
    return acc;
  }, {} as Record<string, number>);

  const awaitingAckJobs = jobs.filter(j => j.status === JobStatus.COMPLETED_AWAITING_ACK);
  const disputedJobs = jobs.filter(j => j.status === JobStatus.DISPUTED);

  // Build chart data for ALL statuses with values > 0
  const dataStatus = Object.entries(statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      name: STATUS_CONFIG[status]?.label || status.replace(/_/g, ' '),
      value: count,
      color: CHART_COLORS[status] || '#94a3b8',
    }));

  const laborRate = 150;
  const totalRevenue = jobs.reduce((acc, job) => {
    const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
    return acc + partsCost + (job.status !== JobStatus.NEW ? laborRate : 0);
  }, 0);

  const jobsWithArrival = jobs.filter(j => j.arrival_time);
  const avgResponseHours = jobsWithArrival.length > 0
    ? jobsWithArrival.reduce((acc, j) => {
        const created = new Date(j.created_at).getTime();
        const arrived = new Date(j.arrival_time!).getTime();
        return acc + ((arrived - created) / (1000 * 60 * 60));
      }, 0) / jobsWithArrival.length
    : 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const dataRevenue = last7Days.map(date => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayJobs = jobs.filter(j => {
      const jobDate = new Date(j.created_at);
      return jobDate.toDateString() === date.toDateString();
    });
    const dayRevenue = dayJobs.reduce((acc, job) => {
      const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
      return acc + partsCost + laborRate;
    }, 0);
    return { name: dayName, revenue: Math.round(dayRevenue) };
  });
  const hasRevenueData = dataRevenue.some((d) => d.revenue > 0);

  // Combined Action Required items - FIX: Include awaiting ack in count
  const unacknowledgedEscalations = escalatedJobs.filter(j => !j.escalation_acknowledged_at);
  const totalActionItems = unacknowledgedEscalations.length + awaitingAckJobs.length + disputedJobs.length;

  // Filter action items based on tab
  const getFilteredActionItems = () => {
    const items: { type: 'escalated' | 'awaiting' | 'disputed'; job: any; priority: number }[] = [];
    
    if (actionTab === 'all' || actionTab === 'escalated') {
      unacknowledgedEscalations.forEach(job => {
        items.push({ type: 'escalated', job, priority: 1 });
      });
    }
    if (actionTab === 'all' || actionTab === 'disputed') {
      disputedJobs.forEach(job => {
        items.push({ type: 'disputed', job, priority: 2 });
      });
    }
    if (actionTab === 'all' || actionTab === 'awaiting') {
      awaitingAckJobs.forEach(job => {
        items.push({ type: 'awaiting', job, priority: 3 });
      });
    }
    
    return items.sort((a, b) => a.priority - b.priority);
  };

  // Helper to get status chip styles
  const getStatusChip = (status: string) => {
    const config = STATUS_CONFIG[status];
    if (config) {
      return { background: config.bg, color: config.color };
    }
    return { background: '#f4f4f5', color: '#71717a' };
  };

  if (loading) {
    return (
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>
            <p className="text-sm mt-1 text-[var(--text-muted)]">Welcome back, {currentUser.name}</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--text-muted)]">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard</h1>
          <p className="text-sm mt-1 text-[var(--text-muted)]">Welcome back, {currentUser.name}</p>
        </div>
        <div className="text-xs text-[var(--text-subtle)]">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
      </div>
      
      {/* Row 1: KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Jobs This Week */}
        <div className="card-premium p-5 border-l-4 border-l-[var(--accent)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Jobs This Week</p>
              <p className="text-3xl font-bold mt-2 text-[var(--text)]">{jobsThisWeek.length}</p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">Last 7 days</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[var(--accent)]" />
            </div>
          </div>
        </div>
        
        {/* Revenue */}
        <div className="card-premium p-5 border-l-4 border-l-[var(--success)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Revenue</p>
              <p className="text-3xl font-bold mt-2 text-[var(--success)]">RM{totalRevenue.toLocaleString()}</p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">All-time total</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--success-bg)] flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[var(--success)]" />
            </div>
          </div>
        </div>
        
        {/* Action Required - FIX: Now includes awaiting ack in count */}
        <div 
          className={`card-premium p-5 border-l-4 border-l-[var(--error)] cursor-pointer transition-all ${
            totalActionItems > 0 ? 'bg-[var(--error-bg)] border-[var(--error)]' : ''
          }`}
          onClick={() => document.getElementById('action-queue')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Action Required</p>
              <p className={`text-3xl font-bold mt-2 ${totalActionItems > 0 ? 'text-[var(--error)]' : 'text-[var(--text)]'}`}>
                {totalActionItems}
              </p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">
                {unacknowledgedEscalations.length} escalated, {disputedJobs.length} disputed, {awaitingAckJobs.length} awaiting
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--error-bg)] flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-[var(--error)]" />
            </div>
          </div>
        </div>
        
        {/* Avg Response */}
        <div className="card-premium p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Avg Response</p>
              <p className="text-3xl font-bold mt-2 text-[var(--text)]">
                {avgResponseHours.toFixed(1)}<span className="text-lg font-normal text-[var(--text-muted)]">h</span>
              </p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">First arrival time</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-[var(--text-muted)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Action Required Queue (Combined) */}
      {(isAdmin || isSupervisor) && totalActionItems > 0 && (
        <div id="action-queue" className="card-premium overflow-hidden">
          {/* Header - tinted for visual anchor */}
          <div className="p-5 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--error-bg)] flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[var(--error)]" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-[var(--text)]">Action Required</h2>
                  <p className="text-xs text-[var(--text-muted)]">{totalActionItems} items need your attention</p>
                </div>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              {[
                { key: 'all', label: 'All', count: totalActionItems, color: 'var(--accent)' },
                { key: 'escalated', label: 'Escalated', count: unacknowledgedEscalations.length, color: 'var(--error)' },
                { key: 'disputed', label: 'Disputed', count: disputedJobs.length, color: '#f97316' },
                { key: 'awaiting', label: 'Awaiting Ack', count: awaitingAckJobs.length, color: 'var(--warning)' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActionTab(tab.key as ActionTab)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    actionTab === tab.key 
                      ? 'text-white' 
                      : 'text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-strong)]'
                  }`}
                  style={actionTab === tab.key ? { background: tab.color } : {}}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
          
          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {getFilteredActionItems().map(({ type, job }) => {
              const isExpanded = expandedItemId === `${type}-${job.job_id}`;
              const hasNotes = type === 'escalated' && job.escalation_notes;
              
              return (
                <div
                  key={`${type}-${job.job_id}`}
                  className="border-b border-[var(--border-subtle)] last:border-b-0 transition-all"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-[var(--bg-subtle)] flex items-center justify-between"
                    onClick={() => setExpandedItemId(isExpanded ? null : `${type}-${job.job_id}`)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Type Badge */}
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ 
                          background: type === 'escalated' ? 'var(--error-bg)' : 
                                     type === 'disputed' ? '#fff7ed' : 'var(--warning-bg)'
                        }}
                      >
                        {type === 'escalated' && <AlertTriangle className="w-4 h-4 text-[var(--error)]" />}
                        {type === 'disputed' && <XCircle className="w-4 h-4" style={{ color: '#f97316' }} />}
                        {type === 'awaiting' && <Timer className="w-4 h-4 text-[var(--warning)]" />}
                      </div>
                      
                      <div>
                        <p className="font-medium text-[var(--text)]">{job.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {job.customer?.name || 'No customer'} • {job.forklift?.serial_number || 'No asset'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Notes indicator for collapsed view */}
                      {type === 'escalated' && !isExpanded && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedItemId(`${type}-${job.job_id}`);
                            setEditingNotesId(job.job_id);
                            setNotesInput(job.escalation_notes || '');
                          }}
                          className={`p-1.5 rounded-lg transition-all ${
                            hasNotes 
                              ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' 
                              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)]'
                          }`}
                          title={hasNotes ? 'Has notes - click to edit' : 'Add notes'}
                        >
                          <StickyNote className="w-4 h-4" />
                        </button>
                      )}
                      
                      {type === 'escalated' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-[var(--error-bg)] text-[var(--error)]">
                          {getDaysOverdue(job.escalation_triggered_at)}d overdue
                        </span>
                      )}
                      {type === 'disputed' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: '#fff7ed', color: '#f97316' }}>
                          Disputed
                        </span>
                      )}
                      {type === 'awaiting' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-[var(--warning-bg)] text-[var(--warning)]">
                          Awaiting
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-[var(--bg-subtle)]">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.job_id}`); }}
                          className="btn-premium btn-premium-primary text-sm"
                        >
                          <Eye className="w-4 h-4" /> View Job
                        </button>
                        {type === 'escalated' && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAcknowledgeEscalation(job.job_id); }}
                              className="btn-premium text-sm bg-[var(--success)] text-white hover:opacity-90"
                            >
                              <Check className="w-4 h-4" /> Acknowledge
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMarkOvertime(job.job_id); }}
                              className="btn-premium btn-premium-secondary text-sm"
                            >
                              <Clock className="w-4 h-4" /> Mark Overtime
                            </button>
                          </>
                        )}
                      </div>
                      
                      {type === 'escalated' && (
                        <div className="mt-3">
                          <label className="text-xs font-medium text-[var(--text-muted)]">Notes</label>
                          <div className="flex gap-2 mt-1">
                            <input
                              type="text"
                              value={editingNotesId === job.job_id ? notesInput : (job.escalation_notes || '')}
                              onChange={(e) => { setEditingNotesId(job.job_id); setNotesInput(e.target.value); }}
                              onFocus={() => { setEditingNotesId(job.job_id); setNotesInput(job.escalation_notes || ''); }}
                              placeholder="Add notes..."
                              className="input-premium flex-1"
                              onClick={(e) => e.stopPropagation()}
                            />
                            {editingNotesId === job.job_id && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSaveNotes(job.job_id); }}
                                className="btn-premium btn-premium-primary text-sm"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {getFilteredActionItems().length === 0 && (
              <div className="p-8 text-center text-[var(--text-muted)]">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No items in this category</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Row 3: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Status Distribution - FIX: Now shows ALL statuses */}
        <div className="card-premium p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-[var(--text)]">Job Status</h3>
            <p className="text-xs mt-0.5 text-[var(--text-muted)]">Current distribution</p>
          </div>
          <div className={dataStatus.length > 0 ? "h-64" : "h-44"}>
            {dataStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {dataStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--surface)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-md)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center mb-2">
                  <Briefcase className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm font-medium text-[var(--text)]">No jobs yet</p>
                <p className="text-xs mt-1 text-[var(--text-muted)]">
                  Create your first job to see status distribution.
                </p>
              </div>
            )}
          </div>
          {/* Legend - shows all statuses */}
          {dataStatus.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[var(--border-subtle)]">
              {dataStatus.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[var(--text-muted)]">{item.name}</span>
                  <span className="font-medium text-[var(--text)]">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue Trend */}
        <div className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-[var(--text)]">Revenue Trend</h3>
              <p className="text-xs mt-0.5 text-[var(--text-muted)]">Last 7 days</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--success)]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="font-medium">Active</span>
            </div>
          </div>
          <div className={hasRevenueData ? "h-64" : "h-44"}>
            {hasRevenueData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dataRevenue}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={(value) => `RM${value}`}
                  />
                  <Tooltip 
                    formatter={(value) => [`RM${value}`, 'Revenue']}
                    contentStyle={{ 
                      background: 'var(--surface)', 
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-md)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="var(--accent)" 
                    strokeWidth={2}
                    fill="url(#revenueGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center mb-2">
                  <DollarSign className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm font-medium text-[var(--text)]">No revenue yet</p>
                <p className="text-xs mt-1 text-[var(--text-muted)]">
                  Create an invoice to start tracking revenue trends.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Service Automation, Recent Jobs & Notifications */}
      <div
        className={`grid grid-cols-1 ${showServiceAutomation ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 lg:h-[560px]`}
      >
        {/* Service Automation Widget */}
        {showServiceAutomation && (
          <ServiceAutomationWidget onViewAll={() => navigate('/service-due')} />
        )}

        {/* Recent Jobs - FIX: Now uses STATUS_CONFIG for all statuses */}
        <div className="card-premium p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[var(--text)]">Recent Jobs</h3>
              <p className="text-xs mt-0.5 text-[var(--text-muted)]">Latest activity</p>
            </div>
            <button 
              onClick={() => navigate('/jobs')}
              className="btn-premium btn-premium-ghost text-xs"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          
          {/* Recent Jobs List (Row-card style; no inner scrollbar) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
            {jobs.slice(0, 20).map((job) => {
              const chipStyle = getStatusChip(job.status);
              const statusColor = CHART_COLORS[job.status] || 'var(--border-strong)';
              const safeTitle = (job.title || '').trim() || '(Untitled job)';

              return (
                <div
                  key={job.job_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/jobs/${job.job_id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/jobs/${job.job_id}`);
                    }
                  }}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer transition-all hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)] active:scale-[0.99]"
                >
                  {/* Status color rail */}
                  <div
                    className="w-1.5 self-stretch rounded-full"
                    style={{ background: statusColor }}
                    aria-hidden="true"
                  />

                  {/* Main text */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                      {safeTitle}
                    </p>
                    <p className="text-xs mt-0.5 text-[var(--text-muted)]">
                      {job.customer ? (
                        <span>{job.customer.name}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--warning)]">
                          <AlertTriangle className="w-3 h-3" /> No Customer
                        </span>
                      )}
                      <span className="mx-1.5">•</span>
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Status + chevron */}
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap border border-[var(--border-subtle)]"
                      style={chipStyle}
                    >
                      {STATUS_CONFIG[job.status]?.label || job.status.replace(/_/g, ' ')}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[var(--text-subtle)] group-hover:text-[var(--accent)] transition-colors" />
                  </div>
                </div>
              );
            })}

            {jobs.length === 0 && (
              <div className="text-center py-10 text-[var(--text-muted)]">
                <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No jobs found</p>
              </div>
            )}
          </div>
        </div>

        {/* Notifications Panel - Customer Feedback: Show on dashboard (kept compact & rightmost) */}
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          isConnected={isConnected}
          onMarkRead={markAsRead}
          onMarkAllRead={markAllAsRead}
          currentUser={currentUser}
          maxItems={5}
        />
      </div>
    </div>
  );
};

export default Dashboard;

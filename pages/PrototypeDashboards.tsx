import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole, Job, JobStatus, User } from '../types_with_invoice_tracking';
import { SupabaseDb } from '../services/supabaseService';
import { useDevMode } from '../hooks/useDevMode';
import { DevBanner } from '../components/dev/DevBanner';
import { RoleSwitcher } from '../components/dev/RoleSwitcher';
import {
  Wrench, Clock, AlertTriangle, CheckCircle, FileText, Users,
  DollarSign, TrendingUp, Calendar, ChevronRight, Bell,
  Play, Pause, Check, X, ArrowRight, Filter, RefreshCw
} from 'lucide-react';

// =========================================
// SHARED TYPES & UTILITIES
// =========================================

interface DashboardProps {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onNavigate: (path: string) => void;
  onRefresh: () => void;
}

const statusColors: Record<string, string> = {
  'New': 'bg-blue-500',
  'Assigned': 'bg-purple-500',
  'In Progress': 'bg-amber-500',
  'Completed': 'bg-green-500',
  'Awaiting Finalization': 'bg-cyan-500',
  'Cancelled': 'bg-gray-500',
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-MY', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// =========================================
// TECHNICIAN DASHBOARD
// =========================================

const TechnicianDashboard: React.FC<DashboardProps> = ({ currentUser, jobs, onNavigate }) => {
  const myJobs = jobs.filter(j => 
    j.assigned_technician_id === currentUser.user_id &&
    !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)
  );
  
  const todayJobs = myJobs.filter(j => {
    const jobDate = new Date(j.scheduled_date || j.created_at);
    const today = new Date();
    return jobDate.toDateString() === today.toDateString();
  });

  const inProgressJob = myJobs.find(j => j.status === 'In Progress');
  const completedToday = jobs.filter(j => {
    const isCompleted = ['Completed', 'Completed Awaiting Ack'].includes(j.status);
    const completedDate = j.completed_at ? new Date(j.completed_at) : null;
    const today = new Date();
    return isCompleted && completedDate?.toDateString() === today.toDateString() && 
           j.assigned_technician_id === currentUser.user_id;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            My Jobs Today
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="stat-card stat-card-success px-4 py-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Completed</span>
            <span className="text-xl font-bold ml-2" style={{ color: 'var(--success)' }}>{completedToday}</span>
          </div>
        </div>
      </div>

      {/* Current Job (if in progress) */}
      {inProgressJob && (
        <div className="card-premium p-4 border-l-4" style={{ borderLeftColor: 'var(--warning)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'var(--warning-bg)' }}>
                <Play className="w-5 h-5" style={{ color: 'var(--warning)' }} />
              </div>
              <div>
                <p className="label-premium">CURRENTLY WORKING ON</p>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{inProgressJob.job_number}</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate(`/jobs/${inProgressJob.job_id}`)}
              className="btn-primary flex items-center gap-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Today's Jobs List */}
      <div className="card-premium">
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
            Today's Schedule ({todayJobs.length} jobs)
          </h2>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {todayJobs.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No jobs scheduled for today</p>
            </div>
          ) : (
            todayJobs.map(job => (
              <div
                key={job.job_id}
                onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                className="p-4 hover:bg-[var(--surface-2)] cursor-pointer transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${statusColors[job.status]}`} />
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text)' }}>{job.job_number}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {job.customer?.name || 'Unknown Customer'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm px-2 py-1 rounded" style={{ 
                    background: 'var(--surface-2)', 
                    color: 'var(--text-secondary)' 
                  }}>
                    {job.job_type}
                  </span>
                  <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{myJobs.length}</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Pending Jobs</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>
            {myJobs.filter(j => j.status === 'Assigned').length}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>To Start</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{completedToday}</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Done Today</p>
        </div>
      </div>
    </div>
  );
};


// =========================================
// SUPERVISOR DASHBOARD
// =========================================

const SupervisorDashboard: React.FC<DashboardProps> = ({ jobs, users, onNavigate, onRefresh }) => {
  const [filter, setFilter] = useState<'all' | 'escalated' | 'approvals'>('all');
  
  const technicians = users.filter(u => u.role === UserRole.TECHNICIAN && u.is_active);
  const activeJobs = jobs.filter(j => !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
  const escalatedJobs = jobs.filter(j => j.is_escalated && !j.escalation_acknowledged_at);
  const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');
  
  const filteredItems = filter === 'escalated' 
    ? escalatedJobs 
    : filter === 'approvals' 
      ? awaitingFinalization 
      : [...escalatedJobs, ...awaitingFinalization];

  const getTechnicianStatus = (tech: User) => {
    const techJobs = jobs.filter(j => j.assigned_technician_id === tech.user_id);
    const inProgress = techJobs.find(j => j.status === 'In Progress');
    if (inProgress) return { status: 'busy', label: 'In Progress', color: 'var(--warning)' };
    const assigned = techJobs.filter(j => j.status === 'Assigned').length;
    if (assigned > 0) return { status: 'assigned', label: `${assigned} assigned`, color: 'var(--info)' };
    return { status: 'available', label: 'Available', color: 'var(--success)' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Team Overview</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your team and jobs</p>
        </div>
        <button onClick={onRefresh} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--info-bg)' }}>
              <Wrench className="w-5 h-5" style={{ color: 'var(--info)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{activeJobs.length}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Active Jobs</p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-warning">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--warning-bg)' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>{escalatedJobs.length}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Escalated</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--success-bg)' }}>
              <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{awaitingFinalization.length}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Awaiting Review</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--accent-subtle)' }}>
              <Users className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{technicians.length}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Technicians</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Action Queue */}
        <div className="col-span-2 card-premium">
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Action Queue</h2>
            <div className="flex gap-2">
              {(['all', 'escalated', 'approvals'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    filter === f 
                      ? 'bg-[var(--accent)] text-white' 
                      : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'escalated' ? 'Escalated' : 'Approvals'}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items requiring action</p>
              </div>
            ) : (
              filteredItems.map(job => (
                <div
                  key={job.job_id}
                  onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                  className="p-4 hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {job.is_escalated ? (
                        <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warning)' }} />
                      ) : (
                        <FileText className="w-5 h-5" style={{ color: 'var(--info)' }} />
                      )}
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text)' }}>{job.job_number}</p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {job.is_escalated ? 'Needs attention' : 'Ready for review'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Status */}
        <div className="card-premium">
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Team Status</h2>
          </div>
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {technicians.map(tech => {
              const status = getTechnicianStatus(tech);
              return (
                <div key={tech.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--surface-2)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
                      <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                        {tech.name.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text)' }}>{tech.name}</span>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ 
                    background: `${status.color}20`,
                    color: status.color
                  }}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};


// =========================================
// ADMIN DASHBOARD
// =========================================

const AdminDashboard: React.FC<DashboardProps> = ({ jobs, users, onNavigate, onRefresh }) => {
  const activeJobs = jobs.filter(j => !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
  const escalatedJobs = jobs.filter(j => j.is_escalated && !j.escalation_acknowledged_at);
  const completedLast30Days = jobs.filter(j => {
    if (!['Completed', 'Completed Awaiting Ack'].includes(j.status)) return false;
    const completed = new Date(j.completed_at || j.updated_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return completed >= thirtyDaysAgo;
  }).length;

  const technicians = users.filter(u => u.role === UserRole.TECHNICIAN && u.is_active);
  const busyTechs = technicians.filter(t => 
    jobs.some(j => j.assigned_technician_id === t.user_id && j.status === 'In Progress')
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>System Overview</h1>
          <p style={{ color: 'var(--text-muted)' }}>Full administrative dashboard</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onNavigate('/create-job')} className="btn-primary">
            + New Job
          </button>
          <button onClick={onRefresh} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Header */}
      <div className="grid grid-cols-5 gap-4">
        <div className="stat-card stat-card-accent">
          <p className="label-premium">ACTIVE JOBS</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{activeJobs.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>
            <TrendingUp className="w-3 h-3 inline mr-1" />
            +12% vs last week
          </p>
        </div>
        <div className="stat-card stat-card-warning">
          <p className="label-premium">ESCALATED</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--warning)' }}>{escalatedJobs.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Needs attention</p>
        </div>
        <div className="stat-card stat-card-success">
          <p className="label-premium">COMPLETED (30D)</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--success)' }}>{completedLast30Days}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>This month</p>
        </div>
        <div className="stat-card">
          <p className="label-premium">TEAM CAPACITY</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{busyTechs}/{technicians.length}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Currently working</p>
        </div>
        <div className="stat-card">
          <p className="label-premium">AVG COMPLETION</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--text)' }}>2.4h</p>
          <p className="text-xs mt-1" style={{ color: 'var(--success)' }}>
            <TrendingUp className="w-3 h-3 inline mr-1" />
            -15min vs avg
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="col-span-2 card-premium">
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Recent Jobs</h2>
            <button onClick={() => onNavigate('/jobs')} className="text-sm" style={{ color: 'var(--accent)' }}>
              View All →
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {jobs.slice(0, 5).map(job => (
              <div
                key={job.job_id}
                onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                className="p-4 hover:bg-[var(--surface-2)] cursor-pointer transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${statusColors[job.status]}`} />
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text)' }}>{job.job_number}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {job.customer?.name || 'Unknown'} • {job.job_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(job.created_at)}
                  </span>
                  <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="card-premium p-4">
            <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Quick Actions</h3>
            <div className="space-y-2">
              <button onClick={() => onNavigate('/create-job')} className="w-full btn-secondary text-left flex items-center gap-3">
                <Wrench className="w-4 h-4" /> Create Job
              </button>
              <button onClick={() => onNavigate('/users')} className="w-full btn-secondary text-left flex items-center gap-3">
                <Users className="w-4 h-4" /> Manage Users
              </button>
              <button onClick={() => onNavigate('/forklifts')} className="w-full btn-secondary text-left flex items-center gap-3">
                <FileText className="w-4 h-4" /> Fleet Overview
              </button>
            </div>
          </div>

          {/* Alerts */}
          {escalatedJobs.length > 0 && (
            <div className="card-premium p-4 border-l-4" style={{ borderLeftColor: 'var(--warning)' }}>
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warning)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text)' }}>
                  {escalatedJobs.length} Escalated Jobs
                </h3>
              </div>
              <button 
                onClick={() => onNavigate('/jobs?filter=escalated')}
                className="text-sm" 
                style={{ color: 'var(--accent)' }}
              >
                View all escalated →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// =========================================
// ACCOUNTANT DASHBOARD
// =========================================

const AccountantDashboard: React.FC<DashboardProps> = ({ jobs, onNavigate }) => {
  const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');
  const completedJobs = jobs.filter(j => j.status === 'Completed');
  
  // Mock financial data (would come from real invoices in production)
  const pendingInvoiceValue = awaitingFinalization.length * 850; // Placeholder
  const monthlyRevenue = completedJobs.length * 920; // Placeholder

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Financial Overview</h1>
          <p style={{ color: 'var(--text-muted)' }}>Invoice and payment management</p>
        </div>
        <button onClick={() => onNavigate('/invoices')} className="btn-primary flex items-center gap-2">
          <FileText className="w-4 h-4" /> View Invoices
        </button>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card stat-card-accent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--accent-subtle)' }}>
              <DollarSign className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="label-premium">PENDING INVOICES</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{awaitingFinalization.length}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--warning-bg)' }}>
              <Clock className="w-5 h-5" style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <p className="label-premium">PENDING VALUE</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                RM {pendingInvoiceValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--success-bg)' }}>
              <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <p className="label-premium">COMPLETED (MTD)</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{completedJobs.length}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--info-bg)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: 'var(--info)' }} />
            </div>
            <div>
              <p className="label-premium">MONTHLY REVENUE</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                RM {monthlyRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs Ready for Invoice */}
      <div className="card-premium">
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
            Jobs Ready for Finalization ({awaitingFinalization.length})
          </h2>
          <button className="text-sm" style={{ color: 'var(--accent)' }}>
            Export CSV →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Job #</th>
                <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Customer</th>
                <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Type</th>
                <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Completed</th>
                <th className="text-right p-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {awaitingFinalization.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>All jobs finalized! No pending invoices.</p>
                  </td>
                </tr>
              ) : (
                awaitingFinalization.map(job => (
                  <tr key={job.job_id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="p-3">
                      <span className="font-medium" style={{ color: 'var(--text)' }}>{job.job_number}</span>
                    </td>
                    <td className="p-3" style={{ color: 'var(--text-secondary)' }}>
                      {job.customer?.name || 'Unknown'}
                    </td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-1 rounded" style={{ 
                        background: 'var(--surface-2)', 
                        color: 'var(--text-secondary)' 
                      }}>
                        {job.job_type}
                      </span>
                    </td>
                    <td className="p-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {job.completed_at ? formatDate(job.completed_at) : '-'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                        className="text-sm px-3 py-1 rounded"
                        style={{ background: 'var(--accent)', color: 'white' }}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


// =========================================
// MAIN PROTOTYPE PAGE
// =========================================

const PrototypeDashboards: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dev mode hook
  const devMode = useDevMode(currentUser?.email, currentUser?.role || UserRole.TECHNICIAN);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [user, jobsData, usersData] = await Promise.all([
          SupabaseDb.getCurrentUser(),
          SupabaseDb.getJobs(),
          SupabaseDb.getUsers(),
        ]);
        setCurrentUser(user);
        setJobs(jobsData);
        setUsers(usersData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleRefresh = async () => {
    try {
      const [jobsData, usersData] = await Promise.all([
        SupabaseDb.getJobs(),
        SupabaseDb.getUsers(),
      ]);
      setJobs(jobsData);
      setUsers(usersData);
    } catch (err: any) {
      console.error('Refresh failed:', err);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  // Access check
  if (!loading && !devMode.isDev) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="card-premium p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--warning)' }} />
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Access Restricted</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            This prototype page is only available to developers.
          </p>
          <button 
            onClick={() => navigate('/')} 
            className="mt-4 btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading prototype...</p>
        </div>
      </div>
    );
  }

  if (error || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="card-premium p-8 text-center max-w-md">
          <X className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--error)' }} />
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Error Loading</h1>
          <p style={{ color: 'var(--text-muted)' }}>{error || 'Could not load user data'}</p>
        </div>
      </div>
    );
  }

  const dashboardProps: DashboardProps = {
    currentUser,
    jobs,
    users,
    onNavigate: handleNavigate,
    onRefresh: handleRefresh,
  };

  // Render appropriate dashboard based on effective role
  const renderDashboard = () => {
    const role = devMode.effectiveRole;
    switch (role) {
      case UserRole.TECHNICIAN:
        return <TechnicianDashboard {...dashboardProps} />;
      case UserRole.SUPERVISOR:
        return <SupervisorDashboard {...dashboardProps} />;
      case UserRole.ADMIN:
        return <AdminDashboard {...dashboardProps} />;
      case UserRole.ACCOUNTANT:
        return <AccountantDashboard {...dashboardProps} />;
      default:
        return <TechnicianDashboard {...dashboardProps} />;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Dev Banner (when impersonating) */}
      {devMode.isDevModeActive && (
        <DevBanner
          impersonatedRole={devMode.impersonatedRole!}
          actualRole={currentUser.role}
          devModeType={devMode.devModeType}
          onExit={devMode.deactivateDevMode}
        />
      )}

      {/* Main Content */}
      <div className={`${devMode.isDevModeActive ? 'pt-14' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Role Switcher Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium px-2 py-1 rounded" style={{ 
                background: 'var(--warning-bg)', 
                color: 'var(--warning)' 
              }}>
                PROTOTYPE
              </span>
              <span style={{ color: 'var(--text-muted)' }}>Role-Based Dashboard Preview</span>
            </div>
            <RoleSwitcher
              currentRole={currentUser.role}
              impersonatedRole={devMode.impersonatedRole}
              devModeType={devMode.devModeType}
              onRoleChange={devMode.setImpersonatedRole}
              onModeTypeChange={devMode.setDevModeType}
              onDeactivate={devMode.deactivateDevMode}
            />
          </div>

          {/* Dashboard Content */}
          {renderDashboard()}
        </div>
      </div>
    </div>
  );
};

export default PrototypeDashboards;

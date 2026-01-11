import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole, Job, JobStatus, User } from '../types_with_invoice_tracking';
import { SupabaseDb } from '../services/supabaseService';
import { useDevMode } from '../hooks/useDevMode';
import { DevBanner } from '../components/dev/DevBanner';
import { RoleSwitcher } from '../components/dev/RoleSwitcher';
import {
  Wrench, Clock, AlertTriangle, CheckCircle, FileText, Users,
  TrendingUp, Calendar, ChevronRight, Bell, Play, ArrowRight,
  RefreshCw, Truck, Settings, Plus, BarChart3, Timer, UserCheck,
  AlertCircle, Package, ClipboardList, CircleDot, Zap, Target,
  Activity, ArrowUpRight, ArrowDownRight, Eye, ChevronDown
} from 'lucide-react';

// =========================================
// TYPES & UTILITIES
// =========================================

interface DashboardProps {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onNavigate: (path: string) => void;
  onRefresh: () => void;
}

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString('en-MY', { 
    hour: '2-digit', 
    minute: '2-digit'
  });
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-MY', { 
    day: 'numeric', 
    month: 'short'
  });
};

// =========================================
// APPLE-STYLE COMPONENTS
// =========================================

// Premium Stat Card with subtle glassmorphism
const StatCard: React.FC<{
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  accent?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  onClick?: () => void;
  compact?: boolean;
}> = ({ label, value, sublabel, icon, trend, accent = 'blue', onClick, compact }) => {
  const accentColors = {
    blue: { bg: 'rgba(0, 122, 255, 0.08)', icon: '#007AFF', border: 'rgba(0, 122, 255, 0.15)' },
    green: { bg: 'rgba(52, 199, 89, 0.08)', icon: '#34C759', border: 'rgba(52, 199, 89, 0.15)' },
    orange: { bg: 'rgba(255, 149, 0, 0.08)', icon: '#FF9500', border: 'rgba(255, 149, 0, 0.15)' },
    red: { bg: 'rgba(255, 59, 48, 0.08)', icon: '#FF3B30', border: 'rgba(255, 59, 48, 0.15)' },
    purple: { bg: 'rgba(175, 82, 222, 0.08)', icon: '#AF52DE', border: 'rgba(175, 82, 222, 0.15)' },
  };
  
  const colors = accentColors[accent];
  
  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl p-5 transition-all duration-300
        ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}
        ${compact ? 'p-4' : 'p-5'}
      `}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      }}
    >
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          background: `linear-gradient(135deg, ${colors.bg} 0%, transparent 60%)`,
        }}
      />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: colors.bg }}
          >
            <div style={{ color: colors.icon }}>{icon}</div>
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend.value >= 0 ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'
            }`}>
              {trend.value >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          <p className={`font-semibold ${compact ? 'text-2xl' : 'text-3xl'}`} style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
            {value}
          </p>
          {sublabel && (
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{sublabel}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Quick Action Button
const QuickAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: string;
}> = ({ icon, label, onClick, accent }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
    style={{
      background: accent ? `${accent}08` : 'var(--surface-2)',
      border: '1px solid var(--border-subtle)',
    }}
  >
    <div 
      className="w-9 h-9 rounded-lg flex items-center justify-center"
      style={{ 
        background: accent || 'var(--accent)',
        color: 'white'
      }}
    >
      {icon}
    </div>
    <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{label}</span>
    <ChevronRight className="w-4 h-4 ml-auto" style={{ color: 'var(--text-muted)' }} />
  </button>
);

// Activity Item
const ActivityItem: React.FC<{
  title: string;
  subtitle: string;
  time: string;
  status?: string;
  statusColor?: string;
  onClick?: () => void;
}> = ({ title, subtitle, time, status, statusColor, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${onClick ? 'cursor-pointer hover:bg-[var(--surface-2)]' : ''}`}
  >
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{title}</p>
      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
    </div>
    <div className="text-right flex-shrink-0">
      {status && (
        <span 
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ 
            background: `${statusColor}15`,
            color: statusColor 
          }}
        >
          {status}
        </span>
      )}
      <p className="text-[10px] mt-1" style={{ color: 'var(--text-subtle)' }}>{time}</p>
    </div>
  </div>
);

// Team Member Row
const TeamMember: React.FC<{
  name: string;
  status: 'available' | 'busy' | 'assigned';
  detail: string;
}> = ({ name, status, detail }) => {
  const statusConfig = {
    available: { color: '#34C759', bg: 'rgba(52, 199, 89, 0.1)', label: 'Available' },
    busy: { color: '#FF9500', bg: 'rgba(255, 149, 0, 0.1)', label: 'In Progress' },
    assigned: { color: '#007AFF', bg: 'rgba(0, 122, 255, 0.1)', label: 'Assigned' },
  };
  const config = statusConfig[status];
  
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm"
        style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
      >
        {name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{name}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{detail}</p>
      </div>
      <div 
        className="flex items-center gap-1.5 px-2 py-1 rounded-full"
        style={{ background: config.bg }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
        <span className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</span>
      </div>
    </div>
  );
};

// Alert Card
const AlertCard: React.FC<{
  type: 'escalated' | 'disputed' | 'awaiting';
  count: number;
  onClick: () => void;
}> = ({ type, count, onClick }) => {
  if (count === 0) return null;
  
  const config = {
    escalated: { 
      icon: <AlertTriangle className="w-4 h-4" />, 
      label: 'Escalated', 
      color: '#FF3B30',
      bg: 'rgba(255, 59, 48, 0.08)'
    },
    disputed: { 
      icon: <AlertCircle className="w-4 h-4" />, 
      label: 'Disputed', 
      color: '#FF9500',
      bg: 'rgba(255, 149, 0, 0.08)'
    },
    awaiting: { 
      icon: <Timer className="w-4 h-4" />, 
      label: 'Awaiting Ack', 
      color: '#AF52DE',
      bg: 'rgba(175, 82, 222, 0.08)'
    },
  };
  const c = config[type];
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
      style={{ 
        background: c.bg,
        border: `1px solid ${c.color}20`
      }}
    >
      <div style={{ color: c.color }}>{c.icon}</div>
      <span className="font-semibold" style={{ color: c.color }}>{count}</span>
      <span className="text-sm" style={{ color: c.color }}>{c.label}</span>
      <ChevronRight className="w-4 h-4 ml-auto" style={{ color: c.color }} />
    </button>
  );
};


// =========================================
// ADMIN PREMIUM DASHBOARD
// =========================================

const AdminPremiumDashboard: React.FC<DashboardProps> = ({ currentUser, jobs, users, onNavigate, onRefresh }) => {
  const today = new Date();
  const todayStr = today.toDateString();
  
  // Calculate metrics
  const activeJobs = jobs.filter(j => !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
  const todayJobs = jobs.filter(j => new Date(j.scheduled_date || j.created_at).toDateString() === todayStr);
  const inProgressJobs = jobs.filter(j => j.status === 'In Progress');
  const completedToday = jobs.filter(j => 
    ['Completed', 'Completed Awaiting Ack'].includes(j.status) &&
    j.completed_at && new Date(j.completed_at).toDateString() === todayStr
  );
  
  const escalatedJobs = jobs.filter(j => j.is_escalated && !j.escalation_acknowledged_at);
  const awaitingAckJobs = jobs.filter(j => j.status === 'Completed Awaiting Ack');
  const disputedJobs = jobs.filter(j => j.status === 'Disputed');
  const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');
  
  const technicians = users.filter(u => u.role === UserRole.TECHNICIAN && u.is_active);
  const busyTechs = technicians.filter(t => 
    jobs.some(j => j.assigned_technician_id === t.user_id && j.status === 'In Progress')
  );
  
  // Calculate first-time fix rate (completed jobs without reassignment)
  const completedJobs = jobs.filter(j => j.status === 'Completed');
  const firstTimeFixes = completedJobs.filter(j => !j.previous_technician_id);
  const ftfRate = completedJobs.length > 0 ? Math.round((firstTimeFixes.length / completedJobs.length) * 100) : 0;
  
  // Calculate avg response time
  const jobsWithArrival = jobs.filter(j => j.arrival_time);
  const avgResponseHours = jobsWithArrival.length > 0
    ? jobsWithArrival.reduce((acc, j) => {
        const created = new Date(j.created_at).getTime();
        const arrived = new Date(j.arrival_time!).getTime();
        return acc + ((arrived - created) / (1000 * 60 * 60));
      }, 0) / jobsWithArrival.length
    : 0;

  const totalActionRequired = escalatedJobs.length + disputedJobs.length + awaitingAckJobs.length;

  // Get team status
  const getTeamMemberStatus = (tech: User) => {
    const techJobs = jobs.filter(j => j.assigned_technician_id === tech.user_id);
    const inProgress = techJobs.find(j => j.status === 'In Progress');
    if (inProgress) return { status: 'busy' as const, detail: `Working on ${inProgress.job_number}` };
    const assigned = techJobs.filter(j => j.status === 'Assigned').length;
    if (assigned > 0) return { status: 'assigned' as const, detail: `${assigned} job${assigned > 1 ? 's' : ''} queued` };
    return { status: 'available' as const, detail: 'Ready for dispatch' };
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            Good {today.getHours() < 12 ? 'morning' : today.getHours() < 18 ? 'afternoon' : 'evening'}, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onRefresh}
            className="p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
          <button 
            onClick={() => onNavigate('/create-job')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>
      </div>

      {/* Action Required Banner */}
      {totalActionRequired > 0 && (
        <div 
          className="p-4 rounded-2xl flex items-center justify-between"
          style={{ 
            background: 'linear-gradient(135deg, rgba(255, 59, 48, 0.08) 0%, rgba(255, 149, 0, 0.06) 100%)',
            border: '1px solid rgba(255, 59, 48, 0.15)'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255, 59, 48, 0.12)' }}>
              <Bell className="w-5 h-5" style={{ color: '#FF3B30' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>
                {totalActionRequired} item{totalActionRequired > 1 ? 's' : ''} need{totalActionRequired === 1 ? 's' : ''} your attention
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {escalatedJobs.length > 0 && `${escalatedJobs.length} escalated`}
                {escalatedJobs.length > 0 && (disputedJobs.length > 0 || awaitingAckJobs.length > 0) && ' · '}
                {disputedJobs.length > 0 && `${disputedJobs.length} disputed`}
                {disputedJobs.length > 0 && awaitingAckJobs.length > 0 && ' · '}
                {awaitingAckJobs.length > 0 && `${awaitingAckJobs.length} awaiting`}
              </p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('/jobs?filter=action')}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
            style={{ background: '#FF3B30', color: 'white' }}
          >
            Review Now
          </button>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Jobs"
          value={todayJobs.length}
          sublabel={`${inProgressJobs.length} in progress`}
          icon={<ClipboardList className="w-5 h-5" />}
          accent="blue"
          onClick={() => onNavigate('/jobs?filter=today')}
        />
        <StatCard
          label="Completed Today"
          value={completedToday.length}
          sublabel={`${awaitingFinalization.length} awaiting finalization`}
          icon={<CheckCircle className="w-5 h-5" />}
          accent="green"
          trend={{ value: 12, label: 'vs last week' }}
        />
        <StatCard
          label="First-Time Fix"
          value={`${ftfRate}%`}
          sublabel="Target: 85%"
          icon={<Target className="w-5 h-5" />}
          accent={ftfRate >= 85 ? 'green' : ftfRate >= 70 ? 'orange' : 'red'}
        />
        <StatCard
          label="Avg Response"
          value={`${avgResponseHours.toFixed(1)}h`}
          sublabel="Time to first arrival"
          icon={<Zap className="w-5 h-5" />}
          accent="purple"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - 8 cols */}
        <div className="lg:col-span-8 space-y-6">
          {/* Action Items (if any) */}
          {totalActionRequired > 0 && (
            <div 
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Action Required</h2>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <AlertCard type="escalated" count={escalatedJobs.length} onClick={() => onNavigate('/jobs?filter=escalated')} />
                <AlertCard type="disputed" count={disputedJobs.length} onClick={() => onNavigate('/jobs?filter=disputed')} />
                <AlertCard type="awaiting" count={awaitingAckJobs.length} onClick={() => onNavigate('/jobs?filter=awaiting')} />
              </div>
            </div>
          )}

          {/* Recent Jobs */}
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Recent Activity</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Latest job updates</p>
              </div>
              <button 
                onClick={() => onNavigate('/jobs')}
                className="text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent)' }}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {jobs.slice(0, 5).map(job => {
                const statusColors: Record<string, string> = {
                  'New': '#007AFF',
                  'Assigned': '#5856D6',
                  'In Progress': '#FF9500',
                  'Completed': '#34C759',
                  'Awaiting Finalization': '#AF52DE',
                  'Completed Awaiting Ack': '#FF9500',
                  'Disputed': '#FF3B30',
                };
                return (
                  <ActivityItem
                    key={job.job_id}
                    title={job.job_number || job.title}
                    subtitle={`${job.customer?.name || 'Unknown'} · ${job.job_type}`}
                    time={formatDate(job.created_at)}
                    status={job.status.replace(/_/g, ' ')}
                    statusColor={statusColors[job.status] || '#8E8E93'}
                    onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                  />
                );
              })}
              {jobs.length === 0 && (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No jobs yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - 4 cols */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Actions */}
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Quick Actions</h2>
            </div>
            <div className="p-4 space-y-2">
              <QuickAction 
                icon={<Plus className="w-4 h-4" />} 
                label="Create New Job" 
                onClick={() => onNavigate('/create-job')}
                accent="#007AFF"
              />
              <QuickAction 
                icon={<Truck className="w-4 h-4" />} 
                label="Fleet Overview" 
                onClick={() => onNavigate('/forklifts')}
                accent="#34C759"
              />
              <QuickAction 
                icon={<Users className="w-4 h-4" />} 
                label="Manage Team" 
                onClick={() => onNavigate('/people')}
                accent="#AF52DE"
              />
              <QuickAction 
                icon={<BarChart3 className="w-4 h-4" />} 
                label="View Reports" 
                onClick={() => onNavigate('/reports')}
                accent="#FF9500"
              />
            </div>
          </div>

          {/* Team Status */}
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Team Status</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {busyTechs.length}/{technicians.length} active
                </p>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {technicians.length - busyTechs.length} available
                </span>
              </div>
            </div>
            <div className="px-5 py-3 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {technicians.slice(0, 5).map(tech => {
                const memberStatus = getTeamMemberStatus(tech);
                return (
                  <TeamMember
                    key={tech.user_id}
                    name={tech.name}
                    status={memberStatus.status}
                    detail={memberStatus.detail}
                  />
                );
              })}
              {technicians.length === 0 && (
                <div className="py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No technicians</p>
                </div>
              )}
            </div>
            {technicians.length > 5 && (
              <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <button 
                  onClick={() => onNavigate('/people')}
                  className="text-sm font-medium w-full text-center"
                  style={{ color: 'var(--accent)' }}
                >
                  View all {technicians.length} technicians
                </button>
              </div>
            )}
          </div>

          {/* Mini Stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Active Jobs"
              value={activeJobs.length}
              icon={<Activity className="w-4 h-4" />}
              accent="blue"
              compact
            />
            <StatCard
              label="This Week"
              value={jobs.filter(j => {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return new Date(j.created_at) >= weekAgo;
              }).length}
              icon={<Calendar className="w-4 h-4" />}
              accent="purple"
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
};


// =========================================
// SUPERVISOR PREMIUM DASHBOARD
// =========================================

const SupervisorPremiumDashboard: React.FC<DashboardProps> = ({ currentUser, jobs, users, onNavigate, onRefresh }) => {
  const today = new Date();
  const todayStr = today.toDateString();
  
  const technicians = users.filter(u => u.role === UserRole.TECHNICIAN && u.is_active);
  const activeJobs = jobs.filter(j => !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status));
  const escalatedJobs = jobs.filter(j => j.is_escalated && !j.escalation_acknowledged_at);
  const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');
  const awaitingAck = jobs.filter(j => j.status === 'Completed Awaiting Ack');
  const disputedJobs = jobs.filter(j => j.status === 'Disputed');
  
  const inProgressJobs = jobs.filter(j => j.status === 'In Progress');
  const completedToday = jobs.filter(j => 
    ['Completed', 'Completed Awaiting Ack'].includes(j.status) &&
    j.completed_at && new Date(j.completed_at).toDateString() === todayStr
  );

  const totalActionRequired = escalatedJobs.length + awaitingFinalization.length + disputedJobs.length + awaitingAck.length;

  const getTeamMemberStatus = (tech: User) => {
    const techJobs = jobs.filter(j => j.assigned_technician_id === tech.user_id);
    const inProgress = techJobs.find(j => j.status === 'In Progress');
    if (inProgress) return { status: 'busy' as const, detail: inProgress.job_number || 'Working' };
    const assigned = techJobs.filter(j => j.status === 'Assigned').length;
    if (assigned > 0) return { status: 'assigned' as const, detail: `${assigned} queued` };
    return { status: 'available' as const, detail: 'Available' };
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            Team Overview
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button 
          onClick={onRefresh}
          className="p-2.5 rounded-xl transition-all hover:scale-105"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Jobs"
          value={activeJobs.length}
          sublabel={`${inProgressJobs.length} in progress`}
          icon={<Wrench className="w-5 h-5" />}
          accent="blue"
          onClick={() => onNavigate('/jobs')}
        />
        <StatCard
          label="Action Required"
          value={totalActionRequired}
          sublabel={`${escalatedJobs.length} escalated · ${awaitingAck.length} awaiting ack`}
          icon={<AlertTriangle className="w-5 h-5" />}
          accent={totalActionRequired > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Completed Today"
          value={completedToday.length}
          sublabel={`${awaitingFinalization.length} to finalize`}
          icon={<CheckCircle className="w-5 h-5" />}
          accent="green"
        />
        <StatCard
          label="Team"
          value={`${technicians.filter(t => jobs.some(j => j.assigned_technician_id === t.user_id && j.status === 'In Progress')).length}/${technicians.length}`}
          sublabel="Currently active"
          icon={<Users className="w-5 h-5" />}
          accent="purple"
        />
      </div>

      {/* Action Queue + Team Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Action Queue - 2 cols */}
        <div className="lg:col-span-2">
          <div 
            className="rounded-2xl overflow-hidden h-full"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Action Queue</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Items requiring your attention</p>
            </div>
            
            {totalActionRequired === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--success)' }} />
                <p className="font-medium" style={{ color: 'var(--text)' }}>All caught up!</p>
                <p className="text-sm mt-1">No items need attention right now</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {/* Escalated Jobs */}
                {escalatedJobs.map(job => (
                  <div
                    key={job.job_id}
                    onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255, 59, 48, 0.1)' }}>
                      <AlertTriangle className="w-5 h-5" style={{ color: '#FF3B30' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--text)' }}>{job.job_number}</p>
                      <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{job.customer?.name} · Escalated</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: 'rgba(255, 59, 48, 0.1)', color: '#FF3B30' }}>
                      Urgent
                    </span>
                    <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
                
                {/* Disputed Jobs */}
                {disputedJobs.map(job => (
                  <div
                    key={job.job_id}
                    onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255, 149, 0, 0.1)' }}>
                      <AlertCircle className="w-5 h-5" style={{ color: '#FF9500' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--text)' }}>{job.job_number}</p>
                      <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{job.customer?.name} · Disputed</p>
                    </div>
                    <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
                
                {/* Awaiting Customer Acknowledgment */}
                {awaitingAck.map(job => (
                  <div
                    key={job.job_id}
                    onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(175, 82, 222, 0.1)' }}>
                      <Timer className="w-5 h-5" style={{ color: '#AF52DE' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--text)' }}>{job.job_number}</p>
                      <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{job.customer?.name} · Awaiting acknowledgment</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: 'rgba(175, 82, 222, 0.1)', color: '#AF52DE' }}>
                      Pending
                    </span>
                    <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
                
                {/* Awaiting Finalization */}
                {awaitingFinalization.slice(0, 3).map(job => (
                  <div
                    key={job.job_id}
                    onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(175, 82, 222, 0.1)' }}>
                      <FileText className="w-5 h-5" style={{ color: '#AF52DE' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--text)' }}>{job.job_number}</p>
                      <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{job.customer?.name} · Ready for review</p>
                    </div>
                    <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team Status - 1 col */}
        <div 
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Team Status</h2>
          </div>
          <div className="px-5 py-3 divide-y max-h-80 overflow-y-auto" style={{ borderColor: 'var(--border-subtle)' }}>
            {technicians.map(tech => {
              const status = getTeamMemberStatus(tech);
              return (
                <TeamMember
                  key={tech.user_id}
                  name={tech.name}
                  status={status.status}
                  detail={status.detail}
                />
              );
            })}
            {technicians.length === 0 && (
              <div className="py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No technicians</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// =========================================
// TECHNICIAN PREMIUM DASHBOARD
// =========================================

const TechnicianPremiumDashboard: React.FC<DashboardProps> = ({ currentUser, jobs, onNavigate }) => {
  const today = new Date();
  const todayStr = today.toDateString();
  
  // My jobs
  const myJobs = jobs.filter(j => 
    j.assigned_technician_id === currentUser.user_id &&
    !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)
  );
  
  const todayJobs = myJobs.filter(j => {
    const jobDate = new Date(j.scheduled_date || j.created_at);
    return jobDate.toDateString() === todayStr;
  });

  const inProgressJob = myJobs.find(j => j.status === 'In Progress');
  const assignedJobs = myJobs.filter(j => j.status === 'Assigned');
  
  const completedToday = jobs.filter(j => {
    const isCompleted = ['Completed', 'Completed Awaiting Ack'].includes(j.status);
    const completedDate = j.completed_at ? new Date(j.completed_at) : null;
    return isCompleted && completedDate?.toDateString() === todayStr && 
           j.assigned_technician_id === currentUser.user_id;
  }).length;

  // Weekly stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const completedThisWeek = jobs.filter(j => 
    ['Completed', 'Completed Awaiting Ack'].includes(j.status) &&
    j.completed_at && new Date(j.completed_at) >= weekAgo &&
    j.assigned_technician_id === currentUser.user_id
  ).length;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
          My Jobs
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Current Job Banner */}
      {inProgressJob && (
        <div 
          className="p-4 rounded-2xl"
          style={{ 
            background: 'linear-gradient(135deg, rgba(255, 149, 0, 0.12) 0%, rgba(255, 149, 0, 0.06) 100%)',
            border: '1px solid rgba(255, 149, 0, 0.2)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255, 149, 0, 0.15)' }}
              >
                <Play className="w-6 h-6" style={{ color: '#FF9500' }} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#FF9500' }}>
                  Currently Working
                </p>
                <p className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
                  {inProgressJob.job_number}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {inProgressJob.customer?.name}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate(`/jobs/${inProgressJob.job_id}`)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:scale-105"
              style={{ background: '#FF9500', color: 'white' }}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Today"
          value={todayJobs.length}
          sublabel="Scheduled"
          icon={<Calendar className="w-5 h-5" />}
          accent="blue"
          compact
        />
        <StatCard
          label="Completed"
          value={completedToday}
          sublabel="Today"
          icon={<CheckCircle className="w-5 h-5" />}
          accent="green"
          compact
        />
        <StatCard
          label="This Week"
          value={completedThisWeek}
          sublabel="Completed"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="purple"
          compact
        />
      </div>

      {/* Job Queue */}
      <div 
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
            {inProgressJob ? 'Up Next' : 'Today\'s Schedule'}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {assignedJobs.length} job{assignedJobs.length !== 1 ? 's' : ''} in queue
          </p>
        </div>
        
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {assignedJobs.length === 0 && !inProgressJob ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium" style={{ color: 'var(--text)' }}>No jobs scheduled</p>
              <p className="text-sm mt-1">You're all caught up for today!</p>
            </div>
          ) : (
            assignedJobs.slice(0, 5).map((job, index) => (
              <div
                key={job.job_id}
                onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm"
                  style={{ 
                    background: index === 0 ? 'var(--accent)' : 'var(--surface-2)',
                    color: index === 0 ? 'white' : 'var(--text-muted)'
                  }}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--text)' }}>
                    {job.job_number}
                  </p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                    {job.customer?.name} · {job.job_type}
                  </p>
                </div>
                {index === 0 && !inProgressJob && (
                  <span 
                    className="text-xs font-medium px-2 py-1 rounded-full"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
                  >
                    Next
                  </span>
                )}
                <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </div>
            ))
          )}
        </div>
        
        {assignedJobs.length > 5 && (
          <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <button 
              onClick={() => onNavigate('/jobs')}
              className="text-sm font-medium w-full text-center"
              style={{ color: 'var(--accent)' }}
            >
              View all {myJobs.length} jobs
            </button>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <QuickAction
          icon={<Eye className="w-4 h-4" />}
          label="View All My Jobs"
          onClick={() => onNavigate('/jobs')}
          accent="#007AFF"
        />
        <QuickAction
          icon={<Clock className="w-4 h-4" />}
          label="My Time Log"
          onClick={() => onNavigate('/my-time')}
          accent="#34C759"
        />
      </div>
    </div>
  );
};


// =========================================
// ACCOUNTANT PREMIUM DASHBOARD
// =========================================

const AccountantPremiumDashboard: React.FC<DashboardProps> = ({ jobs, onNavigate }) => {
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
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
          Financial Overview
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Invoice and payment management
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending Invoices"
          value={awaitingFinalization.length}
          sublabel="Ready to finalize"
          icon={<FileText className="w-5 h-5" />}
          accent="blue"
        />
        <StatCard
          label="Pending Value"
          value={`RM ${pendingInvoiceValue.toLocaleString()}`}
          sublabel="Estimated"
          icon={<Clock className="w-5 h-5" />}
          accent="orange"
        />
        <StatCard
          label="Completed"
          value={completedJobs.length}
          sublabel="Month to date"
          icon={<CheckCircle className="w-5 h-5" />}
          accent="green"
        />
        <StatCard
          label="Revenue"
          value={`RM ${monthlyRevenue.toLocaleString()}`}
          sublabel="Month to date"
          icon={<TrendingUp className="w-5 h-5" />}
          accent="purple"
          trend={{ value: 8, label: 'vs last month' }}
        />
      </div>

      {/* Jobs Ready for Finalization */}
      <div 
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Ready for Finalization</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {awaitingFinalization.length} jobs awaiting invoice
            </p>
          </div>
          <button 
            onClick={() => onNavigate('/invoices')}
            className="text-sm font-medium flex items-center gap-1"
            style={{ color: 'var(--accent)' }}
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {awaitingFinalization.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--success)' }} />
              <p className="font-medium" style={{ color: 'var(--text)' }}>All caught up!</p>
              <p className="text-sm mt-1">No jobs pending finalization</p>
            </div>
          ) : (
            awaitingFinalization.slice(0, 5).map(job => (
              <div
                key={job.job_id}
                onClick={() => onNavigate(`/jobs/${job.job_id}`)}
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--text)' }}>{job.job_number}</p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                    {job.customer?.name} · {job.job_type}
                  </p>
                </div>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(job.completed_at || job.updated_at)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onNavigate(`/jobs/${job.job_id}`); }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  Review
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};


// =========================================
// MAIN PROTOTYPE PAGE
// =========================================

interface PrototypeDashboardsProps {
  currentUser: User;
}

const PrototypeDashboards: React.FC<PrototypeDashboardsProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dev mode hook
  const devMode = useDevMode(currentUser.email, currentUser.role);

  // Load data ONLY if user is a dev
  useEffect(() => {
    if (!devMode.isDev) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const [jobsData, usersData] = await Promise.all([
          SupabaseDb.getJobs(currentUser),
          SupabaseDb.getUsers(),
        ]);
        setJobs(jobsData);
        setUsers(usersData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUser, devMode.isDev]);

  const handleRefresh = async () => {
    if (!devMode.isDev) return;
    try {
      const [jobsData, usersData] = await Promise.all([
        SupabaseDb.getJobs(currentUser),
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

  // Access check - dev only
  if (!devMode.isDev) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div 
          className="p-8 text-center max-w-md rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--warning)' }} />
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Access Restricted</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            This prototype page is only available to developers.
          </p>
          <button 
            onClick={() => navigate('/')} 
            className="mt-4 px-4 py-2 rounded-xl font-medium text-sm"
            style={{ background: 'var(--accent)', color: 'white' }}
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div 
          className="p-8 text-center max-w-md rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--error)' }} />
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Error Loading</h1>
          <p style={{ color: 'var(--text-muted)' }}>{error}</p>
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

  // Render appropriate dashboard based on display role
  const renderDashboard = () => {
    const role = devMode.displayRole;
    switch (role) {
      case UserRole.TECHNICIAN:
        return <TechnicianPremiumDashboard {...dashboardProps} />;
      case UserRole.SUPERVISOR:
        return <SupervisorPremiumDashboard {...dashboardProps} />;
      case UserRole.ADMIN:
        return <AdminPremiumDashboard {...dashboardProps} />;
      case UserRole.ACCOUNTANT:
        return <AccountantPremiumDashboard {...dashboardProps} />;
      default:
        return <TechnicianPremiumDashboard {...dashboardProps} />;
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {/* Role Switcher Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span 
                className="text-xs font-medium px-2.5 py-1 rounded-lg"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(255, 149, 0, 0.15) 0%, rgba(255, 59, 48, 0.1) 100%)',
                  color: '#FF9500',
                  border: '1px solid rgba(255, 149, 0, 0.2)'
                }}
              >
                PROTOTYPE v2
              </span>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Premium Dashboard Preview
              </span>
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

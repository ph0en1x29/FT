import {
ArrowRight,
Briefcase,
Calendar,
CheckCircle,
MapPin,
Package,
Play,
RefreshCw,
TrendingUp,
Truck
} from 'lucide-react';
import React from 'react';
import { Job,User } from '../../../../types';
import { colors,KPICard,QueueItem } from './DashboardWidgets';

interface TechnicianDashboardProps {
  currentUser: User;
  jobs: Job[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({ currentUser, jobs, onRefresh, navigate }) => {
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
  const completedJobsThisWeek = jobs.filter(j =>
    ['Completed', 'Completed Awaiting Ack'].includes(j.status) && j.completed_at && new Date(j.completed_at) >= weekAgo && j.assigned_technician_id === currentUser.user_id
  );
  const completedThisWeek = completedJobsThisWeek.length;
  const totalHoursThisWeek = completedJobsThisWeek.reduce((sum, j) => sum + (j.actual_duration_hours || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--text)' }}>My Jobs</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={onRefresh} className="p-2 rounded-xl shrink-0 transition-all active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Current Job Banner */}
      {inProgressJob && (
        <div onClick={() => navigate(`/jobs/${inProgressJob.job_id}`)} className="p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, rgba(255, 149, 0, 0.12) 0%, rgba(255, 149, 0, 0.06) 100%)', border: '1px solid rgba(255, 149, 0, 0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255, 149, 0, 0.15)' }}>
              <Play className="w-5 h-5" style={{ color: '#FF9500' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#FF9500' }}>Currently Working</p>
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{inProgressJob.job_number || inProgressJob.title}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{inProgressJob.customer?.name}</p>
            </div>
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#FF9500' }}>
              <ArrowRight className="w-4 h-4" style={{ color: 'white' }} />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
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
              <QueueItem key={job.job_id} type="assigned" jobNumber={job.job_number || job.title} customer={job.customer?.name || 'Unknown'} detail={job.job_type || ''} onClick={() => navigate(`/jobs/${job.job_id}`)} />
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => navigate('/jobs')} className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(0, 122, 255, 0.15)' }}>
              <Briefcase className="w-4 h-4" style={{ color: '#007AFF' }} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>All Jobs</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>View assignments</p>
            </div>
          </button>

          <button onClick={() => navigate('/my-van-stock')} className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255, 149, 0, 0.15)' }}>
              <Package className="w-4 h-4" style={{ color: '#FF9500' }} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>Van Stock</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>Check inventory</p>
            </div>
          </button>

          <button onClick={() => navigate('/forklifts')} className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(175, 82, 222, 0.15)' }}>
              <Truck className="w-4 h-4" style={{ color: '#AF52DE' }} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>Fleet</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>Manage vehicles</p>
            </div>
          </button>

          <button onClick={() => navigate('/customers')} className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(52, 199, 89, 0.15)' }}>
              <MapPin className="w-4 h-4" style={{ color: '#34C759' }} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>Customers</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>View locations</p>
            </div>
          </button>
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="p-4 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--text)' }}>This Week</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>{completedThisWeek}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Jobs Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>{totalHoursThisWeek.toFixed(1)}h</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Hours</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicianDashboard;

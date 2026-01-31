import React from 'react';
import { Job, User } from '../../../../types';
import {
  CheckCircle, Calendar, TrendingUp,
  RefreshCw, Play, ArrowRight
} from 'lucide-react';
import { colors, KPICard, QueueItem } from './DashboardWidgets';

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
                <p className="font-semibold text-lg" style={{ color: 'var(--text)' }}>{inProgressJob.job_number || inProgressJob.title}</p>
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
              <QueueItem key={job.job_id} type="assigned" jobNumber={job.job_number || job.title} customer={job.customer?.name || 'Unknown'} detail={job.job_type || ''} onClick={() => navigate(`/jobs/${job.job_id}`)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TechnicianDashboard;

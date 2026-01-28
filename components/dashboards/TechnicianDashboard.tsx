import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Clock, CheckCircle, Play, Package, AlertTriangle,
  ChevronRight, Calendar, MapPin, Wrench, Truck
} from 'lucide-react';
import { User, Job, JobStatus, JobType } from '../../types';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import SlotInSLABadge from '../SlotInSLABadge';
import DashboardNotificationCard from '../DashboardNotificationCard';
import { NotificationPermissionPrompt } from '../NotificationSettings';

interface TechnicianDashboardProps {
  currentUser: User;
}

const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [vanStockLow, setVanStockLow] = useState(0);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      const jobsData = await MockDb.getJobs(currentUser);
      setJobs(jobsData || []);

      // Check van stock for low items
      try {
        const vanStock = await MockDb.getVanStockByTechnician(currentUser.user_id);
        if (vanStock && vanStock.items) {
          const lowItems = vanStock.items.filter((item: any) =>
            item.quantity <= (item.min_quantity || 2)
          );
          setVanStockLow(lowItems.length);
        }
      } catch (e) {
        // Van stock might not be set up
      }
    } catch (error: any) {
      showToast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const today = new Date();
  const todayStr = today.toDateString();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);

  // My jobs for today - sorted chronologically by scheduled time
  const todayJobs = jobs
    .filter(j => {
      const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
      return scheduled && scheduled.toDateString() === todayStr &&
             !['Completed', 'Cancelled'].includes(j.status);
    })
    .sort((a, b) => {
      const aTime = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
      const bTime = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      return aTime - bTime; // Chronological order
    });

  // Check if a job is overdue (past scheduled time)
  const isJobOverdue = (job: Job): boolean => {
    if (!job.scheduled_date) return false;
    const scheduledTime = new Date(job.scheduled_date).getTime();
    return Date.now() > scheduledTime && job.status !== JobStatus.IN_PROGRESS;
  };

  // Jobs in progress
  const inProgressJobs = jobs.filter(j => j.status === JobStatus.IN_PROGRESS);

  // Completed this week
  const completedThisWeek = jobs.filter(j =>
    j.status === JobStatus.COMPLETED &&
    j.completed_at &&
    new Date(j.completed_at) >= weekStart
  );

  // Assigned but not started
  const assignedJobs = jobs.filter(j => j.status === JobStatus.ASSIGNED);

  // Slot-In jobs pending acknowledgement (urgent)
  const slotInPending = jobs.filter(j =>
    j.job_type === JobType.SLOT_IN &&
    !j.acknowledged_at &&
    !['Completed', 'Cancelled'].includes(j.status)
  );

  // All active jobs (not completed/cancelled)
  const activeJobs = jobs.filter(j =>
    !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)
  ).sort((a, b) => {
    // Slot-In first
    if (a.job_type === JobType.SLOT_IN && b.job_type !== JobType.SLOT_IN) return -1;
    if (b.job_type === JobType.SLOT_IN && a.job_type !== JobType.SLOT_IN) return 1;
    // Then by status priority
    const statusOrder: Record<string, number> = {
      [JobStatus.IN_PROGRESS]: 1,
      [JobStatus.ASSIGNED]: 2,
      [JobStatus.NEW]: 3,
    };
    return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  });

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case JobStatus.IN_PROGRESS: return { bg: '#dbeafe', text: '#1d4ed8' };
      case JobStatus.ASSIGNED: return { bg: '#e0e7ff', text: '#4f46e5' };
      case JobStatus.NEW: return { bg: '#e0f2fe', text: '#0369a1' };
      default: return { bg: '#f4f4f5', text: '#71717a' };
    }
  };

  const getJobTypeColor = (type?: string) => {
    switch (type) {
      case JobType.SLOT_IN: return { bg: '#fee2e2', text: '#dc2626' };
      case JobType.REPAIR: return { bg: '#ffedd5', text: '#c2410c' };
      case JobType.SERVICE: return { bg: '#dcfce7', text: '#166534' };
      default: return { bg: '#f4f4f5', text: '#71717a' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--text-muted)]">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Push Notification Permission Prompt */}
      <NotificationPermissionPrompt />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            {getGreeting()}, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-sm mt-1 text-[var(--text-muted)]">
            {today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/my-van-stock')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <Package className="w-4 h-4" /> My Van Stock
        </button>
      </div>

      {/* Slot-In Alert Banner */}
      {slotInPending.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full animate-pulse">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="font-semibold text-red-800">
                {slotInPending.length} Slot-In Job{slotInPending.length > 1 ? 's' : ''} - Acknowledge Now!
              </div>
              <div className="text-sm text-red-600">15-minute SLA active</div>
            </div>
          </div>
          <button
            onClick={() => navigate(`/jobs/${slotInPending[0].job_id}`)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
          >
            View Now
          </button>
        </div>
      )}

      {/* Today's Schedule Carousel - PRIMARY SECTION */}
      <div className="card-premium overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-[var(--text)]">Today's Schedule</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {todayJobs.length} job{todayJobs.length !== 1 ? 's' : ''} scheduled • Swipe to see more
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/jobs')}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              View All →
            </button>
          </div>
        </div>

        {todayJobs.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-50" />
            <p className="font-medium text-[var(--text)]">No jobs scheduled for today</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Check back later or view all jobs</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="schedule-carousel">
              {todayJobs.map(job => {
                const isSlotIn = job.job_type === JobType.SLOT_IN;
                const isUnacknowledged = isSlotIn && !job.acknowledged_at;
                const overdue = isJobOverdue(job);
                const typeColor = getJobTypeColor(job.job_type);
                const statusColor = getStatusColor(job.status);

                return (
                  <div
                    key={job.job_id}
                    onClick={() => navigate(`/jobs/${job.job_id}`)}
                    className={`schedule-card ${isUnacknowledged ? 'urgent' : ''} ${overdue ? 'overdue' : ''}`}
                  >
                    {/* Job Type Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: typeColor.bg, color: typeColor.text }}
                      >
                        {job.job_type || 'Job'}
                      </span>
                      {isUnacknowledged && (
                        <SlotInSLABadge
                          createdAt={job.created_at}
                          acknowledgedAt={job.acknowledged_at}
                          slaTargetMinutes={job.sla_target_minutes || 15}
                          size="sm"
                        />
                      )}
                    </div>

                    {/* Job Title */}
                    <h3 className="font-medium text-[var(--text)] truncate mb-1">{job.title}</h3>

                    {/* Customer & Location */}
                    <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-2">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{job.customer?.name || 'No customer'}</span>
                    </div>

                    {/* Scheduled Time */}
                    {job.scheduled_date && (
                      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-2">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {new Date(job.scheduled_date).toLocaleTimeString('en-MY', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {overdue && (
                          <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                            Overdue
                          </span>
                        )}
                      </div>
                    )}

                    {/* Forklift Info */}
                    {job.forklift && (
                      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-3">
                        <Truck className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {job.forklift.serial_number} • {job.forklift.make} {job.forklift.model}
                        </span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                      <span
                        className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: statusColor.bg, color: statusColor.text }}
                      >
                        {job.status.replace(/_/g, ' ')}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Jobs */}
        <div
          className="card-premium p-5 border-l-4 border-l-[var(--accent)] cursor-pointer hover:shadow-lg transition-all"
          onClick={() => navigate('/jobs')}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Today's Jobs</p>
              <p className="text-3xl font-bold mt-2 text-[var(--text)]">{todayJobs.length}</p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">Scheduled for today</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[var(--accent)]" />
            </div>
          </div>
        </div>

        {/* In Progress */}
        <div
          className={`card-premium p-5 border-l-4 cursor-pointer hover:shadow-lg transition-all ${
            inProgressJobs.length > 0 ? 'border-l-blue-500 bg-blue-50/50' : 'border-l-gray-300'
          }`}
          onClick={() => navigate('/jobs?filter=in-progress')}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">In Progress</p>
              <p className={`text-3xl font-bold mt-2 ${inProgressJobs.length > 0 ? 'text-blue-600' : 'text-[var(--text)]'}`}>
                {inProgressJobs.length}
              </p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">Currently working</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Play className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Completed This Week */}
        <div className="card-premium p-5 border-l-4 border-l-green-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Completed</p>
              <p className="text-3xl font-bold mt-2 text-green-600">{completedThisWeek.length}</p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">This week</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        {/* Van Stock Alert */}
        <div
          className={`card-premium p-5 border-l-4 cursor-pointer hover:shadow-lg transition-all ${
            vanStockLow > 0 ? 'border-l-orange-500 bg-orange-50/50' : 'border-l-gray-300'
          }`}
          onClick={() => navigate('/my-van-stock')}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Van Stock</p>
              <p className={`text-3xl font-bold mt-2 ${vanStockLow > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {vanStockLow > 0 ? vanStockLow : 'OK'}
              </p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">
                {vanStockLow > 0 ? 'Items low' : 'Stock levels good'}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              vanStockLow > 0 ? 'bg-orange-100' : 'bg-green-100'
            }`}>
              <Package className={`w-5 h-5 ${vanStockLow > 0 ? 'text-orange-600' : 'text-green-600'}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <DashboardNotificationCard maxItems={5} />

      {/* All Active Jobs */}
      <div className="card-premium overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-[var(--text)]">All Active Jobs</h2>
                <p className="text-xs text-[var(--text-muted)]">{activeJobs.length} active jobs assigned to you</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/jobs')}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              View All →
            </button>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {activeJobs.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
              <p className="font-medium text-[var(--text)]">All caught up!</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">No active jobs assigned to you</p>
            </div>
          ) : (
            activeJobs.slice(0, 8).map(job => {
              const statusColor = getStatusColor(job.status);
              const typeColor = getJobTypeColor(job.job_type);
              const isSlotIn = job.job_type === JobType.SLOT_IN;

              return (
                <div
                  key={job.job_id}
                  onClick={() => navigate(`/jobs/${job.job_id}`)}
                  className={`p-4 cursor-pointer transition-all hover:bg-[var(--bg-subtle)] ${
                    isSlotIn && !job.acknowledged_at ? 'bg-red-50/50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Status/Type indicator */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: isSlotIn ? typeColor.bg : statusColor.bg }}
                      >
                        {isSlotIn ? (
                          <AlertTriangle className="w-5 h-5" style={{ color: typeColor.text }} />
                        ) : (
                          <Wrench className="w-5 h-5" style={{ color: statusColor.text }} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--text)] truncate">{job.title}</p>
                          {isSlotIn && !job.acknowledged_at && (
                            <SlotInSLABadge
                              createdAt={job.created_at}
                              acknowledgedAt={job.acknowledged_at}
                              slaTargetMinutes={job.sla_target_minutes || 15}
                              size="sm"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.customer?.name || 'No customer'}
                          </span>
                          {job.scheduled_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(job.scheduled_date).toLocaleDateString('en-MY', {
                                day: 'numeric', month: 'short'
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status badge */}
                      <span
                        className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ background: statusColor.bg, color: statusColor.text }}
                      >
                        {job.status.replace(/_/g, ' ')}
                      </span>
                      {/* Job type badge */}
                      {job.job_type && (
                        <span
                          className="px-2 py-1 rounded-lg text-xs font-medium"
                          style={{ background: typeColor.bg, color: typeColor.text }}
                        >
                          {job.job_type}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {activeJobs.length > 8 && (
          <div className="p-3 border-t border-[var(--border-subtle)] text-center">
            <button
              onClick={() => navigate('/jobs')}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              View all {activeJobs.length} jobs →
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/jobs')}
          className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">All Jobs</p>
            <p className="text-xs text-[var(--text-muted)]">View job list</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/my-van-stock')}
          className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Van Stock</p>
            <p className="text-xs text-[var(--text-muted)]">Manage inventory</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/forklifts')}
          className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Truck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Fleet</p>
            <p className="text-xs text-[var(--text-muted)]">View forklifts</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/customers')}
          className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Customers</p>
            <p className="text-xs text-[var(--text-muted)]">View locations</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default TechnicianDashboard;

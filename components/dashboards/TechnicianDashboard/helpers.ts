import { Job, JobStatus, JobType, StatusColor } from './types';

/**
 * Returns time-appropriate greeting
 */
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Returns color scheme for job status
 */
export const getStatusColor = (status: string): StatusColor => {
  switch (status) {
    case JobStatus.IN_PROGRESS:
      return { bg: '#dbeafe', text: '#1d4ed8' };
    case JobStatus.ASSIGNED:
      return { bg: '#e0e7ff', text: '#4f46e5' };
    case JobStatus.NEW:
      return { bg: '#e0f2fe', text: '#0369a1' };
    default:
      return { bg: '#f4f4f5', text: '#71717a' };
  }
};

/**
 * Returns color scheme for job type
 */
export const getJobTypeColor = (type?: string): StatusColor => {
  switch (type) {
    case JobType.SLOT_IN:
      return { bg: '#fee2e2', text: '#dc2626' };
    case JobType.REPAIR:
      return { bg: '#ffedd5', text: '#c2410c' };
    case JobType.SERVICE:
      return { bg: '#dcfce7', text: '#166534' };
    default:
      return { bg: '#f4f4f5', text: '#71717a' };
  }
};

/**
 * Checks if a job is overdue (past scheduled time)
 */
export const isJobOverdue = (job: Job): boolean => {
  if (!job.scheduled_date) return false;
  const scheduledTime = new Date(job.scheduled_date).getTime();
  return Date.now() > scheduledTime && job.status !== JobStatus.IN_PROGRESS;
};

/**
 * Format date for display
 */
export const formatScheduledTime = (date: string): string => {
  return new Date(date).toLocaleTimeString('en-MY', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format date for short display
 */
export const formatShortDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short'
  });
};

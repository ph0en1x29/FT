import { JobStatus, JobType } from '../../types';

/**
 * Status badge color classes
 */
export const getStatusColor = (status: JobStatus): string => {
  switch (status) {
    case JobStatus.NEW:
      return 'bg-blue-100 text-blue-800';
    case JobStatus.ASSIGNED:
      return 'bg-indigo-100 text-indigo-800';
    case JobStatus.IN_PROGRESS:
      return 'bg-amber-100 text-amber-800';
    case JobStatus.AWAITING_FINALIZATION:
      return 'bg-purple-100 text-purple-800';
    case JobStatus.COMPLETED:
      return 'bg-green-100 text-green-800';
    case JobStatus.COMPLETED_AWAITING_ACK:
      return 'bg-orange-100 text-orange-800';
    case JobStatus.INCOMPLETE_CONTINUING:
      return 'bg-amber-100 text-amber-800';
    case JobStatus.INCOMPLETE_REASSIGNED:
      return 'bg-rose-100 text-rose-800';
    case JobStatus.DISPUTED:
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

/**
 * Job type badge color classes
 */
export const getJobTypeColor = (type?: JobType): string => {
  switch (type) {
    case JobType.SERVICE:
      return 'bg-green-50 text-green-700 border-green-200';
    case JobType.REPAIR:
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case JobType.CHECKING:
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case JobType.SLOT_IN:
      return 'bg-red-50 text-red-700 border-red-200';
    case JobType.COURIER:
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

/**
 * Quick stats button active background colors
 */
export const QUICK_STATS_ACTIVE_COLORS = {
  active: '#16A34A',
  new: '#475569',
  assigned: '#0891B2',
  inProgress: '#22C55E',
  awaiting: '#D97706',
  completed: '#166534',
} as const;

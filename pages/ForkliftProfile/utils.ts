import { ForkliftStatus } from '../../types';

export const getStatusBadge = (status: ForkliftStatus) => {
  const styles = {
    [ForkliftStatus.ACTIVE]: 'bg-green-100 text-green-700',
    [ForkliftStatus.MAINTENANCE]: 'bg-amber-100 text-amber-700',
    [ForkliftStatus.INACTIVE]: 'bg-red-100 text-red-700',
  };
  return styles[status] || 'bg-slate-100 text-slate-700';
};

export const getJobStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    'Completed': 'bg-green-100 text-green-700',
    'Awaiting Finalization': 'bg-purple-100 text-purple-700',
    'In Progress': 'bg-amber-100 text-amber-700',
    'Assigned': 'bg-blue-100 text-blue-700',
    'New': 'bg-slate-100 text-slate-700',
    'Completed Awaiting Acknowledgement': 'bg-orange-100 text-orange-700',
    'Incomplete - Continuing': 'bg-amber-100 text-amber-700',
    'Incomplete - Reassigned': 'bg-rose-100 text-rose-700',
    'Disputed': 'bg-red-100 text-red-700',
  };
  return styles[status] || 'bg-slate-100 text-slate-700';
};

export const getScheduledServiceStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    'pending': 'bg-amber-100 text-amber-700',
    'scheduled': 'bg-blue-100 text-blue-700',
    'completed': 'bg-green-100 text-green-700',
    'overdue': 'bg-red-100 text-red-700',
    'cancelled': 'bg-slate-100 text-slate-500',
  };
  return styles[status] || 'bg-slate-100 text-slate-700';
};

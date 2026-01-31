import React from 'react';
import { LeaveStatus } from '../../../types';
import { Clock, CheckCircle, X, AlertTriangle } from 'lucide-react';

interface LeaveStatusBadgeProps {
  status: LeaveStatus;
}

export function getStatusColor(status: LeaveStatus): string {
  switch (status) {
    case LeaveStatus.APPROVED:
      return 'bg-green-100 text-green-800';
    case LeaveStatus.PENDING:
      return 'bg-yellow-100 text-yellow-800';
    case LeaveStatus.REJECTED:
      return 'bg-red-100 text-red-800';
    case LeaveStatus.CANCELLED:
      return 'bg-slate-100 text-slate-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

export function getStatusIcon(status: LeaveStatus): React.ReactNode {
  switch (status) {
    case LeaveStatus.APPROVED:
      return <CheckCircle className="w-4 h-4" />;
    case LeaveStatus.PENDING:
      return <Clock className="w-4 h-4" />;
    case LeaveStatus.REJECTED:
      return <X className="w-4 h-4" />;
    case LeaveStatus.CANCELLED:
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return null;
  }
}

export function LeaveStatusBadge({ status }: LeaveStatusBadgeProps) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${getStatusColor(status)}`}
    >
      {getStatusIcon(status)}
      {status}
    </span>
  );
}

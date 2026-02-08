import { Trash2 } from 'lucide-react';
import { EmployeeLeave,LeaveStatus,LeaveType } from '../../../types';
import { LeaveStatusBadge } from './LeaveStatusBadge';

interface LeaveRequestCardProps {
  leave: EmployeeLeave;
  onCancel: (leaveId: string) => void;
}

export function LeaveRequestCard({ leave, onCancel }: LeaveRequestCardProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isUpcoming = new Date(leave.start_date) > today;
  const isCurrent = new Date(leave.start_date) <= today && new Date(leave.end_date) >= today;
  const canCancel = (leave.status === LeaveStatus.PENDING || 
    (leave.status === LeaveStatus.APPROVED && new Date(leave.start_date) > today));

  const leaveType = leave.leave_type as LeaveType;

  return (
    <div
      className={`border rounded-lg p-4 ${
        isCurrent ? 'border-blue-300 bg-blue-50' :
        isUpcoming && leave.status === LeaveStatus.APPROVED ? 'border-green-200 bg-green-50' :
        leave.status === LeaveStatus.PENDING ? 'border-yellow-200 bg-yellow-50' :
        'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: leaveType?.color || '#3B82F6',
              }}
            />
            <h4 className="font-medium text-slate-800">
              {leaveType?.name || 'Leave'}
            </h4>
            <LeaveStatusBadge status={leave.status} />
            {isCurrent && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Currently on leave
              </span>
            )}
            {isUpcoming && leave.status === LeaveStatus.APPROVED && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                Scheduled
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-slate-500">From:</span>{' '}
              <span className="text-slate-800">
                {new Date(leave.start_date).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500">To:</span>{' '}
              <span className="text-slate-800">
                {new Date(leave.end_date).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Days:</span>{' '}
              <span className="text-slate-800">
                {leave.total_days}
                {leave.is_half_day && ` (${leave.half_day_type})`}
              </span>
            </div>
            {leave.requested_at && (
              <div>
                <span className="text-slate-500">Requested:</span>{' '}
                <span className="text-slate-800">
                  {new Date(leave.requested_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          {leave.reason && (
            <p className="text-sm text-slate-600 mt-2">
              <span className="text-slate-500">Reason:</span> {leave.reason}
            </p>
          )}
          {leave.rejection_reason && (
            <p className="text-sm text-red-600 mt-2">
              <span className="text-red-500">Rejection reason:</span> {leave.rejection_reason}
            </p>
          )}
          {leave.approved_at && leave.approved_by_name && (
            <p className="text-xs text-slate-500 mt-2">
              Approved by {leave.approved_by_name} on {new Date(leave.approved_at).toLocaleDateString()}
            </p>
          )}
        </div>
        {canCancel && (
          <button
            onClick={() => onCancel(leave.leave_id)}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Cancel leave request"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

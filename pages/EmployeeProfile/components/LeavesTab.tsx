import React from 'react';
import {
  Calendar,
  CalendarDays,
  Plus,
  CheckCircle,
  Clock,
  Trash2,
  X,
} from 'lucide-react';
import { EmployeeLeave, LeaveType, LeaveStatus } from '../../../types';
import { HRService } from '../../../services/hrService';
import { showToast } from '../../../services/toastService';
import { LeavesTabProps } from '../types';

/**
 * LeavesTab - Displays and manages employee leave history
 * Shows leave cards grouped by upcoming/past
 * Supports requesting, approving, rejecting, and canceling leaves
 */
export default function LeavesTab({
  employee,
  canManage,
  canApprove,
  canRequestOwn,
  onAdd,
  onShowCalendar,
  onRefresh,
  currentUser,
}: LeavesTabProps) {
  const leaves = employee.leaves || [];
  
  // Sort leaves by date, showing upcoming/current first
  const sortedLeaves = [...leaves].sort((a, b) => {
    const dateA = new Date(a.start_date).getTime();
    const dateB = new Date(b.start_date).getTime();
    return dateB - dateA; // Most recent first
  });
  
  // Separate upcoming and past leaves
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcomingLeaves = sortedLeaves.filter(
    l => new Date(l.end_date) >= today && l.status !== LeaveStatus.CANCELLED && l.status !== LeaveStatus.REJECTED
  );
  const pastLeaves = sortedLeaves.filter(
    l => new Date(l.end_date) < today || l.status === LeaveStatus.CANCELLED || l.status === LeaveStatus.REJECTED
  );

  const handleApprove = async (leaveId: string) => {
    try {
      await HRService.approveLeave(
        leaveId,
        currentUser.user_id,
        currentUser.name
      );
      onRefresh();
    } catch (error) {
      console.error('Error approving leave:', error);
      showToast.error('Failed to approve leave');
      alert('Failed to approve leave');
    }
  };

  const handleReject = async (leaveId: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;
    try {
      await HRService.rejectLeave(
        leaveId,
        currentUser.user_id,
        currentUser.name,
        reason
      );
      onRefresh();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      showToast.error('Failed to reject leave');
      alert('Failed to reject leave');
    }
  };

  const handleCancel = async (leaveId: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await HRService.cancelLeave(leaveId);
      onRefresh();
    } catch (error) {
      console.error('Error canceling leave:', error);
      showToast.error('Failed to cancel leave');
      alert('Failed to cancel leave');
    }
  };

  const getStatusColor = (status: LeaveStatus) => {
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
  };

  const LeaveCard: React.FC<{ leave: EmployeeLeave }> = ({ leave }) => {
    const isUpcoming = new Date(leave.start_date) > today;
    const isCurrent = new Date(leave.start_date) <= today && new Date(leave.end_date) >= today;
    
    return (
      <div
        className={`border rounded-lg p-4 ${
          isCurrent ? 'border-blue-300 bg-blue-50' :
          isUpcoming ? 'border-green-300 bg-green-50' :
          'border-slate-200'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor:
                    (leave.leave_type as LeaveType)?.color || '#3B82F6',
                }}
              />
              <h4 className="font-medium text-slate-800">
                {(leave.leave_type as LeaveType)?.name || 'Leave'}
              </h4>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(
                  leave.status
                )}`}
              >
                {leave.status}
              </span>
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
                <span className="text-slate-500">Reason:</span>{' '}
                {leave.reason}
              </p>
            )}
            {leave.rejection_reason && (
              <p className="text-sm text-red-600 mt-2">
                <span className="text-red-500">Rejection:</span>{' '}
                {leave.rejection_reason}
              </p>
            )}
            {leave.approved_at && leave.approved_by_name && (
              <p className="text-xs text-slate-500 mt-2">
                Approved by {leave.approved_by_name} on {new Date(leave.approved_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {/* Approval Actions for managers */}
            {canApprove && leave.status === LeaveStatus.PENDING && (
              <>
                <button
                  onClick={() => handleApprove(leave.leave_id)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                  title="Approve"
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleReject(leave.leave_id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Reject"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            )}
            
            {/* Cancel button for own pending/approved future leaves */}
            {canRequestOwn && 
             (leave.status === LeaveStatus.PENDING || 
              (leave.status === LeaveStatus.APPROVED && new Date(leave.start_date) > today)) && (
              <button
                onClick={() => handleCancel(leave.leave_id)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                title="Cancel"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="font-medium text-slate-800">Leave History</h3>
        <div className="flex gap-2">
          <button
            onClick={onShowCalendar}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            <CalendarDays className="w-4 h-4" />
            Calendar
          </button>
          {(canManage || canRequestOwn) && (
            <button
              onClick={onAdd}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Request Leave
            </button>
          )}
        </div>
      </div>

      {leaves.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Calendar className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p>No leave records</p>
          {(canManage || canRequestOwn) && (
            <button
              onClick={onAdd}
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              Request your first leave
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Leaves */}
          {upcomingLeaves.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Upcoming & Current ({upcomingLeaves.length})
              </h4>
              <div className="space-y-3">
                {upcomingLeaves.map((leave) => (
                  <LeaveCard key={leave.leave_id} leave={leave} />
                ))}
              </div>
            </div>
          )}
          
          {/* Past Leaves */}
          {pastLeaves.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Past Leaves ({pastLeaves.length})
              </h4>
              <div className="space-y-3">
                {pastLeaves.map((leave) => (
                  <LeaveCard key={leave.leave_id} leave={leave} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

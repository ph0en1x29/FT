import React, { useState, useEffect } from 'react';
import { User, EmployeeLeave, LeaveStatus } from '../../../types';
import { HRService } from '../../../services/hrService';
import { showToast } from '../../../services/toastService';
import { Calendar, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { LeaveFilterType } from '../types';

interface LeaveTabProps {
  currentUser: User;
  initialFilter?: LeaveFilterType;
  onFilterChange?: (filter: LeaveFilterType) => void;
}

const LeaveTab: React.FC<LeaveTabProps> = ({ currentUser, initialFilter, onFilterChange }) => {
  const [pendingLeaves, setPendingLeaves] = useState<EmployeeLeave[]>([]);
  const [allLeaves, setAllLeaves] = useState<EmployeeLeave[]>([]);
  const [todayLeaves, setTodayLeaves] = useState<EmployeeLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeaveFilterType>(initialFilter || 'pending');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Use dev mode context for role-based permissions
  const { hasPermission } = useDevModeContext();
  const canApproveLeave = hasPermission('canApproveLeave');

  // Update filter when initialFilter changes (from URL param)
  useEffect(() => {
    const newFilter = initialFilter || 'pending';
    if (newFilter !== filter) {
      setFilter(newFilter);
    }
  }, [initialFilter]);

  const handleFilterChange = (newFilter: LeaveFilterType) => {
    setFilter(newFilter);
    onFilterChange?.(newFilter);
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const [pending, all, today] = await Promise.all([
        HRService.getPendingLeaves(),
        HRService.getLeaves(),
        HRService.getTodaysLeaves()
      ]);
      setPendingLeaves(pending);
      setAllLeaves(all.length > 0 ? all : pending);
      setTodayLeaves(today);
    } catch (error) {
      console.error('Error loading leaves:', error);
      showToast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (leaveId: string) => {
    try {
      await HRService.approveLeave(leaveId, currentUser.user_id, currentUser.name);
      showToast.success('Leave approved');
      loadLeaves();
    } catch (error) {
      showToast.error('Failed to approve leave');
    }
  };

  const handleReject = async () => {
    if (!rejectingLeaveId) return;
    try {
      await HRService.rejectLeave(rejectingLeaveId, currentUser.user_id, currentUser.name, rejectionReason);
      showToast.success('Leave rejected');
      setShowRejectModal(false);
      setRejectingLeaveId(null);
      setRejectionReason('');
      loadLeaves();
    } catch (error) {
      showToast.error('Failed to reject leave');
    }
  };

  const getStatusBadge = (status: LeaveStatus) => {
    const styles = {
      [LeaveStatus.PENDING]: 'bg-amber-100 text-amber-700',
      [LeaveStatus.APPROVED]: 'bg-green-100 text-green-700',
      [LeaveStatus.REJECTED]: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-600';
  };

  // Determine which leaves to display based on filter
  const displayLeaves = filter === 'pending' 
    ? pendingLeaves 
    : filter === 'today' 
      ? todayLeaves 
      : allLeaves;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleFilterChange('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Pending ({pendingLeaves.length})
        </button>
        <button
          onClick={() => handleFilterChange('today')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'today' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          On Leave Today ({todayLeaves.length})
        </button>
        <button
          onClick={() => handleFilterChange('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Requests
        </button>
      </div>

      {/* Leave Requests */}
      {displayLeaves.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No leave requests</h3>
          <p className="text-sm text-theme-muted">
            {filter === 'pending' ? 'No pending requests to review' : 
             filter === 'today' ? 'No one is on leave today' : 
             'No leave requests found'}
          </p>
        </div>
      ) : (
        <div className="card-theme rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-theme-surface-2 border-b border-theme">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Dates</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Status</th>
                {canApproveLeave && <th className="px-4 py-3 text-right text-xs font-semibold text-theme-muted uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayLeaves.map(leave => (
                <tr key={leave.leave_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{(leave as any).user?.full_name || (leave as any).user?.name || 'Unknown'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm capitalize">{(leave.leave_type as any)?.name?.replace('_', ' ') || 'Unknown'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <p>{new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-500">{leave.total_days} day(s)</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(leave.status)}`}>
                      {leave.status}
                    </span>
                  </td>
                  {canApproveLeave && (
                    <td className="px-4 py-3 text-right">
                      {leave.status === LeaveStatus.PENDING && (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => handleApprove(leave.leave_id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setRejectingLeaveId(leave.leave_id); setShowRejectModal(true); }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-red-50">
              <h3 className="font-bold text-lg text-red-800">Reject Leave Request</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason (Optional)</label>
                <textarea
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 h-24"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowRejectModal(false); setRejectingLeaveId(null); setRejectionReason(''); }} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button onClick={handleReject} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveTab;

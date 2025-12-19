import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Employee,
  EmployeeLicense,
  EmployeePermit,
  EmployeeLeave,
  LeaveType,
  HRDashboardSummary,
  AttendanceToday,
  HRAlert,
  LeaveStatus,
  UserRole,
  ROLE_PERMISSIONS,
} from '../types_with_invoice_tracking';
import { HRService } from '../services/hrService';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Car,
  Shield,
  Bell,
  ChevronRight,
  UserCheck,
  UserX,
  FileText,
  TrendingUp,
  XCircle,
  X,
} from 'lucide-react';

interface HRDashboardProps {
  currentUser: User;
}

export default function HRDashboard({ currentUser }: HRDashboardProps) {
  const [summary, setSummary] = useState<HRDashboardSummary | null>(null);
  const [expiringLicenses, setExpiringLicenses] = useState<EmployeeLicense[]>([]);
  const [expiringPermits, setExpiringPermits] = useState<EmployeePermit[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<EmployeeLeave[]>([]);
  const [todaysAttendance, setTodaysAttendance] = useState<AttendanceToday | null>(null);
  const [alerts, setAlerts] = useState<HRAlert[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const canApproveLeave = ROLE_PERMISSIONS[currentUser.role]?.canApproveLeave;

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [
        summaryData,
        licensesData,
        permitsData,
        leavesData,
        attendanceData,
        alertsData,
      ] = await Promise.all([
        HRService.getDashboardSummary(),
        HRService.getExpiringLicenses(60),
        HRService.getExpiringPermits(60),
        HRService.getPendingLeaves(),
        HRService.getAttendanceToday(),
        HRService.getAlerts(),
      ]);
      setSummary(summaryData);
      setExpiringLicenses(licensesData);
      setExpiringPermits(permitsData);
      setPendingLeaves(leavesData);
      setTodaysAttendance(attendanceData);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading HR dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLeave = async (leaveId: string) => {
    try {
      await HRService.approveLeave(leaveId, currentUser.user_id, currentUser.name);
      loadDashboardData();
    } catch (error) {
      console.error('Error approving leave:', error);
      alert('Failed to approve leave');
    }
  };

  const handleRejectLeave = async (leaveId: string) => {
    setRejectingLeaveId(leaveId);
    setRejectionReason('');
    setShowRejectModal(true);
  };
  
  const confirmRejectLeave = async () => {
    if (!rejectingLeaveId || !rejectionReason.trim()) return;
    
    setRejecting(true);
    try {
      await HRService.rejectLeave(rejectingLeaveId, currentUser.user_id, currentUser.name, rejectionReason);
      loadDashboardData();
      setShowRejectModal(false);
      setRejectingLeaveId(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting leave:', error);
      alert('Failed to reject leave');
    } finally {
      setRejecting(false);
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  };

  const getExpiryColor = (days: number) => {
    if (days < 0) return 'text-red-600 bg-red-50';
    if (days <= 14) return 'text-red-600 bg-red-50';
    if (days <= 30) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-theme">HR Dashboard</h1>
          <p className="text-theme-muted">Employee management and leave tracking</p>
        </div>
        <Link
          to="/hr/employees"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Users className="w-5 h-5" />
          View All Employees
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{summary?.totalEmployees || 0}</p>
              <p className="text-sm text-theme-muted">Total Employees</p>
            </div>
          </div>
        </div>

        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{summary?.activeEmployees || 0}</p>
              <p className="text-sm text-theme-muted">Active</p>
            </div>
          </div>
        </div>

        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{summary?.onLeaveToday || 0}</p>
              <p className="text-sm text-theme-muted">On Leave Today</p>
            </div>
          </div>
        </div>

        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{summary?.pendingLeaveRequests || 0}</p>
              <p className="text-sm text-theme-muted">Pending Leaves</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expiry Alerts Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Expiring Licenses */}
        <div className="card-theme rounded-xl overflow-hidden theme-transition">
          <div className="p-4 border-b border-theme flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-theme">Expiring Licenses</h2>
            </div>
            <span className="text-sm text-theme-muted">{expiringLicenses.length} items</span>
          </div>
          <div className="divide-y divide-theme max-h-64 overflow-y-auto">
            {expiringLicenses.length === 0 ? (
              <div className="p-4 text-center text-theme-muted">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No licenses expiring soon</p>
              </div>
            ) : (
              expiringLicenses.slice(0, 5).map((license) => {
                const days = getDaysUntilExpiry(license.expiry_date);
                return (
                  <Link
                    key={license.license_id}
                    to={`/hr/employees/${license.user_id}`}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 transition"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {(license.employee as Employee)?.full_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-slate-600">
                        {license.license_type} - {license.license_number}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getExpiryColor(days)}`}>
                      {days < 0 ? 'Expired' : `${days} days`}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Expiring Permits */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-slate-800">Expiring Permits</h2>
            </div>
            <span className="text-sm text-slate-500">{expiringPermits.length} items</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {expiringPermits.length === 0 ? (
              <div className="p-4 text-center text-slate-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No permits expiring soon</p>
              </div>
            ) : (
              expiringPermits.slice(0, 5).map((permit) => {
                const days = getDaysUntilExpiry(permit.expiry_date);
                return (
                  <Link
                    key={permit.permit_id}
                    to={`/hr/employees/${permit.user_id}`}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 transition"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        {(permit.employee as Employee)?.full_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-slate-600">
                        {permit.permit_type} - {permit.permit_number}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getExpiryColor(days)}`}>
                      {days < 0 ? 'Expired' : `${days} days`}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Pending Leave Requests */}
      {pendingLeaves.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-slate-800">Pending Leave Requests</h2>
            </div>
            <span className="text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
              {pendingLeaves.length} pending
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingLeaves.slice(0, 5).map((leave) => (
              <div
                key={leave.leave_id}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">
                      {(leave.employee as Employee)?.full_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-slate-600">
                      {(leave.leave_type as any)?.name || 'Leave'} •{' '}
                      {new Date(leave.start_date).toLocaleDateString()} -{' '}
                      {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                    {leave.reason && (
                      <p className="text-sm text-slate-500 mt-1">{leave.reason}</p>
                    )}
                  </div>
                </div>
                {canApproveLeave && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveLeave(leave.leave_id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                      title="Approve"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleRejectLeave(leave.leave_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Reject"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Attendance */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-slate-800">Today's Attendance</h2>
          </div>
          <span className="text-sm text-slate-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <UserCheck className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-800">
                  {todaysAttendance?.available?.length || 0}
                </p>
                <p className="text-sm text-green-600">Available</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
              <UserX className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-800">
                  {todaysAttendance?.onLeave?.length || 0}
                </p>
                <p className="text-sm text-yellow-600">On Leave</p>
              </div>
            </div>
          </div>

          {/* On Leave List */}
          {todaysAttendance?.onLeave && todaysAttendance.onLeave.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-2">Employees on Leave Today</h3>
              <div className="space-y-2">
                {todaysAttendance.onLeave.map((leave) => (
                    <div
                      key={leave.leave_id}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Users className="w-4 h-4 text-yellow-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">
                            {(leave.employee as Employee)?.full_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500">{(leave.leave_type as LeaveType)?.name || 'Leave'}</p>
                        </div>
                      </div>
                      <Link
                        to={`/hr/employees/${leave.user_id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View Profile
                      </Link>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-slate-800">Recent Alerts</h2>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.alert_id}
                className={`p-3 flex items-start gap-3 ${
                  alert.severity === 'critical' ? 'bg-red-50' :
                  alert.severity === 'warning' ? 'bg-yellow-50' : 'bg-slate-50'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                  alert.severity === 'critical' ? 'text-red-600' :
                  alert.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{alert.title}</p>
                  <p className="text-xs text-slate-600">{alert.message}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Reject Leave Request</h2>
              <button 
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectingLeaveId(null);
                  setRejectionReason('');
                }} 
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Please provide a reason for rejection *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter the reason why this leave request is being rejected..."
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-2">
                The employee will be notified with this reason.
              </p>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectingLeaveId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
                disabled={rejecting}
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectLeave}
                disabled={!rejectionReason.trim() || rejecting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {rejecting ? 'Rejecting...' : 'Reject Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

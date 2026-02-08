import {
Calendar,
Car,
CheckCircle,
ChevronDown,
ChevronRight,
ChevronUp,
Clock,
Loader2,
Shield,
UserCheck,
User as UserIcon,
Users,
UserX
} from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { HRService } from '../../../services/hrService';
import { showToast } from '../../../services/toastService';
import { AttendanceToday,EmployeeLeave,EmployeeLicense,EmployeePermit,HRDashboardSummary,User } from '../../../types';
import { TabType } from '../types';

interface OverviewTabProps {
  currentUser: User;
  onNavigate: (tab: TabType, params?: Record<string, string>) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ currentUser, onNavigate }) => {
  const [summary, setSummary] = useState<HRDashboardSummary | null>(null);
  const [expiringLicenses, setExpiringLicenses] = useState<EmployeeLicense[]>([]);
  const [expiringPermits, setExpiringPermits] = useState<EmployeePermit[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<EmployeeLeave[]>([]);
  const [todaysAttendance, setTodaysAttendance] = useState<AttendanceToday | null>(null);
  const [loading, setLoading] = useState(true);

  // Expand toggles for expiring sections
  const [showAllLicenses, setShowAllLicenses] = useState(false);
  const [showAllPermits, setShowAllPermits] = useState(false);

  // Use dev mode context for role-based permissions
  const { hasPermission } = useDevModeContext();
  const canApproveLeave = hasPermission('canApproveLeave');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [summaryData, licensesData, permitsData, leavesData, attendanceData] = await Promise.all([
        HRService.getDashboardSummary(),
        HRService.getExpiringLicenses(60),
        HRService.getExpiringPermits(60),
        HRService.getPendingLeaves(),
        HRService.getAttendanceToday(),
      ]);
      setSummary(summaryData);
      setExpiringLicenses(licensesData);
      setExpiringPermits(permitsData);
      setPendingLeaves(leavesData);
      setTodaysAttendance(attendanceData);
    } catch (error) {
      console.error('Error loading HR dashboard:', error);
      showToast.error('Failed to load HR dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLeave = async (leaveId: string) => {
    try {
      await HRService.approveLeave(leaveId, currentUser.user_id, currentUser.name);
      loadDashboardData();
      showToast.success('Leave request approved');
    } catch (error) {
      console.error('Error approving leave:', error);
      showToast.error('Failed to approve leave');
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const getExpiryBadge = (days: number) => {
    if (days < 0) return { text: 'Expired', class: 'text-red-600 bg-red-50' };
    if (days <= 14) return { text: `${days}d`, class: 'text-red-600 bg-red-50' };
    if (days <= 30) return { text: `${days}d`, class: 'text-amber-600 bg-amber-50' };
    return { text: `${days}d`, class: 'text-green-600 bg-green-50' };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  // Determine which licenses/permits to show
  const displayedLicenses = showAllLicenses ? expiringLicenses : expiringLicenses.slice(0, 5);
  const displayedPermits = showAllPermits ? expiringPermits : expiringPermits.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats Cards - All Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Employees → Employees tab */}
        <button 
          onClick={() => onNavigate('employees')} 
          className="card-theme rounded-xl p-4 hover:border-blue-300 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{summary?.totalEmployees || 0}</p>
              <p className="text-xs text-theme-muted">Total Employees</p>
            </div>
          </div>
        </button>

        {/* Active → Employees tab with active filter */}
        <button 
          onClick={() => onNavigate('employees', { status: 'active' })} 
          className="card-theme rounded-xl p-4 hover:border-green-300 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{summary?.activeEmployees || 0}</p>
              <p className="text-xs text-theme-muted">Active</p>
            </div>
          </div>
        </button>

        {/* On Leave Today → Leave tab with today filter */}
        <button 
          onClick={() => onNavigate('leave', { filter: 'today' })} 
          className="card-theme rounded-xl p-4 hover:border-amber-300 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{summary?.onLeaveToday || 0}</p>
              <p className="text-xs text-theme-muted">On Leave Today</p>
            </div>
          </div>
        </button>

        {/* Pending Leaves → Leave tab with pending filter */}
        <button 
          onClick={() => onNavigate('leave', { filter: 'pending' })} 
          className="card-theme rounded-xl p-4 hover:border-orange-300 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{summary?.pendingLeaveRequests || 0}</p>
              <p className="text-xs text-theme-muted">Pending Leaves</p>
            </div>
          </div>
        </button>
      </div>

      {/* Expiring Licenses & Permits */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Expiring Licenses */}
        <div className="card-theme rounded-xl overflow-hidden">
          <div className="p-3 border-b border-theme flex items-center justify-between bg-theme-surface-2">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-sm text-theme">Expiring Licenses</h3>
              <span className="text-xs text-theme-muted">({expiringLicenses.length})</span>
            </div>
            {expiringLicenses.length > 5 && (
              <button 
                onClick={() => setShowAllLicenses(!showAllLicenses)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {showAllLicenses ? (
                  <>Show less <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>View all <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>
          <div className={`divide-y divide-theme overflow-y-auto ${showAllLicenses ? 'max-h-96' : 'max-h-48'}`}>
            {expiringLicenses.length === 0 ? (
              <div className="p-4 text-center text-theme-muted">
                <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-500" />
                <p className="text-xs">No licenses expiring soon</p>
              </div>
            ) : (
              displayedLicenses.map((license) => {
                const days = getDaysUntilExpiry(license.expiry_date);
                const badge = getExpiryBadge(days);
                return (
                  <Link
                    key={license.license_id}
                    to={`/people/employees/${license.user_id}`}
                    className="flex items-center justify-between p-2.5 clickable-row text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-theme truncate">
                        {(license.user as User)?.full_name || (license.user as User)?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-theme-muted truncate">{license.license_type}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${badge.class}`}>
                      {badge.text}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Expiring Permits */}
        <div className="card-theme rounded-xl overflow-hidden">
          <div className="p-3 border-b border-theme flex items-center justify-between bg-theme-surface-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-sm text-theme">Expiring Permits</h3>
              <span className="text-xs text-theme-muted">({expiringPermits.length})</span>
            </div>
            {expiringPermits.length > 5 && (
              <button 
                onClick={() => setShowAllPermits(!showAllPermits)}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                {showAllPermits ? (
                  <>Show less <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>View all <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>
          <div className={`divide-y divide-theme overflow-y-auto ${showAllPermits ? 'max-h-96' : 'max-h-48'}`}>
            {expiringPermits.length === 0 ? (
              <div className="p-4 text-center text-theme-muted">
                <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-500" />
                <p className="text-xs">No permits expiring soon</p>
              </div>
            ) : (
              displayedPermits.map((permit) => {
                const days = getDaysUntilExpiry(permit.expiry_date);
                const badge = getExpiryBadge(days);
                return (
                  <Link
                    key={permit.permit_id}
                    to={`/people/employees/${permit.user_id}`}
                    className="flex items-center justify-between p-2.5 clickable-row text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-theme truncate">
                        {(permit.user as User)?.full_name || (permit.user as User)?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-theme-muted truncate">{permit.permit_type}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${badge.class}`}>
                      {badge.text}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Today's Attendance */}
      <div className="card-theme rounded-xl overflow-hidden">
        <div className="p-3 border-b border-theme flex items-center justify-between bg-theme-surface-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-sm text-theme">Today's Attendance</h3>
          </div>
          <span className="text-xs text-theme-muted">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="grid grid-cols-2">
          <div className="p-4 bg-green-50 flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700">{todaysAttendance?.available?.length || 0}</p>
              <p className="text-xs text-green-600">Available</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('leave', { filter: 'today' })}
            className="p-4 bg-amber-50 flex items-center gap-3 hover:bg-amber-100 transition-colors text-left"
          >
            <UserX className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-700">{todaysAttendance?.onLeave?.length || 0}</p>
              <p className="text-xs text-amber-600">On Leave</p>
            </div>
          </button>
        </div>
      </div>

      {/* Pending Leave Requests (Quick Actions) */}
      {pendingLeaves.length > 0 && canApproveLeave && (
        <div className="card-theme rounded-xl overflow-hidden">
          <div className="p-3 border-b border-theme flex items-center justify-between bg-theme-surface-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <h3 className="font-semibold text-sm text-theme">Pending Leave Requests</h3>
            </div>
            <button 
              onClick={() => onNavigate('leave', { filter: 'pending' })} 
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-theme">
            {pendingLeaves.slice(0, 3).map((leave) => (
              <div key={leave.leave_id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-theme">{leave.user?.full_name || leave.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-theme-muted">
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleApproveLeave(leave.leave_id)}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                    title="Approve"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNavigate('leave', { filter: 'pending' })}
                    className="p-1.5 text-slate-400 hover:bg-slate-50 rounded transition"
                    title="View Details"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;

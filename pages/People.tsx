import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { User, UserRole, Employee, EmployeeLeave, EmployeeLicense, EmployeePermit, LeaveStatus, ROLE_PERMISSIONS, HRDashboardSummary, AttendanceToday } from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { HRService } from '../services/hrService';
import { showToast } from '../services/toastService';
import {
  Users, UserCheck, UserX, Shield, Wrench, FileText, Plus, Edit2, Search,
  CheckCircle, XCircle, Lock, X, AlertTriangle, Calendar, Clock,
  ChevronRight, Loader2, User as UserIcon, Car, Bell, LayoutDashboard, ChevronDown, ChevronUp,
  BarChart3, Briefcase
} from 'lucide-react';
import TechnicianKPIPage from './TechnicianKPIPageV2';
import TeamStatusTab from '../components/TeamStatusTab';

// ============================================================================
// TYPES
// ============================================================================

type TabType = 'overview' | 'team' | 'users' | 'employees' | 'leave' | 'performance';
type LeaveFilterType = 'pending' | 'today' | 'all';

interface PeopleProps {
  currentUser: User;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const People: React.FC<PeopleProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab = (searchParams.get('tab') as TabType) || 'overview';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Get filter params for child tabs
  const statusParam = searchParams.get('status') || undefined;
  const filterParam = searchParams.get('filter') as LeaveFilterType | undefined;

  const canManageUsers = ROLE_PERMISSIONS[currentUser.role]?.canManageUsers;
  const canViewHR = ROLE_PERMISSIONS[currentUser.role]?.canViewHR;
  const canViewKPI = ROLE_PERMISSIONS[currentUser.role]?.canViewKPI;

  const handleTabChange = (tab: TabType, params?: Record<string, string>) => {
    setActiveTab(tab);
    const newParams: Record<string, string> = { tab };
    if (params) {
      Object.assign(newParams, params);
    }
    setSearchParams(newParams);
  };

  // Sync tab from URL when it changes externally
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabType;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: LayoutDashboard, description: 'Dashboard' },
    ...(canViewHR ? [{ id: 'team' as TabType, label: 'Team', icon: Briefcase, description: 'Workload status' }] : []),
    ...(canManageUsers ? [{ id: 'users' as TabType, label: 'Users', icon: Users, description: 'Accounts & access' }] : []),
    ...(canViewHR ? [{ id: 'employees' as TabType, label: 'Employees', icon: UserIcon, description: 'HR profiles' }] : []),
    ...(canViewHR ? [{ id: 'leave' as TabType, label: 'Leave', icon: Calendar, description: 'Requests & approvals' }] : []),
    ...(canViewKPI ? [{ id: 'performance' as TabType, label: 'Performance', icon: BarChart3, description: 'KPI metrics' }] : []),
  ];

  // Default to first available tab
  const availableTabs = tabs.map(t => t.id);
  const effectiveTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || 'overview';

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme">People</h1>
            <p className="text-sm text-theme-muted mt-1">Manage users, employee profiles, and leave requests</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-theme">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = effectiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-theme-muted hover:text-theme hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {effectiveTab === 'overview' && <OverviewTab currentUser={currentUser} onNavigate={handleTabChange} />}
      {effectiveTab === 'team' && canViewHR && <TeamStatusTab currentUser={currentUser} />}
      {effectiveTab === 'users' && canManageUsers && <UsersTab currentUser={currentUser} />}
      {effectiveTab === 'employees' && canViewHR && (
        <EmployeesTab 
          currentUser={currentUser} 
          initialStatus={statusParam} 
          onFilterChange={(status) => setSearchParams({ tab: 'employees', ...(status !== 'all' ? { status } : {}) })}
        />
      )}
      {effectiveTab === 'leave' && canViewHR && (
        <LeaveTab
          currentUser={currentUser}
          initialFilter={filterParam}
          onFilterChange={(filter) => setSearchParams({ tab: 'leave', ...(filter !== 'pending' ? { filter } : {}) })}
        />
      )}
      {effectiveTab === 'performance' && canViewKPI && (
        <TechnicianKPIPage currentUser={currentUser} hideHeader />
      )}
    </div>
  );
};

// ============================================================================
// OVERVIEW TAB (HR DASHBOARD)
// ============================================================================

interface OverviewTabProps {
  currentUser: User;
  onNavigate: (tab: TabType, params?: Record<string, string>) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ currentUser, onNavigate }) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<HRDashboardSummary | null>(null);
  const [expiringLicenses, setExpiringLicenses] = useState<EmployeeLicense[]>([]);
  const [expiringPermits, setExpiringPermits] = useState<EmployeePermit[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<EmployeeLeave[]>([]);
  const [todaysAttendance, setTodaysAttendance] = useState<AttendanceToday | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Expand toggles for expiring sections
  const [showAllLicenses, setShowAllLicenses] = useState(false);
  const [showAllPermits, setShowAllPermits] = useState(false);

  const canApproveLeave = ROLE_PERMISSIONS[currentUser.role]?.canApproveLeave;

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
                    <p className="text-sm font-medium text-theme">{(leave as any).user?.full_name || (leave as any).user?.name || 'Unknown'}</p>
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

// ============================================================================
// USERS TAB
// ============================================================================

const UsersTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; user: User | null; action: 'activate' | 'deactivate' }>({ isOpen: false, user: null, action: 'deactivate' });
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: UserRole.TECHNICIAN,
    password: '',
    is_active: true
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getUsers();
      setUsers(data);
    } catch (error: any) {
      console.error('Error loading users:', error);
      showToast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, email: user.email, role: user.role, password: '', is_active: user.is_active });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', role: UserRole.TECHNICIAN, password: '', is_active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await MockDb.updateUser(editingUser.user_id, {
          name: formData.name,
          role: formData.role,
          is_active: formData.is_active,
          ...(formData.password ? { password: formData.password } : {})
        });
        showToast.success('User updated successfully');
      } else {
        if (!formData.password) {
          showToast.error('Password required');
          return;
        }
        await MockDb.createUser({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password,
          is_active: formData.is_active
        });
        showToast.success('User created successfully');
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (error: any) {
      showToast.error('Failed to save user', error.message);
    }
  };

  const handleConfirmToggle = async () => {
    if (!confirmModal.user) return;
    try {
      await MockDb.updateUser(confirmModal.user.user_id, { is_active: !confirmModal.user.is_active });
      showToast.success(`User ${confirmModal.action}d successfully`);
      loadUsers();
    } catch (error: any) {
      showToast.error('Failed to update user status');
    } finally {
      setConfirmModal({ isOpen: false, user: null, action: 'deactivate' });
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const badges = {
      [UserRole.ADMIN]: { icon: Shield, class: 'bg-red-100 text-red-800' },
      [UserRole.SUPERVISOR]: { icon: Users, class: 'bg-amber-100 text-amber-800' },
      [UserRole.TECHNICIAN]: { icon: Wrench, class: 'bg-blue-100 text-blue-800' },
      [UserRole.ACCOUNTANT]: { icon: FileText, class: 'bg-purple-100 text-purple-800' },
    };
    const badge = badges[role];
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.class}`}>
        <Icon className="w-3 h-3" /> {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const inputClass = "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900";

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="card-theme rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-theme-surface-2 border-b border-theme">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-theme-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers.map(user => (
              <tr key={user.user_id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                    {user.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleOpenModal(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setConfirmModal({ isOpen: true, user, action: user.is_active ? 'deactivate' : 'activate' })}
                    className={`p-1.5 rounded ml-1 ${user.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                    title={user.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name *</label>
                <input type="text" className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email *</label>
                <input type="email" className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!!editingUser} required />
                {editingUser && <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role *</label>
                <select className={inputClass} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}>
                  {Object.values(UserRole).map(role => <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  {editingUser ? 'New Password (leave blank to keep)' : 'Password *'}
                </label>
                <input type="password" className={inputClass} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingUser} />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">{editingUser ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Toggle Modal */}
      {confirmModal.isOpen && confirmModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className={`px-6 py-4 border-b ${confirmModal.action === 'deactivate' ? 'bg-red-50' : 'bg-green-50'}`}>
              <h3 className={`font-bold text-lg ${confirmModal.action === 'deactivate' ? 'text-red-800' : 'text-green-800'}`}>
                {confirmModal.action === 'deactivate' ? 'Deactivate User?' : 'Activate User?'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">
                Are you sure you want to {confirmModal.action} <strong>{confirmModal.user.name}</strong>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal({ isOpen: false, user: null, action: 'deactivate' })} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button 
                  onClick={handleConfirmToggle} 
                  className={`flex-1 py-2.5 rounded-lg font-medium text-white ${confirmModal.action === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {confirmModal.action === 'deactivate' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EMPLOYEES TAB
// ============================================================================

interface EmployeesTabProps {
  currentUser: User;
  initialStatus?: string;
  onFilterChange?: (status: string) => void;
}

const EmployeesTab: React.FC<EmployeesTabProps> = ({ currentUser, initialStatus, onFilterChange }) => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus || 'all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  // Update filter when initialStatus changes (from URL param)
  useEffect(() => {
    const newStatus = initialStatus || 'all';
    if (newStatus !== filterStatus) {
      setFilterStatus(newStatus);
    }
  }, [initialStatus]);

  const handleStatusFilter = (status: string) => {
    setFilterStatus(status);
    onFilterChange?.(status);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getUsers();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
      showToast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.department || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && (emp.employment_status === 'active' || !emp.employment_status)) ||
      (filterStatus === 'inactive' && emp.employment_status === 'inactive');
    
    const matchesDept = filterDepartment === 'all' || emp.department === filterDepartment;
    
    return matchesSearch && matchesStatus && matchesDept;
  });

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees..."
            className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme" value={filterStatus} onChange={(e) => handleStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {departments.length > 0 && (
          <select className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
            <option value="all">All Departments</option>
            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
          </select>
        )}
      </div>

      {/* Employees Grid */}
      {filteredEmployees.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No employees found</h3>
          <p className="text-sm text-theme-muted">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map(emp => (
            <div 
              key={emp.user_id} 
              onClick={() => navigate(`/people/employees/${emp.user_id}`)}
              className="card-theme rounded-xl p-4 cursor-pointer hover:shadow-theme hover:border-blue-300 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-theme group-hover:text-blue-600 truncate">{emp.name}</h3>
                  <p className="text-sm text-theme-muted truncate">{emp.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      emp.employment_status === 'active' || !emp.employment_status ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {emp.employment_status || 'Active'}
                    </span>
                    {emp.department && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {emp.department}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-theme-muted group-hover:text-blue-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// LEAVE TAB
// ============================================================================

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

  const canApproveLeave = ROLE_PERMISSIONS[currentUser.role]?.canApproveLeave;

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

export default People;

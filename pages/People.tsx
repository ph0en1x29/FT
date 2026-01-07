import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { User, UserRole, Employee, EmployeeLeave, LeaveStatus, ROLE_PERMISSIONS } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { HRService } from '../services/hrService';
import { showToast } from '../services/toastService';
import { 
  Users, UserCheck, UserX, Shield, Wrench, FileText, Plus, Edit2, Search, 
  CheckCircle, XCircle, Lock, X, AlertTriangle, Calendar, Clock, 
  ChevronRight, Loader2, User as UserIcon, Car, Bell
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type TabType = 'users' | 'employees' | 'leave';

interface PeopleProps {
  currentUser: User;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const People: React.FC<PeopleProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'users';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const canManageUsers = ROLE_PERMISSIONS[currentUser.role]?.canManageUsers;
  const canViewHR = ROLE_PERMISSIONS[currentUser.role]?.canViewHR;

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    ...(canManageUsers ? [{ id: 'users' as TabType, label: 'Users', icon: Users, description: 'Accounts & access' }] : []),
    ...(canViewHR ? [{ id: 'employees' as TabType, label: 'Employees', icon: UserIcon, description: 'HR profiles' }] : []),
    ...(canViewHR ? [{ id: 'leave' as TabType, label: 'Leave', icon: Calendar, description: 'Requests & approvals' }] : []),
  ];

  // Default to first available tab
  const availableTabs = tabs.map(t => t.id);
  const effectiveTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || 'users';

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
      {effectiveTab === 'users' && canManageUsers && <UsersTab currentUser={currentUser} />}
      {effectiveTab === 'employees' && canViewHR && <EmployeesTab currentUser={currentUser} />}
      {effectiveTab === 'leave' && canViewHR && <LeaveTab currentUser={currentUser} />}
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
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
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

const EmployeesTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

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
      (filterStatus === 'active' && emp.employment_status === 'active') ||
      (filterStatus === 'inactive' && emp.employment_status !== 'active');
    
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
        <select className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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
                      emp.employment_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
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

const LeaveTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [pendingLeaves, setPendingLeaves] = useState<EmployeeLeave[]>([]);
  const [allLeaves, setAllLeaves] = useState<EmployeeLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const canApproveLeave = ROLE_PERMISSIONS[currentUser.role]?.canApproveLeave;

  useEffect(() => {
    loadLeaves();
  }, []);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const [pending, all] = await Promise.all([
        HRService.getPendingLeaves(),
        HRService.getLeaves()
      ]);
      setPendingLeaves(pending);
      setAllLeaves(all.length > 0 ? all : pending);
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

  const displayLeaves = filter === 'pending' ? pendingLeaves : allLeaves;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Pending ({pendingLeaves.length})
        </button>
        <button
          onClick={() => setFilter('all')}
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
            {filter === 'pending' ? 'No pending requests to review' : 'No leave requests found'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Dates</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                {canApproveLeave && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayLeaves.map(leave => (
                <tr key={leave.leave_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{(leave as any).user?.name || 'Unknown'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm capitalize">{leave.leave_type.replace('_', ' ')}</span>
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

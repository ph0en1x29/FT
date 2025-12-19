import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Employee,
  EmploymentStatus,
  EmploymentType,
  UserRole,
  ROLE_PERMISSIONS,
} from '../types_with_invoice_tracking';
import { HRService } from '../services/hrService';
import {
  Users,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  Calendar,
  Building2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  FileText,
  Shield,
  Car,
  X,
  ArrowLeft,
} from 'lucide-react';

interface EmployeesPageProps {
  currentUser: User;
}

export default function EmployeesPage({ currentUser }: EmployeesPageProps) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const canManageEmployees = ROLE_PERMISSIONS[currentUser.role]?.canManageEmployees;

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await HRService.getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique departments for filter
  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))];

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.phone?.includes(searchTerm) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || emp.status === statusFilter;
    const matchesDepartment =
      departmentFilter === 'all' || emp.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const getStatusColor = (status: EmploymentStatus) => {
    switch (status) {
      case EmploymentStatus.ACTIVE:
        return 'bg-green-100 text-green-800';
      case EmploymentStatus.INACTIVE:
        return 'bg-gray-100 text-gray-800';
      case EmploymentStatus.ON_LEAVE:
        return 'bg-yellow-100 text-yellow-800';
      case EmploymentStatus.TERMINATED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: EmploymentStatus) => {
    switch (status) {
      case EmploymentStatus.ACTIVE:
        return <CheckCircle className="w-4 h-4" />;
      case EmploymentStatus.INACTIVE:
        return <XCircle className="w-4 h-4" />;
      case EmploymentStatus.ON_LEAVE:
        return <Clock className="w-4 h-4" />;
      case EmploymentStatus.TERMINATED:
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/hr')}
            className="p-2 hover:bg-theme-surface-2 rounded-lg transition theme-transition"
            title="Back to HR Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-theme" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-theme">Employees</h1>
            <p className="text-theme-muted">
              Manage employee records, licenses, and permits
            </p>
          </div>
        </div>
        {canManageEmployees && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Add Employee
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
            <input
              type="text"
              placeholder="Search by name, code, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-theme-surface border border-theme rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme placeholder-slate-400 theme-transition"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value={EmploymentStatus.ACTIVE}>Active</option>
            <option value={EmploymentStatus.INACTIVE}>Inactive</option>
            <option value={EmploymentStatus.ON_LEAVE}>On Leave</option>
            <option value={EmploymentStatus.TERMINATED}>Terminated</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {employees.length}
              </p>
              <p className="text-sm text-slate-600">Total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {employees.filter((e) => e.status === EmploymentStatus.ACTIVE).length}
              </p>
              <p className="text-sm text-slate-600">Active</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {employees.filter((e) => e.status === EmploymentStatus.ON_LEAVE).length}
              </p>
              <p className="text-sm text-slate-600">On Leave</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">
                {employees.filter((e) => e.user?.role === UserRole.TECHNICIAN).length}
              </p>
              <p className="text-sm text-slate-600">Technicians</p>
            </div>
          </div>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading employees...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No employees found</p>
            {searchTerm && (
              <p className="text-slate-500 text-sm mt-1">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredEmployees.map((employee) => (
              <Link
                key={employee.user_id}
                to={`/hr/employees/${employee.user_id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
              >
                {/* Avatar */}
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {employee.profile_photo_url ? (
                    <img
                      src={employee.profile_photo_url}
                      alt={employee.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-slate-600">
                      {employee.full_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 truncate">
                      {employee.full_name}
                    </h3>
                    {employee.employee_code && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {employee.employee_code}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${getStatusColor(
                        employee.status
                      )}`}
                    >
                      {getStatusIcon(employee.status)}
                      {employee.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                    {employee.position && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {employee.position}
                        {employee.department && ` • ${employee.department}`}
                      </span>
                    )}
                    {employee.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {employee.phone}
                      </span>
                    )}
                  </div>

                  {/* Badges for licenses/permits */}
                  {employee.user?.role === UserRole.TECHNICIAN && (
                    <div className="flex items-center gap-2 mt-2">
                      {employee.licenses && employee.licenses.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          <Car className="w-3 h-3" />
                          {employee.licenses.length} License(s)
                        </span>
                      )}
                      {employee.permits && employee.permits.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                          <Shield className="w-3 h-3" />
                          {employee.permits.length} Permit(s)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Joined Date */}
                <div className="hidden md:block text-right">
                  <p className="text-sm text-slate-600">Joined</p>
                  <p className="text-sm font-medium text-slate-800">
                    {new Date(employee.joined_date).toLocaleDateString()}
                  </p>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-400" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onSave={async (data) => {
            try {
              await HRService.createEmployee(
                data,
                currentUser.user_id,
                currentUser.name
              );
              loadEmployees();
              setShowAddModal(false);
            } catch (error) {
              console.error('Error creating employee:', error);
              alert('Failed to create employee');
            }
          }}
        />
      )}
    </div>
  );
}


// Add Employee Modal Component
interface AddEmployeeModalProps {
  onClose: () => void;
  onSave: (data: Partial<Employee>) => Promise<void>;
}

function AddEmployeeModal({ onClose, onSave }: AddEmployeeModalProps) {
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [formData, setFormData] = useState<Partial<Employee>>({
    full_name: '',
    phone: '',
    email: '',
    ic_number: '',
    department: '',
    position: '',
    joined_date: new Date().toISOString().split('T')[0],
    employment_type: EmploymentType.FULL_TIME,
    status: EmploymentStatus.ACTIVE,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
  });
  const [saving, setSaving] = useState(false);

  // Load users without employee profiles
  useEffect(() => {
    loadAvailableUsers();
  }, []);

  const loadAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      // Import supabase to fetch users
      const { supabase } = await import('../services/supabaseService');
      
      // Get all users
      const { data: users } = await supabase
        .from('users')
        .select('user_id, name, email, role')
        .eq('is_active', true)
        .order('name');
      
      // Get existing employee user_ids
      const { data: employees } = await supabase
        .from('employees')
        .select('user_id');
      
      const existingUserIds = new Set((employees || []).map(e => e.user_id));
      
      // Filter users without employee profiles
      const usersWithoutProfiles = (users || []).filter(u => !existingUserIds.has(u.user_id));
      setAvailableUsers(usersWithoutProfiles);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    const user = availableUsers.find(u => u.user_id === userId);
    if (user) {
      setFormData(prev => ({
        ...prev,
        user_id: userId,
        full_name: user.name || '',
        email: user.email || '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      alert('Please select a user account');
      return;
    }
    if (!formData.full_name || !formData.joined_date) {
      alert('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...formData, user_id: selectedUserId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">
            Add New Employee
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* User Account Selection */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-blue-800 mb-2">
              Link to User Account *
            </label>
            {loadingUsers ? (
              <p className="text-sm text-blue-600">Loading available users...</p>
            ) : availableUsers.length === 0 ? (
              <p className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                All users already have employee profiles. Create a new user in User Management first.
              </p>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => handleUserSelect(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">-- Select a user account --</option>
                {availableUsers.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.name} ({user.email}) - {user.role}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-blue-600 mt-1">
              Employee profiles are linked 1:1 with user accounts
            </p>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="font-medium text-slate-700 mb-3">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Employee Code
                </label>
                <input
                  type="text"
                  value={formData.employee_code || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, employee_code: e.target.value })
                  }
                  placeholder="e.g., EMP001"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  IC Number
                </label>
                <input
                  type="text"
                  value={formData.ic_number || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, ic_number: e.target.value })
                  }
                  placeholder="e.g., 880101-01-1234"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div>
            <h3 className="font-medium text-slate-700 mb-3">
              Employment Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  placeholder="e.g., Service, Operations"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Position
                </label>
                <input
                  type="text"
                  value={formData.position || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                  placeholder="e.g., Technician, Supervisor"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Joined Date *
                </label>
                <input
                  type="date"
                  value={formData.joined_date}
                  onChange={(e) =>
                    setFormData({ ...formData, joined_date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Employment Type
                </label>
                <select
                  value={formData.employment_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      employment_type: e.target.value as EmploymentType,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={EmploymentType.FULL_TIME}>Full Time</option>
                  <option value={EmploymentType.PART_TIME}>Part Time</option>
                  <option value={EmploymentType.CONTRACT}>Contract</option>
                </select>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <h3 className="font-medium text-slate-700 mb-3">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.emergency_contact_name || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergency_contact_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergency_contact_phone: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  value={formData.emergency_contact_relationship || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergency_contact_relationship: e.target.value,
                    })
                  }
                  placeholder="e.g., Spouse, Parent"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Address
            </label>
            <textarea
              value={formData.address || ''}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

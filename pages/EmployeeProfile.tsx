import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User,
  Employee,
  EmployeeLicense,
  EmployeePermit,
  EmployeeLeave,
  LeaveType,
  EmploymentStatus,
  EmploymentType,
  LicenseStatus,
  LeaveStatus,
  UserRole,
} from '../types';
import { HRService } from '../services/hrService';
import { showToast } from '../services/toastService';
import { useDevModeContext } from '../contexts/DevModeContext';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building2,
  User as UserIcon,
  Car,
  Shield,
  FileText,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  Upload,
  Eye,
  Camera,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Image as ImageIcon,
  Briefcase,
} from 'lucide-react';
import TechnicianJobsTab from '../components/TechnicianJobsTab';
import TelegramConnect from '../components/TelegramConnect';

interface EmployeeProfileProps {
  currentUser: User;
}

export default function EmployeeProfile({ currentUser }: EmployeeProfileProps) {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Employee>>({});
  const [activeTab, setActiveTab] = useState<'info' | 'jobs' | 'licenses' | 'permits' | 'leaves'>('info');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  // Modals
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [showAddPermit, setShowAddPermit] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showLeaveCalendar, setShowLeaveCalendar] = useState(false);

  // Use dev mode context for role-based permissions
  const { hasPermission } = useDevModeContext();

  const canManageEmployees = hasPermission('canManageEmployees');
  const canApproveLeave = hasPermission('canApproveLeave');
  
  // Check if viewing own profile (for "My Profile" functionality)
  const isOwnProfile = currentUser.user_id === userId;

  useEffect(() => {
    if (userId) {
      loadEmployee();
      loadLeaveTypes();
    }
  }, [userId]);

  const loadEmployee = async () => {
    try {
      setLoading(true);
      const data = await HRService.getEmployeeByUserId(userId!);
      setEmployee(data);
      if (data) {
        setEditData(data);
      }
    } catch (error) {
      console.error('Error loading employee:', error);
      showToast.error('Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaveTypes = async () => {
    try {
      const types = await HRService.getLeaveTypes();
      setLeaveTypes(types);
    } catch (error) {
      console.error('Error loading leave types:', error);
      showToast.error('Failed to load leave types');
    }
  };

  const handleSave = async () => {
    try {
      await HRService.updateEmployee(
        userId!,
        editData,
        currentUser.user_id,
        currentUser.name
      );
      setEmployee({ ...employee!, ...editData });
      setEditing(false);
    } catch (error) {
      console.error('Error updating employee:', error);
      showToast.error('Failed to update employee');
      alert('Failed to update employee');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading employee...</div>
      </div>
    );
  }

  if (!employee) {
    // Check if viewing own profile without employee record
    if (isOwnProfile) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Profile Not Set Up
          </h2>
          <p className="text-slate-600 mb-4 max-w-md mx-auto">
            Your employee profile hasn't been created yet. Please contact your administrator or HR to set up your employee record.
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      );
    }
    
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-800">
          Employee not found
        </h2>
        <Link
          to="/hr/employees"
          className="text-blue-600 hover:underline mt-2 inline-block"
        >
          Back to Employees
        </Link>
      </div>
    );
  }

  const isTechnician = employee.role === UserRole.TECHNICIAN;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(isOwnProfile ? '/' : '/hr/employees')}
          className="p-2 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">
            {isOwnProfile ? 'My Profile' : (employee.full_name || employee.name)}
          </h1>
          <p className="text-slate-600">
            {employee.position}
            {employee.department && ` • ${employee.department}`}
          </p>
        </div>
        {(canManageEmployees || isOwnProfile) && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            <Edit className="w-5 h-5" />
            Edit
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setEditData(employee);
              }}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Save className="w-5 h-5" />
              Save
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
              {employee.profile_photo_url ? (
                <img loading="lazy" decoding="async"
                  src={employee.profile_photo_url}
                  alt={employee.full_name || employee.name || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-slate-500">
                  {(employee.full_name || employee.name || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="mt-2 text-center">
              <span
                className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full ${
                  employee.employment_status === EmploymentStatus.ACTIVE
                    ? 'bg-green-100 text-green-800'
                    : employee.employment_status === EmploymentStatus.ON_LEAVE
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {employee.employment_status}
              </span>
            </div>
          </div>

          {/* Basic Info */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoItem
              icon={<UserIcon className="w-4 h-4" />}
              label="Employee Code"
              value={employee.employee_code || '-'}
            />
            <InfoItem
              icon={<Phone className="w-4 h-4" />}
              label="Phone"
              value={employee.phone || '-'}
            />
            <InfoItem
              icon={<Mail className="w-4 h-4" />}
              label="Email"
              value={employee.email || '-'}
            />
            <InfoItem
              icon={<Calendar className="w-4 h-4" />}
              label="Joined Date"
              value={new Date(employee.joined_date).toLocaleDateString()}
            />
            <InfoItem
              icon={<Building2 className="w-4 h-4" />}
              label="Department"
              value={employee.department || '-'}
            />
            <InfoItem
              icon={<FileText className="w-4 h-4" />}
              label="IC Number"
              value={employee.ic_number || '-'}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === 'info'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              Information
            </button>
            {isTechnician && (
              <>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'jobs'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  Jobs
                </button>
                <button
                  onClick={() => setActiveTab('licenses')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'licenses'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Car className="w-4 h-4" />
                  Licenses
                  {employee.licenses && employee.licenses.length > 0 && (
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                      {employee.licenses.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('permits')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'permits'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Permits
                  {employee.permits && employee.permits.length > 0 && (
                    <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                      {employee.permits.length}
                    </span>
                  )}
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('leaves')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'leaves'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Leave History
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <>
              <InfoTab
                employee={employee}
                editing={editing}
                editData={editData}
                setEditData={setEditData}
              />
              {/* Telegram Notifications - only show on own profile */}
              {isOwnProfile && !editing && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-theme mb-3 flex items-center gap-2">
                    <span>📱</span> Notifications
                  </h3>
                  <TelegramConnect currentUser={currentUser} />
                </div>
              )}
            </>
          )}

          {activeTab === 'jobs' && isTechnician && (
            <TechnicianJobsTab
              employee={employee}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'licenses' && isTechnician && (
            <LicensesTab
              employee={employee}
              canManage={canManageEmployees || isOwnProfile}
              onAdd={() => setShowAddLicense(true)}
              onRefresh={loadEmployee}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'permits' && isTechnician && (
            <PermitsTab
              employee={employee}
              canManage={canManageEmployees || isOwnProfile}
              onAdd={() => setShowAddPermit(true)}
              onRefresh={loadEmployee}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'leaves' && (
            <LeavesTab
              employee={employee}
              leaveTypes={leaveTypes}
              canManage={canManageEmployees}
              canApprove={canApproveLeave}
              canRequestOwn={isOwnProfile}
              onAdd={() => setShowAddLeave(true)}
              onShowCalendar={() => setShowLeaveCalendar(true)}
              onRefresh={loadEmployee}
              currentUser={currentUser}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddLicense && (
        <AddLicenseModal
          userId={employee.user_id}
          onClose={() => setShowAddLicense(false)}
          onSave={async (data) => {
            await HRService.createLicense(
              data,
              currentUser.user_id,
              currentUser.name
            );
            loadEmployee();
            setShowAddLicense(false);
          }}
        />
      )}

      {showAddPermit && (
        <AddPermitModal
          userId={employee.user_id}
          onClose={() => setShowAddPermit(false)}
          onSave={async (data) => {
            await HRService.createPermit(
              data,
              currentUser.user_id,
              currentUser.name
            );
            loadEmployee();
            setShowAddPermit(false);
          }}
        />
      )}

      {showAddLeave && (
        <AddLeaveModal
          userId={employee.user_id}
          leaveTypes={leaveTypes}
          onClose={() => setShowAddLeave(false)}
          onSave={async (data) => {
            await HRService.createLeave(data);
            loadEmployee();
            setShowAddLeave(false);
          }}
        />
      )}

      {showLeaveCalendar && (
        <LeaveCalendarModal
          userId={employee.user_id}
          employeeName={employee.full_name || employee.name || ''}
          onClose={() => setShowLeaveCalendar(false)}
        />
      )}
    </div>
  );
}

// Helper Components
function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}


// Info Tab Component
function InfoTab({
  employee,
  editing,
  editData,
  setEditData,
}: {
  employee: Employee;
  editing: boolean;
  editData: Partial<Employee>;
  setEditData: (data: Partial<Employee>) => void;
}) {
  if (editing) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={editData.full_name || ''}
              onChange={(e) =>
                setEditData({ ...editData, full_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Employee Code
            </label>
            <input
              type="text"
              value={editData.employee_code || ''}
              onChange={(e) =>
                setEditData({ ...editData, employee_code: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={editData.phone || ''}
              onChange={(e) =>
                setEditData({ ...editData, phone: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={editData.email || ''}
              onChange={(e) =>
                setEditData({ ...editData, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              IC Number
            </label>
            <input
              type="text"
              value={editData.ic_number || ''}
              onChange={(e) =>
                setEditData({ ...editData, ic_number: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Department
            </label>
            <input
              type="text"
              value={editData.department || ''}
              onChange={(e) =>
                setEditData({ ...editData, department: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Position
            </label>
            <input
              type="text"
              value={editData.position || ''}
              onChange={(e) =>
                setEditData({ ...editData, position: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              value={editData.employment_status}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  employment_status: e.target.value as EmploymentStatus,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value={EmploymentStatus.ACTIVE}>Active</option>
              <option value={EmploymentStatus.INACTIVE}>Inactive</option>
              <option value={EmploymentStatus.ON_LEAVE}>On Leave</option>
              <option value={EmploymentStatus.TERMINATED}>Terminated</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Address
          </label>
          <textarea
            value={editData.address || ''}
            onChange={(e) =>
              setEditData({ ...editData, address: e.target.value })
            }
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <h4 className="font-medium text-slate-700 mb-3">Emergency Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={editData.emergency_contact_name || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  emergency_contact_name: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={editData.emergency_contact_phone || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  emergency_contact_phone: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              placeholder="Relationship"
              value={editData.emergency_contact_relationship || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  emergency_contact_relationship: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Address */}
      {employee.address && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Address</h4>
          <p className="text-slate-600 flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {employee.address}
          </p>
        </div>
      )}

      {/* Emergency Contact */}
      {employee.emergency_contact_name && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">
            Emergency Contact
          </h4>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="font-medium text-slate-800">
              {employee.emergency_contact_name}
            </p>
            <p className="text-sm text-slate-600">
              {employee.emergency_contact_relationship}
            </p>
            {employee.emergency_contact_phone && (
              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3" />
                {employee.emergency_contact_phone}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {employee.notes && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Notes</h4>
          <p className="text-slate-600">{employee.notes}</p>
        </div>
      )}
    </div>
  );
}


// Licenses Tab Component
function LicensesTab({
  employee,
  canManage,
  onAdd,
  onRefresh,
  currentUser,
}: {
  employee: Employee;
  canManage: boolean;
  onAdd: () => void;
  onRefresh: () => void;
  currentUser: User;
}) {
  const licenses = employee.licenses || [];

  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  };

  const handleDelete = async (licenseId: string) => {
    if (!confirm('Are you sure you want to delete this license?')) return;
    try {
      await HRService.deleteLicense(licenseId);
      onRefresh();
    } catch (error) {
      console.error('Error deleting license:', error);
      showToast.error('Failed to delete license');
      alert('Failed to delete license');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-slate-800">Driving Licenses</h3>
        {canManage && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add License
          </button>
        )}
      </div>

      {licenses.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Car className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p>No licenses recorded</p>
          {canManage && (
            <button
              onClick={onAdd}
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              Add your first license
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {licenses.map((license) => {
            const daysLeft = getDaysUntilExpiry(license.expiry_date);
            const isExpired = daysLeft < 0;
            const isExpiring = daysLeft <= 30 && daysLeft >= 0;

            return (
              <div
                key={license.license_id}
                className={`border rounded-lg p-4 ${
                  isExpired ? 'border-red-300 bg-red-50' : 
                  isExpiring ? 'border-yellow-300 bg-yellow-50' : 
                  'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-slate-800">
                        {license.license_type}
                      </h4>
                      {isExpired && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Expired {Math.abs(daysLeft)} days ago
                        </span>
                      )}
                      {isExpiring && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expiring in {daysLeft} days
                        </span>
                      )}
                      {!isExpired && !isExpiring && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Valid
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">License No:</span>{' '}
                        <span className="text-slate-800">
                          {license.license_number}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Expiry:</span>{' '}
                        <span
                          className={
                            isExpired || isExpiring
                              ? 'text-red-600 font-medium'
                              : 'text-slate-800'
                          }
                        >
                          {new Date(license.expiry_date).toLocaleDateString()}
                        </span>
                      </div>
                      {license.issue_date && (
                        <div>
                          <span className="text-slate-500">Issued:</span>{' '}
                          <span className="text-slate-800">
                            {new Date(license.issue_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {license.issuing_authority && (
                        <div>
                          <span className="text-slate-500">Issuer:</span>{' '}
                          <span className="text-slate-800">
                            {license.issuing_authority}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* License Images */}
                    {(license.license_front_image_url ||
                      license.license_back_image_url) && (
                      <div className="flex gap-3 mt-3">
                        {license.license_front_image_url && (
                          <a
                            href={license.license_front_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                          >
                            <ImageIcon className="w-3 h-3" />
                            View Front
                          </a>
                        )}
                        {license.license_back_image_url && (
                          <a
                            href={license.license_back_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                          >
                            <ImageIcon className="w-3 h-3" />
                            View Back
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {canManage && (
                    <button
                      onClick={() => handleDelete(license.license_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// Permits Tab Component
function PermitsTab({
  employee,
  canManage,
  onAdd,
  onRefresh,
  currentUser,
}: {
  employee: Employee;
  canManage: boolean;
  onAdd: () => void;
  onRefresh: () => void;
  currentUser: User;
}) {
  const permits = employee.permits || [];

  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  };

  const handleDelete = async (permitId: string) => {
    if (!confirm('Are you sure you want to delete this permit?')) return;
    try {
      await HRService.deletePermit(permitId);
      onRefresh();
    } catch (error) {
      console.error('Error deleting permit:', error);
      showToast.error('Failed to delete permit');
      alert('Failed to delete permit');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-slate-800">Special Permits</h3>
        {canManage && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Permit
          </button>
        )}
      </div>

      {permits.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Shield className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p>No permits recorded</p>
          {canManage && (
            <button
              onClick={onAdd}
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              Add your first permit
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {permits.map((permit) => {
            const daysLeft = getDaysUntilExpiry(permit.expiry_date);
            const isExpired = daysLeft < 0;
            const isExpiring = daysLeft <= 30 && daysLeft >= 0;

            return (
              <div
                key={permit.permit_id}
                className={`border rounded-lg p-4 ${
                  isExpired ? 'border-red-300 bg-red-50' : 
                  isExpiring ? 'border-yellow-300 bg-yellow-50' : 
                  'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h4 className="font-medium text-slate-800">
                        {permit.permit_type}
                      </h4>
                      {permit.permit_name && (
                        <span className="text-sm text-slate-600">
                          - {permit.permit_name}
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Expired {Math.abs(daysLeft)} days ago
                        </span>
                      )}
                      {isExpiring && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expiring in {daysLeft} days
                        </span>
                      )}
                      {!isExpired && !isExpiring && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Valid
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">Permit No:</span>{' '}
                        <span className="text-slate-800">
                          {permit.permit_number}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Expiry:</span>{' '}
                        <span
                          className={
                            isExpired || isExpiring
                              ? 'text-red-600 font-medium'
                              : 'text-slate-800'
                          }
                        >
                          {new Date(permit.expiry_date).toLocaleDateString()}
                        </span>
                      </div>
                      {permit.issue_date && (
                        <div>
                          <span className="text-slate-500">Issued:</span>{' '}
                          <span className="text-slate-800">
                            {new Date(permit.issue_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {permit.issuing_authority && (
                        <div>
                          <span className="text-slate-500">Issuer:</span>{' '}
                          <span className="text-slate-800">
                            {permit.issuing_authority}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Restricted Areas */}
                    {permit.restricted_areas &&
                      permit.restricted_areas.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm text-slate-500">
                            Access Areas:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {permit.restricted_areas.map((area, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Document Link */}
                    {permit.permit_document_url && (
                      <a
                        href={permit.permit_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-3 bg-blue-50 px-2 py-1 rounded w-fit"
                      >
                        <FileText className="w-3 h-3" />
                        View Document
                      </a>
                    )}
                  </div>

                  {canManage && (
                    <button
                      onClick={() => handleDelete(permit.permit_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// Leaves Tab Component
function LeavesTab({
  employee,
  leaveTypes,
  canManage,
  canApprove,
  canRequestOwn,
  onAdd,
  onShowCalendar,
  onRefresh,
  currentUser,
}: {
  employee: Employee;
  leaveTypes: LeaveType[];
  canManage: boolean;
  canApprove: boolean;
  canRequestOwn: boolean;
  onAdd: () => void;
  onShowCalendar: () => void;
  onRefresh: () => void;
  currentUser: User;
}) {
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


// Add License Modal with Document Upload
function AddLicenseModal({
  userId,
  onClose,
  onSave,
}: {
  userId: string;
  onClose: () => void;
  onSave: (data: Partial<EmployeeLicense>) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    license_type: '',
    license_number: '',
    issuing_authority: '',
    issue_date: '',
    expiry_date: '',
    alert_days_before: 30,
    notes: '',
  });
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string>('');
  const [backPreview, setBackPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    side: 'front' | 'back'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (side === 'front') {
        setFrontImage(file);
        setFrontPreview(URL.createObjectURL(file));
      } else {
        setBackImage(file);
        setBackPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.license_type || !formData.license_number || !formData.expiry_date) {
      alert('Please fill in required fields (License Type, Number, and Expiry Date)');
      return;
    }
    setSaving(true);
    try {
      let frontUrl = '';
      let backUrl = '';

      // Upload images if provided
      if (frontImage) {
        setUploadProgress('Uploading front image...');
        frontUrl = await HRService.uploadLicenseImage(userId, frontImage, 'front');
      }
      if (backImage) {
        setUploadProgress('Uploading back image...');
        backUrl = await HRService.uploadLicenseImage(userId, backImage, 'back');
      }

      setUploadProgress('Saving license...');
      await onSave({
        user_id: userId,
        ...formData,
        license_front_image_url: frontUrl || undefined,
        license_back_image_url: backUrl || undefined,
        status: LicenseStatus.ACTIVE,
      });
    } catch (error) {
      console.error('Error saving license:', error);
      showToast.error('Failed to save license');
      alert('Failed to save license. Please try again.');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-800">Add Driving License</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                License Type *
              </label>
              <select
                value={formData.license_type}
                onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Type</option>
                <option value="Class B">Class B (Car)</option>
                <option value="Class D">Class D (Motorcycle)</option>
                <option value="Class E">Class E (Commercial)</option>
                <option value="Class E1">Class E1 (Forklift)</option>
                <option value="Class E2">Class E2 (Lorry)</option>
                <option value="Class G">Class G (Crane)</option>
                <option value="GDL">GDL (Goods Driving License)</option>
                <option value="PSV">PSV (Public Service Vehicle)</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                License Number *
              </label>
              <input
                type="text"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., D12345678"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Issuing Authority
            </label>
            <input
              type="text"
              value={formData.issuing_authority}
              onChange={(e) => setFormData({ ...formData, issuing_authority: e.target.value })}
              placeholder="e.g., JPJ Malaysia"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expiry Date *
              </label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Alert Days Before Expiry
            </label>
            <select
              value={formData.alert_days_before}
              onChange={(e) => setFormData({ ...formData, alert_days_before: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          {/* License Image Uploads */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              License Images (Optional)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Front Image */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Front Side
                </label>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'front')}
                  className="hidden"
                />
                <div
                  onClick={() => frontInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50 ${
                    frontPreview ? 'border-blue-300' : 'border-slate-300'
                  }`}
                >
                  {frontPreview ? (
                    <img loading="lazy" decoding="async"
                      src={frontPreview}
                      alt="License front"
                      className="w-full h-32 object-contain rounded"
                    />
                  ) : (
                    <div className="text-center py-4">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to upload front</p>
                    </div>
                  )}
                </div>
                {frontImage && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{frontImage.name}</p>
                )}
              </div>

              {/* Back Image */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Back Side
                </label>
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'back')}
                  className="hidden"
                />
                <div
                  onClick={() => backInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50 ${
                    backPreview ? 'border-blue-300' : 'border-slate-300'
                  }`}
                >
                  {backPreview ? (
                    <img loading="lazy" decoding="async"
                      src={backPreview}
                      alt="License back"
                      className="w-full h-32 object-contain rounded"
                    />
                  ) : (
                    <div className="text-center py-4">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to upload back</p>
                    </div>
                  )}
                </div>
                {backImage && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{backImage.name}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  {uploadProgress || 'Saving...'}
                </>
              ) : (
                'Add License'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Add Permit Modal with Document Upload
function AddPermitModal({
  userId,
  onClose,
  onSave,
}: {
  userId: string;
  onClose: () => void;
  onSave: (data: Partial<EmployeePermit>) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    permit_type: '',
    permit_number: '',
    permit_name: '',
    issuing_authority: '',
    issue_date: '',
    expiry_date: '',
    restricted_areas: '',
    alert_days_before: 30,
    notes: '',
  });
  const [permitDocument, setPermitDocument] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPermitDocument(file);
      // For images, show preview; for PDFs, show file name
      if (file.type.startsWith('image/')) {
        setDocumentPreview(URL.createObjectURL(file));
      } else {
        setDocumentPreview('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.permit_type || !formData.permit_number || !formData.expiry_date) {
      alert('Please fill in required fields (Permit Type, Number, and Expiry Date)');
      return;
    }
    setSaving(true);
    try {
      let documentUrl = '';

      // Upload document if provided
      if (permitDocument) {
        setUploadProgress('Uploading document...');
        documentUrl = await HRService.uploadPermitDocument(userId, permitDocument);
      }

      setUploadProgress('Saving permit...');
      await onSave({
        user_id: userId,
        permit_type: formData.permit_type,
        permit_number: formData.permit_number,
        permit_name: formData.permit_name,
        issuing_authority: formData.issuing_authority,
        issue_date: formData.issue_date || undefined,
        expiry_date: formData.expiry_date,
        restricted_areas: formData.restricted_areas
          ? formData.restricted_areas.split(',').map((s) => s.trim()).filter(s => s)
          : [],
        alert_days_before: formData.alert_days_before,
        permit_document_url: documentUrl || undefined,
        notes: formData.notes || undefined,
        status: LicenseStatus.ACTIVE,
      });
    } catch (error) {
      console.error('Error saving permit:', error);
      showToast.error('Failed to save permit');
      alert('Failed to save permit. Please try again.');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-800">Add Special Permit</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Permit Type *
              </label>
              <select
                value={formData.permit_type}
                onChange={(e) => setFormData({ ...formData, permit_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Type</option>
                <option value="Security Clearance">Security Clearance</option>
                <option value="Hazardous Area">Hazardous Area Access</option>
                <option value="Port Access">Port Access</option>
                <option value="Airport Access">Airport Access</option>
                <option value="Factory Entry">Factory Entry</option>
                <option value="Restricted Zone">Restricted Zone</option>
                <option value="Safety Permit">Safety Permit</option>
                <option value="Work Permit">Work Permit</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Permit Number *
              </label>
              <input
                type="text"
                value={formData.permit_number}
                onChange={(e) => setFormData({ ...formData, permit_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., PMT-2024-001"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Permit Name/Description
            </label>
            <input
              type="text"
              value={formData.permit_name}
              onChange={(e) => setFormData({ ...formData, permit_name: e.target.value })}
              placeholder="e.g., Shell Refinery Access Pass"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Issuing Authority
            </label>
            <input
              type="text"
              value={formData.issuing_authority}
              onChange={(e) => setFormData({ ...formData, issuing_authority: e.target.value })}
              placeholder="e.g., Shell Malaysia Security Dept"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expiry Date *
              </label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Restricted/Authorized Areas (comma-separated)
            </label>
            <input
              type="text"
              value={formData.restricted_areas}
              onChange={(e) => setFormData({ ...formData, restricted_areas: e.target.value })}
              placeholder="e.g., Zone A, Zone B, Loading Dock, Warehouse"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Alert Days Before Expiry
            </label>
            <select
              value={formData.alert_days_before}
              onChange={(e) => setFormData({ ...formData, alert_days_before: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          {/* Permit Document Upload */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Permit Document (Optional)
            </h4>
            <input
              ref={documentInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleDocumentChange}
              className="hidden"
            />
            <div
              onClick={() => documentInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50 ${
                permitDocument ? 'border-blue-300' : 'border-slate-300'
              }`}
            >
              {documentPreview ? (
                <img loading="lazy" decoding="async"
                  src={documentPreview}
                  alt="Permit document"
                  className="w-full h-40 object-contain rounded"
                />
              ) : permitDocument ? (
                <div className="text-center py-4">
                  <FileText className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">{permitDocument.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(permitDocument.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Click to upload permit document</p>
                  <p className="text-xs text-slate-400 mt-1">Supports images and PDF</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  {uploadProgress || 'Saving...'}
                </>
              ) : (
                'Add Permit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Add Leave Modal with Scheduling
function AddLeaveModal({
  userId,
  leaveTypes,
  onClose,
  onSave,
}: {
  userId: string;
  leaveTypes: LeaveType[];
  onClose: () => void;
  onSave: (data: Partial<EmployeeLeave>) => Promise<void>;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_type: 'morning' as 'morning' | 'afternoon',
    reason: '',
  });
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const documentInputRef = useRef<HTMLInputElement>(null);

  const selectedLeaveType = leaveTypes.find(lt => lt.leave_type_id === formData.leave_type_id);
  
  // Calculate total days
  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0;
    if (formData.is_half_day) return 0.5;
    
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const totalDays = calculateDays();

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSupportingDocument(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
      alert('Please fill in required fields');
      return;
    }

    // Validate dates
    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      alert('End date must be after start date');
      return;
    }

    // Check if document is required
    if (selectedLeaveType?.requires_document && !supportingDocument) {
      alert(`${selectedLeaveType.name} requires a supporting document`);
      return;
    }

    setSaving(true);
    try {
      let documentUrl = '';

      // Upload document if provided
      if (supportingDocument) {
        setUploadProgress('Uploading document...');
        documentUrl = await HRService.uploadLeaveDocument(userId, supportingDocument);
      }

      setUploadProgress('Submitting request...');
      await onSave({
        user_id: userId,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.is_half_day ? formData.start_date : formData.end_date,
        is_half_day: formData.is_half_day,
        half_day_type: formData.is_half_day ? formData.half_day_type : undefined,
        reason: formData.reason,
        supporting_document_url: documentUrl || undefined,
        total_days: totalDays,
      });
    } catch (error) {
      console.error('Error submitting leave:', error);
      showToast.error('Failed to submit leave request');
      alert('Failed to submit leave request. Please try again.');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  // Check if selected date is in the future (for scheduling)
  const isSchedulingAhead = formData.start_date && new Date(formData.start_date) > new Date();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Request Leave</h2>
            <p className="text-sm text-slate-500">Submit a leave request for approval</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Leave Type *
            </label>
            <select
              value={formData.leave_type_id}
              onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select Leave Type</option>
              {leaveTypes.map((lt) => (
                <option key={lt.leave_type_id} value={lt.leave_type_id}>
                  {lt.name}
                  {lt.requires_document && ' (Document Required)'}
                </option>
              ))}
            </select>
            {selectedLeaveType && (
              <div className="mt-2 p-2 bg-slate-50 rounded text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedLeaveType.color }}
                  />
                  <span>{selectedLeaveType.description || selectedLeaveType.name}</span>
                </div>
                {selectedLeaveType.max_days_per_year && (
                  <p className="text-xs text-slate-500 mt-1">
                    Max {selectedLeaveType.max_days_per_year} days per year
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_half_day}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    is_half_day: e.target.checked,
                    end_date: e.target.checked ? formData.start_date : formData.end_date,
                  })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-slate-700">Half Day</span>
            </label>

            {formData.is_half_day && (
              <select
                value={formData.half_day_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    half_day_type: e.target.value as 'morning' | 'afternoon',
                  })
                }
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              >
                <option value="morning">Morning (AM)</option>
                <option value="afternoon">Afternoon (PM)</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {formData.is_half_day ? 'Date *' : 'Start Date *'}
              </label>
              <input
                type="date"
                value={formData.start_date}
                min={today}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    start_date: e.target.value,
                    end_date: formData.is_half_day || !formData.end_date || e.target.value > formData.end_date 
                      ? e.target.value 
                      : formData.end_date,
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            {!formData.is_half_day && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.start_date || today}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            )}
          </div>

          {/* Summary */}
          {formData.start_date && formData.end_date && (
            <div className={`p-3 rounded-lg ${isSchedulingAhead ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSchedulingAhead ? (
                    <>
                      <CalendarDays className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Scheduling Ahead</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Leave Duration</span>
                    </>
                  )}
                </div>
                <span className={`text-lg font-bold ${isSchedulingAhead ? 'text-green-700' : 'text-blue-700'}`}>
                  {totalDays} {totalDays === 1 || totalDays === 0.5 ? 'day' : 'days'}
                </span>
              </div>
              {isSchedulingAhead && (
                <p className="text-xs text-green-600 mt-1">
                  This leave request is scheduled for a future date
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason {selectedLeaveType?.requires_approval ? '*' : '(Optional)'}
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Please provide a reason for your leave request..."
              required={selectedLeaveType?.requires_approval}
            />
          </div>

          {/* Supporting Document */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Supporting Document {selectedLeaveType?.requires_document ? '*' : '(Optional)'}
            </label>
            <input
              ref={documentInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleDocumentChange}
              className="hidden"
            />
            <div
              onClick={() => documentInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-3 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50 ${
                supportingDocument ? 'border-blue-300 bg-blue-50' : 'border-slate-300'
              }`}
            >
              {supportingDocument ? (
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{supportingDocument.name}</p>
                    <p className="text-xs text-slate-500">{(supportingDocument.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSupportingDocument(null);
                    }}
                    className="ml-auto p-1 text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-sm text-slate-500">Click to upload</p>
                  <p className="text-xs text-slate-400">Medical certificate, approval letter, etc.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  {uploadProgress || 'Submitting...'}
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Leave Calendar Modal
function LeaveCalendarModal({
  userId,
  employeeName,
  onClose,
}: {
  userId: string;
  employeeName: string;
  onClose: () => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadLeaves();
  }, [year, month]);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const data = await HRService.getLeaves({
        userId,
        startDate: new Date(year, month, 1).toISOString().split('T')[0],
        endDate: new Date(year, month + 1, 0).toISOString().split('T')[0],
      });
      setLeaves(data.filter(l => l.status === LeaveStatus.APPROVED || l.status === LeaveStatus.PENDING));
    } catch (error) {
      console.error('Error loading leaves:', error);
      showToast.error('Failed to load leave history');
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const isLeaveDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.find(leave => {
      const start = leave.start_date;
      const end = leave.end_date;
      return dateStr >= start && dateStr <= end;
    });
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const leave = isLeaveDay(day);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      const isPast = new Date(year, month, day) < new Date(new Date().setHours(0, 0, 0, 0));

      days.push(
        <div
          key={day}
          className={`h-10 flex items-center justify-center rounded-lg relative ${
            isToday ? 'ring-2 ring-blue-500' : ''
          } ${isPast ? 'text-slate-400' : ''}`}
        >
          {leave ? (
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                leave.status === LeaveStatus.PENDING ? 'bg-yellow-500' : ''
              }`}
              style={{
                backgroundColor: leave.status === LeaveStatus.APPROVED 
                  ? (leave.leave_type as LeaveType)?.color || '#3B82F6'
                  : undefined
              }}
              title={`${(leave.leave_type as LeaveType)?.name || 'Leave'} - ${leave.status}`}
            >
              {day}
            </div>
          ) : (
            <span className={isToday ? 'font-bold text-blue-600' : ''}>{day}</span>
          )}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Leave Calendar</h2>
            <p className="text-sm text-slate-500">{employeeName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1))}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold">
              {monthNames[month]} {year}
            </h3>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1))}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-slate-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="h-60 flex items-center justify-center text-slate-500">
              Loading...
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {renderCalendar()}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Leave Types</h4>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs text-slate-600">Pending</span>
              </div>
              {leaves
                .filter((l, i, arr) => 
                  l.status === LeaveStatus.APPROVED && 
                  arr.findIndex(x => (x.leave_type as LeaveType)?.leave_type_id === (l.leave_type as LeaveType)?.leave_type_id) === i
                )
                .map(leave => (
                  <div key={(leave.leave_type as LeaveType)?.leave_type_id} className="flex items-center gap-1.5">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: (leave.leave_type as LeaveType)?.color || '#3B82F6' }}
                    />
                    <span className="text-xs text-slate-600">{(leave.leave_type as LeaveType)?.name}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Upcoming Leaves List */}
          {leaves.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">This Month's Leaves</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {leaves.map(leave => (
                  <div key={leave.leave_id} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: leave.status === LeaveStatus.PENDING 
                          ? '#EAB308' 
                          : (leave.leave_type as LeaveType)?.color || '#3B82F6'
                      }}
                    />
                    <span className="text-slate-600">
                      {new Date(leave.start_date).toLocaleDateString()} 
                      {leave.start_date !== leave.end_date && ` - ${new Date(leave.end_date).toLocaleDateString()}`}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      leave.status === LeaveStatus.PENDING ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {leave.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

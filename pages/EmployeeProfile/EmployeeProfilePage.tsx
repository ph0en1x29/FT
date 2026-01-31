import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User,
  Employee,
  LeaveType,
  EmploymentStatus,
  UserRole,
} from '../../types';
import { HRService } from '../../services/hrService';
import { showToast } from '../../services/toastService';
import { useDevModeContext } from '../../contexts/DevModeContext';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Phone,
  Mail,
  Calendar,
  Building2,
  User as UserIcon,
  Car,
  Shield,
  FileText,
  Briefcase,
} from 'lucide-react';
import TechnicianJobsTab from '../../components/TechnicianJobsTab';
import TelegramConnect from '../../components/TelegramConnect';
import { EmployeeProfileProps, ActiveTab } from './types';
import {
  InfoItem,
  InfoTab,
  LicensesTab,
  PermitsTab,
  LeavesTab,
  AddLicenseModal,
  AddPermitModal,
  AddLeaveModal,
  LeaveCalendarModal,
} from './components';

/**
 * EmployeeProfilePage - Main container for viewing and editing employee profiles
 * 
 * Features:
 * - View employee personal and employment information
 * - Edit employee details (with proper permissions)
 * - Manage licenses and permits (for technicians)
 * - Request and manage leave
 * - Connect Telegram notifications
 * 
 * @param currentUser - The currently logged-in user
 */
export default function EmployeeProfilePage({ currentUser }: EmployeeProfileProps) {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Employee>>({});
  const [activeTab, setActiveTab] = useState<ActiveTab>('info');
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
      showToast.error('Failed to update employee');
      alert('Failed to update employee');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading employee...</div>
      </div>
    );
  }

  // Employee not found states
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

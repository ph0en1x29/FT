import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserRole } from '../../types';
import { HRService } from '../../services/hrService';
import { useDevModeContext } from '../../contexts/DevModeContext';
import TechnicianJobsTab from '../../components/TechnicianJobsTab';
import TelegramConnect from '../../components/TelegramConnect';
import { EmployeeProfileProps, ActiveTab } from './types';
import { useEmployeeProfile, useEmployeeModals } from './hooks';
import {
  ProfileHeader,
  ProfileCard,
  ProfileTabs,
  LoadingState,
  ProfileNotSetUp,
  EmployeeNotFound,
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
 */
export default function EmployeeProfilePage({ currentUser }: EmployeeProfileProps) {
  const { id: userId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('info');

  // Custom hooks for state management
  const {
    employee,
    loading,
    editing,
    editData,
    leaveTypes,
    setEditing,
    setEditData,
    handleSave,
    loadEmployee,
    cancelEdit,
  } = useEmployeeProfile({
    userId,
    currentUserId: currentUser.user_id,
    currentUserName: currentUser.name,
  });

  const modals = useEmployeeModals();

  // Permissions
  const { hasPermission } = useDevModeContext();
  const canManageEmployees = hasPermission('canManageEmployees');
  const canApproveLeave = hasPermission('canApproveLeave');
  const isOwnProfile = currentUser.user_id === userId;

  // Loading state
  if (loading) return <LoadingState />;

  // Not found states
  if (!employee) {
    if (isOwnProfile) {
      return <ProfileNotSetUp onBack={() => navigate('/')} />;
    }
    return <EmployeeNotFound />;
  }

  const isTechnician = employee.role === UserRole.TECHNICIAN;

  // Modal save handlers
  const handleSaveLicense = async (data: Parameters<typeof HRService.createLicense>[0]) => {
    await HRService.createLicense(data, currentUser.user_id, currentUser.name);
    loadEmployee();
    modals.setShowAddLicense(false);
  };

  const handleSavePermit = async (data: Parameters<typeof HRService.createPermit>[0]) => {
    await HRService.createPermit(data, currentUser.user_id, currentUser.name);
    loadEmployee();
    modals.setShowAddPermit(false);
  };

  const handleSaveLeave = async (data: Parameters<typeof HRService.createLeave>[0]) => {
    await HRService.createLeave(data);
    loadEmployee();
    modals.setShowAddLeave(false);
  };

  return (
    <div className="space-y-6">
      <ProfileHeader
        employee={employee}
        isOwnProfile={isOwnProfile}
        editing={editing}
        canEdit={canManageEmployees || isOwnProfile}
        onNavigateBack={() => navigate(isOwnProfile ? '/' : '/hr/employees')}
        onStartEdit={() => setEditing(true)}
        onSave={handleSave}
        onCancel={cancelEdit}
      />

      <ProfileCard employee={employee} />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <ProfileTabs
          activeTab={activeTab}
          isTechnician={isTechnician}
          employee={employee}
          onTabChange={setActiveTab}
        />

        <div className="p-6">
          {activeTab === 'info' && (
            <>
              <InfoTab
                employee={employee}
                editing={editing}
                editData={editData}
                setEditData={setEditData}
              />
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
            <TechnicianJobsTab employee={employee} currentUser={currentUser} />
          )}

          {activeTab === 'licenses' && isTechnician && (
            <LicensesTab
              employee={employee}
              canManage={canManageEmployees || isOwnProfile}
              onAdd={() => modals.setShowAddLicense(true)}
              onRefresh={loadEmployee}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'permits' && isTechnician && (
            <PermitsTab
              employee={employee}
              canManage={canManageEmployees || isOwnProfile}
              onAdd={() => modals.setShowAddPermit(true)}
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
              onAdd={() => modals.setShowAddLeave(true)}
              onShowCalendar={() => modals.setShowLeaveCalendar(true)}
              onRefresh={loadEmployee}
              currentUser={currentUser}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {modals.showAddLicense && (
        <AddLicenseModal
          userId={employee.user_id}
          onClose={() => modals.setShowAddLicense(false)}
          onSave={handleSaveLicense}
        />
      )}

      {modals.showAddPermit && (
        <AddPermitModal
          userId={employee.user_id}
          onClose={() => modals.setShowAddPermit(false)}
          onSave={handleSavePermit}
        />
      )}

      {modals.showAddLeave && (
        <AddLeaveModal
          userId={employee.user_id}
          leaveTypes={leaveTypes}
          onClose={() => modals.setShowAddLeave(false)}
          onSave={handleSaveLeave}
        />
      )}

      {modals.showLeaveCalendar && (
        <LeaveCalendarModal
          userId={employee.user_id}
          employeeName={employee.full_name || employee.name || ''}
          onClose={() => modals.setShowLeaveCalendar(false)}
        />
      )}
    </div>
  );
}

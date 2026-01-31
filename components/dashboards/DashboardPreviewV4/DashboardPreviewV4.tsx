import React from 'react';
import { Job, User, UserRole } from '../../../types';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import TechnicianDashboard from './components/TechnicianDashboard';
import AccountantDashboard from './components/AccountantDashboard';

/**
 * Dashboard Preview V4 - "Calm Focus"
 *
 * Role-aware dashboard with calm design principles:
 * - Admin/Supervisor: Full operational view
 * - Technician: Personal "My Jobs" focus
 * - Accountant: Financial/invoice focus
 */

export interface DashboardPreviewV4Props {
  currentUser: User;
  displayRole: UserRole;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
}

const DashboardPreviewV4: React.FC<DashboardPreviewV4Props> = ({
  currentUser,
  displayRole,
  jobs,
  users,
  onRefresh
}) => {
  const navigate = useNavigate();

  switch (displayRole) {
    case UserRole.TECHNICIAN:
      return (
        <TechnicianDashboard
          currentUser={currentUser}
          jobs={jobs}
          onRefresh={onRefresh}
          navigate={navigate}
        />
      );

    case UserRole.ACCOUNTANT:
      return (
        <AccountantDashboard
          jobs={jobs}
          onRefresh={onRefresh}
          navigate={navigate}
        />
      );

    case UserRole.ADMIN:
    case UserRole.SUPERVISOR:
    default:
      return (
        <AdminDashboard
          currentUser={currentUser}
          jobs={jobs}
          users={users}
          onRefresh={onRefresh}
          navigate={navigate}
        />
      );
  }
};

export default DashboardPreviewV4;

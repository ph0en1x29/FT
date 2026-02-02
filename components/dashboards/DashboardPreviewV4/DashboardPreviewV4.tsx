import React from 'react';
import { Job, User, UserRole } from '../../../types';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import SupervisorDashboard from './components/SupervisorDashboard';
import TechnicianDashboard from './components/TechnicianDashboard';
import AccountantDashboard from './components/AccountantDashboard';

/**
 * Dashboard Preview V4 - "Calm Focus"
 *
 * Role-aware dashboard with calm design principles:
 * - Admin: Full operational view (V5 prototype available)
 * - Supervisor: Team-focused view (V5 prototype available)
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

    case UserRole.SUPERVISOR:
      return (
        <SupervisorDashboard
          currentUser={currentUser}
          jobs={jobs}
          users={users}
          onRefresh={onRefresh}
          navigate={navigate}
        />
      );

    case UserRole.ADMIN:
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

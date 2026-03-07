import React, { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Job,User,UserRole } from '../../../types';

const AccountantDashboard = lazy(() => import('./components/AccountantDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ServiceAdminDashboard = lazy(() => import('./components/ServiceAdminDashboard'));
const StoreAdminDashboard = lazy(() => import('./components/StoreAdminDashboard'));
const SupervisorDashboard = lazy(() => import('./components/SupervisorDashboard'));
const TechnicianDashboard = lazy(() => import('./components/TechnicianDashboard'));

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
  const renderDashboard = (dashboard: React.ReactNode) => (
    <Suspense
      fallback={(
        <div className="space-y-5">
          <div
            className="h-32 rounded-[28px] animate-pulse"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 rounded-[24px] animate-pulse"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              />
            ))}
          </div>
          <div
            className="h-[320px] rounded-[28px] animate-pulse"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          />
        </div>
      )}
    >
      {dashboard}
    </Suspense>
  );

  switch (displayRole) {
    case UserRole.TECHNICIAN:
      return renderDashboard(
        <TechnicianDashboard
          currentUser={currentUser}
          jobs={jobs}
          onRefresh={onRefresh}
          navigate={navigate}
        />
      );

    case UserRole.ACCOUNTANT:
      return renderDashboard(
        <AccountantDashboard
          jobs={jobs}
          onRefresh={onRefresh}
          navigate={navigate}
        />
      );

    case UserRole.SUPERVISOR:
      return renderDashboard(
        <SupervisorDashboard
          currentUser={currentUser}
          jobs={jobs}
          users={users}
          onRefresh={onRefresh}
          navigate={navigate}
        />
      );

    case UserRole.ADMIN_SERVICE:
      return renderDashboard(
        <ServiceAdminDashboard
          currentUser={currentUser}
          jobs={jobs}
          users={users}
          onRefresh={onRefresh}
          navigate={navigate}
        />
      );

    case UserRole.ADMIN_STORE:
      return renderDashboard(
        <StoreAdminDashboard
          currentUser={currentUser}
          jobs={jobs}
          onRefresh={onRefresh}
          navigate={navigate}
        />
      );

    case UserRole.ADMIN:
    default:
      return renderDashboard(
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

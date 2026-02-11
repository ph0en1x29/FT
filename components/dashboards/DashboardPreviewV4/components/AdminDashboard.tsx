import React from 'react';
import { Job, User } from '../../../../types';
import AdminDashboardV7_1 from './AdminDashboardV7_1';

interface AdminDashboardProps {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
  hideV5Toggle?: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, jobs, users, onRefresh, navigate }) => {
  return (
    <AdminDashboardV7_1
      currentUser={currentUser}
      jobs={jobs}
      users={users}
      onRefresh={onRefresh}
      navigate={navigate}
    />
  );
};

export default AdminDashboard;

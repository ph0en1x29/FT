/**
 * SupervisorDashboard - Uses AdminDashboard (with V7 prototype toggle)
 */

import React from 'react';
import { Job, User } from '../../../../types';
import AdminDashboard from './AdminDashboard';

interface SupervisorDashboardProps {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = (props) => {
  return <AdminDashboard {...props} hideV5Toggle />;
};

export default SupervisorDashboard;

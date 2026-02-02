/**
 * SupervisorDashboard - With V5 prototype toggle
 * 
 * Default: Uses AdminDashboard (V4) - but hides Admin's own V5 toggle
 * Prototype: SupervisorDashboardV5 (team-focused)
 */

import React, { useState } from 'react';
import { Job, User } from '../../../../types';
import { FlaskConical } from 'lucide-react';
import SupervisorDashboardV5 from './SupervisorDashboardV5';

// Import the base Admin V4 layout components directly to avoid double-toggle
import AdminDashboard from './AdminDashboard';

interface SupervisorDashboardProps {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = (props) => {
  const { currentUser } = props;
  const isDevUser = currentUser.email === 'dev@test.com';
  const [useV5, setUseV5] = useState(false);

  // V5 Prototype for dev user
  if (isDevUser && useV5) {
    return (
      <div>
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setUseV5(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-lg"
          >
            <FlaskConical className="w-4 h-4" />
            ← Back to V4
          </button>
        </div>
        <SupervisorDashboardV5 {...props} />
      </div>
    );
  }

  // Default: Admin dashboard layout
  // Pass hideV5Toggle to prevent Admin's own V5 toggle from showing
  return (
    <div>
      {isDevUser && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setUseV5(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700"
          >
            <FlaskConical className="w-4 h-4" />
            🧪 Try Supervisor V5
          </button>
        </div>
      )}
      <AdminDashboard {...props} hideV5Toggle />
    </div>
  );
};

export default SupervisorDashboard;

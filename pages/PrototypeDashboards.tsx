import React, { useState, useEffect } from 'react';
import { Job, User } from '../types';
import { SupabaseDb } from '../services/supabaseService';
import { useDevMode } from '../hooks/useDevMode';
import { DevBanner } from '../components/dev/DevBanner';
import { RoleSwitcher } from '../components/dev/RoleSwitcher';
import DashboardPreviewV4 from '../components/dashboards/DashboardPreviewV4';
import { RefreshCw, AlertCircle } from 'lucide-react';

// =========================================
// MAIN DASHBOARD (V4)
// =========================================

interface DashboardV4Props {
  currentUser: User;
}

const DashboardV4: React.FC<DashboardV4Props> = ({ currentUser }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dev mode hook - only affects devs
  const devMode = useDevMode(currentUser.email, currentUser.role);

  // Load data for ALL users
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [jobsData, usersData] = await Promise.all([
          SupabaseDb.getJobs(currentUser),
          SupabaseDb.getUsers(),
        ]);
        setJobs(jobsData);
        setUsers(usersData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUser]);

  const handleRefresh = async () => {
    try {
      const [jobsData, usersData] = await Promise.all([
        SupabaseDb.getJobs(currentUser),
        SupabaseDb.getUsers(),
      ]);
      setJobs(jobsData);
      setUsers(usersData);
    } catch (err: any) {
      console.error('Refresh failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="p-8 text-center max-w-md rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--error)' }} />
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>Error Loading</h1>
          <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Dev Banner (when impersonating) - only for devs */}
      {devMode.isDevModeActive && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <DevBanner
            impersonatedRole={devMode.impersonatedRole!}
            actualRole={currentUser.role}
            devModeType={devMode.devModeType}
            onExit={devMode.deactivateDevMode}
          />
        </div>
      )}

      {/* Dev Role Switcher - only for devs */}
      {devMode.isDev && (
        <div className="flex justify-end mb-4">
          <RoleSwitcher
            currentRole={currentUser.role}
            impersonatedRole={devMode.impersonatedRole}
            devModeType={devMode.devModeType}
            onRoleChange={devMode.setImpersonatedRole}
            onModeTypeChange={devMode.setDevModeType}
            onDeactivate={devMode.deactivateDevMode}
          />
        </div>
      )}

      {/* Dashboard Content */}
      <div className={devMode.isDevModeActive ? 'mt-10' : ''}>
        <DashboardPreviewV4
          currentUser={currentUser}
          displayRole={devMode.displayRole}
          jobs={jobs}
          users={users}
          onRefresh={handleRefresh}
        />
      </div>
    </>
  );
};

export default DashboardV4;

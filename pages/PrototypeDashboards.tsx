import { AlertCircle,RefreshCw } from 'lucide-react';
import React,{ useEffect,useRef,useState } from 'react';
import DashboardPreviewV4 from '../components/dashboards/DashboardPreviewV4';
import { useDevModeContext } from '../contexts/DevModeContext';
import { runEscalationChecks } from '../services/escalationService';
import { SupabaseDb } from '../services/supabaseService';
import { Job,User,UserRole } from '../types';

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

  // Dev mode from context - shared with header DevModeSelector
  const devMode = useDevModeContext();
  const escalationChecked = useRef(false);

  // Run escalation checks once on dashboard load (admin/supervisor only)
  useEffect(() => {
    const role = devMode.displayRole || currentUser.role;
    const isAdmin = [UserRole.ADMIN, UserRole.ADMIN_SERVICE, UserRole.ADMIN_STORE, UserRole.SUPERVISOR].includes(role as UserRole);
    if (isAdmin && !escalationChecked.current) {
      escalationChecked.current = true;
      runEscalationChecks().catch(() => {});
    }
  }, [currentUser.role, devMode.displayRole]);

  // Load data for ALL users
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [jobsData, usersData] = await Promise.all([
          SupabaseDb.getJobs(currentUser),
          SupabaseDb.getUsersLightweight(),
        ]);
        setJobs(jobsData);
        setUsers(usersData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
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
        SupabaseDb.getUsersLightweight(),
      ]);
      setJobs(jobsData);
      setUsers(usersData);
    } catch (_err) {
      /* Silently ignore */
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
    <div className="pb-24 md:pb-8">
    <DashboardPreviewV4
      currentUser={currentUser}
      displayRole={devMode.displayRole}
      jobs={jobs}
      users={users}
      onRefresh={handleRefresh}
    />
    </div>
  );
};

export default DashboardV4;

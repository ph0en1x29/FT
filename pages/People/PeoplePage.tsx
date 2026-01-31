import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User } from '../../types';
import {
  Users, LayoutDashboard, Calendar, BarChart3, Briefcase, User as UserIcon
} from 'lucide-react';
import TechnicianKPIPage from '../TechnicianKPIPageV2';
import TeamStatusTab from '../../components/TeamStatusTab';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { TabType, LeaveFilterType } from './types';
import OverviewTab from './components/OverviewTab';
import UsersTab from './components/UsersTab';
import EmployeesTab from './components/EmployeesTab';
import LeaveTab from './components/LeaveTab';

interface PeopleProps {
  currentUser: User;
}

/**
 * People page - Unified HR management interface
 * 
 * Tabs:
 * - Overview: HR dashboard with stats, expiring docs, attendance
 * - Team: Workload status (TeamStatusTab)
 * - Users: User account management (CRUD)
 * - Employees: Employee profiles grid
 * - Leave: Leave request management
 * - Performance: KPI metrics (TechnicianKPIPage)
 */
const People: React.FC<PeopleProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'overview';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Use dev mode context for role-based permissions
  const { hasPermission } = useDevModeContext();

  // Get filter params for child tabs
  const statusParam = searchParams.get('status') || undefined;
  const filterParam = searchParams.get('filter') as LeaveFilterType | undefined;

  const canManageUsers = hasPermission('canManageUsers');
  const canViewHR = hasPermission('canViewHR');
  const canViewKPI = hasPermission('canViewKPI');

  const handleTabChange = (tab: TabType, params?: Record<string, string>) => {
    setActiveTab(tab);
    const newParams: Record<string, string> = { tab };
    if (params) {
      Object.assign(newParams, params);
    }
    setSearchParams(newParams);
  };

  // Sync tab from URL when it changes externally
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabType;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: LayoutDashboard, description: 'Dashboard' },
    ...(canViewHR ? [{ id: 'team' as TabType, label: 'Team', icon: Briefcase, description: 'Workload status' }] : []),
    ...(canManageUsers ? [{ id: 'users' as TabType, label: 'Users', icon: Users, description: 'Accounts & access' }] : []),
    ...(canViewHR ? [{ id: 'employees' as TabType, label: 'Employees', icon: UserIcon, description: 'HR profiles' }] : []),
    ...(canViewHR ? [{ id: 'leave' as TabType, label: 'Leave', icon: Calendar, description: 'Requests & approvals' }] : []),
    ...(canViewKPI ? [{ id: 'performance' as TabType, label: 'Performance', icon: BarChart3, description: 'KPI metrics' }] : []),
  ];

  // Default to first available tab
  const availableTabs = tabs.map(t => t.id);
  const effectiveTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || 'overview';

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme">People</h1>
            <p className="text-sm text-theme-muted mt-1">Manage users, employee profiles, and leave requests</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-theme">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = effectiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-theme-muted hover:text-theme hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {effectiveTab === 'overview' && <OverviewTab currentUser={currentUser} onNavigate={handleTabChange} />}
      {effectiveTab === 'team' && canViewHR && <TeamStatusTab currentUser={currentUser} />}
      {effectiveTab === 'users' && canManageUsers && <UsersTab currentUser={currentUser} />}
      {effectiveTab === 'employees' && canViewHR && (
        <EmployeesTab 
          currentUser={currentUser} 
          initialStatus={statusParam} 
          onFilterChange={(status) => setSearchParams({ tab: 'employees', ...(status !== 'all' ? { status } : {}) })}
        />
      )}
      {effectiveTab === 'leave' && canViewHR && (
        <LeaveTab
          currentUser={currentUser}
          initialFilter={filterParam}
          onFilterChange={(filter) => setSearchParams({ tab: 'leave', ...(filter !== 'pending' ? { filter } : {}) })}
        />
      )}
      {effectiveTab === 'performance' && canViewKPI && (
        <TechnicianKPIPage currentUser={currentUser} hideHeader />
      )}
    </div>
  );
};

export default People;

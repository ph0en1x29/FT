import { Briefcase,CheckSquare,FileText,Plus } from 'lucide-react';
import React,{ useCallback,useEffect,useState } from 'react';
import { useNavigate,useSearchParams } from 'react-router-dom';
import { useDevModeContext } from '../contexts/DevModeContext';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { User,UserRole } from '../types';
import JobBoard from './JobBoard';
import ServiceRecords from './ServiceRecords';
import StoreQueue from './StoreQueue';

type TabType = 'active' | 'history' | 'approvals';

interface JobsTabsProps {
  currentUser: User;
}

const JobsTabs: React.FC<JobsTabsProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab = (searchParams.get('tab') as TabType) || 'active';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [refreshKey, setRefreshKey] = useState(0);

  const { displayRole, hasPermission } = useDevModeContext();

  const canCreateJob = hasPermission('canCreateJobs');
  const canViewHistory = hasPermission('canViewServiceRecords');
  const isAdminOrSupervisor = [UserRole.ADMIN, UserRole.ADMIN_SERVICE, UserRole.ADMIN_STORE, UserRole.SUPERVISOR].includes(
    (displayRole || currentUser.role) as UserRole
  );

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const refreshActiveTab = useCallback(async () => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const { pullToRefreshProps, PullIndicator } = usePullToRefresh(refreshActiveTab);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabType;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const tabs = [
    { id: 'active' as TabType, label: 'Active Jobs', icon: Briefcase },
    ...(canViewHistory ? [{ id: 'history' as TabType, label: 'Service History', icon: FileText }] : []),
    ...(isAdminOrSupervisor ? [{ id: 'approvals' as TabType, label: 'Approvals', icon: CheckSquare }] : []),
  ];

  const availableTabs = tabs.map(t => t.id);
  const effectiveTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || 'active';

  return (
    <div className="space-y-4 md:space-y-6 pb-24 md:pb-8" {...pullToRefreshProps}>
      <PullIndicator />
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-theme">
              {displayRole === UserRole.TECHNICIAN ? 'My Jobs' : 'Jobs'}
            </h1>
            <p className="text-xs md:text-sm text-theme-muted mt-1">Manage jobs and service records</p>
          </div>
          {canCreateJob && (
            <button
              onClick={() => navigate('/jobs/new')}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 md:px-4 py-2.5 md:py-2 h-12 md:h-auto rounded-lg shadow hover:bg-blue-700 transition text-sm md:text-base"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Job</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>

        <div className="border-b border-theme">
          <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = effectiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3 md:px-4 py-3 h-12 min-w-[44px] text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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

      {effectiveTab === 'active' && <React.Fragment key={`active-${refreshKey}`}><JobBoard currentUser={currentUser} hideHeader /></React.Fragment>}
      {effectiveTab === 'history' && canViewHistory && <React.Fragment key={`history-${refreshKey}`}><ServiceRecords currentUser={currentUser} hideHeader /></React.Fragment>}
      {effectiveTab === 'approvals' && isAdminOrSupervisor && <React.Fragment key={`approvals-${refreshKey}`}><StoreQueue currentUser={currentUser} hideHeader /></React.Fragment>}
    </div>
  );
};

export default JobsTabs;

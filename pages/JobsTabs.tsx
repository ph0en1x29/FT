import { Briefcase,FileText,Plus } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { useNavigate,useSearchParams } from 'react-router-dom';
import { useDevModeContext } from '../contexts/DevModeContext';
import { User,UserRole } from '../types';
import JobBoard from './JobBoard';
import ServiceRecords from './ServiceRecords';

type TabType = 'active' | 'history';

interface JobsTabsProps {
  currentUser: User;
}

const JobsTabs: React.FC<JobsTabsProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab = (searchParams.get('tab') as TabType) || 'active';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Use dev mode context for role-based permissions
  const { displayRole, hasPermission } = useDevModeContext();

  const canCreateJob = hasPermission('canCreateJobs');
  const canViewHistory = hasPermission('canViewServiceRecords');

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Sync tab from URL when it changes externally
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabType;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const tabs = [
    { id: 'active' as TabType, label: 'Active Jobs', icon: Briefcase },
    ...(canViewHistory ? [{ id: 'history' as TabType, label: 'Service History', icon: FileText }] : []),
  ];

  // Default to first available tab
  const availableTabs = tabs.map(t => t.id);
  const effectiveTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || 'active';

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme">
              {displayRole === UserRole.TECHNICIAN ? 'My Jobs' : 'Jobs'}
            </h1>
            <p className="text-sm text-theme-muted mt-1">Manage jobs and service records</p>
          </div>
          {canCreateJob && (
            <button
              onClick={() => navigate('/jobs/new')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              New Job
            </button>
          )}
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
      {effectiveTab === 'active' && <JobBoard currentUser={currentUser} hideHeader />}
      {effectiveTab === 'history' && canViewHistory && <ServiceRecords currentUser={currentUser} hideHeader />}
    </div>
  );
};

export default JobsTabs;

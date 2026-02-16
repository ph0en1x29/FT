import { ArrowLeftRight,Briefcase,CheckSquare,ClipboardList,FileText,Plus } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { useNavigate,useSearchParams } from 'react-router-dom';
import { useDevModeContext } from '../contexts/DevModeContext';
import { User,UserRole } from '../types';
import JobBoard from './JobBoard';
import PendingConfirmations from './PendingConfirmations';
import ServiceRecords from './ServiceRecords';
import StoreQueue from './StoreQueue';

type TabType = 'active' | 'history' | 'queue' | 'confirmations';

interface JobsTabsProps {
  currentUser: User;
}

const JobsTabs: React.FC<JobsTabsProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab = (searchParams.get('tab') as TabType) || 'active';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [useNewQueue, setUseNewQueue] = useState(() => {
    return localStorage.getItem('ft-store-queue-v2') !== 'false'; // default: new
  });

  // Use dev mode context for role-based permissions
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

  const toggleQueueVersion = () => {
    const next = !useNewQueue;
    setUseNewQueue(next);
    localStorage.setItem('ft-store-queue-v2', String(next));
    // Switch to the right tab
    if (next && activeTab === 'confirmations') {
      handleTabChange('queue');
    } else if (!next && activeTab === 'queue') {
      handleTabChange('confirmations');
    }
  };

  // Sync tab from URL when it changes externally
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabType;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const storeTab = useNewQueue
    ? { id: 'queue' as TabType, label: 'Store Queue', icon: ClipboardList }
    : { id: 'confirmations' as TabType, label: 'Confirmations', icon: CheckSquare };

  const tabs = [
    { id: 'active' as TabType, label: 'Active Jobs', icon: Briefcase },
    ...(canViewHistory ? [{ id: 'history' as TabType, label: 'Service History', icon: FileText }] : []),
    ...(isAdminOrSupervisor ? [storeTab] : []),
  ];

  // Default to first available tab
  const availableTabs = tabs.map(t => t.id);
  const effectiveTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || 'active';

  const showingStoreContent = effectiveTab === 'queue' || effectiveTab === 'confirmations';

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

      {/* Version toggle — only visible when on store tab */}
      {isAdminOrSupervisor && showingStoreContent && (
        <div className="flex items-center justify-end">
          <button
            onClick={toggleQueueVersion}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-subtle)] hover:bg-[var(--surface)] border border-[var(--border)] rounded-lg transition"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Switch to {useNewQueue ? 'Old View' : 'New View'}
          </button>
        </div>
      )}

      {/* Tab Content */}
      {effectiveTab === 'active' && <JobBoard currentUser={currentUser} hideHeader />}
      {effectiveTab === 'history' && canViewHistory && <ServiceRecords currentUser={currentUser} hideHeader />}
      {effectiveTab === 'queue' && isAdminOrSupervisor && <StoreQueue currentUser={currentUser} hideHeader />}
      {effectiveTab === 'confirmations' && isAdminOrSupervisor && <PendingConfirmations currentUser={currentUser} hideHeader />}
    </div>
  );
};

export default JobsTabs;

import { AlertTriangle,ClipboardCheck,LayoutDashboard,Settings,Truck } from 'lucide-react';
import React,{ useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AssetDashboard from '../../components/AssetDashboard';
import StaleDataBanner from '../../components/StaleDataBanner';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { UserRole } from '../../types';
import HourmeterReview from '../HourmeterReview';
import FleetTab from './components/FleetTab';
import ServiceDueTab from './components/ServiceDueTab';
import ServiceIntervalsTab from './components/ServiceIntervalsTab';
import { ForkliftsTabsProps,TabType } from './types';

/**
 * ForkliftsTabsPage - Main container for forklift management
 * 
 * Tabs:
 * - Dashboard (admin/supervisor only) - Asset overview
 * - Fleet - Fleet management with CRUD operations
 * - Service Intervals (admin only) - Configure service schedules
 * - Service Due - Track upcoming maintenance
 * - Hourmeter Review (admin/supervisor only) - Review readings
 */
const ForkliftsTabsPage: React.FC<ForkliftsTabsProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { displayRole } = useDevModeContext();

  const isAdmin = displayRole === UserRole.ADMIN;
  const isAdminOrSupervisor = [
    UserRole.ADMIN,
    UserRole.ADMIN_SERVICE,
    UserRole.ADMIN_STORE,
    UserRole.SUPERVISOR,
  ].includes(displayRole);

  // Default tab based on role
  const defaultTab = isAdminOrSupervisor ? 'dashboard' : 'fleet';
  const urlTab = searchParams.get('tab') as TabType;
  
  // If URL has dashboard tab but user doesn't have access, fallback to fleet
  const initialTab = (urlTab === 'dashboard' && !isAdminOrSupervisor) 
    ? 'fleet' 
    : (urlTab || defaultTab);
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Build tabs based on permissions
  const tabs = [
    ...(isAdminOrSupervisor ? [{ id: 'dashboard' as TabType, label: 'Overview', icon: LayoutDashboard }] : []),
    { id: 'fleet' as TabType, label: 'Fleet', icon: Truck },
    ...(isAdmin ? [{ id: 'intervals' as TabType, label: 'Service Intervals', icon: Settings }] : []),
    { id: 'service-due' as TabType, label: 'Service Due', icon: AlertTriangle },
    ...(isAdminOrSupervisor ? [{ id: 'hourmeter' as TabType, label: 'Hourmeter Review', icon: ClipboardCheck }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme">Forklifts</h1>
            <p className="text-sm text-theme-muted mt-1">
              Manage fleet, service intervals, and maintenance schedules
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-theme">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
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
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Stale Data Banner (admin/supervisor only) */}
      {isAdminOrSupervisor && <StaleDataBanner />}

      {/* Tab Content */}
      {activeTab === 'dashboard' && isAdminOrSupervisor && (
        <AssetDashboard currentUser={currentUser} />
      )}
      {activeTab === 'fleet' && (
        <FleetTab currentUser={currentUser} />
      )}
      {activeTab === 'intervals' && isAdmin && (
        <ServiceIntervalsTab currentUser={currentUser} />
      )}
      {activeTab === 'service-due' && (
        <ServiceDueTab currentUser={currentUser} />
      )}
      {activeTab === 'hourmeter' && isAdminOrSupervisor && (
        <HourmeterReview currentUser={currentUser} hideHeader />
      )}
    </div>
  );
};

export default ForkliftsTabsPage;

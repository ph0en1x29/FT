import React, { useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, ROLE_PERMISSIONS } from '../types_with_invoice_tracking';
import { BarChart3, TrendingUp, Loader2 } from 'lucide-react';

// Lazy load the actual content component
const TechnicianKPIPage = lazy(() => import('./TechnicianKPIPageV2'));

type TabType = 'kpi';

interface ReportsPageProps {
  currentUser: User;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'kpi';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const canViewKPI = ROLE_PERMISSIONS[currentUser.role]?.canViewKPI;

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    ...(canViewKPI ? [{ id: 'kpi' as TabType, label: 'Technician KPI', icon: TrendingUp }] : []),
    // Future tabs can be added here:
    // { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
  ];

  const availableTabs = tabs.map(t => t.id);
  const effectiveTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || 'kpi';

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme">Reports</h1>
            <p className="text-sm text-theme-muted mt-1">Performance metrics and analytics</p>
          </div>
        </div>

        {/* Tab Navigation - shown even with single tab for consistency */}
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
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }>
        {effectiveTab === 'kpi' && canViewKPI && (
          <TechnicianKPIWrapper currentUser={currentUser} />
        )}
      </Suspense>
    </div>
  );
};

// Wrapper that strips the header from original page
const TechnicianKPIWrapper: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  return (
    <div className="reports-content-wrapper">
      <TechnicianKPIPage currentUser={currentUser} hideHeader />
    </div>
  );
};

export default ReportsPage;

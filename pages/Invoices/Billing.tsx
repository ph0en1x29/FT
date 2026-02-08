import { FileText,Send } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User } from '../../types';
import AutoCountExport from '../AutoCountExport';
import InvoiceHistoryTab from './InvoiceHistoryTab';

type TabType = 'invoices' | 'autocount';

interface BillingProps {
  currentUser: User;
}

/**
 * Billing page with tabs for Invoice History and AutoCount Export
 */
const Billing: React.FC<BillingProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'invoices';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

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
  }, [searchParams, activeTab]);

  const tabs = [
    { id: 'invoices' as TabType, label: 'Invoice History', icon: FileText },
    { id: 'autocount' as TabType, label: 'AutoCount Export', icon: Send },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme">Billing</h1>
            <p className="text-sm text-theme-muted mt-1">Manage invoices and accounting exports</p>
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
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'invoices' && <InvoiceHistoryTab currentUser={currentUser} />}
      {activeTab === 'autocount' && (
        <div className="space-y-6">
          <AutoCountExport currentUser={currentUser} hideHeader />
        </div>
      )}
    </div>
  );
};

export default Billing;

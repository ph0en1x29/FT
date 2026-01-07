import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, ROLE_PERMISSIONS } from '../types_with_invoice_tracking';
import { FileText, Receipt, Loader2 } from 'lucide-react';

// Lazy load the actual content components
const ServiceRecords = lazy(() => import('./ServiceRecords'));
const Invoices = lazy(() => import('./Invoices'));

type TabType = 'service-records' | 'invoices';

interface RecordsPageProps {
  currentUser: User;
}

const RecordsPage: React.FC<RecordsPageProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'service-records';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const canViewServiceRecords = ROLE_PERMISSIONS[currentUser.role]?.canViewServiceRecords;
  const canFinalizeInvoices = ROLE_PERMISSIONS[currentUser.role]?.canFinalizeInvoices;

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    ...(canViewServiceRecords ? [{ id: 'service-records' as TabType, label: 'Service Records', icon: FileText }] : []),
    ...(canFinalizeInvoices ? [{ id: 'invoices' as TabType, label: 'Invoices', icon: Receipt }] : []),
  ];

  const availableTabs = tabs.map(t => t.id);
  const effectiveTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0] || 'service-records';

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme">Records</h1>
            <p className="text-sm text-theme-muted mt-1">Service history and financial documents</p>
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
        {effectiveTab === 'service-records' && canViewServiceRecords && (
          <ServiceRecordsWrapper currentUser={currentUser} />
        )}
        {effectiveTab === 'invoices' && canFinalizeInvoices && (
          <InvoicesWrapper currentUser={currentUser} />
        )}
      </Suspense>
    </div>
  );
};

// Wrapper components that strip the header from original pages
const ServiceRecordsWrapper: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  return (
    <div className="records-content-wrapper">
      <ServiceRecords currentUser={currentUser} hideHeader />
    </div>
  );
};

const InvoicesWrapper: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  return (
    <div className="records-content-wrapper">
      <Invoices currentUser={currentUser} hideHeader />
    </div>
  );
};

export default RecordsPage;

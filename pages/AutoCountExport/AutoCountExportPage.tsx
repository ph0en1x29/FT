import {
ExportDetailModal,
ExportHeader,
ExportsList,
PendingJobsSection,
SearchBar,
StatCards,
} from './components';
import { useAutoCountExport } from './hooks/useAutoCountExport';
import { AutoCountExportProps } from './types';

export default function AutoCountExportPage({ currentUser, hideHeader = false }: AutoCountExportProps) {
  const {
    pendingJobs,
    loading,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedExport,
    setSelectedExport,
    showDetailModal,
    setShowDetailModal,
    processing,
    selectedJobIds,
    filteredExports,
    stats,
    canExport,
    loadData,
    handleExportJob,
    handleBulkExport,
    handleRetryExport,
    handleCancelExport,
    toggleJobSelection,
    selectAllJobs,
    clearSelection,
  } = useAutoCountExport(currentUser);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading AutoCount exports...</div>
      </div>
    );
  }

  const handleSelectExport = (exp: typeof selectedExport) => {
    setSelectedExport(exp);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6">
      <ExportHeader hideHeader={hideHeader} onRefresh={loadData} />

      <PendingJobsSection
        pendingJobs={pendingJobs}
        selectedJobIds={selectedJobIds}
        processing={processing}
        onExportJob={handleExportJob}
        onBulkExport={handleBulkExport}
        onToggleSelection={toggleJobSelection}
        onSelectAll={selectAllJobs}
        onClearSelection={clearSelection}
      />

      <StatCards
        stats={stats}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by customer, invoice number..."
      />

      <ExportsList
        exports={filteredExports}
        activeTab={activeTab}
        onSelectExport={handleSelectExport}
      />

      {showDetailModal && selectedExport && (
        <ExportDetailModal
          export_={selectedExport}
          canExport={canExport}
          processing={processing}
          onClose={() => setShowDetailModal(false)}
          onRetry={handleRetryExport}
          onCancel={handleCancelExport}
        />
      )}
    </div>
  );
}

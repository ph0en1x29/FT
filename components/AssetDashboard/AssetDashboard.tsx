/**
 * AssetDashboard - Fleet overview with status cards and forklift table
 * 
 * Displays real-time fleet status by operational state:
 * - Rented Out, In Service, Service Due, Available, Out of Service
 * - Secondary states: Awaiting Parts, Reserved (shown when count > 0)
 * 
 * Features:
 * - Clickable status cards for filtering
 * - Search by S/N, make, model, or customer
 * - Pagination with show more/collapse
 * - Quick job creation from table rows
 */

import { Loader2,RefreshCw } from 'lucide-react';
import React from 'react';
import {
ForkliftTable,
MetricsBar,
ResultsCount,
SearchBar,
StatusCardGrid
} from './components';
import { useAssetDashboard } from './hooks/useAssetDashboard';
import { AssetDashboardProps,OperationalStatus } from './types';

const AssetDashboard: React.FC<AssetDashboardProps> = ({ currentUser }) => {
  const {
    loading,
    refreshing,
    forklifts,
    filteredCount,
    statusCounts,
    metrics,
    activeFilter,
    searchQuery,
    displayLimit,
    hasMore,
    refresh,
    setActiveFilter,
    setSearchQuery,
    setDisplayLimit,
    clearFilter
  } = useAssetDashboard({ currentUser });

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleCardClick = (status: OperationalStatus) => {
    setActiveFilter(activeFilter === status ? 'all' : status);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-theme">Fleet Overview</h2>
          <p className="text-sm text-theme-muted">
            {statusCounts.total} total units • Last updated just now
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Cards */}
      <StatusCardGrid
        statusCounts={statusCounts}
        activeFilter={activeFilter}
        onCardClick={handleCardClick}
      />

      {/* Metrics Bar */}
      <MetricsBar metrics={metrics} />

      {/* Search and Filter */}
      <SearchBar
        searchQuery={searchQuery}
        activeFilter={activeFilter}
        onSearchChange={setSearchQuery}
        onClearFilter={clearFilter}
      />

      {/* Results Count */}
      <ResultsCount
        displayedCount={forklifts.length}
        filteredCount={filteredCount}
        activeFilter={activeFilter}
      />

      {/* Forklift Table */}
      <ForkliftTable
        forklifts={forklifts}
        filteredCount={filteredCount}
        displayLimit={displayLimit}
        hasMore={hasMore}
        onShowMore={() => setDisplayLimit(displayLimit + 20)}
        onShowAll={() => setDisplayLimit(filteredCount)}
        onCollapse={() => setDisplayLimit(5)}
      />
    </div>
  );
};

export default AssetDashboard;

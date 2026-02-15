/**
 * AssetDashboardV3 - Clean fleet overview
 * 
 * Changes from V1:
 * - Inline utilization stat in header
 * - Subtitle with available + service due counts
 * - No metrics bar (belongs on analytics page)
 * - Same status cards as V1 (proven design)
 */

import { Loader2, RefreshCw } from 'lucide-react';
import React from 'react';
import {
  ForkliftTable,
  ResultsCount,
  SearchBar,
  StatusCardGrid,
} from './components';
import { useAssetDashboard } from './hooks/useAssetDashboard';
import { AssetDashboardProps, OperationalStatus } from './types';

const AssetDashboardV3: React.FC<AssetDashboardProps> = ({ currentUser }) => {
  const {
    loading,
    refreshing,
    forklifts,
    filteredCount,
    statusCounts,
    activeFilter,
    searchQuery,
    displayLimit,
    hasMore,
    refresh,
    setActiveFilter,
    setSearchQuery,
    setDisplayLimit,
    clearFilter,
  } = useAssetDashboard({ currentUser });

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

  const utilizationRate = statusCounts.total > 0
    ? Math.round((statusCounts.rented_out / statusCounts.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header with inline utilization */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-theme">Fleet Overview</h2>
            <span className="text-sm font-medium text-green-600">
              {statusCounts.rented_out}/{statusCounts.total} rented ({utilizationRate}%)
            </span>
          </div>
          <p className="text-sm text-theme-muted mt-0.5">
            {statusCounts.available} available • {statusCounts.service_due} due for service
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm text-theme-muted hover:text-theme hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Cards — same as V1 */}
      <StatusCardGrid
        statusCounts={statusCounts}
        activeFilter={activeFilter}
        onCardClick={handleCardClick}
      />

      {/* Search */}
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

export default AssetDashboardV3;

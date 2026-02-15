/**
 * AssetDashboardV2 - Enhanced fleet overview prototype
 * 
 * Improvements over V1:
 * - Utilization donut chart for at-a-glance fleet health
 * - Enhanced metric cards (utilization %, fleet health, jobs, avg duration)
 * - Refined status cards with percentage bars and hover effects
 * - Better zero states ("All clear" for service due = 0)
 * - Same data/hooks as V1, purely visual upgrade
 */

import { Loader2, RefreshCw } from 'lucide-react';
import React from 'react';
import {
  EnhancedMetrics,
  ForkliftTable,
  ResultsCount,
  SearchBar,
  StatusCardGridV2,
} from './components';
import { UtilizationRing } from './components/UtilizationRing';
import { useAssetDashboard } from './hooks/useAssetDashboard';
import { AssetDashboardProps, OperationalStatus } from './types';

const AssetDashboardV2: React.FC<AssetDashboardProps> = ({ currentUser }) => {
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
          className="flex items-center gap-2 px-3 py-2 text-sm text-theme-muted hover:text-theme hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Utilization Ring + Enhanced Metrics */}
      <div className="card-theme rounded-xl border border-theme p-6">
        <UtilizationRing statusCounts={statusCounts} />
      </div>

      {/* Metric Cards */}
      <EnhancedMetrics metrics={metrics} statusCounts={statusCounts} />

      {/* Status Cards */}
      <StatusCardGridV2
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

export default AssetDashboardV2;

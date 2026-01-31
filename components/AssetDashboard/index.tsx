/**
 * AssetDashboard module - Fleet overview dashboard
 * 
 * Re-exports for backward compatibility with existing imports:
 *   import AssetDashboard from './AssetDashboard'
 */

export { default } from './AssetDashboard';
export { default as AssetDashboard } from './AssetDashboard';

// Export types for consumers
export type {
  AssetDashboardProps,
  OperationalStatus,
  ForkliftWithStatus,
  StatusCounts,
  DashboardMetrics
} from './types';

// Export hook for advanced usage
export { useAssetDashboard } from './hooks/useAssetDashboard';

// Export sub-components
export {
  StatusCard,
  StatusCardGrid,
  MetricsBar,
  SearchBar,
  ResultsCount,
  ForkliftTable
} from './components';

// Export constants
export { STATUS_CONFIG, PRIMARY_STATUSES, SECONDARY_STATUSES } from './constants';

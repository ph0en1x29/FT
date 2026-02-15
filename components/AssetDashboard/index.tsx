/**
 * AssetDashboard module - Fleet overview dashboard (V3.1)
 */

export { default as AssetDashboard, default } from './AssetDashboardV3_1';

// Export types for consumers
export type {
  AssetDashboardProps, DashboardMetrics, ForkliftWithStatus, OperationalStatus, StatusCounts
} from './types';

// Export hook for advanced usage
export { useAssetDashboard } from './hooks/useAssetDashboard';

// Export sub-components
export {
  ForkliftTable, ResultsCount, SearchBar, StatusCard, StatusCardGrid
} from './components';

export { ForkliftTableV2 } from './components/ForkliftTableV2';

// Export constants
export { PRIMARY_STATUSES, SECONDARY_STATUSES, STATUS_CONFIG } from './constants';

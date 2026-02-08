/**
 * AssetDashboard module - Fleet overview dashboard
 * 
 * Re-exports for backward compatibility with existing imports:
 *   import AssetDashboard from './AssetDashboard'
 */

export { default as AssetDashboard,default } from './AssetDashboard';

// Export types for consumers
export type {
AssetDashboardProps,DashboardMetrics,ForkliftWithStatus,OperationalStatus,StatusCounts
} from './types';

// Export hook for advanced usage
export { useAssetDashboard } from './hooks/useAssetDashboard';

// Export sub-components
export {
ForkliftTable,MetricsBar,ResultsCount,SearchBar,StatusCard,
StatusCardGrid
} from './components';

// Export constants
export { PRIMARY_STATUSES,SECONDARY_STATUSES,STATUS_CONFIG } from './constants';

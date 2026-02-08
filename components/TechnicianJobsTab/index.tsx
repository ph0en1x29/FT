// TechnicianJobsTab - Modular component structure
// Main component re-export for backward compatibility

export { default as TechnicianJobsTab,default } from './TechnicianJobsTab';

// Sub-components (for advanced usage)
export { default as EmptyState } from './components/EmptyState';
export { default as FilterBar } from './components/FilterBar';
export { default as JobCard } from './components/JobCard';
export { default as StatsGrid } from './components/StatsGrid';

// Hooks
export { useJobFilters } from './hooks/useJobFilters';
export type { FilterMode,JobFilters,JobStats } from './hooks/useJobFilters';

// Utils
export { getJobTypeTone,getStatusTone,toneStyles } from './utils/jobStyles';
export type { ToneStyle } from './utils/jobStyles';

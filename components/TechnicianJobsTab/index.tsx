// TechnicianJobsTab - Modular component structure
// Main component re-export for backward compatibility

export { default } from './TechnicianJobsTab';
export { default as TechnicianJobsTab } from './TechnicianJobsTab';

// Sub-components (for advanced usage)
export { default as StatsGrid } from './components/StatsGrid';
export { default as FilterBar } from './components/FilterBar';
export { default as JobCard } from './components/JobCard';
export { default as EmptyState } from './components/EmptyState';

// Hooks
export { useJobFilters } from './hooks/useJobFilters';
export type { FilterMode, JobFilters, JobStats } from './hooks/useJobFilters';

// Utils
export { getStatusTone, getJobTypeTone, toneStyles } from './utils/jobStyles';
export type { ToneStyle } from './utils/jobStyles';

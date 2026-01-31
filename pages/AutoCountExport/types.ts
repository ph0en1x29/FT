import { User, AutoCountExport, AutoCountExportStatus, Job } from '../../types';

export interface AutoCountExportProps {
  currentUser: User;
  hideHeader?: boolean;
}

export type TabType = 'pending' | 'exported' | 'failed';

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}

export interface ExportStats {
  pending: number;
  exported: number;
  failed: number;
  pendingJobs: number;
}

export interface UseAutoCountExportReturn {
  exports: AutoCountExport[];
  pendingJobs: Job[];
  loading: boolean;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedExport: AutoCountExport | null;
  setSelectedExport: (exp: AutoCountExport | null) => void;
  showDetailModal: boolean;
  setShowDetailModal: (show: boolean) => void;
  processing: boolean;
  selectedJobIds: Set<string>;
  filteredExports: AutoCountExport[];
  stats: ExportStats;
  canExport: boolean;
  loadData: () => Promise<void>;
  handleExportJob: (jobId: string) => Promise<void>;
  handleBulkExport: () => Promise<void>;
  handleRetryExport: (exportId: string) => Promise<void>;
  handleCancelExport: (exportId: string) => Promise<void>;
  toggleJobSelection: (jobId: string) => void;
  selectAllJobs: () => void;
  clearSelection: () => void;
}

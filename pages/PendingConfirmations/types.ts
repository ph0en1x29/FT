import { Job, User } from '../../types';

export type TabType = 'parts' | 'jobs';

export interface PendingConfirmationsProps {
  currentUser: User;
  hideHeader?: boolean;
}

export interface JobCardProps {
  job: Job;
  activeTab: TabType;
  processing: boolean;
  canConfirm: boolean;
  onConfirmParts: (jobId: string) => void;
  onConfirmJob: (jobId: string) => void;
  onSkipParts: (jobId: string) => void;
  onReject: (jobId: string, type: 'parts' | 'job') => void;
  onNavigate: (jobId: string) => void;
}

export interface TabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  partsCount: number;
  jobsCount: number;
}

export interface SummaryCardsProps {
  partsPending: number;
  jobsPending: number;
  overdueCount: number;
  confirmedToday: number;
}

export interface RejectionModalProps {
  isOpen: boolean;
  rejectionType: 'parts' | 'job';
  rejectionReason: string;
  processing: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onReject: () => void;
}

export interface HeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

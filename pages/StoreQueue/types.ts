import type { User } from '../../types';

export type QueueItemType = 'part_request' | 'confirm_job';
export type FilterType = 'all' | 'part_request' | 'confirm_job';

export interface InlinePartRow {
  partId: string;
  quantity: string;
}

export interface QueueItem {
  id: string;
  type: QueueItemType;
  priority: number;
  createdAt: string;
  requestId?: string;
  requestDescription?: string;
  requestedByName?: string;
  adminResponsePartId?: string;
  adminResponseQuantity?: number;
  issuedAt?: string;
  collectedAt?: string;
  jobId: string;
  jobTitle: string;
  jobStatus: string;
  customerName: string;
  technicianName: string;
  forkliftSerial: string;
  completedAt?: string | null;
  partsCount?: number;
  partsTotal?: number;
  partsConfirmedAt?: string;
  jobConfirmedAt?: string;
}

export interface JobGroup {
  jobId: string;
  jobTitle: string;
  customerName: string;
  technicianName: string;
  items: QueueItem[];
  newestCreatedAt: string;
  oldestCreatedAt: string;
  canShowApproveAll: boolean;
}

export interface StoreQueuePageProps {
  currentUser: User;
  hideHeader?: boolean;
}

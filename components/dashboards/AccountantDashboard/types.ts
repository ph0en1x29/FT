/**
 * Shared types for AccountantDashboard components
 */
import { Job, User } from '../../../types';

export interface AccountantDashboardProps {
  currentUser: User;
}

export type UrgencyLevel = 'normal' | 'warning' | 'urgent' | 'critical';

export interface UrgencyStyle {
  border: string;
  badge: string;
  icon: boolean;
}

export interface RevenueDataPoint {
  name: string;
  revenue: number;
}

export interface InvoiceStatusDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface AccountantDashboardData {
  jobs: Job[];
  loading: boolean;
  awaitingFinalization: Job[];
  awaitingAck: Job[];
  completedJobs: Job[];
  completedThisMonth: Job[];
  monthlyRevenue: number;
  totalRevenue: number;
  urgentJobsCount: number;
  totalQueueValue: number;
  revenueData: RevenueDataPoint[];
  invoiceStatusData: InvoiceStatusDataPoint[];
  calculateJobRevenue: (job: Job) => number;
  calculateDaysWaiting: (job: Job) => number;
  getUrgencyLevel: (days: number) => UrgencyLevel;
  getUrgencyStyle: (urgency: UrgencyLevel) => UrgencyStyle;
}

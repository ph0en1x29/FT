import { User } from '../../types';

export interface TechnicianKPIPageProps {
  currentUser: User;
  hideHeader?: boolean;
}

export type DateRange = '7d' | '30d' | '90d' | '365d' | 'custom';

export interface TeamTotals {
  totalJobs: number;
  totalCompleted: number;
  totalRevenue: number;
  avgFTFR: number;
  avgResponseTime: number;
  avgUtilization: number;
  avgJobsPerDay: number;
}

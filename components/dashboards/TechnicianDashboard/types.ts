import { User, Job, JobStatus, JobType } from '../../../types';

export interface TechnicianDashboardProps {
  currentUser: User;
}

export interface DashboardStats {
  todayJobs: Job[];
  inProgressJobs: Job[];
  completedThisWeek: Job[];
  assignedJobs: Job[];
  slotInPending: Job[];
  activeJobs: Job[];
}

export interface StatusColor {
  bg: string;
  text: string;
}

export { JobStatus, JobType };
export type { User, Job };

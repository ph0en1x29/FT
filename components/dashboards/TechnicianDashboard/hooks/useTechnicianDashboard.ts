import { useEffect,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../../services/supabaseService';
import { showToast } from '../../../../services/toastService';
import { DashboardStats,Job,JobStatus,JobType,User } from '../types';

interface UseTechnicianDashboardResult {
  loading: boolean;
  vanStockLow: number;
  stats: DashboardStats;
}

/**
 * Hook for managing Technician Dashboard data and state
 */
export function useTechnicianDashboard(currentUser: User): UseTechnicianDashboardResult {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [vanStockLow, setVanStockLow] = useState(0);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      const jobsData = await MockDb.getJobs(currentUser);
      setJobs(jobsData || []);

      // Check van stock for low items
      try {
        const vanStock = await MockDb.getVanStockByTechnician(currentUser.user_id);
        if (vanStock?.items) {
          const lowItems = vanStock.items.filter(
            (item) => item.quantity <= (item.min_quantity || 2)
          );
          setVanStockLow(lowItems.length);
        }
      } catch {
        // Van stock might not be set up
      }
    } catch {
      showToast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate time boundaries
  const today = new Date();
  const todayStr = today.toDateString();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);

  // Today's jobs - sorted chronologically
  const todayJobs = jobs
    .filter((j) => {
      const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
      return (
        scheduled &&
        scheduled.toDateString() === todayStr &&
        !['Completed', 'Cancelled'].includes(j.status)
      );
    })
    .sort((a, b) => {
      const aTime = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
      const bTime = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      return aTime - bTime;
    });

  // Jobs in progress
  const inProgressJobs = jobs.filter((j) => j.status === JobStatus.IN_PROGRESS);

  // Completed this week
  const completedThisWeek = jobs.filter(
    (j) =>
      j.status === JobStatus.COMPLETED &&
      j.completed_at &&
      new Date(j.completed_at) >= weekStart
  );

  // Assigned but not started
  const assignedJobs = jobs.filter((j) => j.status === JobStatus.ASSIGNED);

  // Slot-In jobs pending acknowledgement
  const slotInPending = jobs.filter(
    (j) =>
      j.job_type === JobType.SLOT_IN &&
      !j.acknowledged_at &&
      !['Completed', 'Cancelled'].includes(j.status)
  );

  // All active jobs (not completed/cancelled) - sorted by priority
  const activeJobs = jobs
    .filter((j) => !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status))
    .sort((a, b) => {
      // Slot-In first
      if (a.job_type === JobType.SLOT_IN && b.job_type !== JobType.SLOT_IN) return -1;
      if (b.job_type === JobType.SLOT_IN && a.job_type !== JobType.SLOT_IN) return 1;
      // Then by status priority
      const statusOrder: Record<string, number> = {
        [JobStatus.IN_PROGRESS]: 1,
        [JobStatus.ASSIGNED]: 2,
        [JobStatus.NEW]: 3,
      };
      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    });

  return {
    loading,
    vanStockLow,
    stats: {
      todayJobs,
      inProgressJobs,
      completedThisWeek,
      assignedJobs,
      slotInPending,
      activeJobs,
    },
  };
}

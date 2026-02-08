/**
 * Hook for managing AccountantDashboard data and calculations
 */
import { useEffect,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../../services/supabaseService';
import { showToast } from '../../../../services/toastService';
import { Job,JobStatus,User } from '../../../../types';
import {
AccountantDashboardData,
InvoiceStatusDataPoint,
RevenueDataPoint,
UrgencyLevel,
UrgencyStyle,
} from '../types';

const LABOR_RATE = 150;

export function useAccountantDashboardData(currentUser: User): AccountantDashboardData {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const loadData = async () => {
    try {
      const jobsData = await MockDb.getJobs(currentUser);
      setJobs(jobsData || []);
    } catch (_error: unknown) {
      showToast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Date calculations
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Calculate job revenue
  const calculateJobRevenue = (job: Job): number => {
    const partsUsed = job.parts_used || [];
    const partsCost = partsUsed.reduce(
      (sum, p) => sum + ((p.sell_price_at_time || 0) * (p.quantity || 0)),
      0
    );
    return partsCost + LABOR_RATE;
  };

  // Calculate days waiting since job completion
  const calculateDaysWaiting = (job: Job): number => {
    if (!job.completed_at) return 0;
    return Math.floor(
      (Date.now() - new Date(job.completed_at).getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  // Get urgency level based on days waiting
  const getUrgencyLevel = (days: number): UrgencyLevel => {
    if (days >= 7) return 'critical';
    if (days >= 5) return 'urgent';
    if (days >= 3) return 'warning';
    return 'normal';
  };

  // Get urgency styling
  const getUrgencyStyle = (urgency: UrgencyLevel): UrgencyStyle => {
    switch (urgency) {
      case 'critical':
        return {
          border: 'border-l-4 border-l-red-500 bg-red-50/50',
          badge: 'bg-red-100 text-red-700',
          icon: true,
        };
      case 'urgent':
        return {
          border: 'border-l-4 border-l-orange-500 bg-orange-50/30',
          badge: 'bg-orange-100 text-orange-700',
          icon: false,
        };
      case 'warning':
        return {
          border: 'border-l-4 border-l-yellow-500 bg-yellow-50/30',
          badge: 'bg-yellow-100 text-yellow-700',
          icon: false,
        };
      default:
        return { border: '', badge: 'bg-gray-100 text-gray-600', icon: false };
    }
  };

  // Jobs awaiting finalization (sorted by oldest first - FIFO)
  const awaitingFinalization = jobs
    .filter((j) => j.status === JobStatus.AWAITING_FINALIZATION)
    .sort((a, b) => {
      const aDate = a.completed_at ? new Date(a.completed_at).getTime() : Date.now();
      const bDate = b.completed_at ? new Date(b.completed_at).getTime() : Date.now();
      return aDate - bDate;
    });

  // Completed awaiting acknowledgement
  const awaitingAck = jobs.filter((j) => j.status === JobStatus.COMPLETED_AWAITING_ACK);

  // Completed jobs
  const completedJobs = jobs.filter(
    (j) =>
      j.status === JobStatus.COMPLETED || j.status === JobStatus.COMPLETED_AWAITING_ACK
  );

  // Completed this month
  const completedThisMonth = completedJobs.filter(
    (j) => j.completed_at && new Date(j.completed_at) >= monthStart
  );

  // Revenue calculations
  const totalRevenue = completedJobs.reduce(
    (acc, job) => acc + calculateJobRevenue(job),
    0
  );
  const monthlyRevenue = completedThisMonth.reduce(
    (acc, job) => acc + calculateJobRevenue(job),
    0
  );

  // Urgent jobs and queue value
  const urgentJobsCount = awaitingFinalization.filter(
    (j) => calculateDaysWaiting(j) >= 3
  ).length;
  const totalQueueValue = awaitingFinalization.reduce(
    (acc, job) => acc + calculateJobRevenue(job),
    0
  );

  // Revenue trend (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const revenueData: RevenueDataPoint[] = last7Days.map((date) => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayJobs = completedJobs.filter((j) => {
      const completedDate = j.completed_at ? new Date(j.completed_at) : null;
      return completedDate && completedDate.toDateString() === date.toDateString();
    });
    const dayRevenue = dayJobs.reduce((acc, job) => acc + calculateJobRevenue(job), 0);
    return { name: dayName, revenue: Math.round(dayRevenue) };
  });

  // Invoice status distribution
  const invoiceStatusData: InvoiceStatusDataPoint[] = [
    { name: 'Finalized', value: completedJobs.length, color: '#22c55e' },
    { name: 'Awaiting Finalization', value: awaitingFinalization.length, color: '#8b5cf6' },
    { name: 'Awaiting Ack', value: awaitingAck.length, color: '#f97316' },
  ].filter((d) => d.value > 0);

  return {
    jobs,
    loading,
    awaitingFinalization,
    awaitingAck,
    completedJobs,
    completedThisMonth,
    monthlyRevenue,
    totalRevenue,
    urgentJobsCount,
    totalQueueValue,
    revenueData,
    invoiceStatusData,
    calculateJobRevenue,
    calculateDaysWaiting,
    getUrgencyLevel,
    getUrgencyStyle,
  };
}

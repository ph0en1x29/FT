import { useEffect,useMemo,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { EnhancedTechnicianKPI,Job,JobType,User } from '../../../types';
import { BENCHMARKS } from '../constants';
import { DateRange,TeamTotals } from '../types';
import { getWorkingDays } from '../utils';

interface UseKPIDataReturn {
  technicians: User[];
  loading: boolean;
  technicianKPIs: EnhancedTechnicianKPI[];
  teamTotals: TeamTotals;
  loadData: () => Promise<void>;
}

export const useKPIData = (
  currentUser: User,
  dateRange: DateRange,
  customStartDate: string,
  customEndDate: string
): UseKPIDataReturn => {
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [techData, jobData] = await Promise.all([
        MockDb.getTechnicians(),
        MockDb.getJobs(currentUser),
      ]);
      setTechnicians(techData);
      setAllJobs(jobData);
    } catch (_error) {
      showToast.error('Failed to load KPI data');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter jobs by date range
  const filteredJobs = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (dateRange === 'custom') {
      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
      } else {
        return allJobs;
      }
    } else {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    return allJobs.filter(job => {
      const jobDate = new Date(job.created_at);
      return jobDate >= startDate && jobDate <= endDate;
    });
  }, [allJobs, dateRange, customStartDate, customEndDate]);

  // Calculate Enhanced KPIs for each technician
  const technicianKPIs: EnhancedTechnicianKPI[] = useMemo(() => {
    const now = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : dateRange === '365d' ? 365 : 30;
    const periodStart = dateRange === 'custom' && customStartDate
      ? new Date(customStartDate)
      : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange === 'custom' && customEndDate
      ? new Date(customEndDate)
      : now;
    const workingDays = getWorkingDays(periodStart, periodEnd);

    return technicians.map(tech => {
      const techJobs = filteredJobs.filter(j => j.assigned_technician_id === tech.user_id);
      const completedJobs = techJobs.filter(j =>
        j.status === 'Completed' ||
        j.status === 'Awaiting Finalization' ||
        j.status === 'Completed Awaiting Acknowledgement' ||
        j.status === 'Disputed'
      );

      // First Time Fix Rate
      const callbackJobs = techJobs.filter(j => j.is_callback === true);
      const ftfr = completedJobs.length > 0
        ? ((completedJobs.length - callbackJobs.length) / completedJobs.length) * 100
        : 0;

      // Response time calculation
      const jobsWithArrival = techJobs.filter(j => j.arrival_time && j.assigned_at);
      const avgResponseTime = jobsWithArrival.length > 0
        ? jobsWithArrival.reduce((acc, j) => {
            const assigned = new Date(j.assigned_at || j.created_at).getTime();
            const arrived = new Date(j.arrival_time!).getTime();
            return acc + Math.max(0, (arrived - assigned) / (1000 * 60 * 60));
          }, 0) / jobsWithArrival.length
        : 0;

      // Mean Time to Repair (MTTR)
      const jobsWithRepairTimes = completedJobs.filter(j => j.repair_start_time && j.repair_end_time);
      const mttr = jobsWithRepairTimes.length > 0
        ? jobsWithRepairTimes.reduce((acc, j) => {
            const start = new Date(j.repair_start_time!).getTime();
            const end = new Date(j.repair_end_time!).getTime();
            return acc + Math.max(0, (end - start) / (1000 * 60 * 60));
          }, 0) / jobsWithRepairTimes.length
        : 0;

      // Completion time
      const jobsWithCompletion = completedJobs.filter(j => j.arrival_time && j.completion_time);
      const avgCompletionTime = jobsWithCompletion.length > 0
        ? jobsWithCompletion.reduce((acc, j) => {
            const arrived = new Date(j.arrival_time!).getTime();
            const completed = new Date(j.completion_time!).getTime();
            return acc + Math.max(0, (completed - arrived) / (1000 * 60 * 60));
          }, 0) / jobsWithCompletion.length
        : 0;

      // Total hours worked
      const totalHoursWorked = jobsWithCompletion.reduce((acc, j) => {
        const arrived = new Date(j.arrival_time!).getTime();
        const completed = new Date(j.completion_time!).getTime();
        return acc + Math.max(0, (completed - arrived) / (1000 * 60 * 60));
      }, 0);

      // Utilization & Jobs per day
      const availableHours = workingDays * 8;
      const utilization = availableHours > 0 ? (totalHoursWorked / availableHours) * 100 : 0;
      const jobsPerDay = workingDays > 0 ? completedJobs.length / workingDays : 0;

      // Revenue calculation
      const totalRevenue = completedJobs.reduce((acc, job) => {
        const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
        const laborCost = job.labor_cost || 0;
        const extraCharges = (job.extra_charges || []).reduce((sum, c) => sum + c.amount, 0);
        return acc + partsCost + laborCost + extraCharges;
      }, 0);

      // Job Type Breakdown
      const serviceJobs = techJobs.filter(j => j.job_type === JobType.SERVICE).length;
      const repairJobs = techJobs.filter(j => j.job_type === JobType.REPAIR).length;
      const checkingJobs = techJobs.filter(j => j.job_type === JobType.CHECKING).length;
      const slotInJobs = techJobs.filter(j => j.job_type === JobType.SLOT_IN).length;
      const courierJobs = techJobs.filter(j => j.job_type === JobType.COURIER).length;

      // Priority breakdown
      const priorityBreakdown = {
        emergency: techJobs.filter(j => j.priority === 'Emergency').length,
        high: techJobs.filter(j => j.priority === 'High').length,
        medium: techJobs.filter(j => j.priority === 'Medium').length,
        low: techJobs.filter(j => j.priority === 'Low').length,
      };

      // Calculate scores
      const efficiencyScore = Math.min(100, (
        (ftfr / BENCHMARKS.first_time_fix_rate) * 30 +
        (BENCHMARKS.avg_response_time / Math.max(avgResponseTime, 0.5)) * 30 +
        (utilization / BENCHMARKS.technician_utilization) * 40
      ));
      const productivityScore = Math.min(100, (jobsPerDay / BENCHMARKS.jobs_per_day) * 100);
      const qualityScore = Math.min(100, ftfr);

      return {
        technician_id: tech.user_id,
        technician_name: tech.name,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_jobs_assigned: techJobs.length,
        total_jobs_completed: completedJobs.length,
        completion_rate: techJobs.length > 0 ? (completedJobs.length / techJobs.length) * 100 : 0,
        avg_response_time: avgResponseTime,
        avg_completion_time: avgCompletionTime,
        total_hours_worked: totalHoursWorked,
        jobs_with_callbacks: callbackJobs.length,
        total_revenue_generated: totalRevenue,
        avg_job_value: completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0,
        total_parts_used: completedJobs.reduce((acc, job) =>
          acc + job.parts_used.reduce((sum, p) => sum + p.quantity, 0), 0
        ),
        emergency_jobs: priorityBreakdown.emergency,
        high_priority_jobs: priorityBreakdown.high,
        medium_priority_jobs: priorityBreakdown.medium,
        low_priority_jobs: priorityBreakdown.low,
        first_time_fix_rate: ftfr,
        mean_time_to_repair: mttr,
        technician_utilization: utilization,
        jobs_per_day: jobsPerDay,
        repeat_visit_count: callbackJobs.length,
        service_jobs: serviceJobs,
        repair_jobs: repairJobs,
        checking_jobs: checkingJobs,
        slot_in_jobs: slotInJobs,
        courier_jobs: courierJobs,
        efficiency_score: efficiencyScore,
        productivity_score: productivityScore,
        quality_score: qualityScore,
      };
    }).sort((a, b) => b.efficiency_score - a.efficiency_score);
  }, [technicians, filteredJobs, dateRange, customStartDate, customEndDate]);

  // Team totals
  const teamTotals: TeamTotals = useMemo(() => {
    const activeTechs = technicianKPIs.filter(t => t.total_jobs_assigned > 0);
    return {
      totalJobs: technicianKPIs.reduce((acc, t) => acc + t.total_jobs_assigned, 0),
      totalCompleted: technicianKPIs.reduce((acc, t) => acc + t.total_jobs_completed, 0),
      totalRevenue: technicianKPIs.reduce((acc, t) => acc + t.total_revenue_generated, 0),
      avgFTFR: activeTechs.length > 0
        ? activeTechs.reduce((acc, t) => acc + t.first_time_fix_rate, 0) / activeTechs.length
        : 0,
      avgResponseTime: activeTechs.length > 0
        ? activeTechs.reduce((acc, t) => acc + t.avg_response_time, 0) / activeTechs.filter(t => t.avg_response_time > 0).length || 0
        : 0,
      avgUtilization: activeTechs.length > 0
        ? activeTechs.reduce((acc, t) => acc + t.technician_utilization, 0) / activeTechs.length
        : 0,
      avgJobsPerDay: activeTechs.length > 0
        ? activeTechs.reduce((acc, t) => acc + t.jobs_per_day, 0) / activeTechs.length
        : 0,
    };
  }, [technicianKPIs]);

  return { technicians, loading, technicianKPIs, teamTotals, loadData };
};

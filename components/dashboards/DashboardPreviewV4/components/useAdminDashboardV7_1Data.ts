import { useCallback, useMemo, useState } from 'react';
import { SupabaseDb } from '../../../../services/supabaseService';
import { showToast } from '../../../../services/toastService';
import type { Job, User } from '../../../../types';
import { JobStatus, UserRole } from '../../../../types';
import { useAdminDashboardStockAlerts } from './useAdminDashboardStockAlerts';

interface UseAdminDashboardV7_1DataParams {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

export function useAdminDashboardV7_1Data({
  currentUser,
  jobs,
  users,
  onRefresh,
  navigate,
}: UseAdminDashboardV7_1DataParams) {
  const today = new Date();
  const todayStr = today.toDateString();
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const { lowStockCount, lowStockItems, oosCount, oosItems } = useAdminDashboardStockAlerts();

  const technicians = users.filter(u => u.role === UserRole.TECHNICIAN && u.is_active);
  const jobsByStatus = useMemo(() => {
    const newJobs = jobs.filter(j => j.status === 'New');
    const assigned = jobs.filter(j => j.status === 'Assigned');
    const inProgress = jobs.filter(j => j.status === 'In Progress');
    const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');
    const completed = jobs.filter(j => j.status === 'Completed');
    const overdue = jobs.filter(j => {
      if (['Completed', 'Cancelled', 'Completed Awaiting Acknowledgement'].includes(j.status)) return false;
      const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
      return scheduled && scheduled < new Date(todayStr) && j.status !== 'New';
    });
    const unassigned = jobs.filter(j => !j.assigned_technician_id && !['Completed', 'Cancelled', 'Completed Awaiting Acknowledgement'].includes(j.status));
    const escalated = jobs.filter(j => (j.is_escalated || j.escalation_triggered_at) && !j.escalation_acknowledged_at);
    const awaitingAck = jobs.filter(j => j.status === JobStatus.COMPLETED_AWAITING_ACK);
    const disputed = jobs.filter(j => j.status === 'Disputed');
    const incompleteContinuing = jobs.filter(j => j.status === 'Incomplete - Continuing');
    const dueToday = jobs.filter(j => {
      if (['Completed', 'Cancelled', 'Completed Awaiting Acknowledgement'].includes(j.status)) return false;
      const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
      return scheduled && scheduled.toDateString() === todayStr;
    });
    const completedToday = jobs.filter(j => {
      if (j.status !== 'Completed') return false;
      const done = j.completed_at ? new Date(j.completed_at) : null;
      return done && done.toDateString() === todayStr;
    });

    return { newJobs, assigned, inProgress, awaitingFinalization, completed, overdue, unassigned, escalated, awaitingAck, disputed, incompleteContinuing, dueToday, completedToday };
  }, [jobs, todayStr]);

  const approvalQueue = useMemo(() => {
    const jobMap = new Map<string, { job: Job; type: 'parts' | 'job' | 'escalation' | 'dispute' | 'ack'; priority: number }>();
    const addOrUpgrade = (job: Job, type: 'parts' | 'job' | 'escalation' | 'dispute' | 'ack', priority: number) => {
      const existing = jobMap.get(job.job_id);
      if (!existing || priority < existing.priority) {
        jobMap.set(job.job_id, { job, type, priority });
      }
    };

    jobs.forEach(j => {
      if ((j.is_escalated || j.escalation_triggered_at) && !j.escalation_acknowledged_at) {
        addOrUpgrade(j, 'escalation', 0);
      }
      if (j.status === 'Disputed') {
        addOrUpgrade(j, 'dispute', 1);
      }
      if (j.parts_used?.length > 0 && !j.parts_confirmed_at && !j.parts_confirmation_skipped &&
          ['Awaiting Finalization', 'Completed', 'Completed Awaiting Acknowledgement'].includes(j.status)) {
        addOrUpgrade(j, 'parts', 2);
      }
      if (j.status === JobStatus.COMPLETED_AWAITING_ACK) {
        addOrUpgrade(j, 'ack', 3);
      }
    });

    return Array.from(jobMap.values()).sort((a, b) => a.priority - b.priority);
  }, [jobs]);

  const slaMetrics = useMemo(() => {
    const completedJobs = jobs.filter(j => j.status === 'Completed' && j.completed_at);
    const onTimeJobs = completedJobs.filter(j => {
      const scheduled = j.scheduled_date ? new Date(j.scheduled_date) : null;
      const done = j.completed_at ? new Date(j.completed_at) : null;
      if (!scheduled || !done) return true;
      return done <= new Date(scheduled.getTime() + 24 * 60 * 60 * 1000);
    });
    return {
      onTimeRate: completedJobs.length > 0 ? Math.round((onTimeJobs.length / completedJobs.length) * 100) : 100,
    };
  }, [jobs]);

  const weeklyRevenue = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const completedLastWeek = jobs.filter(j => j.status === 'Completed' && j.completed_at && new Date(j.completed_at) >= weekAgo);
    return completedLastWeek.reduce((acc, job) => {
      const partsCost = (job.parts_used || []).reduce((sum, p) => sum + ((p.sell_price_at_time || 0) * (p.quantity || 0)), 0);
      return acc + partsCost + 150;
    }, 0);
  }, [jobs]);

  const teamStatus = useMemo(() => technicians.map(tech => {
    const techJobs = jobs.filter(j => j.assigned_technician_id === tech.user_id && !['Completed', 'Cancelled', 'Completed Awaiting Acknowledgement'].includes(j.status));
    const activeCount = techJobs.length;
    const status = activeCount === 0 ? 'available' : activeCount >= 3 ? 'overloaded' : 'busy';
    return { tech, activeCount, status: status as 'available' | 'busy' | 'overloaded' };
  }), [technicians, jobs]);
  const availableTechs = teamStatus.filter(t => t.status === 'available').length;

  const todaySchedule = useMemo(() => jobsByStatus.dueToday
    .map(j => {
      const tech = users.find(u => u.user_id === j.assigned_technician_id);
      const scheduledTime = j.scheduled_date ? new Date(j.scheduled_date) : new Date();
      let status: 'completed' | 'in-progress' | 'upcoming' = 'upcoming';
      if (j.status === 'Completed') status = 'completed';
      else if (j.status === 'In Progress') status = 'in-progress';
      return { job: j, tech: tech?.name?.split(' ')[0] || 'Unassigned', time: scheduledTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), status };
    })
    .sort((a, b) => a.time.localeCompare(b.time)), [jobsByStatus.dueToday, users]);

  const techNameMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(u => map.set(u.user_id, u.name?.split(' ')[0] || 'Unknown'));
    return map;
  }, [users]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedApprovalIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedApprovalIds.size === approvalQueue.length) {
      setSelectedApprovalIds(new Set());
    } else {
      setSelectedApprovalIds(new Set(approvalQueue.map(i => i.job.job_id)));
    }
  }, [approvalQueue, selectedApprovalIds.size]);

  const handleBulkConfirmParts = useCallback(async () => {
    const partsItems = approvalQueue.filter(i => i.type === 'parts' && selectedApprovalIds.has(i.job.job_id));
    if (partsItems.length === 0) {
      showToast.error('No parts verification items selected');
      return;
    }
    setProcessing(true);
    let success = 0;
    let failed = 0;
    for (const item of partsItems) {
      try {
        await SupabaseDb.confirmParts(item.job.job_id, currentUser.user_id, currentUser.name, currentUser.role);
        success++;
      } catch {
        failed++;
      }
    }
    setProcessing(false);
    setSelectedApprovalIds(new Set());
    await new Promise(r => setTimeout(r, 300));
    onRefresh();
    if (failed === 0) showToast.success(`${success} job${success > 1 ? 's' : ''} parts confirmed`);
    else showToast.error(`${success} confirmed, ${failed} failed`);
  }, [approvalQueue, selectedApprovalIds, currentUser, onRefresh]);

  const handleBulkFinalize = useCallback(async () => {
    const selectedJobs = jobs.filter(j => selectedApprovalIds.has(j.job_id) && j.status === 'Awaiting Finalization');
    if (selectedJobs.length === 0) {
      showToast.error('No finalization-ready jobs selected');
      return;
    }
    setProcessing(true);
    let success = 0;
    let failed = 0;
    for (const job of selectedJobs) {
      try {
        await SupabaseDb.finalizeInvoice(job.job_id, currentUser.user_id, currentUser.name);
        success++;
      } catch {
        failed++;
      }
    }
    setProcessing(false);
    setSelectedApprovalIds(new Set());
    onRefresh();
    if (failed === 0) showToast.success(`${success} invoice${success > 1 ? 's' : ''} finalized`);
    else showToast.error(`${success} finalized, ${failed} failed`);
  }, [jobs, selectedApprovalIds, currentUser, onRefresh]);

  const handleInlineAssign = useCallback(async (jobId: string, techId: string) => {
    try {
      const tech = users.find(u => u.user_id === techId);
      await SupabaseDb.updateJob(jobId, { assigned_technician_id: techId, assigned_technician_name: tech?.name || '', status: JobStatus.ASSIGNED });
      showToast.success(`Assigned to ${tech?.name?.split(' ')[0]}`);
      onRefresh();
    } catch {
      showToast.error('Failed to assign');
    }
  }, [users, onRefresh]);

  const recentActivity = useMemo(() => jobs
    .filter(j => j.completed_at || j.updated_at)
    .sort((a, b) => {
      const aTime = a.completed_at || a.updated_at || a.created_at;
      const bTime = b.completed_at || b.updated_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    })
    .slice(0, 5)
    .map(j => {
      const time = j.completed_at || j.updated_at || j.created_at;
      const ago = Math.round((Date.now() - new Date(time).getTime()) / 60000);
      const agoText = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
      return { job: j, status: j.status, agoText, techName: j.assigned_technician_id ? techNameMap.get(j.assigned_technician_id) : undefined };
    }), [jobs, techNameMap]);

  const techList = useMemo(() => technicians.map(t => ({ user_id: t.user_id, name: t.name })), [technicians]);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const base = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const firstName = currentUser.name?.split(' ')[0] || 'Admin';
    return `${base}, ${firstName}`;
  }, [currentUser]);

  const urgentCount = jobsByStatus.escalated.length + jobsByStatus.overdue.length + jobsByStatus.disputed.length;
  const totalDueToday = jobsByStatus.dueToday.length + jobsByStatus.completedToday.length;
  const completionPct = totalDueToday > 0 ? Math.round((jobsByStatus.completedToday.length / totalDueToday) * 100) : 0;

  return {
    approvalQueue,
    availableTechs,
    completionPct,
    currentUser,
    greeting,
    handleBulkConfirmParts,
    handleBulkFinalize,
    handleInlineAssign,
    jobs,
    jobsByStatus,
    lowStockCount,
    lowStockItems,
    navigate,
    oosCount,
    oosItems,
    onRefresh,
    processing,
    recentActivity,
    selectAll,
    selectedApprovalIds,
    setSelectedApprovalIds,
    slaMetrics,
    teamStatus,
    techList,
    techNameMap,
    technicians,
    todaySchedule,
    toggleSelection,
    totalDueToday,
    urgentCount,
    weeklyRevenue,
  };
}

export type AdminDashboardV7_1Data = ReturnType<typeof useAdminDashboardV7_1Data>;

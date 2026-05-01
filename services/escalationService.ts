/**
 * Escalation Service
 *
 * Auto-escalates jobs that exceed time thresholds:
 * - Jobs in progress > 24 hours → escalate to admin/supervisor
 * - Slot-In jobs not acknowledged within 15 minutes → escalate
 *
 * Runs on dashboard load for admin/supervisor roles.
 * Only triggers once per job (gated by escalation_triggered_at).
 *
 * Implementation notes (post-2026-05-01 perf sweep):
 * - Admin recipients are fetched once per call, not once per overdue job.
 * - All overdue rows are stamped escalated in a single batched UPDATE.
 * - All notifications are bulk-inserted in one round-trip via
 *   createNotificationsBulk(). The previous per-call createNotification()
 *   path also fanned a 5-minute dedupe SELECT per row — escalation already
 *   gates re-firing through escalation_triggered_at IS NULL, so that extra
 *   layer was pure waste here.
 *
 * Net: previously ~(N × M × 2) round-trips per cron tick (N overdue jobs,
 * M admins). Now 4 round-trips total per check (overdue scan, admin scan,
 * batch update, bulk insert) regardless of N or M.
 */

import { NotificationType } from '../types';
import { createNotificationsBulk } from './notificationService';
import { supabase } from './supabaseClient';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const fetchAdminUserIds = async (roles: string[]): Promise<string[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .in('role', roles)
    .eq('is_active', true);
  if (error || !data) return [];
  return (data as { user_id: string }[]).map(u => u.user_id);
};

interface OverdueJobRow {
  job_id: string;
  title: string | null;
  description: string | null;
  assigned_technician_id: string | null;
  assigned_technician_name: string | null;
  repair_start_time: string | null;
  status: string;
}

interface SlotInJobRow {
  job_id: string;
  title: string | null;
  description: string | null;
  assigned_technician_id: string | null;
  assigned_technician_name: string | null;
  created_at: string;
}

/**
 * Check and escalate overdue jobs (>24h in progress).
 * Returns number of newly escalated jobs.
 */
export async function checkAndEscalateOverdueJobs(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();

    const { data: overdueJobs, error } = await supabase
      .from('jobs')
      .select('job_id, title, description, assigned_technician_id, assigned_technician_name, repair_start_time, status')
      .in('status', ['In Progress', 'Incomplete - Continuing'])
      .is('escalation_triggered_at', null)
      .is('deleted_at', null)
      .lt('repair_start_time', cutoff)
      .not('repair_start_time', 'is', null);

    if (error || !overdueJobs?.length) return 0;
    const jobs = overdueJobs as OverdueJobRow[];

    // Fetch admin recipients once. Empty array is fine — the bulk insert
    // skips and we still stamp escalation_triggered_at.
    const adminIds = await fetchAdminUserIds(['admin', 'admin_service', 'admin_store', 'supervisor']);

    // Stamp escalated in a single batched UPDATE.
    const stampedAt = new Date().toISOString();
    const jobIds = jobs.map(j => j.job_id);
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ escalation_triggered_at: stampedAt })
      .in('job_id', jobIds);
    if (updateError) return 0;

    // Build all notifications in memory, then one bulk insert.
    const notifications = jobs.flatMap(job => {
      const startMs = job.repair_start_time ? new Date(job.repair_start_time).getTime() : Date.now();
      const hoursElapsed = Math.round((Date.now() - startMs) / (1000 * 60 * 60));
      const titleText = job.title || job.description?.slice(0, 50) || 'Untitled job';
      const techText = job.assigned_technician_name || 'Unassigned';
      return adminIds.map(adminId => ({
        user_id: adminId,
        type: NotificationType.ESCALATION,
        title: '⚠️ Job Overdue — 24h Exceeded',
        message: `"${titleText}" assigned to ${techText} has been in progress for ${hoursElapsed}h. Immediate attention required.`,
        reference_type: 'job' as const,
        reference_id: job.job_id,
        priority: 'urgent' as const,
      }));
    });

    if (notifications.length > 0) {
      await createNotificationsBulk(notifications);
    }

    return jobs.length;
  } catch {
    return 0;
  }
}

/**
 * Check and escalate Slot-In jobs not acknowledged within 15 minutes.
 * Returns number of newly escalated jobs.
 */
export async function checkAndEscalateSlotInSLA(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - FIFTEEN_MINUTES_MS).toISOString();

    const { data: unackedSlotIns, error } = await supabase
      .from('jobs')
      .select('job_id, title, description, assigned_technician_id, assigned_technician_name, created_at')
      .eq('job_type', 'Slot-In')
      .is('acknowledged_at', null)
      .is('escalation_triggered_at', null)
      .is('deleted_at', null)
      .not('status', 'in', '("Completed","Cancelled")')
      .lt('created_at', cutoff);

    if (error || !unackedSlotIns?.length) return 0;
    const jobs = unackedSlotIns as SlotInJobRow[];

    const adminIds = await fetchAdminUserIds(['admin', 'admin_service', 'supervisor']);

    const stampedAt = new Date().toISOString();
    const jobIds = jobs.map(j => j.job_id);
    const { error: updateError } = await supabase
      .from('jobs')
      .update({ escalation_triggered_at: stampedAt })
      .in('job_id', jobIds);
    if (updateError) return 0;

    const notifications = jobs.flatMap(job => {
      const minutesWaiting = Math.round((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60));
      const titleText = job.title || job.description?.slice(0, 50) || 'Untitled job';
      const techText = job.assigned_technician_name || 'Unassigned';
      return adminIds.map(adminId => ({
        user_id: adminId,
        type: NotificationType.ESCALATION,
        title: '🚨 Slot-In SLA Breached — Not Acknowledged',
        message: `"${titleText}" assigned to ${techText} has not been acknowledged after ${minutesWaiting} minutes. 15-min SLA exceeded.`,
        reference_type: 'job' as const,
        reference_id: job.job_id,
        priority: 'urgent' as const,
      }));
    });

    if (notifications.length > 0) {
      await createNotificationsBulk(notifications);
    }

    return jobs.length;
  } catch {
    return 0;
  }
}

/**
 * Run all escalation checks. Call this on dashboard load.
 */
export async function runEscalationChecks(): Promise<{ overdue: number; slotIn: number }> {
  const [overdue, slotIn] = await Promise.all([
    checkAndEscalateOverdueJobs(),
    checkAndEscalateSlotInSLA(),
  ]);
  return { overdue, slotIn };
}

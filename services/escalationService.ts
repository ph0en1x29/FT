/**
 * Escalation Service
 * 
 * Auto-escalates jobs that exceed time thresholds:
 * - Jobs in progress > 24 hours → escalate to admin/supervisor
 * - Slot-In jobs not acknowledged within 15 minutes → escalate
 * 
 * Runs on dashboard load for admin/supervisor roles.
 * Only triggers once per job (checks escalation_triggered_at).
 */

import { NotificationType } from '../types';
import { createNotification } from './notificationService';
import { supabase } from './supabaseClient';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Check and escalate overdue jobs (>24h in progress)
 * Returns number of newly escalated jobs
 */
export async function checkAndEscalateOverdueJobs(): Promise<number> {
  try {
    // Find jobs that are In Progress, started > 24h ago, and NOT yet escalated
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

    let escalated = 0;

    for (const job of overdueJobs) {
      // Mark as escalated
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          escalation_triggered_at: new Date().toISOString(),
        })
        .eq('job_id', job.job_id);

      if (updateError) continue;

      // Calculate hours overdue
      const startTime = new Date(job.repair_start_time);
      const hoursElapsed = Math.round((Date.now() - startTime.getTime()) / (1000 * 60 * 60));

      // Notify all admins and supervisors
      const { data: admins } = await supabase
        .from('users')
        .select('user_id')
        .in('role', ['admin', 'admin_service', 'admin_store', 'supervisor'])
        .eq('is_active', true);

      if (admins) {
        for (const admin of admins) {
          await createNotification({
            user_id: admin.user_id,
            type: NotificationType.ESCALATION,
            title: '⚠️ Job Overdue — 24h Exceeded',
            message: `"${job.title || job.description?.slice(0, 50)}" assigned to ${job.assigned_technician_name || 'Unassigned'} has been in progress for ${hoursElapsed}h. Immediate attention required.`,
            reference_type: 'job',
            reference_id: job.job_id,
            priority: 'urgent',
          });
        }
      }

      escalated++;
    }

    return escalated;
  } catch {
    return 0;
  }
}

/**
 * Check and escalate Slot-In jobs not acknowledged within 15 minutes
 * Returns number of newly escalated jobs
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

    let escalated = 0;

    for (const job of unackedSlotIns) {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          escalation_triggered_at: new Date().toISOString(),
        })
        .eq('job_id', job.job_id);

      if (updateError) continue;

      const minutesWaiting = Math.round((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60));

      const { data: admins } = await supabase
        .from('users')
        .select('user_id')
        .in('role', ['admin', 'admin_service', 'supervisor'])
        .eq('is_active', true);

      if (admins) {
        for (const admin of admins) {
          await createNotification({
            user_id: admin.user_id,
            type: NotificationType.ESCALATION,
            title: '🚨 Slot-In SLA Breached — Not Acknowledged',
            message: `"${job.title || job.description?.slice(0, 50)}" assigned to ${job.assigned_technician_name || 'Unassigned'} has not been acknowledged after ${minutesWaiting} minutes. 15-min SLA exceeded.`,
            reference_type: 'job',
            reference_id: job.job_id,
            priority: 'urgent',
          });
        }
      }

      escalated++;
    }

    return escalated;
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

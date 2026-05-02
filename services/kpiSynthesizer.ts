// Pure synthesizer: convert FT DB row shapes (job + status history + children +
// helper assignments) into the spec's TimerEvent log + JobForScoring shape, so
// that utils/kpi/points.ts can score it without knowing FT's storage details.
//
// No Supabase imports. Tested via tests/unit/kpi/synthesizer.spec.ts.

import type { JobType } from '../types/job-core.types';
import type {
  JobForScoring,
  JobScoringStatus,
  TimerEvent,
} from '../types/kpi.types';

// ─── Input row shapes (subset of real DB columns) ─────────────────
export interface JobRowForKpi {
  job_id: string;
  job_type: JobType | string;
  status: string;
  assigned_technician_id: string | null;
  parent_job_id: string | null;
  transfer_override_pts: number | null;
  repair_start_time: string | null;
  repair_end_time: string | null;
  completion_time: string | null;
  completed_at: string | null;
  cutoff_time: string | null;
}

export interface JobStatusHistoryRow {
  history_id: string;
  job_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
}

export interface JobAssignmentRow {
  assignment_id: string;
  job_id: string;
  technician_id: string;
  assignment_type: 'lead' | 'assistant';
  started_at: string | null;
  ended_at: string | null;
  is_active: boolean;
}

export interface ChildJobRow {
  job_id: string;
  parent_job_id: string;
  created_at: string;
  assigned_technician_id: string | null;
}

const STATUS_IN_PROGRESS = 'In Progress';
const STATUS_CONTINUING = 'Incomplete - Continuing';
const STATUS_REASSIGNED = 'Incomplete - Reassigned';
const STATUS_COMPLETED = 'Completed';
const STATUS_AWAITING = 'Awaiting Finalization';

const COMPLETION_STATUSES = new Set([STATUS_COMPLETED, STATUS_AWAITING]);

/**
 * Synthesize the spec's JobForScoring shape from FT row shapes.
 *
 * Strategy:
 *   1. Lead-tech sessions are derived from `job_status_history` transitions
 *      because legacy jobs (pre-2026-05) lack `job_assignments` lead rows.
 *      The lead tech is taken from `jobs.assigned_technician_id`.
 *   2. Assistant-tech sessions come from `job_assignments` rows where
 *      assignment_type='assistant' (these are explicitly tracked with
 *      started_at/ended_at by jobAssignmentBulkService).
 *   3. TRANSFERRED events fire when a child clone exists for this job
 *      (children parameter). Timestamp = clone's created_at.
 *   4. ASSISTANT_ADDED events fire on each assistant assignment's
 *      assigned_at (we use started_at as a proxy when assigned_at not
 *      passed; in practice both are close).
 *
 * If the lead tech is unknown (assigned_technician_id null), no lead events
 * are emitted — the job effectively scores 0 pts.
 */
export function synthesizeJobForScoring(
  job: JobRowForKpi,
  statusHistory: JobStatusHistoryRow[],
  helperAssignments: JobAssignmentRow[],
  children: ChildJobRow[],
): JobForScoring {
  const events: TimerEvent[] = [];
  const leadTechId = job.assigned_technician_id;

  // ── Lead-tech events from status history ──────────────────────
  if (leadTechId) {
    const sortedHistory = [...statusHistory]
      .filter((h) => h.job_id === job.job_id)
      .sort(
        (a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at),
      );

    for (const t of sortedHistory) {
      if (t.new_status === STATUS_IN_PROGRESS && t.old_status !== STATUS_CONTINUING) {
        events.push({
          id: `JS-${t.history_id}`,
          jobId: job.job_id,
          techId: leadTechId,
          type: 'JOB_STARTED',
          timestamp: t.changed_at,
        });
      } else if (
        t.old_status === STATUS_IN_PROGRESS &&
        t.new_status === STATUS_CONTINUING
      ) {
        events.push({
          id: `CT-${t.history_id}`,
          jobId: job.job_id,
          techId: leadTechId,
          type: 'CONTINUE_TOMORROW',
          timestamp: t.changed_at,
          reason: t.reason ?? undefined,
        });
      } else if (
        t.old_status === STATUS_CONTINUING &&
        t.new_status === STATUS_IN_PROGRESS
      ) {
        events.push({
          id: `JR-${t.history_id}`,
          jobId: job.job_id,
          techId: leadTechId,
          type: 'JOB_RESUMED',
          timestamp: t.changed_at,
        });
      } else if (COMPLETION_STATUSES.has(t.new_status)) {
        events.push({
          id: `WC-${t.history_id}`,
          jobId: job.job_id,
          techId: leadTechId,
          type: 'WORK_COMPLETED',
          timestamp: t.changed_at,
        });
      }
    }

    // Fallback: status_history is empty but the job IS completed and has
    // repair_start_time + completion_time. This handles legacy data where
    // the trigger that writes job_status_history hadn't been deployed yet.
    if (
      events.length === 0 &&
      job.repair_start_time &&
      (job.completion_time ?? job.completed_at)
    ) {
      events.push({
        id: `JS-fallback-${job.job_id}`,
        jobId: job.job_id,
        techId: leadTechId,
        type: 'JOB_STARTED',
        timestamp: job.repair_start_time,
      });
      events.push({
        id: `WC-fallback-${job.job_id}`,
        jobId: job.job_id,
        techId: leadTechId,
        type: 'WORK_COMPLETED',
        timestamp: (job.completion_time ?? job.completed_at) as string,
      });
    }
  }

  // ── Assistant-tech events (job_assignments rows for helpers) ──
  for (const asgn of helperAssignments) {
    if (asgn.assignment_type !== 'assistant') continue;
    if (asgn.job_id !== job.job_id) continue;

    // Emit ASSISTANT_ADDED at the moment the helper began work (started_at).
    // We don't have assigned_at in the row shape; started_at is the right
    // anchor anyway because that's when the per-tech timer opens.
    if (asgn.started_at) {
      events.push({
        id: `AA-${asgn.assignment_id}`,
        jobId: job.job_id,
        techId: asgn.technician_id,
        type: 'ASSISTANT_ADDED',
        timestamp: asgn.started_at,
      });
      events.push({
        id: `JR-helper-${asgn.assignment_id}`,
        jobId: job.job_id,
        techId: asgn.technician_id,
        type: 'JOB_RESUMED',
        timestamp: asgn.started_at,
      });
    }

    if (asgn.ended_at) {
      events.push({
        id: `WC-helper-${asgn.assignment_id}`,
        jobId: job.job_id,
        techId: asgn.technician_id,
        type: 'WORK_COMPLETED',
        timestamp: asgn.ended_at,
      });
    }
  }

  // ── Transfer events (parent had children clones) ──────────────
  // Skip if leadTechId is null — TRANSFERRED with empty techId is
  // meaningless to awardJobPoints (would award 0 to "" tech). Per
  // FT-review nit: gate the loop instead of emitting a useless event.
  if (leadTechId) {
    const myChildren = children.filter((c) => c.parent_job_id === job.job_id);
    for (const child of myChildren) {
      events.push({
        id: `TR-${job.job_id}-${child.job_id}`,
        jobId: job.job_id,
        techId: leadTechId,
        type: 'TRANSFERRED',
        timestamp: child.created_at,
        meta: {
          fromTechId: leadTechId,
          toTechId: child.assigned_technician_id ?? undefined,
          clonedJobId: child.job_id,
          parentJobId: job.job_id,
        },
      });
    }
  }

  return {
    id: job.job_id,
    type: job.job_type as JobType,
    parentJobId: job.parent_job_id ?? undefined,
    events,
    status: mapStatus(job.status, job.parent_job_id),
  };
}

function mapStatus(
  ftStatus: string,
  parentJobId: string | null,
): JobScoringStatus {
  if (ftStatus === STATUS_COMPLETED || ftStatus === STATUS_AWAITING)
    return 'completed';
  if (ftStatus === STATUS_CONTINUING) return 'paused';
  if (ftStatus === STATUS_REASSIGNED) return 'transferred';
  // A clone whose parent is set but the clone itself is mid-flight is 'active'
  if (parentJobId !== null) return 'active';
  return 'active';
}

/**
 * Convenience: pull the transferOverride for awardJobPoints from the row.
 */
export function getTransferOverride(
  job: JobRowForKpi,
): 0 | 5 | undefined {
  if (job.transfer_override_pts === 0) return 0;
  if (job.transfer_override_pts === 5) return 5;
  return undefined;
}

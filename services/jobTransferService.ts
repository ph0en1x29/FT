/**
 * Job Transfer Service (KPI Engine Phase 2)
 *
 * Implements KPI_SPEC.md §3.2 — admin-initiated reassignment that creates a
 * cloned child job (`-B`/`-C`/...) for the receiving tech, leaves the parent
 * row visible-but-frozen, and records the per-transfer override (0/5 pts)
 * for the outgoing tech on the parent's `transfer_override_pts` column.
 *
 * Distinguished from `jobAssignmentCrudService.reassignJob`:
 *   - reassignJob: in-place swap of `jobs.assigned_technician_id` (no new row).
 *   - transferJobToTechnician: INSERTs a new clone, links via parent_job_id.
 *
 * Use this for KPI-aware reassignment (when the outgoing tech's labor should
 * be visibly closed and the receiving tech should start from a fresh timer).
 *
 * Atomicity caveat: this performs 5 sequential supabase-js calls. If a step
 * after the clone INSERT fails, you may end up with a clone that lacks media
 * or notes. There is no client-side transaction in @supabase/supabase-js.
 * The clone INSERT is the irreversible commit point — failures after that
 * surface to the caller but the clone is left in place for manual
 * reconciliation.
 */

import type { Job } from '../types';
import { JobStatus as JobStatusEnum, NotificationType } from '../types';
import {
  createNotification,
  notifyJobAssignment,
} from './notificationService';
import { supabase } from './supabaseClient';

const FIRST_CLONE_SUFFIX_CODE = 'B'.charCodeAt(0); // 0x42
const MAX_CLONE_SUFFIX_CODE = 'Z'.charCodeAt(0);   // 25 clones is way past any realistic case

export interface TransferResult {
  parent: Job;
  clone: Job;
}

/**
 * Transfer the job to a different technician, creating a cloned child job.
 *
 * @param jobId          The job to transfer (becomes the "parent"; remains in place).
 * @param toTechnicianId Receiving technician's user_id.
 * @param toTechnicianName Receiving technician's display name.
 * @param reason         Required — admin explanation of why the transfer.
 * @param transferOverridePts 0 (default — outgoing tech gets 0 pts) or 5
 *                            (admin approves partial credit for initial labor).
 * @param actorId        admin user_id triggering the transfer.
 * @param actorName      admin display name.
 */
export async function transferJobToTechnician(
  jobId: string,
  toTechnicianId: string,
  toTechnicianName: string,
  reason: string,
  transferOverridePts: 0 | 5,
  actorId: string,
  actorName: string,
): Promise<TransferResult> {
  if (!reason || !reason.trim()) {
    throw new Error('Transfer requires a reason.');
  }

  // ── 1. Read the parent row (must exist + not deleted + not already
  //       transferred — idempotency guard against double-clone) ──
  const { data: parentRow, error: parentErr } = await supabase
    .from('jobs')
    .select('*')
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .single();
  if (parentErr || !parentRow) {
    throw new Error(`Transfer failed — could not read source job: ${parentErr?.message ?? 'not found'}`);
  }

  if (parentRow.assigned_technician_id === toTechnicianId) {
    throw new Error('Transfer target is the same technician already assigned.');
  }

  if (parentRow.status === 'Incomplete - Reassigned') {
    throw new Error(
      'Job has already been transferred. Refresh and review the existing clone(s) before transferring again.',
    );
  }

  // ── 2. Compute the next suffix and root parent ───────────────
  // Spec invariant: clone's parent_job_id always points to the un-suffixed
  // root original, never to an intermediate clone.
  const rootParentId = parentRow.parent_job_id ?? parentRow.job_id;
  const rootJobNumber = await getRootJobNumber(rootParentId, parentRow);

  const { count, error: countErr } = await supabase
    .from('jobs')
    .select('job_id', { count: 'exact', head: true })
    .eq('parent_job_id', rootParentId)
    .is('deleted_at', null);
  if (countErr) throw countErr;

  const childIndex = count ?? 0;
  const suffixCode = FIRST_CLONE_SUFFIX_CODE + childIndex;
  if (suffixCode > MAX_CLONE_SUFFIX_CODE) {
    throw new Error(
      `Cannot transfer: this job already has ${childIndex} clones (suffix exhausted at -Z).`,
    );
  }
  const cloneJobNumber = `${rootJobNumber}-${String.fromCharCode(suffixCode)}`;

  // ── 3. INSERT the clone (commit point — past here, parent is touched) ──
  const now = new Date();
  const cloneInsert = buildCloneInsertPayload(
    parentRow,
    rootParentId,
    cloneJobNumber,
    toTechnicianId,
    toTechnicianName,
    actorId,
    actorName,
    now,
  );

  const { data: cloneRow, error: cloneErr } = await supabase
    .from('jobs')
    .insert(cloneInsert)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
      extra_charges:extra_charges(*)
    `)
    .single();
  if (cloneErr || !cloneRow) {
    // Postgres UNIQUE violation = 23505. The most common cause here is two
    // concurrent transfers both picking the same -B/-C suffix (count-then-
    // insert race in step 2). Surface a friendly recovery message.
    if (cloneErr?.code === '23505') {
      throw new Error(
        `Transfer race detected — another transfer just created job ${cloneJobNumber}. Reload and try again with the next available suffix.`,
      );
    }
    throw new Error(`Transfer failed — clone INSERT failed: ${cloneErr?.message ?? 'unknown'}`);
  }
  const clone = cloneRow as Job;

  // ── 4. Copy media rows from parent to clone ────────────────
  await copyMediaToClone(parentRow.job_id, clone.job_id);

  // ── 5. Mark the parent transferred + record override pts ──
  const transferReasonNote = `Transferred to ${toTechnicianName} (clone ${cloneJobNumber}): ${reason}`;
  const newNotes = appendTransferNote(parentRow.notes, transferReasonNote, now);
  const { data: parentUpdated, error: updateErr } = await supabase
    .from('jobs')
    .update({
      status: JobStatusEnum.INCOMPLETE_REASSIGNED,
      transfer_override_pts: transferOverridePts,
      notes: newNotes,
      reassigned_at: now.toISOString(),
      reassigned_by_id: actorId,
      reassigned_by_name: actorName,
    })
    .eq('job_id', jobId)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
      extra_charges:extra_charges(*)
    `)
    .single();
  if (updateErr || !parentUpdated) {
    throw new Error(`Transfer half-done — clone created (${cloneJobNumber}) but parent update failed: ${updateErr?.message ?? 'unknown'}`);
  }

  // ── 6. End any active job_assignments on the parent. We don't throw on
  //       failure here (the clone is already created and the parent is
  //       already marked) but we do surface the error via the toast layer
  //       by re-throwing — the assignment state being stale is a real bug
  //       the user needs to know about.
  const { error: asgmtErr } = await supabase
    .from('job_assignments')
    .update({ is_active: false, ended_at: now.toISOString() })
    .eq('job_id', jobId)
    .eq('is_active', true);
  if (asgmtErr) {
    // Don't throw — clone + parent already mutated. Log so it surfaces in
    // Sentry / dev console; admin can manually deactivate the assignment.
    console.error(
      `[jobTransferService] Transfer of ${jobId} succeeded but failed to end active assignments: ${asgmtErr.message}. Manual cleanup may be required.`,
    );
  }

  // ── 7. Notifications (non-blocking — failures don't roll back) ──
  await notifyJobAssignment(toTechnicianId, clone);
  if (parentRow.assigned_technician_id) {
    await createNotification({
      user_id: parentRow.assigned_technician_id,
      type: NotificationType.JOB_UPDATED,
      title: 'Job Transferred',
      message: `Job "${parentRow.title}" has been transferred to ${toTechnicianName} (new job ${cloneJobNumber}).`,
      reference_type: 'job',
      reference_id: jobId,
      priority: 'normal',
    });
  }

  return { parent: parentUpdated as Job, clone };
}

// ─── Internal helpers ─────────────────────────────────────────────

async function getRootJobNumber(
  rootParentId: string,
  parentRow: { job_id: string; parent_job_id: string | null; job_number: string },
): Promise<string> {
  if (parentRow.parent_job_id == null) return parentRow.job_number;
  const { data, error } = await supabase
    .from('jobs')
    .select('job_number')
    .eq('job_id', rootParentId)
    .single();
  if (error || !data) {
    throw new Error('Could not resolve root parent job_number for clone suffix.');
  }
  return data.job_number as string;
}

interface ParentRowForClone {
  job_id: string;
  job_number: string;
  job_type: string;
  title: string | null;
  description: string | null;
  customer_id: string | null;
  forklift_id: string | null;
  contact_id: string | null;
  site_id: string | null;
  priority: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  notes: unknown;
  reported_issue: string | null;
  hourmeter_reading: number | null;
  service_interval: number | null;
  is_callback: boolean | null;
  callback_parent_job_id: string | null;
  is_accident: boolean | null;
  accident_notes: string | null;
  billing_path: string | null;
  billing_path_reason: string | null;
  parent_job_id: string | null;
  assigned_technician_id: string | null;
}

/**
 * Build the INSERT payload for the clone. Carries forward customer/forklift
 * context, scheduling, and reported issue. Resets timer/completion fields so
 * the receiving tech starts fresh per spec §3.2.
 */
function buildCloneInsertPayload(
  parent: ParentRowForClone,
  rootParentId: string,
  cloneJobNumber: string,
  toTechnicianId: string,
  toTechnicianName: string,
  actorId: string,
  actorName: string,
  now: Date,
): Record<string, unknown> {
  return {
    // Identity (overrides trigger because job_number is non-null)
    job_number: cloneJobNumber,
    parent_job_id: rootParentId,

    // Carry forward context
    job_type: parent.job_type,
    title: parent.title,
    description: parent.description,
    customer_id: parent.customer_id,
    forklift_id: parent.forklift_id,
    contact_id: parent.contact_id,
    site_id: parent.site_id,
    priority: parent.priority,
    scheduled_date: parent.scheduled_date,
    scheduled_time: parent.scheduled_time,
    notes: parent.notes ?? [],
    reported_issue: parent.reported_issue,
    hourmeter_reading: parent.hourmeter_reading,
    service_interval: parent.service_interval,
    is_accident: parent.is_accident ?? false,
    accident_notes: parent.accident_notes,
    billing_path: parent.billing_path,
    billing_path_reason: parent.billing_path_reason,

    // Callback chain stays linked to the original (this is a transfer, not a
    // callback; preserve any callback context the parent already had).
    is_callback: parent.is_callback ?? false,
    callback_parent_job_id: parent.callback_parent_job_id,

    // Fresh assignment for receiving tech (assigned_at triggers
    // set_technician_response_deadline → 15-min accept window).
    assigned_technician_id: toTechnicianId,
    assigned_technician_name: toTechnicianName,
    assigned_at: now.toISOString(),
    assigned_by_id: actorId,
    assigned_by_name: actorName,

    // Status begins as Assigned (receiving tech accepts before working)
    status: JobStatusEnum.ASSIGNED,

    // Reset timer fields per spec (clone starts fresh)
    repair_start_time: null,
    repair_end_time: null,
    completion_time: null,
    completed_at: null,
    cutoff_time: null,
    technician_accepted_at: null,
    technician_rejected_at: null,
    technician_rejection_reason: null,
    // Strip signatures: customer/tech consented to the *original* tech's
    // work; the receiving tech will capture fresh signatures on completion.
    technician_signature: null,
    customer_signature: null,
  };
}

async function copyMediaToClone(
  parentJobId: string,
  cloneJobId: string,
): Promise<void> {
  const { data: parentMedia, error: readErr } = await supabase
    .from('job_media')
    .select('*')
    .eq('job_id', parentJobId);
  if (readErr) throw readErr;
  if (!parentMedia || parentMedia.length === 0) return;

  // Note: signatures in FT are stored as columns on the `jobs` row
  // (technician_signature / customer_signature), not as job_media rows.
  // buildCloneInsertPayload nulls those columns. The defensive category
  // filter below catches a hypothetical future change where signatures
  // might be moved into job_media (security review S2 anticipated this).

  // Strip identity fields and re-point at clone job.
  const inserts = parentMedia
    .filter((m) => {
      const cat = (m as Record<string, unknown>).category as string | undefined;
      return cat !== 'signature' && cat !== 'customer_signature' && cat !== 'technician_signature';
    })
    .map((m) => {
      const {
        // Drop autogen identity
        media_id: _media_id,
        created_at: _created_at,
        ...rest
      } = m as Record<string, unknown>;
      return { ...rest, job_id: cloneJobId };
    });

  if (inserts.length === 0) return;
  const { error: writeErr } = await supabase.from('job_media').insert(inserts);
  if (writeErr) throw writeErr;
}

function appendTransferNote(
  existingNotes: unknown,
  note: string,
  now: Date,
): unknown[] {
  const base = Array.isArray(existingNotes) ? [...existingNotes] : [];
  const stamp = now.toLocaleTimeString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  base.push(`[${stamp}] [Transfer] ${note}`);
  return base;
}

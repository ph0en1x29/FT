// Pure: per-job point allocation respecting Continue / Transfer / Assistance.

import type {
  JobAwardRole,
  JobForScoring,
  JobPointAward,
  TechnicianId,
} from '../../types/kpi.types';
import { JOB_TYPE_POINTS } from '../../types/kpi.types';
import { deriveSessions, laborByTech } from './sessions';

export interface AwardOptions {
  /**
   * Spec §3.2: outgoing tech defaults to 0 pts on Transfer; admin may approve
   * 5 pts for the initial labor.
   */
  transferOverride?: 0 | 5;
}

/**
 * Compute point awards for a single job.
 *
 * Phase 1 supports three shapes:
 *   1. Continue Tomorrow (any number of pause/resume cycles, single tech) →
 *      owner gets 100% of JOB_TYPE_POINTS[type].
 *   2. Transfer (events contain TRANSFERRED) → outgoing tech gets 0 (or 5 via
 *      override). The incoming tech is scored on the *cloned* JobForScoring,
 *      not here — pass the clone in as a separate awardJobPoints call.
 *   3. Assistance (events contain ASSISTANT_ADDED) → split JOB_TYPE_POINTS
 *      pro-rata by laborMs using the largest-remainder method.
 *
 * If the job has not closed (no WORK_COMPLETED / TRANSFERRED), returns [].
 */
export function awardJobPoints(
  job: JobForScoring,
  opts: AwardOptions = {},
): JobPointAward[] {
  const totalPoints = JOB_TYPE_POINTS[job.type];
  if (totalPoints === undefined) return [];

  const sessions = deriveSessions(job.events);
  const labor = laborByTech(sessions);

  const transferEvent = job.events.find((e) => e.type === 'TRANSFERRED');
  const hasAssistant = job.events.some((e) => e.type === 'ASSISTANT_ADDED');
  const isCompleted = job.events.some((e) => e.type === 'WORK_COMPLETED');

  // Case 2: Transfer source job (outgoing tech)
  if (transferEvent) {
    const fromTechId =
      transferEvent.meta?.fromTechId ?? transferEvent.techId;
    const override = opts.transferOverride ?? 0;
    const techLabor = labor.get(fromTechId) ?? 0;
    const totalLabor = sumValues(labor);
    return [
      {
        techId: fromTechId,
        jobId: job.id,
        points: override,
        laborMs: techLabor,
        share: totalLabor > 0 ? techLabor / totalLabor : 0,
        role: 'transferred_out',
      },
    ];
  }

  // Case 3: Assistance — pro-rata split
  if (hasAssistant && isCompleted) {
    return splitProRata(job, totalPoints, labor, sessions);
  }

  // Case 1: simple single-owner completion (Continue Tomorrow OK)
  if (isCompleted) {
    const ownerTechId = sessions[0]?.techId;
    if (!ownerTechId) return [];
    const techLabor = labor.get(ownerTechId) ?? 0;
    return [
      {
        techId: ownerTechId,
        jobId: job.id,
        points: totalPoints,
        laborMs: techLabor,
        share: 1,
        role: 'owner',
      },
    ];
  }

  // Job is still in progress (no closure) — no awards yet
  return [];
}

/**
 * Largest-remainder method (Hare quota) — guarantees the integer awards sum
 * to exactly `totalPoints`, with leftover units allocated to the largest
 * laborMs first per spec invariant #3.
 */
function splitProRata(
  job: JobForScoring,
  totalPoints: number,
  labor: Map<TechnicianId, number>,
  sessions: ReturnType<typeof deriveSessions>,
): JobPointAward[] {
  const totalLabor = sumValues(labor);
  if (totalLabor === 0) return [];

  type Entry = {
    techId: TechnicianId;
    laborMs: number;
    exact: number;
    base: number;
    remainder: number;
  };

  const entries: Entry[] = Array.from(labor.entries()).map(([techId, ms]) => {
    const exact = (ms / totalLabor) * totalPoints;
    const base = Math.floor(exact);
    return { techId, laborMs: ms, exact, base, remainder: exact - base };
  });

  const allocated = entries.reduce((sum, e) => sum + e.base, 0);
  const leftover = totalPoints - allocated;

  // Sort by remainder DESC, then laborMs DESC as tiebreaker.
  const sorted = [...entries].sort(
    (a, b) => b.remainder - a.remainder || b.laborMs - a.laborMs,
  );
  for (let i = 0; i < leftover && i < sorted.length; i++) {
    sorted[i].base += 1;
  }

  const ownerTechId = sessions[0]?.techId;

  return entries.map((e): JobPointAward => ({
    techId: e.techId,
    jobId: job.id,
    points: e.base,
    laborMs: e.laborMs,
    share: e.laborMs / totalLabor,
    role: (e.techId === ownerTechId ? 'owner' : 'assistant') as JobAwardRole,
  }));
}

function sumValues(m: Map<TechnicianId, number>): number {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

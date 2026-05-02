// Pure: derive closed work sessions from a timer-event log.
// No Supabase, no React, no I/O. Tested against KPI_SPEC.md fixtures.

import type {
  TechnicianId,
  TimerEvent,
  WorkSession,
  SessionCloseReason,
} from '../../types/kpi.types';

const OPEN_EVENTS = new Set<TimerEvent['type']>(['JOB_STARTED', 'JOB_RESUMED']);
const CLOSE_EVENTS: Record<string, SessionCloseReason | undefined> = {
  CONTINUE_TOMORROW: 'CONTINUE_TOMORROW',
  WORK_COMPLETED: 'WORK_COMPLETED',
  TRANSFERRED: 'TRANSFERRED',
};

interface OpenSession {
  techId: TechnicianId;
  jobId: string;
  startedAt: string;
}

/**
 * Walk an event log (any order) and produce closed work sessions.
 * Open sessions (no closing event) are dropped per spec edge case #1.
 *
 * Pairing rule: a session opens on JOB_STARTED / JOB_RESUMED for techId T
 * and closes on the *next* CONTINUE_TOMORROW / WORK_COMPLETED / TRANSFERRED
 * event whose techId is T (or whose meta.fromTechId is T for TRANSFERRED).
 *
 * ASSISTANT_ADDED is informational — it does not open or close any session
 * by itself; the assistant's session opens when they next emit JOB_RESUMED
 * or JOB_STARTED.
 */
export function deriveSessions(events: TimerEvent[]): WorkSession[] {
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  const open = new Map<TechnicianId, OpenSession>();
  const out: WorkSession[] = [];

  for (const ev of sorted) {
    if (OPEN_EVENTS.has(ev.type)) {
      // Closing any prior unclosed session for the same tech is intentionally
      // not done here — open sessions are dropped, per spec invariant #1.
      open.set(ev.techId, {
        techId: ev.techId,
        jobId: ev.jobId,
        startedAt: ev.timestamp,
      });
      continue;
    }

    const closeReason = CLOSE_EVENTS[ev.type];
    if (!closeReason) continue;

    // TRANSFERRED carries the outgoing tech in meta.fromTechId; fall back to
    // ev.techId (admin emitting on behalf of the outgoing tech).
    const targetTech =
      ev.type === 'TRANSFERRED'
        ? (ev.meta?.fromTechId ?? ev.techId)
        : ev.techId;

    const session = open.get(targetTech);
    if (!session) continue;

    const startMs = Date.parse(session.startedAt);
    const endMs = Date.parse(ev.timestamp);
    const durationMs = Math.max(0, endMs - startMs);

    out.push({
      techId: session.techId,
      jobId: session.jobId,
      startedAt: session.startedAt,
      endedAt: ev.timestamp,
      durationMs,
      closedBy: closeReason,
    });
    open.delete(targetTech);
  }

  return out;
}

/**
 * Sum durationMs per techId.
 */
export function laborByTech(
  sessions: WorkSession[],
): Map<TechnicianId, number> {
  const out = new Map<TechnicianId, number>();
  for (const s of sessions) {
    out.set(s.techId, (out.get(s.techId) ?? 0) + s.durationMs);
  }
  return out;
}

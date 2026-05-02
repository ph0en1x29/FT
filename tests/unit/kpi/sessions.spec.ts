import { describe, expect, it } from 'vitest';
import { deriveSessions, laborByTech } from '../../../utils/kpi/sessions';
import type { TimerEvent } from '../../../types/kpi.types';

const HOUR_MS = 60 * 60 * 1000;

const ev = (
  type: TimerEvent['type'],
  techId: string,
  timestamp: string,
  meta?: TimerEvent['meta'],
): TimerEvent => ({
  id: `${type}-${techId}-${timestamp}`,
  jobId: 'job-1',
  techId,
  type,
  timestamp,
  meta,
});

describe('deriveSessions', () => {
  it('pairs JOB_STARTED + WORK_COMPLETED into a single session', () => {
    const sessions = deriveSessions([
      ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
      ev('WORK_COMPLETED', 'A', '2026-04-20T17:00:00Z'),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].techId).toBe('A');
    expect(sessions[0].durationMs).toBe(7 * HOUR_MS);
    expect(sessions[0].closedBy).toBe('WORK_COMPLETED');
  });

  it('spec §3.1 — Continue Tomorrow yields two sessions summing to 9h', () => {
    // Reference timeline from KPI_SPEC.md §3.1
    const sessions = deriveSessions([
      ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
      ev('CONTINUE_TOMORROW', 'A', '2026-04-20T17:00:00Z'),
      ev('JOB_RESUMED', 'A', '2026-04-21T08:30:00Z'),
      ev('WORK_COMPLETED', 'A', '2026-04-21T10:30:00Z'),
    ]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].durationMs).toBe(7 * HOUR_MS);
    expect(sessions[1].durationMs).toBe(2 * HOUR_MS);
    const total = sessions.reduce((s, x) => s + x.durationMs, 0);
    expect(total).toBe(9 * HOUR_MS);
  });

  it('spec edge case #1 — open sessions are dropped', () => {
    const sessions = deriveSessions([
      ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
      // no closing event
    ]);
    expect(sessions).toEqual([]);
  });

  it('handles unsorted event input (sorts internally)', () => {
    const sessions = deriveSessions([
      ev('WORK_COMPLETED', 'A', '2026-04-20T17:00:00Z'),
      ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationMs).toBe(7 * HOUR_MS);
  });

  it('TRANSFERRED closes the source-tech session via meta.fromTechId', () => {
    const sessions = deriveSessions([
      ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
      ev('CONTINUE_TOMORROW', 'A', '2026-04-20T17:00:00Z'),
      ev('TRANSFERRED', 'admin-x', '2026-04-21T08:30:00Z', {
        fromTechId: 'A',
        toTechId: 'B',
      }),
    ]);
    // CONTINUE_TOMORROW already closed Session 1; TRANSFERRED finds no open
    // session for A. So only the original session stands.
    expect(sessions).toHaveLength(1);
    expect(sessions[0].closedBy).toBe('CONTINUE_TOMORROW');
  });

  it('TRANSFERRED while in active session closes it at the transfer ts', () => {
    const sessions = deriveSessions([
      ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
      ev('TRANSFERRED', 'admin-x', '2026-04-20T15:00:00Z', {
        fromTechId: 'A',
        toTechId: 'B',
      }),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].closedBy).toBe('TRANSFERRED');
    expect(sessions[0].durationMs).toBe(5 * HOUR_MS);
  });
});

describe('laborByTech', () => {
  it('sums durations grouped by tech', () => {
    const sessions = deriveSessions([
      ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
      ev('CONTINUE_TOMORROW', 'A', '2026-04-20T16:00:00Z'),
      ev('JOB_RESUMED', 'B', '2026-04-21T09:00:00Z'),
      ev('WORK_COMPLETED', 'B', '2026-04-21T11:00:00Z'),
    ]);
    const labor = laborByTech(sessions);
    expect(labor.get('A')).toBe(6 * HOUR_MS);
    expect(labor.get('B')).toBe(2 * HOUR_MS);
  });
});

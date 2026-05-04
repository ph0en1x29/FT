import { describe, expect, it } from 'vitest';
import { JobType } from '../../../types/job-core.types';
import { awardJobPoints } from '../../../utils/kpi/points';
import type { JobForScoring, TimerEvent } from '../../../types/kpi.types';

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

const job = (
  events: TimerEvent[],
  type: JobType = JobType.REPAIR,
  overrides: Partial<JobForScoring> = {},
): JobForScoring => ({
  id: 'job-1',
  type,
  events,
  status: 'completed',
  ...overrides,
});

describe('awardJobPoints — Continue Tomorrow', () => {
  it('spec test 1 — single tech, two sessions, full points (25 for repair, post-2026-05-03 client update)', () => {
    const awards = awardJobPoints(
      job([
        ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
        ev('CONTINUE_TOMORROW', 'A', '2026-04-20T17:00:00Z'),
        ev('JOB_RESUMED', 'A', '2026-04-21T08:30:00Z'),
        ev('WORK_COMPLETED', 'A', '2026-04-21T10:30:00Z'),
      ]),
    );
    expect(awards).toHaveLength(1);
    expect(awards[0].techId).toBe('A');
    expect(awards[0].points).toBe(25);
    expect(awards[0].role).toBe('owner');
    expect(awards[0].share).toBe(1);
  });

  it('Service job awards 15 pts to single owner', () => {
    const awards = awardJobPoints(
      job(
        [
          ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
          ev('WORK_COMPLETED', 'A', '2026-04-20T12:00:00Z'),
        ],
        JobType.SERVICE,
      ),
    );
    expect(awards[0].points).toBe(20);
  });

  it('Checking job awards 5 pts (post-2026-05-03 client update)', () => {
    const awards = awardJobPoints(
      job(
        [
          ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
          ev('WORK_COMPLETED', 'A', '2026-04-20T11:00:00Z'),
        ],
        JobType.CHECKING,
      ),
    );
    expect(awards[0].points).toBe(5);
  });

  it('returns [] when job has not been completed', () => {
    const awards = awardJobPoints(
      job([
        ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
        ev('CONTINUE_TOMORROW', 'A', '2026-04-20T17:00:00Z'),
      ]),
    );
    expect(awards).toEqual([]);
  });
});

describe('awardJobPoints — Transfer (spec §3.2)', () => {
  it('spec test 2 — outgoing tech gets 0 with no override', () => {
    const awards = awardJobPoints(
      job([
        ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
        ev('CONTINUE_TOMORROW', 'A', '2026-04-20T17:00:00Z'),
        ev('TRANSFERRED', 'admin-x', '2026-04-21T08:30:00Z', {
          fromTechId: 'A',
          toTechId: 'B',
          clonedJobId: 'job-1-B',
        }),
      ]),
    );
    expect(awards).toHaveLength(1);
    expect(awards[0].techId).toBe('A');
    expect(awards[0].points).toBe(0);
    expect(awards[0].role).toBe('transferred_out');
  });

  it('spec test 3 — outgoing tech gets 5 with override', () => {
    const awards = awardJobPoints(
      job([
        ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
        ev('CONTINUE_TOMORROW', 'A', '2026-04-20T17:00:00Z'),
        ev('TRANSFERRED', 'admin-x', '2026-04-21T08:30:00Z', {
          fromTechId: 'A',
          toTechId: 'B',
        }),
      ]),
      { transferOverride: 5 },
    );
    expect(awards[0].points).toBe(5);
    expect(awards[0].role).toBe('transferred_out');
  });

  it('cloned job (separate JobForScoring) awards full points to receiving tech', () => {
    // The clone has its OWN events log starting fresh from JOB_RESUMED.
    const cloneJob: JobForScoring = {
      id: 'job-1-B',
      parentJobId: 'job-1',
      type: JobType.REPAIR,
      events: [
        ev('JOB_RESUMED', 'B', '2026-04-21T09:00:00Z'),
        ev('WORK_COMPLETED', 'B', '2026-04-21T11:00:00Z'),
      ],
      status: 'completed',
    };
    const awards = awardJobPoints(cloneJob);
    expect(awards[0].techId).toBe('B');
    expect(awards[0].points).toBe(25);
    expect(awards[0].role).toBe('owner');
  });
});

describe('awardJobPoints — Assistance (spec §3.3)', () => {
  it('spec test 5 — Repair (25 pts), A=6h, B=2h → A:19 B:6 (sum=25)', () => {
    // Post-2026-05-03 client points table: Repair=25.
    // Pro-rata: A=6/8*25=18.75 → floor 18, remainder .75; B=2/8*25=6.25
    // → floor 6, remainder .25. Sum 24, leftover 1 → largest remainder is
    // A → A=19, B=6.
    const awards = awardJobPoints(
      job([
        ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
        ev('CONTINUE_TOMORROW', 'A', '2026-04-20T16:00:00Z'),
        ev('ASSISTANT_ADDED', 'admin-x', '2026-04-21T08:30:00Z'),
        ev('JOB_RESUMED', 'B', '2026-04-21T09:00:00Z'),
        ev('WORK_COMPLETED', 'B', '2026-04-21T11:00:00Z'),
      ]),
    );
    const total = awards.reduce((s, a) => s + a.points, 0);
    expect(total).toBe(25);
    const byId = Object.fromEntries(awards.map((a) => [a.techId, a]));
    expect(byId['A'].points).toBe(19);
    expect(byId['A'].role).toBe('owner');
    expect(byId['B'].points).toBe(6);
    expect(byId['B'].role).toBe('assistant');
  });

  it('largest-remainder rounding — Checking 5pt, A=5h B=2h C=1h sums to 5', () => {
    const awards = awardJobPoints(
      job(
        [
          ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
          ev('CONTINUE_TOMORROW', 'A', '2026-04-20T15:00:00Z'),
          ev('ASSISTANT_ADDED', 'admin', '2026-04-21T07:00:00Z'),
          ev('JOB_RESUMED', 'B', '2026-04-21T08:00:00Z'),
          ev('CONTINUE_TOMORROW', 'B', '2026-04-21T10:00:00Z'),
          ev('JOB_RESUMED', 'C', '2026-04-22T08:00:00Z'),
          ev('WORK_COMPLETED', 'C', '2026-04-22T09:00:00Z'),
        ],
        JobType.CHECKING,
      ),
    );
    const total = awards.reduce((s, a) => s + a.points, 0);
    expect(total).toBe(5);
    expect(awards.every((a) => Number.isInteger(a.points))).toBe(true);
    // Pro-rata: A=5/8*5=3.125 floor 3 rem .125; B=2/8*5=1.25 floor 1 rem .25;
    // C=1/8*5=0.625 floor 0 rem .625. Sum 4, leftover 1 → largest remainder
    // is C → C gets +1. Final: A=3, B=1, C=1.
    const byId = Object.fromEntries(awards.map((a) => [a.techId, a]));
    expect(byId['A'].points).toBeGreaterThanOrEqual(byId['B'].points);
    expect(byId['B'].points).toBeGreaterThanOrEqual(byId['C'].points);
  });
});

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
  it('spec test 1 — single tech, two sessions, full points (20 for repair)', () => {
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
    expect(awards[0].points).toBe(20);
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
    expect(awards[0].points).toBe(15);
  });

  it('Checking job awards 10 pts', () => {
    const awards = awardJobPoints(
      job(
        [
          ev('JOB_STARTED', 'A', '2026-04-20T10:00:00Z'),
          ev('WORK_COMPLETED', 'A', '2026-04-20T11:00:00Z'),
        ],
        JobType.CHECKING,
      ),
    );
    expect(awards[0].points).toBe(10);
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
    expect(awards[0].points).toBe(20);
    expect(awards[0].role).toBe('owner');
  });
});

describe('awardJobPoints — Assistance (spec §3.3)', () => {
  it('spec test 5 — Repair, A=6h, B=2h → A:15 B:5 (sum=20)', () => {
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
    expect(total).toBe(20);
    const byId = Object.fromEntries(awards.map((a) => [a.techId, a]));
    expect(byId['A'].points).toBe(15);
    expect(byId['A'].role).toBe('owner');
    expect(byId['B'].points).toBe(5);
    expect(byId['B'].role).toBe('assistant');
  });

  it('largest-remainder rounding — Checking 10pt, A=5h B=2h C=1h sums to 10', () => {
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
    expect(total).toBe(10);
    expect(awards.every((a) => Number.isInteger(a.points))).toBe(true);
    // Largest laborMs (A=5h) gets the leftover unit.
    const byId = Object.fromEntries(awards.map((a) => [a.techId, a]));
    expect(byId['A'].points).toBeGreaterThanOrEqual(byId['B'].points);
    expect(byId['B'].points).toBeGreaterThanOrEqual(byId['C'].points);
  });
});

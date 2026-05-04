import { describe, expect, it } from 'vitest';
import { JobType } from '../../../types/job-core.types';
import {
  getTransferOverride,
  synthesizeJobForScoring,
} from '../../../services/kpiSynthesizer';
import type {
  ChildJobRow,
  JobAssignmentRow,
  JobRowForKpi,
  JobStatusHistoryRow,
} from '../../../services/kpiSynthesizer';
import { awardJobPoints } from '../../../utils/kpi/points';

const baseJob = (
  overrides: Partial<JobRowForKpi> = {},
): JobRowForKpi => ({
  job_id: 'job-1',
  job_type: JobType.REPAIR,
  status: 'Completed',
  assigned_technician_id: 'TECH-A',
  parent_job_id: null,
  transfer_override_pts: null,
  repair_start_time: null,
  repair_end_time: null,
  completion_time: null,
  completed_at: null,
  cutoff_time: null,
  ...overrides,
});

const histRow = (
  old_status: string | null,
  new_status: string,
  changed_at: string,
  history_id = `${old_status}-${new_status}-${changed_at}`,
  job_id = 'job-1',
): JobStatusHistoryRow => ({
  history_id,
  job_id,
  old_status,
  new_status,
  changed_at,
  changed_by: null,
  reason: null,
});

describe('synthesizeJobForScoring — Continue Tomorrow path', () => {
  it('emits JOB_STARTED, CONTINUE_TOMORROW, JOB_RESUMED, WORK_COMPLETED in order', () => {
    const job = baseJob();
    const history = [
      histRow('Assigned', 'In Progress', '2026-04-20T10:00:00Z'),
      histRow('In Progress', 'Incomplete - Continuing', '2026-04-20T17:00:00Z'),
      histRow('Incomplete - Continuing', 'In Progress', '2026-04-21T08:30:00Z'),
      histRow('In Progress', 'Completed', '2026-04-21T10:30:00Z'),
    ];
    const result = synthesizeJobForScoring(job, history, [], []);
    expect(result.events.map((e) => e.type)).toEqual([
      'JOB_STARTED',
      'CONTINUE_TOMORROW',
      'JOB_RESUMED',
      'WORK_COMPLETED',
    ]);
    expect(result.events.every((e) => e.techId === 'TECH-A')).toBe(true);

    // End-to-end through Phase 1 awardJobPoints (Repair = 25 pts post-2026-05-03)
    const awards = awardJobPoints(result);
    expect(awards).toHaveLength(1);
    expect(awards[0].techId).toBe('TECH-A');
    expect(awards[0].points).toBe(25);
    expect(awards[0].role).toBe('owner');
  });

  it('legacy fallback: empty history but repair_start + completion → fabricates two events', () => {
    const job = baseJob({
      repair_start_time: '2026-04-08T03:12:55.114Z',
      completion_time: '2026-04-08T03:46:25.233Z',
    });
    const result = synthesizeJobForScoring(job, [], [], []);
    expect(result.events.map((e) => e.type)).toEqual([
      'JOB_STARTED',
      'WORK_COMPLETED',
    ]);
    const awards = awardJobPoints(result);
    expect(awards[0].points).toBe(25);
  });

  it('no lead tech (assigned_technician_id null) → no events, no awards', () => {
    const job = baseJob({ assigned_technician_id: null });
    const history = [histRow('Assigned', 'In Progress', '2026-04-20T10:00:00Z')];
    const result = synthesizeJobForScoring(job, history, [], []);
    expect(result.events).toEqual([]);
    expect(awardJobPoints(result)).toEqual([]);
  });

  it('treats Awaiting Finalization as completion', () => {
    const job = baseJob({ status: 'Awaiting Finalization' });
    const history = [
      histRow('Assigned', 'In Progress', '2026-04-20T10:00:00Z'),
      histRow('In Progress', 'Awaiting Finalization', '2026-04-20T12:00:00Z'),
    ];
    const result = synthesizeJobForScoring(job, history, [], []);
    expect(result.status).toBe('completed');
    const awards = awardJobPoints(result);
    expect(awards[0].points).toBe(25);
  });
});

describe('synthesizeJobForScoring — Helper / Assistance path', () => {
  it('emits ASSISTANT_ADDED + JOB_RESUMED + WORK_COMPLETED for the helper', () => {
    const job = baseJob();
    const history = [
      histRow('Assigned', 'In Progress', '2026-04-20T10:00:00Z'),
      histRow('In Progress', 'Incomplete - Continuing', '2026-04-20T16:00:00Z'),
      histRow('In Progress', 'Completed', '2026-04-21T11:00:00Z'),
    ];
    const helperAsgn: JobAssignmentRow = {
      assignment_id: 'asgn-1',
      job_id: 'job-1',
      technician_id: 'TECH-B',
      assignment_type: 'assistant',
      started_at: '2026-04-21T09:00:00Z',
      ended_at: '2026-04-21T11:00:00Z',
      is_active: false,
    };
    const result = synthesizeJobForScoring(job, history, [helperAsgn], []);
    const types = result.events.map((e) => e.type);
    expect(types).toContain('ASSISTANT_ADDED');
    expect(types).toContain('WORK_COMPLETED');

    const awards = awardJobPoints(result);
    // TECH-A: 6h (10:00 → 16:00), TECH-B: 2h (09:00 → 11:00)
    // Total 8h, repair = 25 pts (post-2026-05-03 client update)
    // Pro-rata: A=6/8*25=18.75 floor 18 rem .75; B=2/8*25=6.25 floor 6 rem .25
    // Sum 24, leftover 1 → largest remainder is A → A=19, B=6, sum=25
    expect(awards.reduce((s, a) => s + a.points, 0)).toBe(25);
    const byId = Object.fromEntries(awards.map((a) => [a.techId, a]));
    expect(byId['TECH-A'].points).toBe(19);
    expect(byId['TECH-B'].points).toBe(6);
    expect(byId['TECH-B'].role).toBe('assistant');
  });
});

describe('synthesizeJobForScoring — Transfer path', () => {
  it('parent emits TRANSFERRED with fromTechId/toTechId from child clone', () => {
    const parent = baseJob({
      status: 'Incomplete - Reassigned',
      transfer_override_pts: 0,
    });
    const history = [
      histRow('Assigned', 'In Progress', '2026-04-20T10:00:00Z'),
      histRow('In Progress', 'Incomplete - Continuing', '2026-04-20T17:00:00Z'),
    ];
    const child: ChildJobRow = {
      job_id: 'job-1-B',
      parent_job_id: 'job-1',
      created_at: '2026-04-21T08:30:00Z',
      assigned_technician_id: 'TECH-B',
    };
    const result = synthesizeJobForScoring(parent, history, [], [child]);
    const transferred = result.events.find((e) => e.type === 'TRANSFERRED');
    expect(transferred).toBeDefined();
    expect(transferred?.meta?.fromTechId).toBe('TECH-A');
    expect(transferred?.meta?.toTechId).toBe('TECH-B');
    expect(transferred?.meta?.clonedJobId).toBe('job-1-B');

    const awards = awardJobPoints(result, {
      transferOverride: getTransferOverride(parent),
    });
    expect(awards).toHaveLength(1);
    expect(awards[0].techId).toBe('TECH-A');
    expect(awards[0].points).toBe(0);
    expect(awards[0].role).toBe('transferred_out');
  });

  it('with admin override of 5 pts, outgoing tech gets 5', () => {
    const parent = baseJob({
      status: 'Incomplete - Reassigned',
      transfer_override_pts: 5,
    });
    const history = [
      histRow('Assigned', 'In Progress', '2026-04-20T10:00:00Z'),
    ];
    const child: ChildJobRow = {
      job_id: 'job-1-B',
      parent_job_id: 'job-1',
      created_at: '2026-04-21T08:30:00Z',
      assigned_technician_id: 'TECH-B',
    };
    const result = synthesizeJobForScoring(parent, history, [], [child]);
    const awards = awardJobPoints(result, {
      transferOverride: getTransferOverride(parent),
    });
    expect(awards[0].points).toBe(5);
    expect(getTransferOverride(parent)).toBe(5);
  });

  it('clone (parent_job_id set) — separate JobForScoring scored normally', () => {
    const clone = baseJob({
      job_id: 'job-1-B',
      assigned_technician_id: 'TECH-B',
      parent_job_id: 'job-1',
    });
    const history = [
      histRow('Assigned', 'In Progress', '2026-04-21T09:00:00Z', 'h1', 'job-1-B'),
      histRow('In Progress', 'Completed', '2026-04-21T11:00:00Z', 'h2', 'job-1-B'),
    ];
    const result = synthesizeJobForScoring(clone, history, [], []);
    expect(result.parentJobId).toBe('job-1');

    const awards = awardJobPoints(result);
    expect(awards).toHaveLength(1);
    expect(awards[0].techId).toBe('TECH-B');
    expect(awards[0].points).toBe(25);
    expect(awards[0].role).toBe('owner');
  });
});

describe('getTransferOverride', () => {
  it('returns 0 when transfer_override_pts is 0', () => {
    expect(getTransferOverride(baseJob({ transfer_override_pts: 0 }))).toBe(0);
  });
  it('returns 5 when transfer_override_pts is 5', () => {
    expect(getTransferOverride(baseJob({ transfer_override_pts: 5 }))).toBe(5);
  });
  it('returns undefined when null (not transferred)', () => {
    expect(getTransferOverride(baseJob())).toBeUndefined();
  });
});

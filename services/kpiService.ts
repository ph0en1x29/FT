// KPI Engine — high-level orchestrator that wires Phase 1 pure functions to
// the live Supabase data. Public API:
//   * recomputeMonthlyForTech(techId, year, month, actor) → snapshot row
//   * recomputeMonthlyForAllTechs(year, month, actor)     → snapshot rows
//   * loadSnapshot(techId, year, month)                   → snapshot or null
//   * loadLeaderboard(year, month)                        → ranked snapshot rows
//   * loadSnapshotsForTech(techId, monthsBack=12)         → recent history
//
// Spec ref: /home/jay/Downloads/KPI_SPEC.md.

import { supabase } from './supabaseClient';
import {
  awardJobPoints,
  computeAttendance,
  computeMonthlyKpi,
  rankLeaderboard,
} from '../utils/kpi';
import {
  getTransferOverride,
  synthesizeJobForScoring,
  type ChildJobRow,
  type JobAssignmentRow,
  type JobRowForKpi,
  type JobStatusHistoryRow,
} from './kpiSynthesizer';
import type {
  AttendanceInput,
  AttendanceTier,
  JobPointAward,
  KpiMonthlySnapshotRow,
  MonthlyKpiScore,
  TechnicianId,
} from '../types/kpi.types';

// ─── Period helpers ───────────────────────────────────────────────
function periodBounds(year: number, month: number): {
  startISO: string;
  endISO: string;
} {
  const startISO = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const endISO = new Date(Date.UTC(year, month, 1)).toISOString();
  return { startISO, endISO };
}

function getWorkingDaysInMonth(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// ─── Loaders ──────────────────────────────────────────────────────

interface PeriodJobsBundle {
  jobs: JobRowForKpi[];
  history: JobStatusHistoryRow[];
  helpers: JobAssignmentRow[];
  children: ChildJobRow[];
}

async function loadJobsForPeriod(
  year: number,
  month: number,
): Promise<PeriodJobsBundle> {
  const { startISO, endISO } = periodBounds(year, month);

  // Jobs with completion in the period (per our cross-month decision: award
  // attributed to completion month).
  const { data: completedRows, error: completedErr } = await supabase
    .from('jobs')
    .select(
      'job_id, job_type, status, assigned_technician_id, parent_job_id, transfer_override_pts, repair_start_time, repair_end_time, completion_time, completed_at, cutoff_time',
    )
    .gte('completion_time', startISO)
    .lt('completion_time', endISO)
    .is('deleted_at', null);
  if (completedErr) throw completedErr;

  // Also include jobs that were transferred-out in the period (status flip
  // doesn't always coincide with completion_time; the parent gets its
  // award in the month the transfer happened). `reassigned_at` is set by
  // jobTransferService at transfer time. Note: `jobs` does not have an
  // `updated_at` column.
  const { data: transferredRows, error: transferredErr } = await supabase
    .from('jobs')
    .select(
      'job_id, job_type, status, assigned_technician_id, parent_job_id, transfer_override_pts, repair_start_time, repair_end_time, completion_time, completed_at, cutoff_time',
    )
    .eq('status', 'Incomplete - Reassigned')
    .not('transfer_override_pts', 'is', null)
    .gte('reassigned_at', startISO)
    .lt('reassigned_at', endISO)
    .is('deleted_at', null);
  if (transferredErr) throw transferredErr;

  const jobMap = new Map<string, JobRowForKpi>();
  for (const r of (completedRows ?? []) as JobRowForKpi[]) jobMap.set(r.job_id, r);
  for (const r of (transferredRows ?? []) as JobRowForKpi[]) jobMap.set(r.job_id, r);

  const jobs = Array.from(jobMap.values());
  const jobIds = jobs.map((j) => j.job_id);

  if (jobIds.length === 0) {
    return { jobs: [], history: [], helpers: [], children: [] };
  }

  const [historyRes, helpersRes, childrenRes] = await Promise.all([
    supabase
      .from('job_status_history')
      .select('history_id, job_id, old_status, new_status, changed_by, changed_at, reason')
      .in('job_id', jobIds),
    supabase
      .from('job_assignments')
      .select('assignment_id, job_id, technician_id, assignment_type, started_at, ended_at, is_active')
      .in('job_id', jobIds)
      .eq('assignment_type', 'assistant'),
    supabase
      .from('jobs')
      .select('job_id, parent_job_id, created_at, assigned_technician_id')
      .in('parent_job_id', jobIds)
      .is('deleted_at', null),
  ]);
  if (historyRes.error) throw historyRes.error;
  if (helpersRes.error) throw helpersRes.error;
  if (childrenRes.error) throw childrenRes.error;

  return {
    jobs,
    history: (historyRes.data ?? []) as JobStatusHistoryRow[],
    helpers: (helpersRes.data ?? []) as JobAssignmentRow[],
    children: (childrenRes.data ?? []).map((c) => ({
      job_id: c.job_id,
      parent_job_id: c.parent_job_id as string,
      created_at: c.created_at as string,
      assigned_technician_id: c.assigned_technician_id ?? null,
    })),
  };
}

async function loadHolidayDatesInMonth(
  year: number,
  month: number,
): Promise<Set<string>> {
  const { startISO, endISO } = periodBounds(year, month);
  const { data, error } = await supabase
    .from('public_holidays')
    .select('holiday_date')
    .gte('holiday_date', startISO.slice(0, 10))
    .lt('holiday_date', endISO.slice(0, 10));
  if (error) throw error;

  const out = new Set<string>();
  for (const r of data ?? []) {
    const d = new Date(r.holiday_date as string);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.add((r.holiday_date as string).slice(0, 10));
  }
  return out;
}

async function loadAttendanceForTech(
  techId: TechnicianId,
  year: number,
  month: number,
  workingDays: number,
  weekdayHolidays: number,
): Promise<AttendanceInput> {
  const monthStart = periodBounds(year, month).startISO.slice(0, 10);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('employee_leaves')
    .select(
      'user_id, start_date, end_date, total_days, is_half_day, leave_type:leave_types(name)',
    )
    .eq('user_id', techId)
    .eq('status', 'approved')
    .lte('start_date', monthEnd)
    .gte('end_date', monthStart);
  if (error) throw error;

  return aggregateLeavesForTech(
    data ?? [],
    techId,
    year,
    month,
    workingDays,
    weekdayHolidays,
  );
}

interface LeaveRow {
  user_id: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean | null;
  leave_type: { name?: string } | null;
}

/**
 * Pure aggregator: takes a flat list of leave rows (any tech) and returns
 * the AttendanceInput for one tech. Used by both single-tech and batch
 * codepaths so the math stays identical.
 */
function aggregateLeavesForTech(
  leaves: unknown[],
  techId: TechnicianId,
  year: number,
  month: number,
  workingDays: number,
  weekdayHolidays: number,
): AttendanceInput {
  let al = 0;
  let mc = 0;
  let el = 0;
  for (const raw of leaves) {
    const row = raw as LeaveRow;
    if (row.user_id !== techId) continue;
    const ltName = row.leave_type?.name ?? '';
    const days = computeOverlapDays(
      row.start_date,
      row.end_date,
      Boolean(row.is_half_day),
      year,
      month,
    );
    if (ltName === 'Annual Leave') al += days;
    else if (ltName === 'Medical Leave') mc += days;
    else if (ltName === 'Emergency Leave') el += days;
    // Other leave types (Compassionate, Maternity, Replacement, Unpaid)
    // are not counted in the spec's attendance formula. Confirm with
    // client if any of them should reduce attendance.
  }
  return {
    workingDaysInMonth: workingDays,
    annualLeaveDays: al,
    publicHolidayDays: weekdayHolidays,
    medicalLeaveDays: mc,
    emergencyLeaveDays: el,
  };
}

/**
 * Batch loader: one query for ALL techs in the period, used by
 * recomputeMonthlyForAllTechs to avoid N+1 round-trips.
 */
async function loadAllLeavesForPeriod(
  techIds: TechnicianId[],
  year: number,
  month: number,
): Promise<LeaveRow[]> {
  if (techIds.length === 0) return [];
  const monthStart = periodBounds(year, month).startISO.slice(0, 10);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('employee_leaves')
    .select(
      'user_id, start_date, end_date, total_days, is_half_day, leave_type:leave_types(name)',
    )
    .in('user_id', techIds)
    .eq('status', 'approved')
    .lte('start_date', monthEnd)
    .gte('end_date', monthStart);
  if (error) throw error;
  return (data ?? []) as LeaveRow[];
}

/**
 * Compute overlap of [start_date, end_date] with [year, month] in WEEKDAY
 * count. is_half_day → counts as 0.5 if exactly 1 day, otherwise treated as
 * full days (DB validator should already prevent multi-day half-day leaves).
 */
function computeOverlapDays(
  startDate: string,
  endDate: string,
  isHalfDay: boolean,
  year: number,
  month: number,
): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0)); // last day of month
  monthEnd.setUTCHours(23, 59, 59, 999);

  const from = s < monthStart ? monthStart : s;
  const to = e > monthEnd ? monthEnd : e;
  if (from > to) return 0;

  let days = 0;
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor <= to) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  // Defensive clamp (FT-review B1): even though the DB now enforces
  // `is_half_day → start_date = end_date` via a CHECK constraint added in
  // 20260503_kpi_engine_phase2_hardening.sql, clamp here too so a stale
  // row from before the constraint or a future schema change can't inflate
  // attendance silently.
  if (isHalfDay) return Math.min(days, 1) * 0.5;
  return days;
}

async function loadActiveTechnicians(): Promise<{
  user_id: string;
  name: string;
}[]> {
  // Pull techs who have completed at least one job ever — excludes test
  // accounts and not-yet-started new hires from leaderboard noise. They
  // re-appear automatically the moment they complete their first job.
  // Using assigned_technician_id rather than completed_at is intentional:
  // we want anyone who's *been assigned* work, not only those who finished.
  const { data: workedIds, error: workedErr } = await supabase
    .from('jobs')
    .select('assigned_technician_id')
    .not('assigned_technician_id', 'is', null)
    .is('deleted_at', null)
    .limit(10000);
  if (workedErr) throw workedErr;
  const workedSet = new Set(
    (workedIds ?? []).map((r) => r.assigned_technician_id as string),
  );

  const { data, error } = await supabase
    .from('users')
    .select('user_id, name')
    .eq('role', 'technician')
    .neq('employment_status', 'terminated');
  if (error) throw error;
  return ((data ?? []) as { user_id: string; name: string }[]).filter((u) =>
    workedSet.has(u.user_id),
  );
}

// ─── Per-job award computation ────────────────────────────────────

function computeAwardsForBundle(
  bundle: PeriodJobsBundle,
): JobPointAward[] {
  const out: JobPointAward[] = [];
  for (const jobRow of bundle.jobs) {
    const jobForScoring = synthesizeJobForScoring(
      jobRow,
      bundle.history,
      bundle.helpers,
      bundle.children,
    );
    const override = getTransferOverride(jobRow);
    const awards = awardJobPoints(jobForScoring, { transferOverride: override });
    for (const a of awards) out.push(a);
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────

export interface RecomputeOptions {
  /**
   * Override `workingDaysInMonth` (M-F count) to honor a custom calendar.
   * Default: Mon-Fri count of the month.
   */
  workingDaysInMonth?: number;
}

export async function recomputeMonthlyForTech(
  techId: TechnicianId,
  year: number,
  month: number,
  actorUserId: string | null,
  opts: RecomputeOptions = {},
): Promise<KpiMonthlySnapshotRow> {
  const bundle = await loadJobsForPeriod(year, month);
  const holidays = await loadHolidayDatesInMonth(year, month);
  const workingDays = opts.workingDaysInMonth ?? getWorkingDaysInMonth(year, month);

  const attendance = await loadAttendanceForTech(
    techId,
    year,
    month,
    workingDays,
    holidays.size,
  );
  const allAwards = computeAwardsForBundle(bundle);
  const score = computeMonthlyKpi(techId, allAwards, attendance);

  return upsertSnapshot(score, year, month, actorUserId);
}

export async function recomputeMonthlyForAllTechs(
  year: number,
  month: number,
  actorUserId: string | null,
  opts: RecomputeOptions = {},
): Promise<KpiMonthlySnapshotRow[]> {
  const techs = await loadActiveTechnicians();
  const techIds = techs.map((t) => t.user_id);

  // Parallelize the read-side: jobs + holidays + leaves all independent.
  const [bundle, holidays, allLeaves] = await Promise.all([
    loadJobsForPeriod(year, month),
    loadHolidayDatesInMonth(year, month),
    loadAllLeavesForPeriod(techIds, year, month),
  ]);
  const workingDays = opts.workingDaysInMonth ?? getWorkingDaysInMonth(year, month);
  const allAwards = computeAwardsForBundle(bundle);

  // Compute all scores client-side first so any error doesn't leave a
  // half-finished batch in the DB.
  const scores: MonthlyKpiScore[] = techs.map((t) => {
    const attendance = aggregateLeavesForTech(
      allLeaves,
      t.user_id,
      year,
      month,
      workingDays,
      holidays.size,
    );
    return computeMonthlyKpi(t.user_id, allAwards, attendance);
  });

  // Upserts are still serial (Supabase doesn't have a batch-upsert with
  // returning per-row); one write per tech is acceptable since the read-
  // side N+1 is now eliminated.
  const out: KpiMonthlySnapshotRow[] = [];
  for (const score of scores) {
    const row = await upsertSnapshot(score, year, month, actorUserId);
    out.push(row);
  }
  return out;
}

export async function loadSnapshot(
  techId: TechnicianId,
  year: number,
  month: number,
): Promise<KpiMonthlySnapshotRow | null> {
  const { data, error } = await supabase
    .from('kpi_monthly_snapshots')
    .select('*')
    .eq('technician_id', techId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as KpiMonthlySnapshotRow | null;
}

export type LeaderboardRow = KpiMonthlySnapshotRow & {
  technician_name: string | null;
};

export async function loadLeaderboard(
  year: number,
  month: number,
): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from('kpi_monthly_snapshots')
    .select('*, technician:users!technician_id(name)')
    .eq('year', year)
    .eq('month', month)
    .order('total_kpi_score', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const { technician, ...rest } = r as KpiMonthlySnapshotRow & {
      technician?: { name?: string } | null;
    };
    return {
      ...rest,
      technician_name: technician?.name ?? null,
    } as LeaderboardRow;
  });
}

export async function loadSnapshotsForTech(
  techId: TechnicianId,
  monthsBack = 12,
): Promise<KpiMonthlySnapshotRow[]> {
  const { data, error } = await supabase
    .from('kpi_monthly_snapshots')
    .select('*')
    .eq('technician_id', techId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(monthsBack);
  if (error) throw error;
  return (data ?? []) as KpiMonthlySnapshotRow[];
}

// ─── Internal: snapshot upsert ────────────────────────────────────

async function upsertSnapshot(
  score: MonthlyKpiScore,
  year: number,
  month: number,
  actorUserId: string | null,
): Promise<KpiMonthlySnapshotRow> {
  const tier: AttendanceTier = score.attendance.tier;
  // bonus is constrained to 0/20/35 by the DB CHECK + tier table. Validate
  // at the seam so a future tier-table change surfaces here as a TypeScript
  // assertion failure rather than a cryptic constraint violation from PG.
  const rawBonus = score.attendance.bonusPoints;
  if (rawBonus !== 0 && rawBonus !== 20 && rawBonus !== 35) {
    throw new Error(
      `KPI bonus_points must be one of {0, 20, 35} (got ${rawBonus}). Check computeAttendance / TIER_BANDS.`,
    );
  }
  const bonus = rawBonus as 0 | 20 | 35;

  const payload = {
    technician_id: score.techId,
    year,
    month,
    job_points: score.jobPoints,
    attendance_pct: round2(score.attendance.attendancePct),
    bonus_points: bonus,
    tier,
    total_kpi_score: score.totalKpiScore,
    red_flag: score.attendance.redFlag,
    working_days: null,
    net_expected_days: score.attendance.netExpectedDays,
    actual_days_worked: score.attendance.actualDaysWorked,
    computed_by: actorUserId,
  };

  const { data, error } = await supabase
    .from('kpi_monthly_snapshots')
    .upsert(payload, { onConflict: 'technician_id,year,month' })
    .select('*')
    .single();
  if (error) throw error;
  return data as KpiMonthlySnapshotRow;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Phase 3.2 — Dispute / correction notes ───────────────────────

/**
 * Update the `notes` column on a frozen snapshot. Used by admin to record a
 * correction rationale (e.g. "Manual adjustment +5 pts after dispute on
 * Job-260420-003 — admin override approved 2026-05-04"). Does NOT change
 * any of the score columns; that's intentional — corrections are recorded
 * as a paper trail. If the score itself needs to change, recompute.
 *
 * RLS gates this to admin/supervisor at the DB layer (kpi_snapshots_update_admin).
 */
export async function updateSnapshotNotes(
  snapshotId: string,
  notes: string,
): Promise<KpiMonthlySnapshotRow> {
  const { data, error } = await supabase
    .from('kpi_monthly_snapshots')
    .update({ notes })
    .eq('snapshot_id', snapshotId)
    .select('*')
    .single();
  if (error) throw error;
  return data as KpiMonthlySnapshotRow;
}

// ─── Phase 3 polish — Leaves-filed visibility ─────────────────────

/**
 * Count of approved leaves overlapping the period. KpiScoreTab shows this
 * in the header so admin sees at a glance whether the attendance bonus has
 * any signal to work with — if it returns 0 for a month, the bonus is
 * dormant and everyone will tier as Elite regardless of actual presence.
 */
export async function loadLeaveCountForPeriod(
  year: number,
  month: number,
): Promise<number> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const { count, error } = await supabase
    .from('employee_leaves')
    .select('leave_id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .lte('start_date', monthEnd)
    .gte('end_date', monthStart);
  if (error) throw error;
  return count ?? 0;
}

// ─── Phase 3.4 — Recompute reminder queue ─────────────────────────

export interface RecomputePendingRow {
  pending_id: string;
  year: number;
  month: number;
  queued_at: string;
  queued_by: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

/**
 * Returns the unacknowledged reminder rows. KpiScoreTab uses this to surface
 * a banner when a new month is due for recompute.
 */
export async function loadPendingRecomputes(): Promise<RecomputePendingRow[]> {
  const { data, error } = await supabase
    .from('kpi_recompute_pending')
    .select('*')
    .is('acknowledged_at', null)
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RecomputePendingRow[];
}

/**
 * Mark a pending reminder acknowledged. Called automatically after a
 * successful recompute for the matching period.
 */
export async function acknowledgeRecompute(
  year: number,
  month: number,
  actorUserId: string,
): Promise<void> {
  const { error } = await supabase
    .from('kpi_recompute_pending')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: actorUserId,
    })
    .eq('year', year)
    .eq('month', month)
    .is('acknowledged_at', null);
  if (error) throw error;
}

// Re-export utility ranking for UI consumers.
export { rankLeaderboard, computeAttendance };

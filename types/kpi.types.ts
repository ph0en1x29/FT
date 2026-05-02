// =============================================
// KPI ENGINE TYPES (Phase 1)
// =============================================
// Source spec: /home/jay/Downloads/KPI_SPEC.md (KPI030526.docx).
// Pure types only — no Supabase imports. Consumed by utils/kpi/* and the
// services/kpiService.ts loader.

import type { JobType } from './job-core.types';

// ─── Identifiers ──────────────────────────────────────────────────
export type TechnicianId = string;
export type JobId = string;

// ─── Point table ──────────────────────────────────────────────────
// Mapping of FT JobType (capitalized DB values) onto the spec's three
// buckets. Open question #1 in the review: confirm Service / Minor Service /
// Courier with client. Default below — easy to retune since this is the
// single source of truth for point values.
export const JOB_TYPE_POINTS: Record<JobType, number> = {
  // 20 — repair bucket (skilled/complex)
  Repair: 20,
  'Slot-In': 20,
  // 15 — service bucket (planned maintenance + field work)
  Service: 15,
  'Full Service': 15,
  'Minor Service': 15,
  'Field Technical Services': 15,
  // 10 — diagnostic / light bucket
  Checking: 10,
  Courier: 10,
} as JobTypePointsMap;

type JobTypePointsMap = { [K in JobType]: number };

// ─── Timer event log (append-only) ────────────────────────────────
export type TimerEventType =
  | 'JOB_STARTED'
  | 'CONTINUE_TOMORROW'
  | 'JOB_RESUMED'
  | 'WORK_COMPLETED'
  | 'TRANSFERRED'        // Phase 2
  | 'ASSISTANT_ADDED';   // Phase 2

export interface TimerEvent {
  id: string;
  jobId: JobId;
  techId: TechnicianId;
  type: TimerEventType;
  timestamp: string;
  reason?: string;
  meta?: {
    fromTechId?: TechnicianId;
    toTechId?: TechnicianId;
    clonedJobId?: JobId;
    parentJobId?: JobId;
  };
}

// ─── Sessions (derived from events) ───────────────────────────────
export type SessionCloseReason =
  | 'CONTINUE_TOMORROW'
  | 'WORK_COMPLETED'
  | 'TRANSFERRED';

export interface WorkSession {
  techId: TechnicianId;
  jobId: JobId;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  closedBy: SessionCloseReason;
}

// ─── Job + per-job point award ────────────────────────────────────
export type JobScoringStatus = 'active' | 'paused' | 'completed' | 'transferred';

export interface JobForScoring {
  id: JobId;
  type: JobType;
  parentJobId?: JobId;
  events: TimerEvent[];
  status: JobScoringStatus;
}

export type JobAwardRole = 'owner' | 'assistant' | 'transferred_out' | 'incomplete';

export interface JobPointAward {
  techId: TechnicianId;
  jobId: JobId;
  points: number;
  laborMs: number;
  share: number;
  role: JobAwardRole;
}

// ─── Attendance ───────────────────────────────────────────────────
export interface AttendanceInput {
  workingDaysInMonth: number;
  annualLeaveDays: number;
  publicHolidayDays: number;
  medicalLeaveDays: number;
  emergencyLeaveDays: number;
}

export type AttendanceTier = 'elite' | 'steady' | 'warning';

export interface AttendanceResult {
  netExpectedDays: number;
  actualDaysWorked: number;
  attendancePct: number;
  bonusPoints: number;
  tier: AttendanceTier;
  redFlag: boolean;
}

// ─── Monthly KPI score ────────────────────────────────────────────
export interface MonthlyKpiScore {
  techId: TechnicianId;
  jobPoints: number;
  attendance: AttendanceResult;
  totalKpiScore: number;
}

// ─── Snapshot row (mirrors kpi_monthly_snapshots DB table) ────────
export interface KpiMonthlySnapshotRow {
  snapshot_id: string;
  technician_id: TechnicianId;
  year: number;
  month: number;
  job_points: number;
  attendance_pct: number;
  bonus_points: 0 | 20 | 35;
  tier: AttendanceTier;
  total_kpi_score: number;
  red_flag: boolean;
  working_days: number | null;
  net_expected_days: number | null;
  actual_days_worked: number | null;
  computed_at: string;
  computed_by: string | null;
  notes: string | null;
}

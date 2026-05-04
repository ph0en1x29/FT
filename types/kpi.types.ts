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
// Confirmed by client (Shin) 2026-05-03 via WhatsApp — DRAFT proposal,
// pending management sign-off. Easy to retune; this is the single source
// of truth.
export const JOB_TYPE_POINTS: Record<JobType, number> = {
  // High-value: complex / urgent
  'Slot-In': 30,                    // 15-min SLA emergency
  Repair: 25,                       // unplanned breakdown work
  // Mid: planned service work
  Service: 20,                      // UI label "General Service"
  'Full Service': 15,               // UI label "Normal Service"
  'Field Technical Services': 15,   // FTS — replaces Minor Service + Courier
  'Minor Service': 15,              // legacy — defaults to FTS rate
  // Light tasks
  Checking: 5,                      // diagnostic only
  Courier: 5,                       // legacy — light task
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

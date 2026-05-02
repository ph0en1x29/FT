// Pure: monthly rollup + leaderboard ranking.

import type {
  AttendanceInput,
  JobPointAward,
  MonthlyKpiScore,
  TechnicianId,
} from '../../types/kpi.types';
import { computeAttendance } from './attendance';

/**
 * Aggregate every JobPointAward for `techId` and add the attendance bonus.
 * Awards for other techs in the input are ignored — caller may pass the
 * full month's awards across all techs without filtering first.
 */
export function computeMonthlyKpi(
  techId: TechnicianId,
  awards: JobPointAward[],
  attendance: AttendanceInput,
): MonthlyKpiScore {
  const jobPoints = awards
    .filter((a) => a.techId === techId)
    .reduce((sum, a) => sum + a.points, 0);

  const attendanceResult = computeAttendance(attendance);

  return {
    techId,
    jobPoints,
    attendance: attendanceResult,
    totalKpiScore: jobPoints + attendanceResult.bonusPoints,
  };
}

/**
 * Rank scores for the leaderboard view (high → low).
 * Returns a new array — input is not mutated.
 */
export function rankLeaderboard(scores: MonthlyKpiScore[]): MonthlyKpiScore[] {
  return [...scores].sort((a, b) => b.totalKpiScore - a.totalKpiScore);
}

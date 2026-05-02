// Pure: monthly attendance computation per spec §3 step 2 + §4 tier table.

import type {
  AttendanceInput,
  AttendanceResult,
  AttendanceTier,
} from '../../types/kpi.types';

const TIER_BANDS: Array<{
  min: number;
  tier: AttendanceTier;
  bonus: number;
  redFlag: boolean;
}> = [
  { min: 95, tier: 'elite', bonus: 35, redFlag: false },
  { min: 80, tier: 'steady', bonus: 20, redFlag: false },
  { min: 0, tier: 'warning', bonus: 0, redFlag: true },
];

/**
 * Spec edge case #6: when netExpectedDays === 0 (the technician was on
 * AL/PH for every working day in the month), avoid the divide-by-zero
 * and return Elite. They worked 0 of 0 expected days = perfect compliance.
 *
 * Spec edge case #7: MC and EL both reduce actualDaysWorked equally.
 * Open question #4 (EL vs MC weighting) is flagged for client confirmation;
 * change here if they want EL penalized harder.
 */
export function computeAttendance(input: AttendanceInput): AttendanceResult {
  const netExpectedDays =
    input.workingDaysInMonth -
    input.annualLeaveDays -
    input.publicHolidayDays;

  if (netExpectedDays <= 0) {
    return {
      netExpectedDays: 0,
      actualDaysWorked: 0,
      attendancePct: 100,
      bonusPoints: 35,
      tier: 'elite',
      redFlag: false,
    };
  }

  const actualDaysWorked = Math.max(
    0,
    netExpectedDays - input.medicalLeaveDays - input.emergencyLeaveDays,
  );

  const attendancePct = (actualDaysWorked / netExpectedDays) * 100;

  // Tier boundaries are inclusive of the lower bound (spec invariant #8).
  const band = TIER_BANDS.find((b) => attendancePct >= b.min)!;

  return {
    netExpectedDays,
    actualDaysWorked,
    attendancePct,
    bonusPoints: band.bonus,
    tier: band.tier,
    redFlag: band.redFlag,
  };
}

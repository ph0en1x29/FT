import { describe, expect, it } from 'vitest';
import {
  computeMonthlyKpi,
  rankLeaderboard,
} from '../../../utils/kpi/monthly';
import type {
  AttendanceInput,
  JobPointAward,
  MonthlyKpiScore,
} from '../../../types/kpi.types';

const award = (
  techId: string,
  points: number,
  jobId = `j-${Math.random()}`,
): JobPointAward => ({
  techId,
  jobId,
  points,
  laborMs: 0,
  share: 1,
  role: 'owner',
});

describe('computeMonthlyKpi', () => {
  it('sums only the named tech\'s awards and adds attendance bonus', () => {
    const awards: JobPointAward[] = [
      award('A', 20),
      award('A', 15),
      award('B', 20), // should be ignored when scoring A
    ];
    const attendance: AttendanceInput = {
      workingDaysInMonth: 22,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 0,
      emergencyLeaveDays: 0,
    };
    const score = computeMonthlyKpi('A', awards, attendance);
    expect(score.jobPoints).toBe(35);
    expect(score.attendance.tier).toBe('elite');
    expect(score.totalKpiScore).toBe(35 + 35);
  });
});

describe('rankLeaderboard', () => {
  it('spec §4 reference — A=485, B=480, C=440', () => {
    const elite: AttendanceInput = {
      workingDaysInMonth: 100,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 2,
      emergencyLeaveDays: 0,
    }; // 98/100 = 98% → Elite
    const steady: AttendanceInput = {
      workingDaysInMonth: 100,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 15,
      emergencyLeaveDays: 0,
    }; // 85/100 = 85% → Steady
    const warning: AttendanceInput = {
      workingDaysInMonth: 100,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 25,
      emergencyLeaveDays: 0,
    }; // 75/100 = 75% → Warning

    const a = computeMonthlyKpi(
      'A',
      Array.from({ length: 450 }, (_, i) => award('A', 1, `a-${i}`)),
      elite,
    );
    const b = computeMonthlyKpi(
      'B',
      Array.from({ length: 460 }, (_, i) => award('B', 1, `b-${i}`)),
      steady,
    );
    const c = computeMonthlyKpi(
      'C',
      Array.from({ length: 440 }, (_, i) => award('C', 1, `c-${i}`)),
      warning,
    );

    expect(a.totalKpiScore).toBe(485);
    expect(b.totalKpiScore).toBe(480);
    expect(c.totalKpiScore).toBe(440);

    const ranked = rankLeaderboard([c, a, b]);
    expect(ranked.map((r) => r.techId)).toEqual(['A', 'B', 'C']);
  });

  it('does not mutate input array', () => {
    const scores: MonthlyKpiScore[] = [
      {
        techId: 'A',
        jobPoints: 100,
        attendance: {
          netExpectedDays: 22,
          actualDaysWorked: 22,
          attendancePct: 100,
          bonusPoints: 35,
          tier: 'elite',
          redFlag: false,
        },
        totalKpiScore: 135,
      },
      {
        techId: 'B',
        jobPoints: 200,
        attendance: {
          netExpectedDays: 22,
          actualDaysWorked: 22,
          attendancePct: 100,
          bonusPoints: 35,
          tier: 'elite',
          redFlag: false,
        },
        totalKpiScore: 235,
      },
    ];
    const before = scores.map((s) => s.techId).join(',');
    rankLeaderboard(scores);
    const after = scores.map((s) => s.techId).join(',');
    expect(after).toBe(before);
  });
});

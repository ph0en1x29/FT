import { describe, expect, it } from 'vitest';
import { computeAttendance } from '../../../utils/kpi/attendance';

describe('computeAttendance', () => {
  it('spec test 6 — 22 work / 2 AL / 2 MC → 90% Steady +20', () => {
    const r = computeAttendance({
      workingDaysInMonth: 22,
      annualLeaveDays: 2,
      publicHolidayDays: 0,
      medicalLeaveDays: 2,
      emergencyLeaveDays: 0,
    });
    expect(r.netExpectedDays).toBe(20);
    expect(r.actualDaysWorked).toBe(18);
    expect(r.attendancePct).toBe(90);
    expect(r.tier).toBe('steady');
    expect(r.bonusPoints).toBe(20);
    expect(r.redFlag).toBe(false);
  });

  it('spec test 7 — 22 work / 0 leave → 100% Elite +35', () => {
    const r = computeAttendance({
      workingDaysInMonth: 22,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 0,
      emergencyLeaveDays: 0,
    });
    expect(r.attendancePct).toBe(100);
    expect(r.tier).toBe('elite');
    expect(r.bonusPoints).toBe(35);
    expect(r.redFlag).toBe(false);
  });

  it('spec test 8 — 22 work / 5 MC → 77.27% Warning, red flag', () => {
    const r = computeAttendance({
      workingDaysInMonth: 22,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 5,
      emergencyLeaveDays: 0,
    });
    expect(r.netExpectedDays).toBe(22);
    expect(r.actualDaysWorked).toBe(17);
    expect(r.attendancePct).toBeCloseTo(77.27, 1);
    expect(r.tier).toBe('warning');
    expect(r.bonusPoints).toBe(0);
    expect(r.redFlag).toBe(true);
  });

  it('spec edge case #6 — netExpectedDays === 0 returns 100% Elite (no divbyzero)', () => {
    const r = computeAttendance({
      workingDaysInMonth: 5,
      annualLeaveDays: 5,
      publicHolidayDays: 0,
      medicalLeaveDays: 0,
      emergencyLeaveDays: 0,
    });
    expect(r.netExpectedDays).toBe(0);
    expect(r.attendancePct).toBe(100);
    expect(r.tier).toBe('elite');
    expect(r.bonusPoints).toBe(35);
  });

  it('tier boundary — exactly 95% is Elite', () => {
    // 19/20 = 95%
    const r = computeAttendance({
      workingDaysInMonth: 20,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 1,
      emergencyLeaveDays: 0,
    });
    expect(r.attendancePct).toBe(95);
    expect(r.tier).toBe('elite');
  });

  it('tier boundary — exactly 80% is Steady', () => {
    // 16/20 = 80%
    const r = computeAttendance({
      workingDaysInMonth: 20,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 4,
      emergencyLeaveDays: 0,
    });
    expect(r.attendancePct).toBe(80);
    expect(r.tier).toBe('steady');
  });

  it('EL counts equally with MC (spec open Q #4 — current behavior)', () => {
    const withMc = computeAttendance({
      workingDaysInMonth: 22,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 3,
      emergencyLeaveDays: 0,
    });
    const withEl = computeAttendance({
      workingDaysInMonth: 22,
      annualLeaveDays: 0,
      publicHolidayDays: 0,
      medicalLeaveDays: 0,
      emergencyLeaveDays: 3,
    });
    expect(withMc.attendancePct).toBe(withEl.attendancePct);
    expect(withMc.bonusPoints).toBe(withEl.bonusPoints);
  });

  it('AL and PH reduce the denominator equally', () => {
    const withAl = computeAttendance({
      workingDaysInMonth: 22,
      annualLeaveDays: 4,
      publicHolidayDays: 0,
      medicalLeaveDays: 0,
      emergencyLeaveDays: 0,
    });
    const withPh = computeAttendance({
      workingDaysInMonth: 22,
      annualLeaveDays: 0,
      publicHolidayDays: 4,
      medicalLeaveDays: 0,
      emergencyLeaveDays: 0,
    });
    expect(withAl.netExpectedDays).toBe(withPh.netExpectedDays);
    expect(withAl.attendancePct).toBe(withPh.attendancePct);
  });
});

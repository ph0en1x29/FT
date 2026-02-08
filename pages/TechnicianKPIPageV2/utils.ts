
// Calculate working days in period (excluding weekends)
export const getWorkingDays = (startDate: Date, endDate: Date): number => {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return Math.max(count, 1);
};

// Score color utilities
export const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
};

export const getScoreBg = (score: number): string => {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-amber-100';
  return 'bg-red-100';
};

export const getBenchmarkStatus = (
  value: number,
  benchmark: number,
  inverse: boolean = false
): { color: string; icon: string; label: string } => {
  const ratio = inverse ? benchmark / value : value / benchmark;
  if (ratio >= 1) return { color: 'text-green-600', icon: '✓', label: 'Above Target' };
  if (ratio >= 0.8) return { color: 'text-amber-600', icon: '~', label: 'Near Target' };
  return { color: 'text-red-600', icon: '↓', label: 'Below Target' };
};

/**
 * Business Day Utilities for Multi-Day Escalation (#7)
 * 
 * Malaysian business day rules:
 * - Working days: Monday to Saturday
 * - Non-working: Sunday only
 * - Public holidays: Skip (fetched from database)
 * - Timezone: Malaysia (UTC+8)
 */

const MALAYSIA_TZ = 'Asia/Kuala_Lumpur';

/**
 * Format date to YYYY-MM-DD in Malaysia timezone
 */
export function formatDateMalaysia(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: MALAYSIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date is a Sunday in Malaysia timezone
 */
export function isSunday(date: Date): boolean {
  const dayStr = new Intl.DateTimeFormat('en-US', { 
    timeZone: MALAYSIA_TZ, 
    weekday: 'short' 
  }).format(date);
  return dayStr === 'Sun';
}

/**
 * Check if a date is a public holiday
 * @param date - Date to check
 * @param holidays - Array of holiday date strings (YYYY-MM-DD format)
 */
export function isHoliday(date: Date, holidays: string[]): boolean {
  const dateStr = formatDateMalaysia(date);
  return holidays.includes(dateStr);
}

/**
 * Check if a date is a business day (not Sunday, not holiday)
 * @param date - Date to check
 * @param holidays - Array of holiday date strings
 */
export function isBusinessDay(date: Date, holidays: string[]): boolean {
  return !isSunday(date) && !isHoliday(date, holidays);
}

/**
 * Get the next business day from a given date
 * @param date - Starting date
 * @param holidays - Array of holiday date strings
 */
export function getNextBusinessDay(date: Date, holidays: string[]): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  
  while (!isBusinessDay(next, holidays)) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

/**
 * Add business days to a date
 * @param date - Starting date
 * @param days - Number of business days to add
 * @param holidays - Array of holiday date strings
 */
export function addBusinessDays(date: Date, days: number, holidays: string[]): Date {
  const result = new Date(date);
  let added = 0;
  
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result, holidays)) {
      added++;
    }
  }
  
  return result;
}

/**
 * Get escalation time for a job (8:00 AM Malaysia time next business day)
 * @param jobDate - Job assignment or cutoff date
 * @param holidays - Array of holiday date strings
 * @param isOvertime - If true, returns null (no escalation for OT jobs)
 */
export function getEscalationTime(
  jobDate: Date, 
  holidays: string[], 
  isOvertime: boolean = false
): Date | null {
  if (isOvertime) {
    return null; // No escalation for overtime jobs
  }
  
  const nextBizDay = getNextBusinessDay(jobDate, holidays);
  // Set to 8:00 AM Malaysia time (UTC+8)
  // Get the date in Malaysia timezone, then create UTC time for 8 AM MYT
  const dateStr = formatDateMalaysia(nextBizDay);
  // 8 AM MYT = 0 AM UTC (8 - 8 = 0)
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Check if a job should be escalated based on current time
 * @param jobDate - Job assignment or cutoff date
 * @param holidays - Array of holiday date strings
 * @param isOvertime - Overtime flag
 */
export function shouldEscalate(
  jobDate: Date,
  holidays: string[],
  isOvertime: boolean = false
): boolean {
  const escalationTime = getEscalationTime(jobDate, holidays, isOvertime);
  
  if (!escalationTime) {
    return false; // Overtime jobs don't escalate
  }
  
  return new Date() >= escalationTime;
}

/**
 * Format a date for display (Malaysia timezone)
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-MY', {
    timeZone: MALAYSIA_TZ,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a datetime for display (Malaysia timezone)
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-MY', {
    timeZone: MALAYSIA_TZ,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

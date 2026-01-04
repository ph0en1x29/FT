/**
 * Business Day Utilities for Multi-Day Escalation (#7)
 * 
 * Malaysian business day rules:
 * - Working days: Monday to Saturday
 * - Non-working: Sunday only
 * - Public holidays: Skip (fetched from database)
 */

/**
 * Format date to YYYY-MM-DD in local timezone (not UTC)
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date is a Sunday
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Check if a date is a public holiday
 * @param date - Date to check
 * @param holidays - Array of holiday date strings (YYYY-MM-DD format)
 */
export function isHoliday(date: Date, holidays: string[]): boolean {
  const dateStr = formatDateLocal(date);
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
 * Get escalation time for a job (8:00 AM next business day)
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
  // Set to 8:00 AM local time
  nextBizDay.setHours(8, 0, 0, 0);
  
  return nextBizDay;
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
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-MY', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a datetime for display
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-MY', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

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

// Removed: formatDateTime (unused)

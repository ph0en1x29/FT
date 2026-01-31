import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ===================
// DEVELOPMENT HELPERS
// ===================

const isDev = import.meta.env.DEV;

export const logDebug = (...args: unknown[]) => {
  if (isDev) {
    console.log(...args);
  }
};

export const logError = (...args: unknown[]) => {
  if (isDev) {
    console.error(...args);
  }
};

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const isNetworkError = (error: unknown) => {
  const message = (error as Error | undefined)?.message || String(error || '');
  return error instanceof TypeError || /Failed to fetch|NetworkError|ERR_CONNECTION_CLOSED|fetch failed/i.test(message);
};

// ===================
// QUERY PROFILES
// ===================
// Use specific field selections based on use case to minimize data transfer

/**
 * Job query profiles - fetch only what's needed for each use case
 * This dramatically reduces payload size (80+ columns → 10-20 columns)
 */
export const JOB_SELECT = {
  // For job list/cards (minimal - ~500 bytes vs ~10KB per job)
  LIST: `
    job_id,
    title,
    status,
    priority,
    job_type,
    customer_id,
    customer:customers(customer_id, name),
    forklift_id,
    forklift:forklifts!forklift_id(serial_number, make, model),
    assigned_technician_id,
    assigned_technician_name,
    created_at,
    scheduled_date,
    technician_accepted_at,
    technician_rejected_at
  `,
  
  // For job board (with timing info)
  BOARD: `
    job_id,
    title,
    status,
    priority,
    job_type,
    customer_id,
    customer:customers(customer_id, name, address, phone),
    forklift_id,
    forklift:forklifts!forklift_id(serial_number, make, model, type),
    assigned_technician_id,
    assigned_technician_name,
    helper_technician_id,
    arrival_time,
    started_at,
    repair_start_time,
    repair_end_time,
    completed_at,
    technician_accepted_at,
    technician_rejected_at,
    created_at,
    scheduled_date
  `,
  
  // For technician dashboard (with acceptance status)
  TECHNICIAN: `
    job_id,
    title,
    status,
    priority,
    job_type,
    customer:customers(customer_id, name, address, phone),
    forklift:forklifts!forklift_id(serial_number, make, model, type, hourmeter),
    assigned_technician_id,
    assigned_technician_name,
    repair_start_time,
    repair_end_time,
    technician_accepted_at,
    technician_rejected_at,
    technician_response_deadline,
    created_at,
    scheduled_date,
    arrival_time,
    started_at
  `,

  // For full job detail (all fields needed for editing)
  DETAIL: `
    *,
    customer:customers(*),
    forklift:forklifts!forklift_id(*),
    parts_used:job_parts(*),
    media:job_media(*),
    extra_charges:extra_charges(*)
  `,
  
  // For job detail with minimal media (faster initial load)
  DETAIL_FAST: `
    *,
    customer:customers(*),
    forklift:forklifts!forklift_id(*),
    parts_used:job_parts(*),
    media:job_media(media_id, type, category, created_at, description, url),
    extra_charges:extra_charges(*)
  `,
};

// ==========================================================================
// MALAYSIA TIMEZONE HELPERS (UTC+8)
// ==========================================================================

const MALAYSIA_TZ = 'Asia/Kuala_Lumpur';

// Get current time in Malaysia
export function getMalaysiaTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: MALAYSIA_TZ }));
}

// Format date as YYYY-MM-DD in Malaysia timezone
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

// Check if date is Sunday in Malaysia timezone
export function isSundayMalaysia(date: Date): boolean {
  const dayStr = new Intl.DateTimeFormat('en-US', { 
    timeZone: MALAYSIA_TZ, 
    weekday: 'short' 
  }).format(date);
  return dayStr === 'Sun';
}

// Check if date is a holiday (comparing in Malaysia timezone)
export function isHolidayMalaysia(date: Date, holidays: string[]): boolean {
  const dateStr = formatDateMalaysia(date);
  return holidays.includes(dateStr);
}

// Helper: Get next business day at 8 AM Malaysia time
export function getNextBusinessDay8AM(date: Date, holidays: string[]): Date {
  // Start from the next day
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  
  // Skip Sundays and holidays (checking in Malaysia timezone)
  while (isSundayMalaysia(next) || isHolidayMalaysia(next, holidays)) {
    next.setDate(next.getDate() + 1);
  }
  
  // Set to 8:00 AM Malaysia time (UTC+8)
  // Get the date string in Malaysia timezone, then create a new date at 8 AM MYT
  const dateStr = formatDateMalaysia(next);
  // 8 AM MYT = 0 AM UTC (8 - 8 = 0)
  const myt8am = new Date(`${dateStr}T00:00:00.000Z`);
  
  return myt8am;
}

// Add business days to a date (Malaysia timezone)
export function addBusinessDaysMalaysia(date: Date, days: number, holidays: string[]): Date {
  const result = new Date(date);
  let added = 0;
  
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isSundayMalaysia(result) && !isHolidayMalaysia(result, holidays)) {
      added++;
    }
  }
  
  return result;
}

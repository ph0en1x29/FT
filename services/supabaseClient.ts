/**
 * Supabase Client Initialization & Shared Helpers
 * 
 * This module contains:
 * - Supabase client instance
 * - Logging helpers
 * - Storage utilities
 * - Query profiles for optimized fetches
 */

import { createClient } from '@supabase/supabase-js';

// =====================
// CLIENT INITIALIZATION
// =====================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// =====================
// LOGGING HELPERS
// =====================

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

// =====================
// UTILITY HELPERS
// =====================

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const isNetworkError = (error: unknown) => {
  const message = (error as Error | undefined)?.message || String(error || '');
  return error instanceof TypeError || /Failed to fetch|NetworkError|ERR_CONNECTION_CLOSED|fetch failed/i.test(message);
};

// =====================
// STORAGE HELPERS
// =====================

/**
 * Convert base64 data URL to Blob
 */
export const dataURLtoBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * Upload file to Supabase Storage and return file path
 * 
 * SECURITY: Returns path only, NOT public URL. Callers should use
 * getSignedStorageUrl() to generate time-limited access URLs.
 * 
 * @param bucket - Storage bucket name ('signatures' or 'job-photos')
 * @param fileName - Unique file name / path within bucket
 * @param dataURL - Base64 data URL
 * @returns File path of uploaded file (use getSignedStorageUrl for URL)
 */
export const uploadToStorage = async (
  bucket: string,
  fileName: string,
  dataURL: string
): Promise<string> => {
  try {
    const blob = dataURLtoBlob(dataURL);
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: true,
      });
    
    if (error) {
      logError(`[Storage] Upload to ${bucket} failed:`, error.message);
      return dataURL; // Fallback to base64
    }
    
    logDebug(`[Storage] Uploaded to ${bucket}:`, fileName);
    // Return path, not public URL - caller uses getSignedStorageUrl when needed
    return data.path;
  } catch (e) {
    logError('[Storage] Upload error:', e);
    return dataURL; // Fallback to base64
  }
};

/**
 * Get signed URL for storage file with expiration
 * 
 * @param bucket - Storage bucket name
 * @param filePath - Path to file within bucket
 * @param expiresIn - Seconds until URL expires (default 24 hours)
 * @returns Signed URL or null if failed
 */
export const getSignedStorageUrl = async (
  bucket: string,
  filePath: string,
  expiresIn: number = 86400 // 24 hours
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);
    
    if (error) {
      logError(`[Storage] Failed to get signed URL:`, error.message);
      return null;
    }
    
    return data.signedUrl;
  } catch (e) {
    logError('[Storage] Signed URL error:', e);
    return null;
  }
};

// =====================
// QUERY PROFILES
// =====================

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
    technician_rejected_at,
    acknowledged_at
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
    acknowledged_at,
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
    acknowledged_at,
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

// =====================
// MALAYSIA TIMEZONE HELPERS (UTC+8)
// =====================

export const MALAYSIA_TZ = 'Asia/Kuala_Lumpur';

export function getMalaysiaTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: MALAYSIA_TZ }));
}

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

export function isSundayMalaysia(date: Date): boolean {
  const dayStr = new Intl.DateTimeFormat('en-US', { 
    timeZone: MALAYSIA_TZ, 
    weekday: 'short' 
  }).format(date);
  return dayStr === 'Sun';
}

export function isHolidayMalaysia(date: Date, holidays: string[]): boolean {
  const dateStr = formatDateMalaysia(date);
  return holidays.includes(dateStr);
}

export function getNextBusinessDay8AM(date: Date, holidays: string[]): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  
  while (isSundayMalaysia(next) || isHolidayMalaysia(next, holidays)) {
    next.setDate(next.getDate() + 1);
  }
  
  const dateStr = formatDateMalaysia(next);
  const myt8am = new Date(`${dateStr}T00:00:00.000Z`);
  
  return myt8am;
}

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

/**
 * Job AutoCount Service
 *
 * Handles AutoCount export workflow hooks for jobs.
 */

import type { AutoCountExport,Job } from '../types';
import { logDebug } from './supabaseClient';

// =====================
// AUTOCOUNT INTEGRATION (TODO: Implement properly)
// =====================

/**
 * Create an AutoCount export for a job
 * @stub Not yet implemented
 */
export const createAutoCountExport = async (
  jobId: string,
  _userId: string,
  _userName: string
): Promise<void> => {
  logDebug('[JobService] createAutoCountExport called for job:', jobId);
  // TODO: Implement AutoCount integration
  throw new Error('AutoCount export not yet implemented');
};

/**
 * Get all AutoCount exports
 * @stub Returns empty array
 */
export const getAutoCountExports = async (): Promise<AutoCountExport[]> => {
  logDebug('[JobService] getAutoCountExports called');
  // TODO: Implement - query autocount_exports table
  return [];
};

/**
 * Get jobs pending AutoCount export
 * @stub Returns empty array
 */
export const getJobsPendingExport = async (): Promise<Job[]> => {
  logDebug('[JobService] getJobsPendingExport called');
  // TODO: Implement - query jobs where invoice is finalized but not exported
  return [];
};

/**
 * Retry a failed AutoCount export
 * @stub Not yet implemented
 */
export const retryAutoCountExport = async (exportId: string): Promise<void> => {
  logDebug('[JobService] retryAutoCountExport called for:', exportId);
  // TODO: Implement retry logic
  throw new Error('AutoCount retry not yet implemented');
};

/**
 * Cancel an AutoCount export
 * @stub Not yet implemented
 */
export const cancelAutoCountExport = async (exportId: string): Promise<void> => {
  logDebug('[JobService] cancelAutoCountExport called for:', exportId);
  // TODO: Implement cancel logic
  throw new Error('AutoCount cancel not yet implemented');
};

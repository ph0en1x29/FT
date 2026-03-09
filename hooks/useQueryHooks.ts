/**
 * React Query Hooks
 * 
 * Cached hooks for common data fetching patterns.
 * These replace direct API calls with cached, deduplicated queries.
 * 
 * USAGE: Import hooks in your components to get automatic caching:
 * - Data is cached and shared across components
 * - Duplicate requests are deduplicated
 * - Stale data is automatically refreshed in background
 */

import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useCallback,useState } from 'react';
import { searchCustomers } from '../services/customerService';
import { SupabaseDb } from '../services/supabaseService';
import type { Customer } from '../types';
import { JobStatus,User } from '../types';

// Query keys for cache management
export const queryKeys = {
  customers: ['customers'] as const,
  customersForList: ['customers', 'list'] as const,
  forklifts: ['forklifts'] as const,
  forkliftsForList: ['forklifts', 'list'] as const,
  parts: ['parts'] as const,
  partsForList: ['parts', 'list'] as const,
  jobs: (userId: string, status?: JobStatus) => ['jobs', userId, status] as const,
  jobsLightweight: (userId: string, status?: JobStatus) => ['jobs', 'lightweight', userId, status] as const,
  job: (jobId: string) => ['job', jobId] as const,
  jobFast: (jobId: string) => ['job', 'fast', jobId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  notificationCount: (userId: string) => ['notifications', 'count', userId] as const,
  technicians: ['technicians'] as const,
};

/**
 * Cached customer list for dropdowns
 * Stale time: 5 minutes (customer data changes rarely)
 * NOTE: Loads all customers — use useSearchCustomers for large-dataset dropdowns
 */
export const useCustomersForList = () => {
  return useQuery({
    queryKey: queryKeys.customersForList,
    queryFn: () => SupabaseDb.getCustomersForList(),
    staleTime: 5 * 60 * 1000, // 5 minutes — customer data changes rarely
  });
};

/**
 * Server-side customer search hook for Combobox components.
 * Returns only customer_id + name — lightweight, no full cache.
 * 
 * Usage:
 *   const { options, isSearching, search } = useSearchCustomers();
 *   <Combobox options={options} onSearch={search} isSearching={isSearching} ... />
 */
export const useSearchCustomers = (limit = 20) => {
  const [options, setOptions] = useState<Pick<Customer, 'customer_id' | 'name'>[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const results = await searchCustomers(query, limit);
      setOptions(results);
    } catch {
      setOptions([]);
    } finally {
      setIsSearching(false);
    }
  }, [limit]);

  return { options, isSearching, search };
};

/**
 * Cached forklift list for dropdowns
 * Stale time: 5 minutes
 */
export const useForkliftsForList = () => {
  return useQuery({
    queryKey: queryKeys.forkliftsForList,
    queryFn: () => SupabaseDb.getForkliftsForList(),
    staleTime: 5 * 60 * 1000, // 5 minutes — fleet changes rarely
  });
};

/**
 * Cached technician list
 * Stale time: 5 minutes (rarely changes)
 */
export const useTechnicians = () => {
  return useQuery({
    queryKey: queryKeys.technicians,
    queryFn: () => SupabaseDb.getTechnicians(),
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Cached parts list for dropdowns
 * Stale time: 5 minutes (parts rarely change)
 */
export const usePartsForList = () => {
  return useQuery({
    queryKey: queryKeys.partsForList,
    queryFn: () => SupabaseDb.getPartsForList(),
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Full parts list (when full details needed)
 * Stale time: 5 minutes
 */
export const useParts = () => {
  return useQuery({
    queryKey: queryKeys.parts,
    queryFn: () => SupabaseDb.getParts(),
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Cached job detail (fast version with minimal relations)
 * Stale time: 30 seconds
 */
export const useJobFast = (jobId: string | undefined) => {
  return useQuery({
    queryKey: queryKeys.jobFast(jobId || ''),
    queryFn: () => jobId ? SupabaseDb.getJobByIdFast(jobId) : Promise.resolve(null),
    staleTime: 30 * 1000,
    enabled: !!jobId,
  });
};

/**
 * Full job detail (all relations)
 * Stale time: 30 seconds
 */
export const useJob = (jobId: string | undefined) => {
  return useQuery({
    queryKey: queryKeys.job(jobId || ''),
    queryFn: () => jobId ? SupabaseDb.getJobById(jobId) : Promise.resolve(null),
    staleTime: 30 * 1000,
    enabled: !!jobId,
  });
};

/**
 * Cached notification count
 * Stale time: 10 seconds (needs to be fresh)
 */
export const useNotificationCount = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.notificationCount(userId),
    queryFn: () => SupabaseDb.getUnreadNotificationCount(userId),
    staleTime: 30 * 1000, // 30 seconds — cuts polling 3x vs 10s
    enabled: !!userId,
  });
};

/**
 * Cached notifications list
 * Stale time: 30 seconds
 */
export const useNotifications = (userId: string, unreadOnly: boolean = false) => {
  return useQuery({
    queryKey: [...queryKeys.notifications(userId), unreadOnly],
    queryFn: () => SupabaseDb.getNotifications(userId, unreadOnly),
    staleTime: 30 * 1000,
    enabled: !!userId,
  });
};

/**
 * Lightweight job list (for dashboards)
 * Stale time: 30 seconds
 */
export const useJobsLightweight = (
  user: User | null,
  options?: { status?: JobStatus; limit?: number }
) => {
  return useQuery({
    queryKey: queryKeys.jobsLightweight(user?.user_id || '', options?.status),
    queryFn: () => user ? SupabaseDb.getJobsLightweight(user, options) : Promise.resolve({ jobs: [], total: 0 }),
    staleTime: 30 * 1000,
    enabled: !!user,
  });
};

/**
 * Hook to invalidate caches after mutations
 */
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();
  
  return {
    invalidateCustomers: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
    invalidateForklifts: () => queryClient.invalidateQueries({ queryKey: ['forklifts'] }),
    invalidateJobs: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
    invalidateNotifications: (userId: string) => 
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userId) }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
};

export default {
  queryKeys,
  useCustomersForList,
  useSearchCustomers,
  useForkliftsForList,
  useTechnicians,
  useParts,
  usePartsForList,
  useJob,
  useJobFast,
  useNotificationCount,
  useNotifications,
  useJobsLightweight,
  useInvalidateQueries,
};

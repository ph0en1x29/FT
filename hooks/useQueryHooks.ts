/**
 * React Query Hooks
 * 
 * Cached hooks for common data fetching patterns.
 * These replace direct API calls with cached, deduplicated queries.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SupabaseDb } from '../services/supabaseService';
import { User, Customer, Forklift, Job, JobStatus } from '../types';

// Query keys for cache management
export const queryKeys = {
  customers: ['customers'] as const,
  customersForList: ['customers', 'list'] as const,
  forklifts: ['forklifts'] as const,
  forkliftsForList: ['forklifts', 'list'] as const,
  jobs: (userId: string, status?: JobStatus) => ['jobs', userId, status] as const,
  jobsLightweight: (userId: string, status?: JobStatus) => ['jobs', 'lightweight', userId, status] as const,
  job: (jobId: string) => ['job', jobId] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  notificationCount: (userId: string) => ['notifications', 'count', userId] as const,
  technicians: ['technicians'] as const,
};

/**
 * Cached customer list for dropdowns
 * Stale time: 2 minutes (customer data changes rarely)
 */
export const useCustomersForList = () => {
  return useQuery({
    queryKey: queryKeys.customersForList,
    queryFn: () => SupabaseDb.getCustomersForList(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Cached forklift list for dropdowns
 * Stale time: 2 minutes
 */
export const useForkliftsForList = () => {
  return useQuery({
    queryKey: queryKeys.forkliftsForList,
    queryFn: () => SupabaseDb.getForkliftsForList(),
    staleTime: 2 * 60 * 1000,
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
 * Cached notification count
 * Stale time: 10 seconds (needs to be fresh)
 */
export const useNotificationCount = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.notificationCount(userId),
    queryFn: () => SupabaseDb.getUnreadNotificationCount(userId),
    staleTime: 10 * 1000, // 10 seconds
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
  useForkliftsForList,
  useTechnicians,
  useNotificationCount,
  useNotifications,
  useJobsLightweight,
  useInvalidateQueries,
};

/**
 * Service Schedule Service
 * 
 * Handles service scheduling, intervals, and predictions
 */

import type { ForkliftServiceEntry,Job,ScheduledService } from '../types';
import { supabase } from './supabaseClient';

// =====================
// SCHEDULED SERVICES
// =====================

export const getScheduledServices = async (filters?: { forklift_id?: string; status?: string }): Promise<ScheduledService[]> => {
  try {
    let query = supabase
      .from('scheduled_services')
      .select(`*, forklift:forklifts!forklift_id(*)`)
      .order('due_date', { ascending: true });

    if (filters?.forklift_id) query = query.eq('forklift_id', filters.forklift_id);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return data as ScheduledService[];
  } catch (_e) {
    return [];
  }
};

export const getUpcomingServices = async (daysAhead: number = 30): Promise<ScheduledService[]> => {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('scheduled_services')
      .select(`*, forklift:forklifts!forklift_id(*)`)
      .in('status', ['pending', 'scheduled'])
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    if (error) {
      return [];
    }
    return data as ScheduledService[];
  } catch (_e) {
    return [];
  }
};

export const createScheduledService = async (
  service: Partial<ScheduledService>,
  createdById?: string,
  createdByName?: string
): Promise<ScheduledService | null> => {
  try {
    const { data, error } = await supabase
      .from('scheduled_services')
      .insert({
        forklift_id: service.forklift_id,
        service_type: service.service_type,
        due_date: service.due_date,
        due_hourmeter: service.due_hourmeter,
        estimated_hours: service.estimated_hours,
        priority: service.priority || 'Medium',
        notes: service.notes,
        auto_create_job: service.auto_create_job ?? true,
        created_by_id: createdById,
        created_by_name: createdByName,
      })
      .select(`*, forklift:forklifts!forklift_id(*)`)
      .single();

    if (error) {
      return null;
    }
    return data as ScheduledService;
  } catch (_e) {
    return null;
  }
};

export const updateScheduledService = async (
  scheduledId: string,
  updates: Partial<ScheduledService>
): Promise<ScheduledService | null> => {
  try {
    const { data, error } = await supabase
      .from('scheduled_services')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('scheduled_id', scheduledId)
      .select(`*, forklift:forklifts!forklift_id(*)`)
      .single();

    if (error) {
      return null;
    }
    return data as ScheduledService;
  } catch (_e) {
    return null;
  }
};

// =====================
// SERVICE INTERVALS
// =====================

export const getServiceIntervals = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('service_intervals')
      .select('*')
      .order('forklift_type', { ascending: true })
      .order('hourmeter_interval', { ascending: true });

    if (error) {
      return [];
    }
    return data || [];
  } catch (_e) {
    return [];
  }
};

export const getServiceIntervalsByType = async (forkliftType: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('service_intervals')
      .select('*')
      .eq('forklift_type', forkliftType)
      .eq('is_active', true)
      .order('hourmeter_interval', { ascending: true });

    if (error) {
      return [];
    }
    return data || [];
  } catch (_e) {
    return [];
  }
};

export const createServiceInterval = async (interval: {
  forklift_type: string;
  service_type: string;
  hourmeter_interval: number;
  calendar_interval_days?: number;
  priority?: string;
  checklist_items?: string[];
  estimated_duration_hours?: number;
  name?: string;
}): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from('service_intervals')
      .insert({
        forklift_type: interval.forklift_type,
        service_type: interval.service_type,
        hourmeter_interval: interval.hourmeter_interval,
        calendar_interval_days: interval.calendar_interval_days || null,
        priority: interval.priority || 'Medium',
        checklist_items: interval.checklist_items || [],
        estimated_duration_hours: interval.estimated_duration_hours || null,
        name: interval.name || interval.service_type,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return null;
    }
    return data;
  } catch (_e) {
    return null;
  }
};

export const updateServiceInterval = async (
  intervalId: string,
  updates: {
    forklift_type?: string;
    service_type?: string;
    hourmeter_interval?: number;
    calendar_interval_days?: number | null;
    priority?: string;
    checklist_items?: string[];
    estimated_duration_hours?: number | null;
    name?: string;
    is_active?: boolean;
  }
): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from('service_intervals')
      .update(updates)
      .eq('interval_id', intervalId)
      .select()
      .single();

    if (error) {
      return null;
    }
    return data;
  } catch (_e) {
    return null;
  }
};

export const deleteServiceInterval = async (intervalId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('service_intervals')
      .update({ is_active: false })
      .eq('interval_id', intervalId);

    if (error) {
      return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
};

export const hardDeleteServiceInterval = async (intervalId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('service_intervals')
      .delete()
      .eq('interval_id', intervalId);

    if (error) {
      return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
};

// =====================
// SERVICE HISTORY
// =====================

export const getForkliftServiceHistory = async (forkliftId: string): Promise<Job[]> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`*, customer:customers(*), parts_used:job_parts(*), media:job_media(*), extra_charges:extra_charges(*)`)
      .eq('forklift_id', forkliftId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }
    return data as Job[];
  } catch (_e) {
    return [];
  }
};

export const getForkliftServiceHistoryWithCancelled = async (forkliftId: string): Promise<ForkliftServiceEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`*, customer:customers(*), parts_used:job_parts(*), media:job_media(*), extra_charges:extra_charges(*)`)
      .eq('forklift_id', forkliftId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map((job: Job) => ({
      ...job,
      is_cancelled: job.deleted_at !== null,
    }));
  } catch (_e) {
    return [];
  }
};

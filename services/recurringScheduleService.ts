/**
 * Recurring Schedule Service — ACWER Path C scheduler (Phase 5)
 *
 * Thin CRUD over `recurring_schedules`. The materialisation into
 * `scheduled_services` rows is owned by the daily pg_cron job
 * `acwer-recurring-schedule-generator` (see migration
 * `20260501_acwer_flow_phase5_recurring_scheduler.sql`).
 *
 * Phase 5 ships the data layer + cron generator. A ForkliftProfile UI
 * surface that lets admin create/edit recurrences with one click is
 * a small follow-up — for now admin populates rows directly via the
 * service or SQL dashboard.
 */
import type { RecurringSchedule } from '../types';
import { logDebug,supabase } from './supabaseClient';

interface CreateRecurringInput {
  forklift_id: string;
  service_interval_id?: string | null;
  contract_id?: string | null;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'hourmeter';
  hourmeter_interval?: number | null;
  next_due_date?: string | null;
  next_due_hourmeter?: number | null;
  lead_time_days?: number;
  notes?: string | null;
}

/** List recurring schedules for a forklift (active and inactive). */
export async function getRecurringSchedulesForForklift(
  forkliftId: string,
): Promise<RecurringSchedule[]> {
  if (!forkliftId) return [];
  const { data, error } = await supabase
    .from('recurring_schedules')
    .select('*')
    .eq('forklift_id', forkliftId)
    .order('created_at', { ascending: false });
  if (error) {
    logDebug('[recurringScheduleService] list error:', error);
    return [];
  }
  return (data ?? []) as RecurringSchedule[];
}

/** Create a recurring schedule for a fleet forklift. */
export async function createRecurringSchedule(
  input: CreateRecurringInput,
): Promise<RecurringSchedule> {
  const payload = {
    forklift_id: input.forklift_id,
    service_interval_id: input.service_interval_id ?? null,
    contract_id: input.contract_id ?? null,
    frequency: input.frequency,
    hourmeter_interval: input.hourmeter_interval ?? null,
    next_due_date: input.next_due_date ?? null,
    next_due_hourmeter: input.next_due_hourmeter ?? null,
    lead_time_days: input.lead_time_days ?? 7,
    is_active: true,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from('recurring_schedules')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as RecurringSchedule;
}

/** Update an existing recurring schedule. */
export async function updateRecurringSchedule(
  scheduleId: string,
  updates: Partial<CreateRecurringInput> & { is_active?: boolean },
): Promise<RecurringSchedule> {
  const { data, error } = await supabase
    .from('recurring_schedules')
    .update(updates)
    .eq('schedule_id', scheduleId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as RecurringSchedule;
}

/** Soft-deactivate a recurring schedule (sets `is_active = false`). */
export async function deactivateRecurringSchedule(scheduleId: string): Promise<RecurringSchedule> {
  return updateRecurringSchedule(scheduleId, { is_active: false });
}

/**
 * Trigger the cron generator manually — useful for admin "force generate now"
 * controls or for ad-hoc backfills. Returns the rows the generator created.
 */
export async function runRecurringScheduleGenerator(): Promise<
  Array<{ schedule_id: string; scheduled_id: string; forklift_id: string; due_date: string; service_type: string }>
> {
  const { data, error } = await supabase.rpc('acwer_generate_recurring_jobs');
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    schedule_id: string;
    scheduled_id: string;
    forklift_id: string;
    due_date: string;
    service_type: string;
  }>;
}

/**
 * Job CRUD Service
 *
 * Handles delete/restore related operations for jobs.
 */

import { supabase } from './supabaseClient';

/** Row type for deleted jobs query with relations (Supabase returns arrays for relations) */
interface DeletedJobRow {
  job_id: string;
  title: string;
  description?: string;
  status: string;
  job_type: string;
  priority: string;
  deleted_at: string;
  deleted_by?: string;
  deleted_by_name?: string;
  deletion_reason?: string;
  hourmeter_before_delete?: number;
  forklift_id?: string;
  customer_id?: string;
  assigned_technician_name?: string;
  created_at: string;
  customer?: { name: string }[] | null;
  forklift?: { serial_number: string; make: string; model: string }[] | null;
}

// =====================
// JOB DELETE
// =====================

export const deleteJob = async (
  jobId: string, 
  deletedById?: string, 
  deletedByName?: string,
  deletionReason?: string
): Promise<void> => {
  const now = new Date().toISOString();
  
  const { data: job } = await supabase
    .from('jobs')
    .select('forklift_id, hourmeter_reading')
    .eq('job_id', jobId)
    .single();

  // Rollback forklift hourmeter if needed
  if (job?.forklift_id && job?.hourmeter_reading) {
    const { data: forklift } = await supabase
      .from('forklifts')
      .select('hourmeter')
      .eq('forklift_id', job.forklift_id)
      .single();

    if (forklift?.hourmeter === job.hourmeter_reading) {
      const { data: prevJob } = await supabase
        .from('jobs')
        .select('hourmeter_reading')
        .eq('forklift_id', job.forklift_id)
        .neq('job_id', jobId)
        .is('deleted_at', null)
        .not('hourmeter_reading', 'is', null)
        .in('status', ['Completed', 'Awaiting Finalization'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .single();

      if (prevJob?.hourmeter_reading) {
        await supabase
          .from('forklifts')
          .update({ hourmeter: prevJob.hourmeter_reading, updated_at: now })
          .eq('forklift_id', job.forklift_id);
      }
    }
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      deleted_at: now,
      deleted_by: deletedById || null,
      deleted_by_name: deletedByName || null,
      deletion_reason: deletionReason || null,
      hourmeter_before_delete: job?.hourmeter_reading || null,
    })
    .eq('job_id', jobId);

  if (error) throw new Error(error.message);
};

export const getRecentlyDeletedJobs = async (): Promise<any[]> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      job_id, title, description, status, job_type, priority,
      deleted_at, deleted_by, deleted_by_name, deletion_reason, hourmeter_before_delete,
      forklift_id, customer_id, assigned_technician_name, created_at,
      customer:customers(name),
      forklift:forklifts!forklift_id(serial_number, make, model)
    `)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', thirtyDaysAgo.toISOString())
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Error fetching recently deleted jobs:', error);
    return [];
  }

  return (data || []).map((job) => {
    const row = job as DeletedJobRow;
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const forklift = Array.isArray(row.forklift) ? row.forklift[0] : row.forklift;
    return {
      ...row,
      customer_name: customer?.name || 'Unknown',
      forklift_serial: forklift?.serial_number,
      forklift_make: forklift?.make,
      forklift_model: forklift?.model,
    };
  });
};

export const hardDeleteJob = async (jobId: string): Promise<void> => {
  // Delete all related records first
  await supabase.from('job_inventory_usage').delete().eq('job_id', jobId);
  await supabase.from('job_invoice_extra_charges').delete().eq('job_id', jobId);
  await supabase.from('job_invoices').delete().eq('job_id', jobId);
  await supabase.from('job_service_records').delete().eq('job_id', jobId);
  await supabase.from('job_status_history').delete().eq('job_id', jobId);
  await supabase.from('job_audit_log').delete().eq('job_id', jobId);
  await supabase.from('job_parts').delete().eq('job_id', jobId);
  await supabase.from('job_media').delete().eq('job_id', jobId);
  await supabase.from('extra_charges').delete().eq('job_id', jobId);
  
  const { error } = await supabase.from('jobs').delete().eq('job_id', jobId);
  if (error) throw new Error(error.message);
};

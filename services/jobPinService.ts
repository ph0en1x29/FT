import { supabase } from './supabaseClient';

/**
 * Pin a job for a specific user.
 * Appends the user ID to is_pinned_by if not already present.
 */
export const pinJob = async (jobId: string, userId: string): Promise<void> => {
  const { data, error } = await supabase
    .from('jobs')
    .select('is_pinned_by')
    .eq('job_id', jobId)
    .single();

  if (error) throw new Error(error.message);

  const current: string[] = data?.is_pinned_by ?? [];
  if (current.includes(userId)) return;

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ is_pinned_by: [...current, userId] })
    .eq('job_id', jobId);

  if (updateError) throw new Error(updateError.message);
};

/**
 * Unpin a job for a specific user.
 * Removes the user ID from is_pinned_by.
 */
export const unpinJob = async (jobId: string, userId: string): Promise<void> => {
  const { data, error } = await supabase
    .from('jobs')
    .select('is_pinned_by')
    .eq('job_id', jobId)
    .single();

  if (error) throw new Error(error.message);

  const current: string[] = data?.is_pinned_by ?? [];

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ is_pinned_by: current.filter((id) => id !== userId) })
    .eq('job_id', jobId);

  if (updateError) throw new Error(updateError.message);
};

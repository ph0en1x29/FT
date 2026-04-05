import { supabase } from './supabaseClient';

/**
 * Star a job — marks it as needing attention.
 * Visible to all users; floats to top of the job board.
 */
export const starJob = async (jobId: string): Promise<void> => {
  const { error } = await supabase
    .from('jobs')
    .update({ is_starred: true })
    .eq('job_id', jobId);

  if (error) throw new Error(error.message);
};

/**
 * Unstar a job — removes the attention flag.
 */
export const unstarJob = async (jobId: string): Promise<void> => {
  const { error } = await supabase
    .from('jobs')
    .update({ is_starred: false })
    .eq('job_id', jobId);

  if (error) throw new Error(error.message);
};

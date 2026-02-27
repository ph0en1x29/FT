/**
 * Job Media Service
 * 
 * Handles photos, signatures, and media attachments for jobs.
 */

import type { Job,JobMedia,SignatureEntry } from '../types';
import { getPublicStorageUrl,getSignedStorageUrl,supabase,uploadToStorage } from './supabaseClient';

// Forward declaration to avoid circular dependency
const getJobById = async (jobId: string): Promise<Job | null> => {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media(*),
      extra_charges:extra_charges(*)
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .single();

  if (error) {
    return null;
  }

  return data as Job;
};

// =====================
// JOB MEDIA
// =====================

export const addMedia = async (
  jobId: string, 
  media: Omit<JobMedia, 'media_id' | 'job_id'>,
  uploadedById?: string,
  uploadedByName?: string,
  isHelperPhoto?: boolean
): Promise<Job> => {
  const { error } = await supabase
    .from('job_media')
    .insert({
      job_id: jobId,
      ...media,
      uploaded_by_id: uploadedById || null,
      uploaded_by_name: uploadedByName || null,
      is_helper_photo: isHelperPhoto || false,
    });

  if (error) throw new Error(error.message);
  return getJobById(jobId) as Promise<Job>;
};

// =====================
// JOB SIGNATURES
// =====================

export const signJob = async (
  jobId: string,
  type: 'technician' | 'customer',
  signerName: string,
  signatureDataUrl: string
): Promise<Job> => {
  const now = new Date().toISOString();
  
  const timestamp = Date.now();
  const fileName = `${jobId}_${type}_${timestamp}.png`;
  const filePath = await uploadToStorage('signatures', fileName, signatureDataUrl);
  
  // Get permanent public URL for the uploaded signature.
  // If upload failed (returned base64), use that directly.
  let signatureUrl = filePath;
  if (!filePath.startsWith('data:')) {
    signatureUrl = getPublicStorageUrl('signatures', filePath);
  }
  
  const signatureEntry: SignatureEntry = {
    signed_by_name: signerName,
    signed_at: now,
    signature_url: signatureUrl,
  };

  const field = type === 'technician' ? 'technician_signature' : 'customer_signature';
  const timestampField = type === 'technician' ? 'technician_signature_at' : 'customer_signature_at';

  const { data, error } = await supabase
    .from('jobs')
    .update({ [field]: signatureEntry })
    .eq('job_id', jobId)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media(*),
      extra_charges:extra_charges(*)
    `)
    .single();

  if (error) throw new Error(error.message);

  const { error: serviceRecordError } = await supabase
    .from('job_service_records')
    .update({ 
      [field]: signatureEntry,
      [timestampField]: now,
      updated_at: now
    })
    .eq('job_id', jobId);

  if (serviceRecordError) {
    await supabase
      .from('job_service_records')
      .upsert({
        job_id: jobId,
        [field]: signatureEntry,
        [timestampField]: now,
        updated_at: now
      }, { onConflict: 'job_id' });
  }

  return data as Job;
};

export const deleteMedia = async (jobId: string, mediaId: string): Promise<Job> => {
  // Get media URL to delete from storage
  const { data: media } = await supabase
    .from('job_media')
    .select('url')
    .eq('media_id', mediaId)
    .single();

  // Delete from job_media table
  const { error } = await supabase
    .from('job_media')
    .delete()
    .eq('media_id', mediaId)
    .eq('job_id', jobId);

  if (error) throw new Error(error.message);

  // Try to delete from storage (non-blocking)
  if (media?.url?.includes('job-photos/')) {
    try {
      const path = media.url.split('job-photos/')[1];
      if (path) await supabase.storage.from('job-photos').remove([path]);
    } catch { /* storage cleanup is best-effort */ }
  }

  return getJobById(jobId) as Promise<Job>;
};

/**
 * Rejection Photo Upload
 *
 * Standalone helper used by the technician job-rejection flow. Captures GPS,
 * compresses the image, uploads it to job-photos storage, and inserts a
 * job_media row with category='rejection_proof'. Returns the new media_id so
 * the caller can persist it on jobs.technician_rejection_photo_id.
 *
 * Lives separately from JobPhotosSection's inline upload helpers because the
 * rejection flow has none of JobPhotosSection's concerns (timer auto-start,
 * helper distinction, video handling, multi-file batching). A future cleanup
 * can extract a shared photo upload module — see WORK_LOG entry for context.
 */

import { addMedia } from './jobMediaService';
import { supabase } from './supabaseClient';
import type { JobMedia, MediaCategory } from '../types';

type NewMediaData = Omit<JobMedia, 'media_id' | 'job_id' | 'uploaded_by_id' | 'uploaded_by_name' | 'is_helper_photo' | 'uploaded_by_assignment_id'>;

export interface RejectionPhotoGPS {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export const captureRejectionGPS = (): Promise<RejectionPhotoGPS | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });

const compressImage = (file: File, maxWidth = 1920, quality = 0.85): Promise<string> => {
  if (file.size > 25 * 1024 * 1024) {
    return Promise.reject(new Error('Photo is too large (>25 MB).'));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(img.src);
          reject(new Error('Canvas not supported'));
          return;
        }
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(img.src);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(img.src);
        reject(err instanceof Error ? err : new Error('Failed to compress image'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
};

const uploadToJobPhotos = async (dataURL: string, jobId: string): Promise<string> => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  const blob = new Blob([u8arr], { type: mime });
  const fileName = `${jobId}/rejection_${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('job-photos')
    .upload(fileName, blob, { contentType: mime, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: { publicUrl } } = supabase.storage.from('job-photos').getPublicUrl(fileName);
  return publicUrl;
};

export interface UploadRejectionPhotoArgs {
  file: File;
  jobId: string;
  uploadedById: string;
  uploadedByName: string;
}

export interface UploadRejectionPhotoResult {
  mediaId: string;
  gps: RejectionPhotoGPS | null;
  publicUrl: string;
}

/**
 * Compresses, uploads, and registers a technician rejection-proof photo. Returns
 * the new job_media.media_id so the caller can write it to
 * jobs.technician_rejection_photo_id.
 */
export const uploadRejectionPhoto = async ({
  file,
  jobId,
  uploadedById,
  uploadedByName,
}: UploadRejectionPhotoArgs): Promise<UploadRejectionPhotoResult> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Rejection proof must be an image.');
  }

  // Capture GPS in parallel with compression. We require GPS for rejection
  // proof; the caller has already enforced this UI-side, but we double-check.
  const gpsPromise = captureRejectionGPS();
  const dataURL = await compressImage(file);
  const [publicUrl, gps] = await Promise.all([
    uploadToJobPhotos(dataURL, jobId),
    gpsPromise,
  ]);

  if (!gps) {
    throw new Error('Location access is required to reject a job. Enable GPS and try again.');
  }

  const now = new Date().toISOString();
  const mediaData: NewMediaData = {
    type: 'photo',
    url: publicUrl,
    description: 'Job rejection proof',
    created_at: now,
    category: 'rejection_proof' as MediaCategory,
    source: 'camera',
    device_timestamp: new Date(file.lastModified).toISOString(),
    server_timestamp: now,
    timestamp_mismatch: false,
    gps_latitude: gps.latitude,
    gps_longitude: gps.longitude,
    gps_accuracy: gps.accuracy,
    gps_captured_at: now,
  };

  const updatedJob = await addMedia(jobId, mediaData, uploadedById, uploadedByName, false);
  // The media we just inserted is the most recent rejection_proof for this job
  const created = (updatedJob.media || [])
    .filter((m) => m.category === 'rejection_proof')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];

  if (!created || !created.media_id) {
    throw new Error('Photo uploaded but media record could not be located.');
  }

  return { mediaId: created.media_id, gps, publicUrl };
};

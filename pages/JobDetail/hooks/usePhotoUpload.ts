import React, { useState } from 'react';
import { SupabaseDb as MockDb,supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Job,JobMedia,JobStatus,MediaCategory } from '../../../types';
import { PHOTO_CATEGORIES } from '../constants';

// Type for media data being created (without ID fields that are auto-generated)
type NewMediaData = Omit<JobMedia, 'media_id' | 'job_id' | 'uploaded_by_id' | 'uploaded_by_name' | 'is_helper_photo' | 'uploaded_by_assignment_id'>;

interface UsePhotoUploadParams {
  job: Job;
  currentUserId: string;
  currentUserName: string;
  isCurrentUserHelper: boolean;
  uploadPhotoCategory: string;
  onJobUpdate: (job: Job) => void;
}

export const usePhotoUpload = ({
  job,
  currentUserId,
  currentUserName,
  isCurrentUserHelper,
  uploadPhotoCategory,
  onJobUpdate,
}: UsePhotoUploadParams) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Check camera permission — show user-friendly error if denied
  const checkCameraPermission = async (): Promise<boolean> => {
    try {
      // navigator.permissions.query is not supported in all browsers for camera
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (result.state === 'denied') {
          showToast.error('Camera access denied', 'Please enable camera permission in your browser settings and try again.');
          return false;
        }
      }
      return true;
    } catch {
      // Permission API not supported for camera — let it pass through
      return true;
    }
  };

  // Helper to get GPS coordinates (non-blocking, shorter timeout)
  const getGPSCoordinates = (): Promise<{ latitude: number; longitude: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        () => {
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 } // Reduced timeout, allow cached
      );
    });
  };

  // Compress image to reduce upload size and processing time
  // Uses requestAnimationFrame to yield to the browser between heavy canvas ops
  const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<string> => {
    // Early reject files > 25MB to avoid freezing the browser
    if (file.size > 25 * 1024 * 1024) {
      return Promise.reject(new Error('Photo is too large (>25 MB). Please use a lower camera resolution or crop before uploading.'));
    }

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        // Yield to the browser before doing heavy canvas work
        requestAnimationFrame(() => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              URL.revokeObjectURL(img.src);
              reject(new Error('Canvas not supported'));
              return;
            }

            let { width, height } = img;

            // Scale down if larger than maxWidth
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            URL.revokeObjectURL(img.src); // Clean up
            resolve(dataUrl);
          } catch (err) {
            URL.revokeObjectURL(img.src);
            reject(err instanceof Error ? err : new Error('Failed to compress image'));
          }
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  };

  // Upload photo/video to Supabase Storage with 1 automatic retry
  const uploadMediaToStorage = async (dataURL: string, jobId: string, fileExtension: string): Promise<string> => {
    const doUpload = async (): Promise<string> => {
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });

      const timestamp = Date.now();
      const fileName = `${jobId}/${timestamp}${fileExtension}`;

      const { data: _data, error } = await supabase.storage
        .from('job-photos')
        .upload(fileName, blob, {
          contentType: mime,
          upsert: false,
        });

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName);

      return publicUrl;
    };

    // Attempt 1
    try {
      return await doUpload();
    } catch (firstErr) {
      // Retry once after a short delay
      await new Promise(r => setTimeout(r, 1500));
      try {
        return await doUpload();
      } catch (retryErr) {
        // Never silently fall back to base64 — surface the error
        throw new Error(
          `Photo upload failed after retry. ${retryErr instanceof Error ? retryErr.message : 'Unknown error'}. Please check your connection and try again.`,
          { cause: retryErr }
        );
      }
    }
  };

  // Extract first frame from video as thumbnail
  const extractVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.onloadeddata = () => {
        video.currentTime = 0.1; // Seek to 0.1s to get first frame
      };

      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(video.src);
        resolve(dataUrl);
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      video.src = URL.createObjectURL(file);
      video.load();
    });
  };

  const uploadPhotoFile = async (file: File, index?: number, total?: number) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      showToast.error('Please upload an image or video file');
      return;
    }

    // Check video file size (50MB max)
    if (isVideo && file.size > 50 * 1024 * 1024) {
      showToast.error('Video too large', 'Maximum size is 50MB');
      return;
    }

    // Early reject images > 25MB before any processing
    if (isImage && file.size > 25 * 1024 * 1024) {
      showToast.error('Photo too large', 'Maximum size is 25 MB. Please use a lower camera resolution.');
      return;
    }

    // Show loading state immediately — BEFORE any heavy work
    setIsUploading(true);
    const progressText = index !== undefined && total !== undefined ? `Uploading ${index}/${total}...` : isVideo ? 'Processing video...' : 'Compressing photo...';
    setUploadProgress(progressText);
    showToast.info(progressText, 'Please wait');

    // Yield a frame so the UI can render the progress state before heavy canvas work
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      // Start GPS fetch in background (don't block on it)
      const gpsPromise = getGPSCoordinates();

      const deviceTimestamp = new Date(file.lastModified).toISOString();
      const serverTimestamp = new Date().toISOString();
      const timeDiffMs = Math.abs(new Date(serverTimestamp).getTime() - new Date(deviceTimestamp).getTime());
      const timeDiffMinutes = Math.round(timeDiffMs / 60000);
      const timestampMismatch = timeDiffMinutes > 5;

      let base64Data: string;
      let fileExtension: string;

      if (isVideo) {
        // For videos: don't compress, upload raw file
        const reader = new FileReader();
        base64Data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Determine extension from MIME type
        if (file.type === 'video/mp4') {
          fileExtension = '.mp4';
        } else if (file.type === 'video/quicktime') {
          fileExtension = '.mov';
        } else {
          fileExtension = '.mp4'; // Default fallback
        }
      } else {
        // For images: compress as before
        base64Data = await compressImage(file, 1920, 0.85);
        fileExtension = '.jpg';
      }

      // Now upload (GPS can still be fetching)
      const [mediaUrl, gps] = await Promise.all([
        uploadMediaToStorage(base64Data, job.job_id, fileExtension),
        gpsPromise,
      ]);

      // === PHOTO/VIDEO-BASED TIME TRACKING ===
      // Only lead technician (not helper) can start/stop timer
      const isLeadTechnician = job.assigned_technician_id === currentUserId;

      // Check if this is the first media and job hasn't started - auto-start timer
      const isFirstMedia = job.media.length === 0;
      const shouldAutoStart = isFirstMedia &&
                              !job.repair_start_time &&
                              !job.started_at &&
                              isLeadTechnician &&
                              !isCurrentUserHelper;

      // Check if this is a completion media (After category) - auto-stop timer
      const isCompletionMedia = uploadPhotoCategory === 'after';
      const shouldAutoStop = isCompletionMedia &&
                             job.repair_start_time &&
                             !job.repair_end_time &&
                             isLeadTechnician &&
                             !isCurrentUserHelper;

      const mediaData: NewMediaData = {
        type: isVideo ? 'video' : 'photo',
        url: mediaUrl,
        description: file.name,
        created_at: serverTimestamp,
        category: uploadPhotoCategory as MediaCategory,
        source: 'camera',
        device_timestamp: deviceTimestamp,
        server_timestamp: serverTimestamp,
        timestamp_mismatch: timestampMismatch,
        timestamp_mismatch_minutes: timestampMismatch ? timeDiffMinutes : undefined,
        ...(shouldAutoStart && { is_start_photo: true }),
        ...(shouldAutoStop && { is_end_photo: true }),
        ...(gps && {
          gps_latitude: gps.latitude,
          gps_longitude: gps.longitude,
          gps_accuracy: gps.accuracy,
          gps_captured_at: serverTimestamp,
        }),
      };

      const updated = await MockDb.addMedia(
        job.job_id,
        mediaData,
        currentUserId,
        currentUserName,
        isCurrentUserHelper
      );

      // Auto-start job timer on first media (lead tech only)
      if (shouldAutoStart) {
        const now = new Date().toISOString();
        const startedJob = await MockDb.updateJob(job.job_id, {
          status: JobStatus.IN_PROGRESS,
          started_at: now,
          repair_start_time: now,
          arrival_time: now,
        });
        onJobUpdate({ ...startedJob } as Job);
        showToast.info('Job started', `Timer started automatically with first ${isVideo ? 'video' : 'photo'}`);
      } else if (shouldAutoStop) {
        const now = new Date().toISOString();
        const stoppedJob = await MockDb.updateJob(job.job_id, {
          repair_end_time: now,
        });
        onJobUpdate({ ...stoppedJob } as Job);
        showToast.info('Timer stopped', `Job timer stopped with "After" ${isVideo ? 'video' : 'photo'}`);
      } else {
        onJobUpdate({ ...updated } as Job);
      }

      const categoryLabel = PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other';
      const mediaType = isVideo ? 'Video' : 'Photo';

      if (!gps && timestampMismatch) {
        showToast.warning(`${mediaType} uploaded (flagged)`, `GPS missing • Timestamp mismatch: ${timeDiffMinutes}min`);
      } else if (!gps) {
        showToast.warning(`${mediaType} uploaded`, `GPS location not captured • ${categoryLabel}`);
      } else if (timestampMismatch) {
        showToast.warning(`${mediaType} uploaded`, `Timestamp mismatch: ${timeDiffMinutes}min • ${categoryLabel}`);
      } else if (!shouldAutoStart && !shouldAutoStop) {
        showToast.success(`${mediaType} uploaded`, `Category: ${categoryLabel}${isCurrentUserHelper ? ' (Helper)' : ''}`);
      }
    } catch (e) {
      showToast.error(`${isVideo ? 'Video' : 'Photo'} upload failed`, (e as Error).message);
    }
  };

  const uploadFiles = async (files: File[]) => {
    for (let i = 0; i < files.length; i++) {
      await uploadPhotoFile(files[i], i + 1, files.length);
    }
    setIsUploading(false);
    setUploadProgress('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    // Only gate on camera permission when the user actually used a camera-capture input.
    // Gallery uploads must work even if camera permission is denied.
    const usedCameraCapture = e.target.hasAttribute('capture');
    e.target.value = '';
    if (files.length === 0) return;

    if (usedCameraCapture) {
      const hasPermission = await checkCameraPermission();
      if (!hasPermission) return;
    }

    await uploadFiles(files);
  };

  return { isUploading, uploadProgress, handlePhotoUpload, uploadFiles };
};

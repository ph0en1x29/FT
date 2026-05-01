/* eslint-disable max-lines */
import { Camera,Download,Images,Trash2 } from 'lucide-react';
import React,{ useMemo,useState } from 'react';
import PhotoLightbox from '../../../components/ui/PhotoLightbox';
import { SupabaseDb as MockDb,supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Job,JobMedia,JobStatus,MediaCategory } from '../../../types';
import { PHOTO_CATEGORIES,getDefaultPhotoCategory } from '../constants';
import { RoleFlags,StatusFlags } from '../types';

// Type for media data being created (without ID fields that are auto-generated)
type NewMediaData = Omit<JobMedia, 'media_id' | 'job_id' | 'uploaded_by_id' | 'uploaded_by_name' | 'is_helper_photo' | 'uploaded_by_assignment_id'>;

interface JobPhotosSectionProps {
  job: Job;
  currentUserId: string;
  currentUserName: string;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  isCurrentUserHelper: boolean;
  onJobUpdate: (job: Job) => void;
}

const JobPhotosSectionInner: React.FC<JobPhotosSectionProps> = ({
  job,
  currentUserId,
  currentUserName,
  roleFlags,
  statusFlags,
  isCurrentUserHelper,
  onJobUpdate,
}) => {
  const [photoCategoryFilter, setPhotoCategoryFilter] = useState<string>('all');
  const [uploadPhotoCategory, setUploadPhotoCategory] = useState<string>(getDefaultPhotoCategory(job));
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);
  const [isPhotoDragActive, setIsPhotoDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);

  const { isTechnician, isAdmin, isSupervisor } = roleFlags;
  const { isNew, isAssigned, isInProgress, isAwaitingFinalization, isIncompleteContinuing, isIncompleteReassigned } = statusFlags;
  
  const canUploadPhotos = isNew || isAssigned || isInProgress || isAwaitingFinalization || isIncompleteContinuing || isIncompleteReassigned;

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

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      await uploadPhotoFile(files[i], i + 1, files.length);
    }
    
    setIsUploading(false);
    setUploadProgress('');
  };

  const handlePhotoDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handlePhotoDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPhotoDragActive(true);
  };

  const handlePhotoDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPhotoDragActive(false);
  };

  const handlePhotoDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPhotoDragActive(false);
    const files: File[] = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      await uploadPhotoFile(files[i], i + 1, files.length);
    }
    
    setIsUploading(false);
    setUploadProgress('');
  };

  const handleDeletePhoto = async (mediaId: string) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    setDeletingMediaId(mediaId);
    try {
      const updated = await MockDb.deleteMedia(job.job_id, mediaId);
      onJobUpdate({ ...updated } as Job);
      showToast.success('Photo deleted');
    } catch (e) {
      showToast.error('Failed to delete photo', (e as Error).message);
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handleDownloadPhotos = async () => {
    if (!job || job.media.length === 0) {
      showToast.error('No photos to download');
      return;
    }
    setDownloadingPhotos(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const photosToDownload = photoCategoryFilter === 'all' ? job.media : job.media.filter(m => m.category === photoCategoryFilter);
      if (photosToDownload.length === 0) {
        showToast.error('No photos in selected category');
        setDownloadingPhotos(false);
        return;
      }
      for (const photo of photosToDownload) {
        const category = photo.category || 'other';
        const folder = zip.folder(category);
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const timestamp = new Date(photo.created_at).toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}_${photo.description || 'photo'}.jpg`;
        folder?.file(filename, blob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Job_${job.service_report_number || job.job_id}_Photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast.success('Photos downloaded', `${photosToDownload.length} photos`);
    } catch (e) {
      showToast.error('Download failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDownloadingPhotos(false);
    }
  };

  const filteredMedia = useMemo(() =>
    job.media.filter(m => photoCategoryFilter === 'all' || m.category === photoCategoryFilter),
    [job.media, photoCategoryFilter]
  );

  const lightboxImages = useMemo(() =>
    filteredMedia.map(m => ({
      url: m.url,
      label: PHOTO_CATEGORIES.find(c => c.value === m.category)?.label || 'Other',
      timestamp: new Date(m.created_at).toLocaleString(),
    })),
    [filteredMedia]
  );

  if (!(isTechnician || isAdmin || isSupervisor)) return null;

  return (
    <div className="card-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
            <Camera className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text)]">Photos</h3>
            <p className="text-xs text-[var(--text-muted)]">{job.media.length} uploaded</p>
            {job.repair_start_time && !job.repair_end_time && !isCurrentUserHelper && (
              <p className="text-xs text-[var(--success)] mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[var(--success)] rounded-full animate-pulse" />
                Take "After" photo to stop timer
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canUploadPhotos && (
            <select
              value={uploadPhotoCategory}
              onChange={(e) => setUploadPhotoCategory(e.target.value)}
              className="text-xs px-2 py-1 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-secondary)]"
            >
              {PHOTO_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          )}
          {job.media.length > 0 && (
            <button onClick={handleDownloadPhotos} disabled={downloadingPhotos} className="btn-premium btn-premium-ghost text-xs">
              <Download className="w-3.5 h-3.5" /> {downloadingPhotos ? 'Downloading...' : 'ZIP'}
            </button>
          )}
        </div>
      </div>

      {job.media.length === 0 ? (
        <div
          className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
            isPhotoDragActive
              ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
              : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-subtle)]'
          }`}
          onDragOver={handlePhotoDragOver}
          onDragEnter={handlePhotoDragEnter}
          onDragLeave={handlePhotoDragLeave}
          onDrop={handlePhotoDrop}
        >
          {canUploadPhotos ? (
            isUploading ? (
              <div className="flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] border border-[var(--accent)] flex items-center justify-center mb-3">
                  <div className="w-7 h-7 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm font-semibold text-[var(--accent)]">{uploadProgress || 'Uploading...'}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Processing and uploading</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex items-center justify-center mb-3">
                  <Camera className="w-7 h-7 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">Drop photos here</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">or click to upload</p>
                <p className="text-xs text-[var(--text-muted)] mt-3">
                  Uploads default to <span className="font-medium text-[var(--text-secondary)]">{PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other'}</span>
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <label className="cursor-pointer">
                    <span className="btn-premium btn-premium-primary text-xs inline-flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> Take Photo
                    </span>
                    <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  <label className="cursor-pointer">
                    <span className="btn-premium btn-premium-ghost text-xs inline-flex items-center gap-1.5">
                      <Images className="w-3.5 h-3.5" /> From Gallery
                    </span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>
                <label className="cursor-pointer">
                  <span className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] underline mt-2 inline-block">Add Video</span>
                  <input type="file" accept="video/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
            )
          ) : (
            <div className="text-center py-10">
              <p className="text-sm text-[var(--text-muted)]">Photos can be uploaded once the job is active.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Category Filter */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button onClick={() => setPhotoCategoryFilter('all')} className={`px-2.5 py-1 text-xs font-medium rounded-full transition ${photoCategoryFilter === 'all' ? 'bg-[var(--text)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}>
              All ({job.media.length})
            </button>
            {PHOTO_CATEGORIES.map(cat => {
              const count = job.media.filter(m => m.category === cat.value).length;
              if (count === 0) return null;
              return (
                <button key={cat.value} onClick={() => setPhotoCategoryFilter(cat.value)} className={`px-2.5 py-1 text-xs font-medium rounded-full transition ${photoCategoryFilter === cat.value ? `${cat.color} text-white` : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'}`}>
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Photo/Video Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredMedia.map((m, idx) => {
              const catInfo = PHOTO_CATEGORIES.find(c => c.value === m.category) || PHOTO_CATEGORIES.find(c => c.value === 'other');
              const isVideo = m.type === 'video';
              return (
                <div
                  key={m.media_id}
                  className="relative group aspect-square cursor-pointer"
                  onClick={() => setLightboxIndex(idx)}
                >
                  {isVideo ? (
                    <>
                      <video 
                        src={m.url} 
                        className="w-full h-full object-cover rounded-xl border border-[var(--border)] transition-transform group-hover:scale-[1.02]"
                        preload="metadata"
                      />
                      {/* Play icon overlay for videos */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                          </svg>
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={m.url} loading="lazy" decoding="async" alt="Job" className="w-full h-full object-cover rounded-xl border border-[var(--border)] transition-transform group-hover:scale-[1.02]" />
                  )}
                  <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-medium text-white rounded ${catInfo?.color || 'bg-slate-500'}`}>
                    {catInfo?.label || 'Other'}
                  </span>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-colors" />
                  {/* Delete button */}
                  {canUploadPhotos && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(m.media_id); }}
                      disabled={deletingMediaId === m.media_id}
                      className="absolute top-1.5 right-1.5 p-1 bg-red-500/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title={`Delete ${isVideo ? 'video' : 'photo'}`}
                    >
                      {deletingMediaId === m.media_id ? (
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-2 py-1.5 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="truncate">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
            {/* Upload Button */}
            {canUploadPhotos && (
              <div className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors ${
                isUploading 
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)]' 
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}>
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-0.5" />
                    <span className="text-[9px] text-[var(--accent)]">{uploadProgress || 'Uploading...'}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <label className="cursor-pointer flex flex-col items-center">
                      <Camera className="w-5 h-5 mb-0.5" />
                      <span className="text-[9px]">Take Photo</span>
                      <span className="text-[9px] text-[var(--text-muted)] mt-0.5">{PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other'}</span>
                      <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoUpload} />
                    </label>
                    <label className="cursor-pointer flex items-center gap-1">
                      <Images className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="text-[9px] text-[var(--text-muted)] hover:text-[var(--accent)] underline">Gallery</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                    </label>
                    <label className="cursor-pointer">
                      <span className="text-[8px] text-[var(--text-muted)] hover:text-[var(--accent)] underline">Add Video</span>
                      <input type="file" accept="video/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
};

// Memoized — JobPhotosSection re-renders only when its props actually change.
// Parent JobDetailPage re-renders on every `state.show*Modal` toggle; without
// memo, every modal toggle would re-run this 700-line component's render.
export const JobPhotosSection = React.memo(JobPhotosSectionInner);

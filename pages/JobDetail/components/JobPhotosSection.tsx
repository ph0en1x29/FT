import { Camera,Download } from 'lucide-react';
import React,{ useState } from 'react';
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

export const JobPhotosSection: React.FC<JobPhotosSectionProps> = ({
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

  const { isTechnician, isAdmin, isSupervisor } = roleFlags;
  const { isNew, isAssigned, isInProgress, isAwaitingFinalization, isIncompleteContinuing, isIncompleteReassigned } = statusFlags;
  
  const canUploadPhotos = isNew || isAssigned || isInProgress || isAwaitingFinalization || isIncompleteContinuing || isIncompleteReassigned;

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
  const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      img.onload = () => {
        let { width, height } = img;
        
        // Scale down if larger than maxWidth
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(img.src); // Clean up
        resolve(dataUrl);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  // Upload photo to Supabase Storage
  const uploadPhotoToStorage = async (dataURL: string, jobId: string): Promise<string> => {
    try {
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
      const fileName = `${jobId}/${timestamp}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('job-photos')
        .upload(fileName, blob, {
          contentType: mime,
          upsert: false,
        });
      
      if (error) {
        return dataURL;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (e) {
      return dataURL;
    }
  };

  const uploadPhotoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast.error('Please upload an image file');
      return;
    }

    // Show loading state immediately
    setIsUploading(true);
    showToast.info('Processing photo...', 'Please wait');

    try {
      // Start GPS fetch in background (don't block on it)
      const gpsPromise = getGPSCoordinates();
      
      const deviceTimestamp = new Date(file.lastModified).toISOString();
      const serverTimestamp = new Date().toISOString();
      const timeDiffMs = Math.abs(new Date(serverTimestamp).getTime() - new Date(deviceTimestamp).getTime());
      const timeDiffMinutes = Math.round(timeDiffMs / 60000);
      const timestampMismatch = timeDiffMinutes > 5;

      // Compress image first (much faster than reading full-res base64)
      const base64Data = await compressImage(file, 1920, 0.85);
      
      // Now upload (GPS can still be fetching)
      const [photoUrl, gps] = await Promise.all([
        uploadPhotoToStorage(base64Data, job.job_id),
        gpsPromise,
      ]);

      // === PHOTO-BASED TIME TRACKING ===
      // Only lead technician (not helper) can start/stop timer
      const isLeadTechnician = job.assigned_technician_id === currentUserId;
      
      // Check if this is the first photo and job hasn't started - auto-start timer
      const isFirstPhoto = job.media.length === 0;
      const shouldAutoStart = isFirstPhoto && 
                              !job.repair_start_time && 
                              !job.started_at &&
                              isLeadTechnician &&
                              !isCurrentUserHelper;

      // Check if this is a completion photo (After category) - auto-stop timer
      const isCompletionPhoto = uploadPhotoCategory === 'after';
      const shouldAutoStop = isCompletionPhoto && 
                             job.repair_start_time && 
                             !job.repair_end_time &&
                             isLeadTechnician &&
                             !isCurrentUserHelper;

      const mediaData: NewMediaData = {
        type: 'photo',
        url: photoUrl,
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

      // Auto-start job timer on first photo (lead tech only)
      if (shouldAutoStart) {
        const now = new Date().toISOString();
        const startedJob = await MockDb.updateJob(job.job_id, {
          status: JobStatus.IN_PROGRESS,
          started_at: now,
          repair_start_time: now,
          arrival_time: now,
        });
        onJobUpdate({ ...startedJob } as Job);
        showToast.info('Job started', 'Timer started automatically with first photo');
      } else if (shouldAutoStop) {
        const now = new Date().toISOString();
        const stoppedJob = await MockDb.updateJob(job.job_id, {
          repair_end_time: now,
        });
        onJobUpdate({ ...stoppedJob } as Job);
        showToast.info('Timer stopped', 'Job timer stopped with "After" photo');
      } else {
        onJobUpdate({ ...updated } as Job);
      }

      const categoryLabel = PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other';

      if (!gps && timestampMismatch) {
        showToast.warning('Photo uploaded (flagged)', `GPS missing • Timestamp mismatch: ${timeDiffMinutes}min`);
      } else if (!gps) {
        showToast.warning('Photo uploaded', `GPS location not captured • ${categoryLabel}`);
      } else if (timestampMismatch) {
        showToast.warning('Photo uploaded', `Timestamp mismatch: ${timeDiffMinutes}min • ${categoryLabel}`);
      } else if (!shouldAutoStart && !shouldAutoStop) {
        showToast.success('Photo uploaded', `Category: ${categoryLabel}${isCurrentUserHelper ? ' (Helper)' : ''}`);
      }
    } catch (e) {
      showToast.error('Photo upload failed', (e as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadPhotoFile(file);
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
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadPhotoFile(file);
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
                <p className="text-sm font-semibold text-[var(--accent)]">Uploading photo...</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Compressing and uploading</p>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center justify-center text-center min-h-[180px]">
                <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex items-center justify-center mb-3">
                  <Camera className="w-7 h-7 text-[var(--text-muted)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">Drop photos here</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">or click to upload</p>
                <p className="text-xs text-[var(--text-muted)] mt-3">
                  Uploads default to <span className="font-medium text-[var(--text-secondary)]">{PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other'}</span>
                </p>
                <span className="btn-premium btn-premium-primary mt-4 text-xs">Upload Photo</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
              </label>
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

          {/* Photo Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {job.media.filter(m => photoCategoryFilter === 'all' || m.category === photoCategoryFilter).map(m => {
              const catInfo = PHOTO_CATEGORIES.find(c => c.value === m.category) || PHOTO_CATEGORIES.find(c => c.value === 'other');
              return (
                <div key={m.media_id} className="relative group aspect-square">
                  <img src={m.url} loading="lazy" decoding="async" alt="Job" className="w-full h-full object-cover rounded-xl border border-[var(--border)]" />
                  <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-medium text-white rounded ${catInfo?.color || 'bg-slate-500'}`}>
                    {catInfo?.label || 'Other'}
                  </span>
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
                    <span className="text-[9px] text-[var(--accent)]">Uploading...</span>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <Camera className="w-5 h-5 mb-0.5" />
                    <span className="text-[9px]">Add</span>
                    <span className="text-[9px] text-[var(--text-muted)] mt-0.5">{PHOTO_CATEGORIES.find(c => c.value === uploadPhotoCategory)?.label || 'Other'}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

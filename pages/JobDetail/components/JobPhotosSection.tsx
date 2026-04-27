import { Camera,Download,Images,Trash2 } from 'lucide-react';
import React,{ useMemo,useState } from 'react';
import PhotoLightbox from '../../../components/ui/PhotoLightbox';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Job } from '../../../types';
import { PHOTO_CATEGORIES,getDefaultPhotoCategory } from '../constants';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import { RoleFlags,StatusFlags } from '../types';

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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);

  const { isUploading, uploadProgress, handlePhotoUpload, uploadFiles } = usePhotoUpload({
    job,
    currentUserId,
    currentUserName,
    isCurrentUserHelper,
    uploadPhotoCategory,
    onJobUpdate,
  });

  const { isTechnician, isAdmin, isSupervisor } = roleFlags;
  const { isNew, isAssigned, isInProgress, isAwaitingFinalization, isIncompleteContinuing, isIncompleteReassigned, isCompleted } = statusFlags;

  const canUploadPhotos = isNew || isAssigned || isInProgress || isAwaitingFinalization || isIncompleteContinuing || isIncompleteReassigned;

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
    await uploadFiles(files);
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

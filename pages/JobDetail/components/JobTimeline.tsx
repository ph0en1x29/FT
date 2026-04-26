import { Camera, Clock } from 'lucide-react';
import React, { useState } from 'react';
import PhotoLightbox from '../../../components/ui/PhotoLightbox';
import { Job, JobMedia } from '../../../types';

interface JobTimelineProps {
  job: Job;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  label: string;
  subLabel?: string;
  dotColor: string;
  /** Rejection proof photo — shown with reason text, thumbnail, GPS */
  rejectionProof?: JobMedia;
  /** After photo — shown with thumbnail and repair duration badge */
  afterPhoto?: JobMedia;
  /** Repair duration string shown alongside the after-photo event */
  repairDuration?: string;
}

/** Format milliseconds into a human-readable duration e.g. "2h 35m" */
function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (ms <= 0) return '—';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** True if two ISO timestamps are more than 2 minutes apart */
function isDistinct(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) > 2 * 60 * 1000;
}

export const JobTimeline: React.FC<JobTimelineProps> = ({ job }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // --- Collect special media events ---
  const rejectionPhotos = job.media?.filter((m) => m.category === 'rejection_proof') ?? [];
  const endPhoto = job.media?.find((m) => m.is_end_photo === true) ?? null;

  // --- Build sorted event list ---
  const events: TimelineEvent[] = [];

  if (job.created_at) {
    events.push({
      id: 'created',
      timestamp: job.created_at,
      label: 'Job created',
      subLabel: job.created_by_name ? `By ${job.created_by_name}` : undefined,
      dotColor: 'bg-[var(--accent)]',
    });
  }

  if (job.assigned_at) {
    events.push({
      id: 'assigned',
      timestamp: job.assigned_at,
      label: 'Assigned',
      subLabel: job.assigned_technician_name ? `To ${job.assigned_technician_name}` : undefined,
      dotColor: 'bg-[var(--warning)]',
    });
  }

  // Rejection events (historical — persists after reassignment)
  rejectionPhotos.forEach((media) => {
    events.push({
      id: `rejection-${media.media_id}`,
      timestamp: media.created_at,
      label: 'Rejected',
      subLabel: media.uploaded_by_name ? `By ${media.uploaded_by_name}` : undefined,
      dotColor: 'bg-red-600',
      rejectionProof: media,
    });
  });

  if (job.started_at) {
    events.push({
      id: 'started',
      timestamp: job.started_at,
      label: 'Job started',
      dotColor: 'bg-[var(--success)]',
    });
  }

  // "Repair timer started" — only show if distinct from started_at by >2 min
  if (job.repair_start_time && isDistinct(job.repair_start_time, job.started_at)) {
    events.push({
      id: 'repair-start',
      timestamp: job.repair_start_time,
      label: 'Work started',
      subLabel: 'Repair timer started (first photo taken)',
      dotColor: 'bg-emerald-500',
    });
  }

  // "Work completed" — after photo taken, timer stopped
  if (job.repair_end_time) {
    const duration =
      job.repair_start_time
        ? formatDuration(job.repair_start_time, job.repair_end_time)
        : null;

    events.push({
      id: 'repair-end',
      timestamp: job.repair_end_time,
      label: 'Work completed',
      subLabel: 'After photo taken — repair timer stopped',
      dotColor: 'bg-emerald-600',
      afterPhoto: endPhoto ?? undefined,
      repairDuration: duration ?? undefined,
    });
  }

  if (job.completed_at) {
    events.push({
      id: 'completed',
      timestamp: job.completed_at,
      label: 'Sign-off completed',
      subLabel: job.completed_by_name ? `By ${job.completed_by_name}` : undefined,
      dotColor: 'bg-[var(--success)]',
    });
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // --- Lightbox images (rejection proofs + after photo) ---
  type LightboxImg = { url: string; label: string; timestamp: string };
  const lightboxImages: LightboxImg[] = [];

  events.forEach((e) => {
    if (e.rejectionProof) {
      lightboxImages.push({
        url: e.rejectionProof.url,
        label: `Rejection proof — ${new Date(e.rejectionProof.created_at).toLocaleString()}`,
        timestamp: e.rejectionProof.created_at,
      });
    }
    if (e.afterPhoto) {
      lightboxImages.push({
        url: e.afterPhoto.url,
        label: `After photo — ${new Date(e.afterPhoto.created_at).toLocaleString()}`,
        timestamp: e.afterPhoto.created_at,
      });
    }
  });

  const openLightbox = (url: string) => {
    const idx = lightboxImages.findIndex((img) => img.url === url);
    setLightboxIndex(Math.max(0, idx));
    setLightboxOpen(true);
  };

  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
          <Clock className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <h3 className="font-semibold text-[var(--text)]">Timeline</h3>
      </div>

      {/* Vertical line + events */}
      <div className="relative">
        {/* Connector line */}
        {events.length > 1 && (
          <div className="absolute left-[3px] top-2 bottom-2 w-px bg-[var(--border)]" />
        )}

        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-3 relative">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ring-2 ring-[var(--surface)] ${event.dotColor}`} />
              <div className="min-w-0 flex-1 pb-1">

                {/* Label + timestamp */}
                <p className="text-sm font-medium text-[var(--text)]">{event.label}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
                {event.subLabel && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{event.subLabel}</p>
                )}

                {/* Repair duration badge */}
                {event.repairDuration && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400">
                    <Clock className="w-3 h-3" />
                    Repair time: {event.repairDuration}
                  </span>
                )}

                {/* After photo thumbnail */}
                {event.afterPhoto && (
                  <div className="mt-2 space-y-1">
                    <button
                      onClick={() => openLightbox(event.afterPhoto!.url)}
                      className="flex items-center gap-2 group"
                      title="View after photo"
                    >
                      <div
                        className="rounded-lg overflow-hidden border border-slate-200 hover:border-emerald-400 transition-colors flex-shrink-0"
                        style={{ width: 96, height: 72 }}
                      >
                        <img
                          src={event.afterPhoto.url}
                          alt="After photo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-xs text-[var(--text-muted)] group-hover:text-emerald-600 flex items-center gap-1 transition-colors">
                        <Camera className="w-3 h-3" />
                        View after photo
                      </span>
                    </button>
                    {/* GPS on after photo */}
                    {event.afterPhoto.gps_latitude != null && event.afterPhoto.gps_longitude != null && (
                      <p className="text-xs text-slate-400">
                        GPS: {Math.abs(event.afterPhoto.gps_latitude).toFixed(4)}°{event.afterPhoto.gps_latitude >= 0 ? 'N' : 'S'},{' '}
                        {Math.abs(event.afterPhoto.gps_longitude).toFixed(4)}°{event.afterPhoto.gps_longitude >= 0 ? 'E' : 'W'}
                        {event.afterPhoto.gps_accuracy != null && ` ±${Math.round(event.afterPhoto.gps_accuracy)}m`}
                      </p>
                    )}
                  </div>
                )}

                {/* Rejection proof block */}
                {event.rejectionProof && (
                  <div className="mt-2 space-y-1.5">
                    {event.rejectionProof.description && (
                      <p className="text-xs text-slate-600 italic bg-red-50 border border-red-100 rounded px-2 py-1">
                        &ldquo;{event.rejectionProof.description}&rdquo;
                      </p>
                    )}
                    <button
                      onClick={() => openLightbox(event.rejectionProof!.url)}
                      className="block rounded-lg overflow-hidden border border-slate-200 hover:border-red-400 transition-colors"
                      style={{ width: 96, height: 72 }}
                    >
                      <img
                        src={event.rejectionProof.url}
                        alt="Rejection proof"
                        className="w-full h-full object-cover"
                      />
                    </button>
                    {event.rejectionProof.gps_latitude != null && event.rejectionProof.gps_longitude != null && (
                      <p className="text-xs text-slate-400">
                        GPS: {Math.abs(event.rejectionProof.gps_latitude).toFixed(4)}°{event.rejectionProof.gps_latitude >= 0 ? 'N' : 'S'},{' '}
                        {Math.abs(event.rejectionProof.gps_longitude).toFixed(4)}°{event.rejectionProof.gps_longitude >= 0 ? 'E' : 'W'}
                        {event.rejectionProof.gps_accuracy != null && ` ±${Math.round(event.rejectionProof.gps_accuracy)}m`}
                      </p>
                    )}
                  </div>
                )}

              </div>
            </div>
          ))}
        </div>
      </div>

      {lightboxOpen && lightboxImages.length > 0 && (
        <PhotoLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};

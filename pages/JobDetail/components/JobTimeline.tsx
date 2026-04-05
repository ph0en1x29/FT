import { Clock } from 'lucide-react';
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
  rejectionProof?: JobMedia;
}

export const JobTimeline: React.FC<JobTimelineProps> = ({ job }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Collect rejection proof photos (persists even after reassignment)
  const rejectionPhotos = job.media?.filter((m) => m.category === 'rejection_proof') ?? [];

  // Build sorted event list
  const events: TimelineEvent[] = [];

  if (job.created_at) {
    events.push({
      id: 'created',
      timestamp: job.created_at,
      label: 'Created',
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

  // Each rejection proof photo is a historical rejection event
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
      label: 'Started',
      dotColor: 'bg-[var(--success)]',
    });
  }

  if (job.completed_at) {
    events.push({
      id: 'completed',
      timestamp: job.completed_at,
      label: 'Completed',
      subLabel: job.completed_by_name ? `By ${job.completed_by_name}` : undefined,
      dotColor: 'bg-[var(--success)]',
    });
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Lightbox images from rejection proof photos (ordered as they appear in sorted events)
  const lightboxImages = events
    .filter((e) => e.rejectionProof)
    .map((e) => ({
      url: e.rejectionProof!.url,
      label: `Rejection proof — ${new Date(e.rejectionProof!.created_at).toLocaleString()}`,
      timestamp: e.rejectionProof!.created_at,
    }));

  const openLightbox = (mediaId: string) => {
    const idx = lightboxImages.findIndex((img) =>
      events.find((e) => e.rejectionProof?.media_id === mediaId && e.rejectionProof?.url === img.url)
    );
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

      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${event.dotColor}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text)]">{event.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{new Date(event.timestamp).toLocaleString()}</p>
              {event.subLabel && (
                <p className="text-xs text-[var(--text-muted)]">{event.subLabel}</p>
              )}

              {/* Rejection proof photo block */}
              {event.rejectionProof && (
                <div className="mt-2 space-y-1.5">
                  {/* Reason text (stored in media description) */}
                  {event.rejectionProof.description && (
                    <p className="text-xs text-slate-600 italic bg-red-50 border border-red-100 rounded px-2 py-1">
                      &ldquo;{event.rejectionProof.description}&rdquo;
                    </p>
                  )}

                  {/* Photo thumbnail */}
                  <button
                    onClick={() => openLightbox(event.rejectionProof!.media_id)}
                    className="block rounded-lg overflow-hidden border border-slate-200 hover:border-red-400 transition-colors"
                    style={{ width: 96, height: 72 }}
                  >
                    <img
                      src={event.rejectionProof.url}
                      alt="Rejection proof"
                      className="w-full h-full object-cover"
                    />
                  </button>

                  {/* GPS info */}
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

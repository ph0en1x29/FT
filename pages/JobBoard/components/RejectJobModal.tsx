import { Camera, RefreshCw, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../services/supabaseService';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';

interface RejectJobModalProps {
  show: boolean;
  jobId: string | null;
  currentUserId: string;
  currentUserName: string;
  rejectReason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

interface GpsCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const getGpsCoordinates = (): Promise<GpsCoords | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 },
    );
  });
};

const formatCoord = (value: number, pos: string, neg: string): string => {
  const dir = value >= 0 ? pos : neg;
  return `${Math.abs(value).toFixed(4)}°${dir}`;
};

/**
 * Draws the image onto a canvas, adds a surveillance-style timestamp + GPS overlay,
 * scales to max 1920px, and returns a compressed JPEG data URL.
 */
const buildProofPhoto = (file: File, gps: GpsCoords | null): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read photo'));
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load photo'));
      img.onload = () => {
        requestAnimationFrame(() => {
          try {
            const canvas = document.createElement('canvas');
            const maxWidth = 1920;
            let { width, height } = img;
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas not supported')); return; }

            // Draw photo
            ctx.drawImage(img, 0, 0, width, height);

            // --- Overlay ---
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('en-GB');
            const fontSize = Math.max(14, Math.round(width / 60));
            const lineHeight = Math.round(fontSize * 1.55);
            const pad = Math.round(fontSize * 0.7);

            const line1 = `FieldPro  ·  ${dateStr}, ${timeStr}`;
            const line2 = gps
              ? `GPS: ${formatCoord(gps.latitude, 'N', 'S')}, ${formatCoord(gps.longitude, 'E', 'W')}  Acc: ±${Math.round(gps.accuracy)}m`
              : 'GPS: Unavailable';

            const barHeight = lineHeight * 2 + pad * 2;

            // Semi-transparent bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
            ctx.fillRect(0, height - barHeight, width, barHeight);

            // Text
            ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.textBaseline = 'top';
            const textY = height - barHeight + pad;
            ctx.fillText(line1, pad, textY);
            ctx.fillText(line2, pad, textY + lineHeight);

            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Failed to process photo'));
          }
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
};

const uploadToStorage = async (dataUrl: string, jobId: string): Promise<string> => {
  const doUpload = async (): Promise<string> => {
    const arr = dataUrl.split(',');
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

  try {
    return await doUpload();
  } catch {
    await new Promise(r => setTimeout(r, 1500));
    return doUpload();
  }
};

/**
 * Modal for rejecting a job assignment.
 * Requires both a written reason AND a live proof photo (with timestamp + GPS overlay).
 */
export const RejectJobModal: React.FC<RejectJobModalProps> = ({
  show,
  jobId,
  currentUserId,
  currentUserName,
  rejectReason,
  onReasonChange,
  onConfirm,
  onCancel,
  isProcessing,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<GpsCoords | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Pre-fetch GPS and reset state when modal opens/closes
  useEffect(() => {
    if (show) {
      getGpsCoordinates().then(setGpsCoords);
    } else {
      setProofPreview(null);
      setProofDataUrl(null);
      setGpsCoords(null);
      setIsProcessingPhoto(false);
      setIsSubmitting(false);
      setPhotoError(null);
    }
  }, [show]);

  const handleCameraInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setPhotoError('Photo is too large (>25 MB). Please use a lower camera resolution.');
      return;
    }

    setIsProcessingPhoto(true);
    setPhotoError(null);

    try {
      const dataUrl = await buildProofPhoto(file, gpsCoords);
      setProofDataUrl(dataUrl);
      setProofPreview(dataUrl);
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleConfirm = async () => {
    if (!rejectReason.trim() || !proofDataUrl || !jobId) return;

    setIsSubmitting(true);
    try {
      const serverTimestamp = new Date().toISOString();
      const photoUrl = await uploadToStorage(proofDataUrl, jobId);

      await MockDb.addMedia(
        jobId,
        {
          type: 'photo',
          url: photoUrl,
          description: rejectReason.trim(),
          created_at: serverTimestamp,
          category: 'rejection_proof',
          source: 'camera',
          server_timestamp: serverTimestamp,
          device_timestamp: serverTimestamp,
          timestamp_mismatch: false,
          ...(gpsCoords && {
            gps_latitude: gpsCoords.latitude,
            gps_longitude: gpsCoords.longitude,
            gps_accuracy: gpsCoords.accuracy,
            gps_captured_at: serverTimestamp,
          }),
        },
        currentUserId,
        currentUserName,
        false,
      );

      onConfirm();
    } catch (err) {
      setPhotoError(`Failed to upload proof photo: ${(err as Error).message}`);
      setIsSubmitting(false);
    }
  };

  if (!show) return null;

  const isBusy = isProcessingPhoto || isSubmitting || isProcessing;
  const canSubmit = !!rejectReason.trim() && !!proofDataUrl && !isBusy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={isBusy ? undefined : onCancel}
    >
      <div
        className="bg-[var(--surface)] rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-semibold text-slate-800">Reject Job Assignment</h3>
          {!isBusy && (
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason for rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Describe why you are rejecting this job..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows={3}
              disabled={isBusy}
              autoFocus
            />
          </div>

          {/* Proof photo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Proof photo <span className="text-red-500">*</span>
              <span className="ml-1 font-normal text-slate-500 text-xs">— timestamp &amp; GPS burned in</span>
            </label>

            {proofPreview ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-200">
                <img src={proofPreview} alt="Proof photo preview" className="w-full max-h-52 object-cover" />
                {/* Retake button */}
                {!isBusy && (
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 text-white text-xs font-medium px-2.5 py-1.5 rounded-full hover:bg-black/80 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retake
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-6 text-slate-500 hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingPhoto ? (
                  <>
                    <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium">Processing photo...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-8 h-8" />
                    <span className="text-sm font-medium">Take proof photo</span>
                    <span className="text-xs text-slate-400">Timestamp &amp; GPS will be overlaid automatically</span>
                  </>
                )}
              </button>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraInput}
            />

            {photoError && (
              <p className="mt-1.5 text-xs text-red-600">{photoError}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onCancel}
            disabled={isBusy}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Uploading...' : isProcessing ? 'Rejecting...' : 'Reject Job'}
          </button>
        </div>
      </div>
    </div>
  );
};

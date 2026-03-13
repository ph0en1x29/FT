import { Camera,Edit3,Package,Send,X } from 'lucide-react';
import React,{ useEffect,useRef,useState } from 'react';
import { supabase } from '../../../services/supabaseService';
import { JobRequest,JobRequestType } from '../../../types';

interface CreateRequestModalProps {
  show: boolean;
  submitting: boolean;
  editingRequest?: JobRequest | null;
  onSubmit: (type: JobRequestType, description: string, photoUrl?: string) => void;
  onUpdate?: (requestId: string, type: JobRequestType, description: string, photoUrl?: string) => void;
  onClose: () => void;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
  show,
  submitting,
  editingRequest,
  onSubmit,
  onUpdate,
  onClose,
}) => {
  const [requestType, setRequestType] = useState<JobRequestType>('spare_part');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!editingRequest;

  // Initialize form with existing request data when editing
  useEffect(() => {
    if (editingRequest) {
      setRequestType(editingRequest.request_type);
      setDescription(editingRequest.description || '');
      setPhotoUrl(editingRequest.photo_url || '');
    }
  }, [editingRequest]);

  // Compress image to reduce upload size
  const compressImage = (file: File, maxWidth = 1920, quality = 0.85): Promise<string> => {
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
  const uploadPhotoToStorage = async (dataURL: string): Promise<string> => {
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
      const random = Math.random().toString(36).substring(7);
      const fileName = `requests/${timestamp}_${random}.jpg`;
      
      const { error } = await supabase.storage
        .from('job-photos')
        .upload(fileName, blob, {
          contentType: mime,
          upsert: false,
        });
      
      if (error) {
        throw new Error(error.message);
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (e) {
      throw new Error(`Upload failed: ${(e as Error).message}`);
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Compressing image...');

    try {
      // Compress image
      const compressed = await compressImage(file, 1920, 0.85);
      
      // Upload to storage
      setUploadProgress('Uploading to storage...');
      const publicUrl = await uploadPhotoToStorage(compressed);
      
      // Store URL in state
      setPhotoUrl(publicUrl);
      setUploadProgress('');
    } catch (error) {
      alert(`Photo upload failed: ${(error as Error).message}`);
      setUploadProgress('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  if (!show) return null;

  const handleSubmit = () => {
    if (!description.trim()) return;
    if (isEditMode && onUpdate && editingRequest) {
      onUpdate(editingRequest.request_id, requestType, description.trim(), photoUrl || undefined);
    } else {
      onSubmit(requestType, description.trim(), photoUrl || undefined);
    }
  };

  const handleClose = () => {
    setRequestType('spare_part');
    setDescription('');
    setPhotoUrl('');
    setIsUploading(false);
    setUploadProgress('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-lg text-[var(--text)] flex items-center gap-2">
            {isEditMode ? (
              <Edit3 className="w-5 h-5 text-[var(--accent)]" />
            ) : (
              <Package className="w-5 h-5 text-[var(--accent)]" />
            )}
            {isEditMode ? 'Edit Request' : 'Request Part'}
          </h4>
          <button onClick={handleClose} className="p-1 hover:bg-[var(--bg-subtle)] rounded-lg">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Request Type */}
          <div>
            <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
              Request Type
            </label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as JobRequestType)}
              className="input-premium w-full"
            >
              <option value="spare_part">Spare Part</option>
              <option value="assistance">Assistance (Helper)</option>
              <option value="skillful_technician">Skillful Technician</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-premium w-full h-24 resize-none"
              placeholder={
                requestType === 'spare_part'
                  ? "Describe the part you need (e.g., 'Hydraulic hose 1/2 inch, 2 meters')"
                  : requestType === 'assistance'
                  ? "Describe why you need assistance"
                  : "Describe the specialized skill needed"
              }
            />
          </div>

          {/* Photo Capture (optional) */}
          {requestType === 'spare_part' && (
            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                <Camera className="w-4 h-4 inline mr-1" />
                Photo (optional)
              </label>
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
                disabled={isUploading}
              />
              
              {/* Camera capture area */}
              <div className="flex items-start gap-3">
                {photoUrl ? (
                  // Thumbnail preview with delete option
                  <div className="relative">
                    <img
                      src={photoUrl}
                      alt="Part photo"
                      className="w-[120px] h-[120px] object-cover rounded-xl border-2 border-[var(--border)]"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={isUploading}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-lg"
                      title="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  // Empty state - camera button
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    disabled={isUploading}
                    className="w-[120px] h-[120px] rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-subtle)] hover:bg-[var(--surface)] hover:border-[var(--accent)] transition flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Camera className="w-8 h-8 text-[var(--text-muted)]" />
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      {isUploading ? 'Processing...' : 'Tap to capture'}
                    </span>
                  </button>
                )}
                
                {/* Upload progress or helper text */}
                <div className="flex-1 flex flex-col justify-center">
                  {isUploading && uploadProgress ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-[var(--accent)] font-medium">{uploadProgress}</span>
                    </div>
                  ) : photoUrl ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Photo attached. Tap the X to remove and retake.
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      Take a photo of the part needed for faster processing
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="btn-premium btn-premium-secondary flex-1"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!description.trim() || submitting}
            className="btn-premium btn-premium-primary flex-1 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? (isEditMode ? 'Saving...' : 'Submitting...') : (isEditMode ? 'Save Changes' : 'Submit Request')}
          </button>
        </div>
      </div>
    </div>
  );
};

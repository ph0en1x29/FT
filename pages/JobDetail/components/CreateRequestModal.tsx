import React, { useState, useEffect } from 'react';
import { Package, Camera, X, Send, Edit3 } from 'lucide-react';
import { JobRequest, JobRequestType } from '../../../types';

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

  const isEditMode = !!editingRequest;

  // Initialize form with existing request data when editing
  useEffect(() => {
    if (editingRequest) {
      setRequestType(editingRequest.request_type);
      setDescription(editingRequest.description || '');
      setPhotoUrl(editingRequest.photo_url || '');
    }
  }, [editingRequest]);

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

          {/* Photo URL (optional) */}
          {requestType === 'spare_part' && (
            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                <Camera className="w-4 h-4 inline mr-1" />
                Photo URL (optional)
              </label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="input-premium w-full"
                placeholder="https://..."
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Attach a photo of the part needed
              </p>
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

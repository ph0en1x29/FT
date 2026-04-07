/* eslint-disable max-lines */
import {
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Gauge,
  Play,
  RefreshCw,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { SignaturePad } from '../../../components/SignaturePad';
import { ForkliftConditionChecklist, Job } from '../../../types';
import { CHECKLIST_CATEGORIES } from '../constants';
import { calculateJobTotals } from '../utils';

interface SignatureModalProps {
  show: boolean;
  title: string;
  subtitle: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  show,
  title,
  subtitle,
  onSave,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-4 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold mb-4 text-[var(--text)]">{title}</h4>
        <p className="text-xs text-[var(--text-muted)] mb-2">{subtitle}</p>
        <SignaturePad onSave={onSave} />
        <button onClick={onClose} className="mt-4 text-sm text-[var(--error)] underline w-full text-center">Cancel</button>
      </div>
    </div>
  );
};

interface StartJobModalProps {
  show: boolean;
  startJobHourmeter: string;
  lastRecordedHourmeter: number;
  conditionChecklist: ForkliftConditionChecklist;
  beforePhotos: File[];
  isRepairJob: boolean;
  onHourmeterChange: (value: string) => void;
  onChecklistToggle: (key: string) => void;
  onCheckAll: () => void;
  onUncheckAll: () => void;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (index: number) => void;
  onStartJob: () => void;
  onClose: () => void;
}

export const StartJobModal: React.FC<StartJobModalProps> = ({
  show,
  startJobHourmeter,
  lastRecordedHourmeter,
  conditionChecklist,
  beforePhotos,
  isRepairJob,
  onHourmeterChange,
  onChecklistToggle,
  onCheckAll,
  onUncheckAll,
  onAddPhotos,
  onRemovePhoto,
  onStartJob,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationStatus, setLocationStatus] = useState<'pending' | 'acquired' | 'failed'>('pending');

  // Cleanup object URLs on unmount or photo changes
  useEffect(() => {
    const urls = beforePhotos.map(file => URL.createObjectURL(file));
    setPhotoUrls(urls);
    
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [beforePhotos]);

  // Reset step when modal closes
  useEffect(() => {
    if (!show) {
      setCurrentStep(1);
    }
  }, [show]);

  // Request geolocation when modal opens
  useEffect(() => {
    if (show && locationStatus === 'pending') {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setLocationStatus('acquired');
          },
          (error) => {
            console.error('Geolocation error:', error);
            setLocationStatus('failed');
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } else {
        setLocationStatus('failed');
      }
    }
  }, [show, locationStatus]);

  if (!show) return null;

  // Count checked items
  const totalItems = CHECKLIST_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0);
  const checkedItems = Object.values(conditionChecklist).filter(Boolean).length;
  const allChecked = checkedItems === totalItems;

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onAddPhotos(files);
    }
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-premium-elevated pb-32 md:pb-6">
        {/* Step Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className={`flex items-center gap-2 ${currentStep === 1 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                currentStep === 1 ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] border-2 border-[var(--border)]'
              }`}>
                1
              </div>
              <span className="text-xs font-medium">Photos</span>
            </div>
            <div className="w-12 h-0.5 bg-[var(--border)]" />
            <div className={`flex items-center gap-2 ${currentStep === 2 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                currentStep === 2 ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] border-2 border-[var(--border)]'
              }`}>
                2
              </div>
              <span className="text-xs font-medium">Inspection</span>
            </div>
          </div>
          <p className="text-center text-xs text-[var(--text-muted)]">
            {currentStep === 1 ? 'Step 1 of 2: Before Condition Photos' : isRepairJob ? 'Step 2 of 2: Hourmeter' : 'Step 2 of 2: Hourmeter & Checklist'}
          </p>
        </div>

        {/* Step 1: Photos */}
        {currentStep === 1 && (
          <>
            <h4 className="font-bold text-xl mb-2 text-[var(--text)] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[var(--accent)]" /> 📸 Before Condition Photos
            </h4>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Take on-site photos of the forklift's current condition. Photos must be taken with camera.
            </p>

            {/* Photo Upload Area */}
            <div className="mb-6">
              <div className="flex flex-col gap-3 mb-4">
                {/* Camera Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-premium btn-premium-primary w-full py-4 text-base flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Take Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleCameraCapture}
                />

                {/* Location Status Indicator */}
                <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                  {locationStatus === 'pending' && (
                    <>
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span>Getting location...</span>
                    </>
                  )}
                  {locationStatus === 'acquired' && (
                    <>
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-green-600">📍 Location captured</span>
                    </>
                  )}
                  {locationStatus === 'failed' && (
                    <>
                      <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                      <span className="text-orange-600">⚠️ Location unavailable</span>
                    </>
                  )}
                </div>
              </div>

              {/* Photo Count */}
              <div className="text-center mb-4">
                <span className={`text-sm font-semibold ${beforePhotos.length > 0 ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                  {beforePhotos.length} photo(s) taken
                </span>
                {beforePhotos.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">Minimum 1 photo required</p>
                )}
              </div>

              {/* Photo Grid */}
              {beforePhotos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {beforePhotos.map((file, index) => {
                    const timestamp = new Date(file.lastModified).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });
                    
                    return (
                      <div key={index} className="relative aspect-square group">
                        <img
                          src={photoUrls[index]}
                          alt={`Before ${index + 1}`}
                          className="w-full h-full object-cover rounded-lg border border-[var(--border)]"
                        />
                        {/* Timestamp Overlay */}
                        <div 
                          className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] text-white font-medium"
                          style={{
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          {timestamp}
                        </div>
                        <button
                          onClick={() => onRemovePhoto(index)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 justify-end border-t border-[var(--border)] pt-4">
              <button onClick={onClose} className="btn-premium btn-premium-secondary">Cancel</button>
              <button
                onClick={() => setCurrentStep(2)}
                disabled={beforePhotos.length === 0}
                className={`btn-premium ${beforePhotos.length > 0 ? 'btn-premium-primary' : 'btn-premium-secondary opacity-60 cursor-not-allowed'}`}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Step 2: Hourmeter & Checklist */}
        {currentStep === 2 && (
          <>
            <h4 className="font-bold text-xl mb-4 text-[var(--text)] flex items-center gap-2">
              <Play className="w-5 h-5 text-[var(--accent)]" /> Start Job - Condition Check
            </h4>
            <div className="bg-[var(--warning-bg)] p-4 rounded-xl border border-[var(--warning)] border-opacity-20 mb-6">
              <label className="text-sm font-bold text-[var(--warning)] mb-2 block flex items-center gap-2">
                <Gauge className="w-4 h-4" /> Current Hourmeter *
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  className="input-premium w-40" 
                  value={startJobHourmeter} 
                  onChange={(e) => onHourmeterChange(e.target.value)} 
                  placeholder="e.g., 5230" 
                />
                <span className="text-[var(--text-muted)]">hours</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last recorded: <span className="font-semibold text-[var(--text-secondary)]">{lastRecordedHourmeter.toLocaleString()} hrs</span>
              </p>
            </div>
            {!isRepairJob && <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-bold text-[var(--text)] flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" /> Condition Checklist
                  <span className="text-sm font-normal text-[var(--text-muted)]">({checkedItems}/{totalItems})</span>
                </h5>
                <div className="flex gap-2">
                  <button 
                    onClick={onCheckAll}
                    disabled={allChecked}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Check All
                  </button>
                  <button 
                    onClick={onUncheckAll}
                    disabled={checkedItems === 0}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Uncheck All
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-4">Tap to toggle. Green = OK, Red X = Needs attention.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CHECKLIST_CATEGORIES.map(category => (
                  <div key={category.name} className="bg-[var(--bg-subtle)] p-3 rounded-xl border border-[var(--border)]">
                    <h6 className="font-semibold text-[var(--text-secondary)] text-xs mb-2 border-b border-[var(--border-subtle)] pb-1">{category.name}</h6>
                    <div className="space-y-1">
                      {category.items.map(item => {
                        const itemValue = conditionChecklist[item.key as keyof ForkliftConditionChecklist];
                        const isNotOk = itemValue === 'not_ok';
                        const isOk = itemValue === true || itemValue === 'ok';

                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => onChecklistToggle(item.key)}
                            className={`w-full flex items-center gap-2 p-1.5 rounded text-xs border text-left transition-colors ${
                              isNotOk
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200'
                                : 'border-transparent hover:bg-[var(--surface-2)]'
                            }`}
                          >
                            {isOk ? (
                              <CheckCircle className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                            ) : isNotOk ? (
                              <X className="w-3.5 h-3.5 text-[var(--error)] shrink-0" />
                            ) : (
                              <span className="w-3.5 h-3.5 flex items-center justify-center text-[var(--text-muted)] shrink-0">-</span>
                            )}
                            <span className={isOk ? 'text-[var(--success)]' : isNotOk ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>}
            <div className="flex gap-3 justify-end border-t border-[var(--border)] pt-4">
              <button onClick={() => setCurrentStep(1)} className="btn-premium btn-premium-secondary">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={onClose} className="btn-premium btn-premium-secondary">Cancel</button>
              <button
                onClick={onStartJob}
                disabled={!startJobHourmeter || (!isRepairJob && !allChecked)}
                className={`btn-premium ${startJobHourmeter && (isRepairJob || allChecked) ? 'btn-premium-primary' : 'btn-premium-secondary opacity-60 cursor-not-allowed'}`}
              >
                <Play className="w-4 h-4" /> Start Job
                {(!startJobHourmeter || (!isRepairJob && !allChecked)) && (
                  <span className="text-xs ml-1 opacity-70">
                    ({!startJobHourmeter ? 'hourmeter required' : `${checkedItems}/${totalItems} checked`})
                  </span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface FinalizeModalProps {
  show: boolean;
  job: Job;
  currentUserName: string;
  onFinalize: () => void;
  onClose: () => void;
}

export const FinalizeModal: React.FC<FinalizeModalProps> = ({
  show,
  job,
  currentUserName,
  onFinalize,
  onClose,
}) => {
  if (!show) return null;

  const { totalCost } = calculateJobTotals(job);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--text)]">Finalize Invoice</h4>
        <p className="text-sm text-[var(--text-muted)] mb-6">This action cannot be undone.</p>
        <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-6">
          <div className="flex justify-between mb-1">
            <span className="text-[var(--text-muted)]">Total:</span>
            <span className="font-bold text-xl text-[var(--success)]">RM{totalCost.toFixed(2)}</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">Finalized by: {currentUserName}</div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button onClick={onFinalize} className="btn-premium btn-premium-primary flex-1">Finalize</button>
        </div>
      </div>
    </div>
  );
};

interface ReassignModalProps {
  show: boolean;
  job: Job;
  techOptions: ComboboxOption[];
  reassignTechId: string;
  onReassignTechIdChange: (id: string) => void;
  onReassign: () => void;
  onClose: () => void;
}

export const ReassignModal: React.FC<ReassignModalProps> = ({
  show,
  job,
  techOptions,
  reassignTechId,
  onReassignTechIdChange,
  onReassign,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--text)] flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-[var(--accent)]" /> Reassign Job
        </h4>
        <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-4 text-sm">
          <div className="text-[var(--text-muted)]">Currently assigned:</div>
          <div className="font-medium text-[var(--text)]">{job?.assigned_technician_name || 'Unassigned'}</div>
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">New Technician</label>
          <Combobox 
            options={techOptions.filter(t => t.id !== job?.assigned_technician_id)} 
            value={reassignTechId} 
            onChange={onReassignTechIdChange} 
            placeholder="Select technician..." 
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button type="button" onClick={onReassign} disabled={!reassignTechId} className="btn-premium btn-premium-primary flex-1 disabled:opacity-50">
            <RefreshCw className="w-4 h-4" /> Reassign
          </button>
        </div>
      </div>
    </div>
  );
};

interface ContinueTomorrowModalProps {
  show: boolean;
  job: Job;
  reason: string;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const ContinueTomorrowModal: React.FC<ContinueTomorrowModalProps> = ({
  show,
  job,
  reason,
  submitting,
  onReasonChange,
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--warning)] flex items-center gap-2">
          <Clock className="w-5 h-5" /> Continue Tomorrow
        </h4>
        <div className="bg-[var(--warning-bg)] rounded-xl p-3 mb-4">
          <p className="text-sm text-[var(--warning)] font-medium">{job?.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Job will be marked incomplete and can resume tomorrow.</p>
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason *</label>
          <textarea 
            className="input-premium resize-none h-24" 
            value={reason} 
            onChange={(e) => onReasonChange(e.target.value)} 
            placeholder="e.g., Waiting for parts..." 
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={!reason.trim() || submitting} 
            className="btn-premium bg-[var(--warning)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteModalProps {
  show: boolean;
  job: Job;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  show,
  job,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--error)] flex items-center gap-2">
          <Trash2 className="w-5 h-5" /> Delete Job
        </h4>
        <div className="bg-[var(--error-bg)] rounded-xl p-3 mb-4">
          <p className="text-sm text-[var(--error)] font-medium">{job?.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">This will mark the job as cancelled.</p>
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason *</label>
          <textarea 
            className="input-premium resize-none h-24" 
            value={reason} 
            onChange={(e) => onReasonChange(e.target.value)} 
            placeholder="e.g., Customer cancelled..." 
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={!reason.trim()} 
            className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
};

interface RejectJobModalProps {
  show: boolean;
  job: Job;
  reason: string;
  onReasonChange: (value: string) => void;
  photoFile: File | null;
  photoPreviewUrl: string;
  onPhotoChange: (file: File | null) => void;
  uploading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const RejectJobModal: React.FC<RejectJobModalProps> = ({
  show,
  job,
  reason,
  onReasonChange,
  photoFile,
  photoPreviewUrl,
  onPhotoChange,
  uploading,
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    onPhotoChange(f);
    e.target.value = '';
  };

  const canConfirm = reason.trim().length > 0 && photoFile !== null && !uploading;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated max-h-[90vh] overflow-y-auto">
        <h4 className="font-bold text-lg mb-4 text-[var(--error)] flex items-center gap-2">
          <XCircle className="w-5 h-5" /> Reject Job Assignment
        </h4>
        <div className="bg-[var(--warning-bg)] rounded-xl p-3 mb-4">
          <p className="text-sm text-[var(--warning)] font-medium">{job?.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">This job will be returned to Admin for reassignment. On-site photo + reason are required.</p>
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason for Rejection *</label>
          <textarea
            className="input-premium resize-none h-24"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="e.g., Weather hazard at site, vehicle blocked, customer not on premises, etc."
          />
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">On-Site Photo Proof *</label>
          <p className="text-xs text-[var(--text-muted)] mb-2">Required so admin can verify you were on-site when rejecting. GPS location is captured automatically.</p>
          {photoPreviewUrl ? (
            <div className="relative mb-2">
              <img src={photoPreviewUrl} alt="Rejection proof preview" className="w-full max-h-48 object-contain rounded-xl border border-[var(--border)]" />
              <button
                onClick={() => onPhotoChange(null)}
                disabled={uploading}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 disabled:opacity-50"
                aria-label="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="block w-full cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />
              <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-6 text-center hover:bg-[var(--bg-subtle)] transition-colors">
                <Camera className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">Tap to take photo</p>
              </div>
            </label>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={uploading} className="btn-premium btn-premium-secondary flex-1 disabled:opacity-50">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Reject Job'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ReportOptionsModalProps {
  show: boolean;
  onSelect: (showPrices: boolean) => void;
  onClose: () => void;
}

export const ReportOptionsModal: React.FC<ReportOptionsModalProps> = ({ show, onSelect, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <div className="flex items-start justify-between mb-4">
          <h4 className="font-bold text-lg text-[var(--text)]">Service Report Options</h4>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5">
          Should this report include prices? Hide prices for customer-facing copies.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelect(false)}
            className="btn-premium btn-premium-primary w-full"
          >
            Hide Prices (Customer Copy)
          </button>
          <button
            onClick={() => onSelect(true)}
            className="btn-premium btn-premium-secondary w-full"
          >
            Show Prices (Internal Copy)
          </button>
        </div>
      </div>
    </div>
  );
};

// Re-export from JobDetailModalsSecondary
export {
  ChecklistWarningModal,
  HelperModal,
  DeferredCompletionModal,
} from './JobDetailModalsSecondary';

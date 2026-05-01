import {
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Gauge,
  Play,
  X,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { ForkliftConditionChecklist } from '../../../../types';
import { CHECKLIST_CATEGORIES } from '../../constants';

interface StartJobModalProps {
  show: boolean;
  startJobHourmeter: string;
  lastRecordedHourmeter: number;
  conditionChecklist: ForkliftConditionChecklist;
  beforePhotos: File[];
  isRepairJob: boolean;
  skipHourmeter?: boolean;
  brokenMeterNote: string;
  onHourmeterChange: (value: string) => void;
  onBrokenMeterNoteChange: (value: string) => void;
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
  skipHourmeter = false,
  brokenMeterNote,
  onHourmeterChange,
  onBrokenMeterNoteChange,
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
  const [, setLocation] = useState<{lat: number, lng: number} | null>(null);
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
            {currentStep === 1
              ? 'Step 1 of 2: Before Condition Photos'
              : skipHourmeter && isRepairJob
                ? 'Step 2 of 2: Confirm Start'
                : skipHourmeter
                  ? 'Step 2 of 2: Checklist'
                  : isRepairJob
                    ? 'Step 2 of 2: Hourmeter'
                    : 'Step 2 of 2: Hourmeter & Checklist'}
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
                      <div key={photoUrls[index] || index} className="relative aspect-square group">
                        <img
                          src={photoUrls[index]}
                          alt={`Before ${index + 1}`}
                          loading="lazy"
                          decoding="async"
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
            {!skipHourmeter && <div className="bg-[var(--warning-bg)] p-4 rounded-xl border border-[var(--warning)] border-opacity-20 mb-6">
              <label className="text-sm font-bold text-[var(--warning)] mb-2 block flex items-center gap-2">
                <Gauge className="w-4 h-4" /> Current Hourmeter *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
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
              {/* Greyed instruction — technician-facing hint. Broken-meter convention
                  is documented in USER_GUIDE.md + utils.ts:isHourmeterExemptJob. */}
              <p className="text-xs text-[var(--text-muted)] mt-2 italic">
                If the hourmeter is broken or reading is unavailable, enter <span className="font-semibold">1</span> and add a remark below stating the meter is broken.
              </p>
              {startJobHourmeter.trim() === '1' && (
                <div className="mt-3">
                  <label className="text-xs font-bold text-[var(--warning)] mb-1 block">
                    Broken meter remark *
                  </label>
                  <textarea
                    className="input-premium w-full text-sm"
                    rows={2}
                    value={brokenMeterNote}
                    onChange={(e) => onBrokenMeterNoteChange(e.target.value)}
                    placeholder="E.g., meter display is broken, unable to get reading"
                  />
                </div>
              )}
            </div>}
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
            {/* Hourmeter gate: non-empty AND parseable AND ≥ 1. Technicians who
                were entering "0" to skip must now enter "1" + a broken-meter remark. */}
            {(() => {
              const hourmeterParsed = parseInt(startJobHourmeter, 10);
              const hourmeterValid = !skipHourmeter
                ? !isNaN(hourmeterParsed) && hourmeterParsed >= 1
                : true;
              const brokenMeterNoteValid = skipHourmeter || startJobHourmeter.trim() !== '1' || brokenMeterNote.trim().length > 0;
              const checklistValid = isRepairJob || allChecked;
              const canStart = hourmeterValid && brokenMeterNoteValid && checklistValid;
              const hint = !hourmeterValid
                ? (startJobHourmeter.trim() === '' ? 'hourmeter required' : 'hourmeter must be ≥ 1')
                : !brokenMeterNoteValid
                  ? 'broken meter remark required'
                  : !checklistValid
                    ? `${checkedItems}/${totalItems} checked`
                    : null;
              return (
                <div className="flex gap-3 justify-end border-t border-[var(--border)] pt-4">
                  <button onClick={() => setCurrentStep(1)} className="btn-premium btn-premium-secondary">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={onClose} className="btn-premium btn-premium-secondary">Cancel</button>
                  <button
                    onClick={onStartJob}
                    disabled={!canStart}
                    className={`btn-premium ${canStart ? 'btn-premium-primary' : 'btn-premium-secondary opacity-60 cursor-not-allowed'}`}
                  >
                    <Play className="w-4 h-4" /> Start Job
                    {hint && <span className="text-xs ml-1 opacity-70">({hint})</span>}
                  </button>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Custom hook for job action handlers
 */

import { useCallback } from 'react';
import { Job, JobStatus, ForkliftConditionChecklist, JobRequest, MediaCategory, UserRole, MANDATORY_CHECKLIST_ITEMS, normalizeChecklistState } from '../../../types';
import { SupabaseDb as MockDb, supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { generateJobSummary } from '../../../services/geminiService';
import { useJobDetail } from '../JobDetailContext';
import { CHECKLIST_CATEGORIES, PHOTO_CATEGORIES, getDefaultPhotoCategory } from '../constants';

export function useJobActions() {
  const {
    job,
    setJob,
    loadJob,
    loadRequests,
    loadVanStock,
    navigate,
    currentUserId,
    currentUserName,
    currentUserRole,
    isCurrentUserHelper,
    setNoPartsUsed,
    noPartsUsed,
    setHourmeterFlagReasons,
    hourmeterFlagReasons,
  } = useJobDetail();

  // Role checks
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'admin_service' || currentUserRole === 'admin_store';
  const isAdminService = currentUserRole === 'admin_service' || currentUserRole === 'admin';
  const isAdminStore = currentUserRole === 'admin_store' || currentUserRole === 'admin';
  const isSupervisor = currentUserRole === 'supervisor';
  const isTechnician = currentUserRole === 'technician';
  const isAccountant = currentUserRole === 'accountant';

  // ===== STATUS CHANGES =====

  const handleStatusChange = useCallback(async (newStatus: JobStatus) => {
    if (!job) return;
    try {
      const updated = await MockDb.updateJobStatus(job.job_id, newStatus, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      showToast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      showToast.error('Failed to update status', (error as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleAcceptJob = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.acceptJobAssignment(job.job_id, currentUserId, currentUserName);
      setJob(updated as Job);
      showToast.success('Job accepted', 'You can now start the job when ready.');
    } catch (e) {
      showToast.error('Failed to accept job', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleRejectJob = useCallback(async (reason: string) => {
    if (!job || !reason.trim()) {
      showToast.error('Please provide a reason for rejecting this job');
      return;
    }
    try {
      await MockDb.rejectJobAssignment(job.job_id, currentUserId, currentUserName, reason.trim());
      showToast.success('Job rejected', 'Admin has been notified for reassignment.');
      navigate('/jobs');
    } catch (e) {
      showToast.error('Failed to reject job', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, navigate]);

  const handleAcknowledgeJob = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.updateJob(job.job_id, {
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_id: currentUserId,
        acknowledged_by_name: currentUserName,
      });
      setJob({ ...updated } as Job);
      showToast.success('Job acknowledged', 'SLA timer stopped');
    } catch (error) {
      showToast.error('Failed to acknowledge job', (error as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleStartJobWithCondition = useCallback(async (hourmeter: number, checklist: ForkliftConditionChecklist) => {
    if (!job) return;
    if (isNaN(hourmeter) || hourmeter < 0) {
      showToast.error('Please enter a valid hourmeter reading');
      return;
    }
    const currentForkliftHourmeter = job.forklift?.hourmeter || 0;
    if (hourmeter < currentForkliftHourmeter) {
      showToast.error(`Hourmeter must be ≥ ${currentForkliftHourmeter} (forklift's current reading)`);
      return;
    }
    try {
      const updated = await MockDb.startJobWithCondition(job.job_id, hourmeter, checklist, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      showToast.success('Job started', 'Status changed to In Progress');
    } catch (error) {
      showToast.error('Failed to start job', (error as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleContinueTomorrow = useCallback(async (reason: string) => {
    if (!job || !reason.trim()) return;
    try {
      const success = await MockDb.markJobContinueTomorrow(job.job_id, reason, currentUserId, currentUserName);
      if (success) {
        showToast.success('Job marked to continue tomorrow');
        loadJob();
      } else {
        showToast.error('Failed to update job');
      }
    } catch (e) {
      console.error('Continue tomorrow error:', e);
      showToast.error('Error updating job');
    }
  }, [job, currentUserId, currentUserName, loadJob]);

  const handleResumeJob = useCallback(async () => {
    if (!job) return;
    try {
      const success = await MockDb.resumeMultiDayJob(job.job_id, currentUserId, currentUserName);
      if (success) {
        showToast.success('Job resumed');
        loadJob();
      } else {
        showToast.error('Failed to resume job');
      }
    } catch (e) {
      console.error('Resume job error:', e);
      showToast.error('Error resuming job');
    }
  }, [job, currentUserId, currentUserName, loadJob]);

  const handleDeferredCompletion = useCallback(async (reason: string, hourmeterValue: number, evidenceIds: string[]) => {
    if (!job || !reason.trim()) return;
    if (isNaN(hourmeterValue)) {
      showToast.error('Please enter a valid hourmeter reading');
      return;
    }
    const startHourmeter = job.start_hourmeter || job.forklift?.hourmeter || 0;
    if (hourmeterValue < startHourmeter) {
      showToast.error(`Hourmeter must be >= start reading (${startHourmeter})`);
      return;
    }
    if (evidenceIds.length === 0) {
      showToast.error('Please select at least 1 evidence photo');
      return;
    }
    try {
      const result = await MockDb.deferJobCompletion(job.job_id, reason, evidenceIds, currentUserId, currentUserName, hourmeterValue);
      if (result.success) {
        showToast.success('Job marked as completed (pending customer acknowledgement)');
        loadJob();
      } else {
        showToast.error(result.error || 'Failed to defer completion');
      }
    } catch (e) {
      console.error('Deferred completion error:', e);
      showToast.error('Error processing deferred completion');
    }
  }, [job, currentUserId, currentUserName, loadJob]);

  // ===== ASSIGNMENT =====

  const handleAssignJob = useCallback(async (techId: string, technicians: any[]) => {
    if (!job || !techId) return;
    const tech = technicians.find(t => t.user_id === techId);
    if (tech) {
      const updated = await MockDb.assignJob(job.job_id, tech.user_id, tech.name, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleReassignJob = useCallback(async (techId: string, technicians: any[]) => {
    if (!job || !techId) return;
    const tech = technicians.find(t => t.user_id === techId);
    if (tech) {
      try {
        const updated = await MockDb.reassignJob(job.job_id, tech.user_id, tech.name, currentUserId, currentUserName);
        if (updated) {
          setJob({ ...updated } as Job);
          showToast.success(`Job reassigned to ${tech.name}`);
        }
      } catch (e) {
        showToast.error('Failed to reassign job', (e as Error).message);
      }
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleAssignHelper = useCallback(async (helperId: string, notes?: string) => {
    if (!job || !helperId) {
      showToast.error('Please select a helper technician');
      return false;
    }
    if (helperId === job.assigned_technician_id) {
      showToast.error('Cannot assign lead technician as helper');
      return false;
    }
    const result = await MockDb.assignHelper(job.job_id, helperId, currentUserId, notes);
    if (result) {
      showToast.success('Helper assigned');
      loadJob();
      return true;
    } else {
      showToast.error('Failed to assign helper');
      return false;
    }
  }, [job, currentUserId, loadJob]);

  const handleRemoveHelper = useCallback(async () => {
    if (!job) return;
    const confirmed = window.confirm('Remove helper technician from this job?');
    if (!confirmed) return;
    const success = await MockDb.removeHelper(job.job_id);
    if (success) {
      showToast.success('Helper removed');
      loadJob();
    } else {
      showToast.error('Failed to remove helper');
    }
  }, [job, loadJob]);

  // ===== PARTS =====

  const handleAddPart = useCallback(async (
    partId: string,
    price?: number,
    fromVanStock?: boolean,
    vanStockItemId?: string,
    vanStock?: any
  ) => {
    if (!job) return;
    
    if (fromVanStock && vanStockItemId) {
      const vanStockItem = vanStock?.items?.find((i: any) => i.item_id === vanStockItemId);
      if (!vanStockItem) {
        showToast.error('Van Stock item not found');
        return;
      }
      
      const isCustomerOwnedForklift = job?.forklift?.ownership === 'customer';
      try {
        await MockDb.useVanStockPart(vanStockItemId, job.job_id, 1, currentUserId, currentUserName, isCustomerOwnedForklift);
        const updated = await MockDb.addPartToJob(job.job_id, vanStockItem.part_id, 1, price || vanStockItem.part?.sell_price, currentUserRole);
        setJob({ ...updated } as Job);
        loadVanStock();
        if (isCustomerOwnedForklift) {
          showToast.warning('Part added (pending approval)', 'Customer-owned forklift requires admin approval');
        } else {
          showToast.success('Part added from Van Stock');
        }
      } catch (e) {
        showToast.error('Could not add part from Van Stock', (e as Error).message);
      }
      return;
    }

    if (!partId) return;
    try {
      const updated = await MockDb.addPartToJob(job.job_id, partId, 1, price, currentUserRole);
      setJob({ ...updated } as Job);
      showToast.success('Part added to job');
    } catch (e) {
      showToast.error('Could not add part', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, currentUserRole, setJob, loadVanStock]);

  const handleRemovePart = useCallback(async (jobPartId: string) => {
    if (!job) return;
    if (!confirm('Remove this part from the job?')) return;
    try {
      const updated = await MockDb.removePartFromJob(job.job_id, jobPartId, currentUserRole);
      setJob({ ...updated } as Job);
      showToast.success('Part removed from job');
    } catch (e) {
      showToast.error('Could not remove part', (e as Error).message);
    }
  }, [job, currentUserRole, setJob]);

  const handleSavePartPrice = useCallback(async (jobPartId: string, price: number) => {
    if (!job) return;
    if (isNaN(price) || price < 0) {
      showToast.error('Please enter a valid price');
      return;
    }
    try {
      const updated = await MockDb.updatePartPrice(job.job_id, jobPartId, price);
      setJob({ ...updated } as Job);
      showToast.success('Price updated');
    } catch (e) {
      showToast.error('Could not update price');
    }
  }, [job, setJob]);

  const handleToggleNoPartsUsed = useCallback(async () => {
    if (!job) return;
    const newValue = !noPartsUsed;
    try {
      await MockDb.setNoPartsUsed(job.job_id, newValue);
      setNoPartsUsed(newValue);
    } catch (e) {
      showToast.error('Could not update', (e as Error).message);
    }
  }, [job, noPartsUsed, setNoPartsUsed]);

  // ===== PRICING =====

  const handleSaveLabor = useCallback(async (cost: number) => {
    if (!job) return;
    if (isNaN(cost) || cost < 0) {
      showToast.error('Please enter a valid labor cost');
      return;
    }
    try {
      const updated = await MockDb.updateLaborCost(job.job_id, cost);
      setJob({ ...updated } as Job);
      showToast.success('Labor cost updated');
    } catch (e) {
      showToast.error('Could not update labor cost');
    }
  }, [job, setJob]);

  const handleAddExtraCharge = useCallback(async (name: string, description: string, amount: number) => {
    if (!job) return;
    if (!name.trim()) {
      showToast.error('Please enter a charge name');
      return;
    }
    if (isNaN(amount) || amount < 0) {
      showToast.error('Please enter a valid amount');
      return;
    }
    try {
      const updated = await MockDb.addExtraCharge(job.job_id, { name: name.trim(), description: description.trim(), amount });
      setJob({ ...updated } as Job);
      showToast.success('Extra charge added');
    } catch (e) {
      showToast.error('Could not add extra charge');
    }
  }, [job, setJob]);

  const handleRemoveExtraCharge = useCallback(async (chargeId: string) => {
    if (!job) return;
    if (!confirm('Remove this charge?')) return;
    try {
      const updated = await MockDb.removeExtraCharge(job.job_id, chargeId);
      setJob({ ...updated } as Job);
      showToast.success('Extra charge removed');
    } catch (e) {
      showToast.error('Could not remove charge');
    }
  }, [job, setJob]);

  // ===== NOTES =====

  const handleAddNote = useCallback(async (note: string) => {
    if (!job || !note.trim()) return;
    try {
      const updated = await MockDb.addNote(job.job_id, note);
      setJob({ ...updated } as Job);
    } catch (error) {
      console.error('Error adding note:', error);
      showToast.error('Could not add note', (error as Error).message);
    }
  }, [job, setJob]);

  // ===== PHOTOS =====

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
        (error) => {
          console.warn('GPS error:', error.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

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
        console.warn('[Storage] Photo upload failed, using base64:', error.message);
        return dataURL;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (e) {
      console.warn('[Storage] Photo upload error, using base64:', e);
      return dataURL;
    }
  };

  const uploadPhotoFile = useCallback(async (file: File, category: string) => {
    if (!job) return;
    if (!file.type.startsWith('image/')) {
      showToast.error('Please upload an image file');
      return;
    }

    const gpsPromise = getGPSCoordinates();
    const deviceTimestamp = new Date(file.lastModified).toISOString();
    const serverTimestamp = new Date().toISOString();
    const timeDiffMs = Math.abs(new Date(serverTimestamp).getTime() - new Date(deviceTimestamp).getTime());
    const timeDiffMinutes = Math.round(timeDiffMs / 60000);
    const timestampMismatch = timeDiffMinutes > 5;

    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const gps = await gpsPromise;
          const base64Data = reader.result as string;
          const photoUrl = await uploadPhotoToStorage(base64Data, job.job_id);

          const mediaData: any = {
            type: 'photo',
            url: photoUrl,
            description: file.name,
            created_at: serverTimestamp,
            category: category as MediaCategory,
            source: 'camera',
            device_timestamp: deviceTimestamp,
            server_timestamp: serverTimestamp,
            timestamp_mismatch: timestampMismatch,
            timestamp_mismatch_minutes: timestampMismatch ? timeDiffMinutes : undefined,
          };

          if (gps) {
            mediaData.gps_latitude = gps.latitude;
            mediaData.gps_longitude = gps.longitude;
            mediaData.gps_accuracy = gps.accuracy;
            mediaData.gps_captured_at = serverTimestamp;
          }

          const isLeadTechnician = job.assigned_technician_id === currentUserId;
          const isHelperPhoto = isCurrentUserHelper;
          const isFirstPhoto = job.media.length === 0;
          const shouldAutoStart = isFirstPhoto && !job.repair_start_time && !job.started_at && isLeadTechnician && !isHelperPhoto;
          const isCompletionPhoto = category === 'after';
          const shouldAutoStop = isCompletionPhoto && job.repair_start_time && !job.repair_end_time && isLeadTechnician && !isHelperPhoto;

          if (shouldAutoStart) mediaData.is_start_photo = true;
          if (shouldAutoStop) mediaData.is_completion_photo = true;

          const updated = await MockDb.addMedia(job.job_id, mediaData, currentUserId, currentUserName, isCurrentUserHelper);

          if (shouldAutoStart) {
            const now = new Date().toISOString();
            const startedJob = await MockDb.updateJob(job.job_id, {
              repair_start_time: now,
              started_at: now,
              status: JobStatus.IN_PROGRESS,
            });
            setJob({ ...startedJob } as Job);
            showToast.info('Job timer started', 'Timer started automatically with first photo');
          } else if (shouldAutoStop) {
            const now = new Date().toISOString();
            const stoppedJob = await MockDb.updateJob(job.job_id, { repair_end_time: now });
            setJob({ ...stoppedJob } as Job);
            showToast.info('Job timer stopped', 'Timer stopped with completion photo');
          } else {
            setJob({ ...updated } as Job);
          }

          const categoryLabel = PHOTO_CATEGORIES.find(c => c.value === category)?.label || 'Other';
          if (!gps && timestampMismatch) {
            showToast.warning('Photo uploaded (flagged)', `GPS missing • Timestamp mismatch: ${timeDiffMinutes}min`);
          } else if (!gps) {
            showToast.warning('Photo uploaded', `GPS location not captured • ${categoryLabel}`);
          } else if (timestampMismatch) {
            showToast.warning('Photo uploaded', `Timestamp mismatch: ${timeDiffMinutes}min • ${categoryLabel}`);
          } else {
            showToast.success('Photo uploaded', `Category: ${categoryLabel}${isCurrentUserHelper ? ' (Helper)' : ''}`);
          }
          resolve();
        } catch (e) {
          showToast.error('Photo upload failed', (e as Error).message);
          reject(e);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [job, currentUserId, currentUserName, isCurrentUserHelper, setJob]);

  const handleDownloadPhotos = useCallback(async (filter: string) => {
    if (!job || job.media.length === 0) {
      showToast.error('No photos to download');
      return;
    }
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const photosToDownload = filter === 'all' ? job.media : job.media.filter(m => m.category === filter);
      if (photosToDownload.length === 0) {
        showToast.error('No photos in selected category');
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
      console.error('Failed to download photos:', e);
      showToast.error('Download failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }, [job]);

  // ===== SIGNATURES =====

  const handleTechnicianSignature = useCallback(async (dataUrl: string) => {
    if (!job) return;
    const updated = await MockDb.signJob(job.job_id, 'technician', currentUserName, dataUrl);
    setJob({ ...updated } as Job);
  }, [job, currentUserName, setJob]);

  const handleCustomerSignature = useCallback(async (dataUrl: string) => {
    if (!job) return;
    const customerName = job.customer?.name || 'Customer';
    const updated = await MockDb.signJob(job.job_id, 'customer', customerName, dataUrl);
    setJob({ ...updated } as Job);
  }, [job, setJob]);

  // ===== HOURMETER =====

  const handleSaveHourmeter = useCallback(async (reading: number) => {
    if (!job || !job.forklift_id) return;
    if (isNaN(reading) || reading < 0) {
      showToast.error('Please enter a valid hourmeter reading');
      return;
    }

    const validation = await MockDb.validateHourmeterReading(job.forklift_id, reading);
    const isFirstRecording = !job.first_hourmeter_recorded_by_id;
    const firstRecordingData = isFirstRecording ? {
      first_hourmeter_recorded_by_id: currentUserId,
      first_hourmeter_recorded_by_name: currentUserName,
      first_hourmeter_recorded_at: new Date().toISOString(),
    } : {};

    if (!validation.isValid) {
      setHourmeterFlagReasons(validation.flags);
      try {
        const updated = await MockDb.updateJobHourmeter(job.job_id, reading);
        await MockDb.flagJobHourmeter(job.job_id, validation.flags);
        if (isFirstRecording) await MockDb.updateJob(job.job_id, firstRecordingData);
        setJob({ ...updated, hourmeter_flagged: true, hourmeter_flag_reasons: validation.flags, ...firstRecordingData } as Job);
        showToast.warning('Hourmeter saved with flags', 'This reading has been flagged for review.');
      } catch (e) {
        showToast.error(e instanceof Error ? e.message : 'Could not update hourmeter');
      }
      return;
    }

    try {
      const updated = await MockDb.updateJobHourmeter(job.job_id, reading);
      if (isFirstRecording) await MockDb.updateJob(job.job_id, firstRecordingData);
      setJob({ ...updated, ...firstRecordingData } as Job);
      setHourmeterFlagReasons([]);
      showToast.success('Hourmeter updated');
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Could not update hourmeter');
    }
  }, [job, currentUserId, currentUserName, setJob, setHourmeterFlagReasons]);

  const handleSubmitHourmeterAmendment = useCallback(async (amendedReading: number, reason: string) => {
    if (!job || !job.forklift_id) throw new Error('Job or forklift not found');

    await MockDb.createHourmeterAmendment(
      job.job_id,
      job.forklift_id,
      job.hourmeter_reading || 0,
      amendedReading,
      reason,
      job.hourmeter_flag_reasons || hourmeterFlagReasons,
      currentUserId,
      currentUserName
    );

    showToast.success('Amendment request submitted', 'Waiting for Admin 1 (Service) approval');
  }, [job, currentUserId, currentUserName, hourmeterFlagReasons]);

  // ===== JOB DETAILS =====

  const handleSaveJobCarriedOut = useCallback(async (jobCarriedOut: string, recommendation: string) => {
    if (!job) return;
    try {
      const updated = await MockDb.updateJobCarriedOut(job.job_id, jobCarriedOut, recommendation);
      setJob({ ...updated } as Job);
      showToast.success('Job details saved');
    } catch (e) {
      showToast.error('Could not save job details');
    }
  }, [job, setJob]);

  const handleSaveChecklist = useCallback(async (checklist: ForkliftConditionChecklist) => {
    if (!job) return;
    
    // Auto-set unchecked items to 'not_ok'
    const finalChecklist: ForkliftConditionChecklist = { ...checklist };
    CHECKLIST_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        const state = normalizeChecklistState(finalChecklist[item.key as keyof ForkliftConditionChecklist]);
        if (state === undefined) {
          finalChecklist[item.key as keyof ForkliftConditionChecklist] = 'not_ok';
        }
      });
    });
    
    try {
      const updated = await MockDb.updateConditionChecklist(job.job_id, finalChecklist, currentUserId);
      setJob({ ...updated } as Job);
      showToast.success('Checklist saved', 'Unchecked items marked as Not OK');
    } catch (e) {
      showToast.error('Could not save checklist', (e as Error).message);
    }
  }, [job, currentUserId, setJob]);

  // ===== REQUESTS =====

  const handleSubmitRequest = useCallback(async (type: string, description: string, photoUrl?: string, editingId?: string) => {
    if (!job || !description.trim()) {
      showToast.error('Please enter a description');
      return;
    }
    try {
      if (editingId) {
        const success = await MockDb.updateJobRequest(editingId, currentUserId, {
          description: description.trim(),
          request_type: type as any,
          photo_url: photoUrl || null,
        });
        if (success) {
          showToast.success('Request updated');
          loadRequests();
        } else {
          showToast.error('Failed to update request');
        }
      } else {
        const result = await MockDb.createJobRequest(job.job_id, type as any, currentUserId, description.trim(), photoUrl);
        if (result) {
          showToast.success('Request submitted', 'Admin will review your request');
          loadRequests();
        } else {
          showToast.error('Failed to submit request');
        }
      }
    } catch (e) {
      showToast.error('Error submitting request');
    }
  }, [job, currentUserId, loadRequests]);

  const handleApproval = useCallback(async (request: JobRequest, approve: boolean, data: any) => {
    if (!job) return;
    try {
      let success = false;
      if (approve) {
        if (request.request_type === 'spare_part') {
          if (!data.partId || !data.quantity) {
            showToast.error('Please select a part and quantity');
            return;
          }
          success = await MockDb.approveSparePartRequest(request.request_id, currentUserId, data.partId, parseInt(data.quantity), data.notes);
        } else if (request.request_type === 'assistance') {
          if (!data.helperId) {
            showToast.error('Please select a helper technician');
            return;
          }
          success = await MockDb.approveAssistanceRequest(request.request_id, currentUserId, data.helperId, data.notes);
        } else if (request.request_type === 'skillful_technician') {
          success = await MockDb.acknowledgeSkillfulTechRequest(request.request_id, currentUserId, data.notes || 'Acknowledged');
          showToast.info('Request acknowledged. Use Job Reassignment to assign a new technician.');
        }
      } else {
        if (!data.notes) {
          showToast.error('Please provide a reason for rejection');
          return;
        }
        success = await MockDb.rejectRequest(request.request_id, currentUserId, data.notes);
      }
      if (success) {
        showToast.success(approve ? 'Request approved' : 'Request rejected');
        loadRequests();
        loadJob();
      } else {
        showToast.error('Failed to process request');
      }
    } catch (e) {
      console.error('Approval error:', e);
      showToast.error('Error processing request');
    }
  }, [job, currentUserId, loadRequests, loadJob]);

  // ===== FINALIZATION =====

  const handleFinalizeInvoice = useCallback(async () => {
    if (!job) return;
    const needsPartsVerification = job.parts_used.length > 0 && !job.parts_confirmation_skipped;
    if (needsPartsVerification && !job.parts_confirmed_at) {
      showToast.error('Store Verification Pending', 'Admin 2 (Store) must verify parts before final service closure.');
      return;
    }
    try {
      const updated = await MockDb.finalizeInvoice(job.job_id, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      showToast.success('Invoice finalized');
    } catch (e) {
      showToast.error('Could not finalize invoice', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleConfirmParts = useCallback(async () => {
    if (!job) return;
    try {
      const updated = {
        ...job,
        parts_confirmed_by_id: currentUserId,
        parts_confirmed_by_name: currentUserName,
        parts_confirmed_at: new Date().toISOString(),
      };
      await MockDb.updateJob(job.job_id, updated);
      setJob(updated as Job);
      showToast.success('Parts verified successfully', 'Admin 1 (Service) can now finalize the job.');
    } catch (e) {
      showToast.error('Could not verify parts', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleDeleteJob = useCallback(async (reason: string) => {
    if (!job) return;
    if (!reason.trim()) {
      showToast.error('Please provide a reason for deleting this job');
      return;
    }
    try {
      await MockDb.deleteJob(job.job_id, currentUserId, currentUserName, reason.trim());
      showToast.success('Job deleted');
      navigate('/jobs');
    } catch (e) {
      showToast.error('Could not delete job', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, navigate]);

  // ===== PDF/EXPORT =====

  const handlePrintServiceReport = useCallback(async () => {
    if (!job) return;
    const { printServiceReport } = await import('../../../components/ServiceReportPDF');
    printServiceReport(job);
  }, [job]);

  const handlePrintQuotation = useCallback(async () => {
    if (!job) return;
    const { printQuotation, generateQuotationFromJob } = await import('../../../components/QuotationPDF');
    const quotation = generateQuotationFromJob(job);
    const quotationNumber = `Q-${new Date().getFullYear()}-${job.job_id.slice(0, 6).toUpperCase()}`;
    printQuotation(quotation, quotationNumber);
  }, [job]);

  const handleExportPDF = useCallback(async () => {
    if (!job) return;
    const { printInvoice } = await import('../../../components/InvoicePDF');
    printInvoice(job);
  }, [job]);

  const handleExportToAutoCount = useCallback(async () => {
    if (!job) return;
    try {
      await MockDb.createAutoCountExport(job.job_id, currentUserId, currentUserName);
      showToast.success('Export created', 'Invoice queued for AutoCount export');
    } catch (e) {
      showToast.error('Export failed', e instanceof Error ? e.message : 'Unknown error');
    }
  }, [job, currentUserId, currentUserName]);

  // ===== AI =====

  const handleAiSummary = useCallback(async () => {
    if (!job) return '';
    return await generateJobSummary(job);
  }, [job]);

  return {
    handleStatusChange,
    handleAcceptJob,
    handleRejectJob,
    handleAcknowledgeJob,
    handleStartJobWithCondition,
    handleContinueTomorrow,
    handleResumeJob,
    handleDeferredCompletion,
    handleAssignJob,
    handleReassignJob,
    handleAssignHelper,
    handleRemoveHelper,
    handleAddPart,
    handleRemovePart,
    handleSavePartPrice,
    handleToggleNoPartsUsed,
    handleSaveLabor,
    handleAddExtraCharge,
    handleRemoveExtraCharge,
    handleAddNote,
    uploadPhotoFile,
    handleDownloadPhotos,
    handleTechnicianSignature,
    handleCustomerSignature,
    handleSaveHourmeter,
    handleSubmitHourmeterAmendment,
    handleSaveJobCarriedOut,
    handleSaveChecklist,
    handleSubmitRequest,
    handleApproval,
    handleFinalizeInvoice,
    handleConfirmParts,
    handleDeleteJob,
    handlePrintServiceReport,
    handlePrintQuotation,
    handleExportPDF,
    handleExportToAutoCount,
    handleAiSummary,
  };
}

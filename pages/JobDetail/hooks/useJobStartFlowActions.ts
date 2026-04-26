import { useCallback } from 'react';
import { checkServiceUpgradeNeeded, declineServiceUpgrade, upgradeToFullService } from '../../../services/serviceTrackingService';
import { SupabaseDb as MockDb, supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import type { ForkliftConditionChecklist, Job } from '../../../types';
import { compressPhoto } from '../../../utils/compressPhoto';
import { CHECKLIST_CATEGORIES } from '../constants';
import { isHourmeterExemptJob } from '../utils';
import type { JobDetailState } from './useJobDetailState';

interface UseJobStartFlowActionsParams {
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
}

export function useJobStartFlowActions({
  state,
  currentUserId,
  currentUserName,
}: UseJobStartFlowActionsParams) {
  const { job } = state;

  const handleOpenStartJobModal = useCallback(async () => {
    if (!job) return;

    if (job.job_type === 'Minor Service' && job.forklift_id) {
      try {
        const upgradePrompt = await checkServiceUpgradeNeeded(
          job.forklift_id,
          job.job_id,
          job.job_type
        );

        if (upgradePrompt) {
          state.setServiceUpgradePrompt(upgradePrompt);
          return;
        }
      } catch (error) {
        console.error('Failed to check service upgrade:', error);
      }
    }

    state.setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
    state.setConditionChecklist({});
    state.setBeforePhotos([]);
    state.setShowStartJobModal(true);
  }, [job, state]);

  const handleChecklistToggle = useCallback((key: string) => {
    state.setConditionChecklist(prev => {
      const currentValue = prev[key as keyof ForkliftConditionChecklist];
      const nextValue = currentValue === 'not_ok' ? true : currentValue ? 'not_ok' : true;
      return { ...prev, [key]: nextValue };
    });
  }, [state]);

  const handleConditionCheckAll = useCallback(() => {
    const allChecked: Partial<ForkliftConditionChecklist> = {};
    CHECKLIST_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        allChecked[item.key as keyof ForkliftConditionChecklist] = true;
      });
    });
    state.setConditionChecklist(allChecked as ForkliftConditionChecklist);
  }, [state]);

  const handleConditionUncheckAll = useCallback(() => {
    state.setConditionChecklist({} as ForkliftConditionChecklist);
  }, [state]);

  const handleStartJobWithCondition = useCallback(async () => {
    if (!job) return;

    if (state.beforePhotos.length === 0) {
      showToast.error('Before photos required', 'Take at least one before condition photo before starting the job.');
      return;
    }

    const isHourmeterExempt = isHourmeterExemptJob(job.job_type);
    const currentForkliftHourmeter = job.forklift?.hourmeter || 0;
    let hourmeter: number;
    let brokenMeterNoteToSave: string | undefined;
    if (isHourmeterExempt) {
      hourmeter = currentForkliftHourmeter;
    } else {
      hourmeter = parseInt(state.startJobHourmeter);
      if (isNaN(hourmeter) || hourmeter < 1) {
        showToast.error('Hourmeter required', 'Enter the hourmeter reading. If the meter is broken, enter 1 and add a broken-meter remark.');
        return;
      }
      if (hourmeter === 1 && state.brokenMeterNote.trim().length === 0) {
        showToast.error('Broken meter remark required', 'Describe why the hourmeter reads 1 (meter broken, unreadable, etc.).');
        return;
      }
      if (hourmeter !== 1 && hourmeter < currentForkliftHourmeter) {
        showToast.error(`Hourmeter must be ≥ ${currentForkliftHourmeter} (forklift's current reading) — or enter 1 if the meter is broken`);
        return;
      }
      if (hourmeter === 1) {
        brokenMeterNoteToSave = state.brokenMeterNote.trim();
      }
    }

    try {
      for (let index = 0; index < state.beforePhotos.length; index++) {
        const file = state.beforePhotos[index];
        const { blob, mime } = await compressPhoto(file);
        const timestamp = Date.now();
        const fileName = `${job.job_id}/before_${timestamp}_${index}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('job-photos')
          .upload(fileName, blob, { contentType: mime, upsert: false });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('job-photos')
          .getPublicUrl(fileName);

        await MockDb.addMedia(
          job.job_id,
          {
            type: 'photo',
            url: publicUrl,
            description: 'Before condition photo',
            created_at: new Date().toISOString(),
            category: 'before',
            source: 'camera',
          },
          currentUserId,
          currentUserName,
          false
        );
      }
    } catch (uploadErr) {
      console.error('Before photo upload failed:', uploadErr);
      showToast.error(
        'Photo upload failed',
        'Could not upload before photos. Job NOT started — please retry.'
      );
      return;
    }

    try {
      const updated = await MockDb.startJobWithCondition(
        job.job_id,
        hourmeter,
        state.conditionChecklist,
        currentUserId,
        currentUserName,
        brokenMeterNoteToSave
      );
      state.setJob({ ...updated } as Job);
      state.setShowStartJobModal(false);
      state.setBrokenMeterNote('');
      showToast.success('Job started', `Status changed to In Progress. ${state.beforePhotos.length} before photo(s) saved.`);
    } catch (error) {
      showToast.error('Failed to start job', (error as Error).message, error, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state, currentUserId, currentUserName]);

  const handleServiceUpgrade = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await upgradeToFullService(job.job_id, currentUserId, currentUserName);
      state.setJob({ ...updated });
      state.setServiceUpgradePrompt(prev => ({ ...prev, show: false }));
      showToast.success('Job upgraded to Full Service', 'The service checklist has been updated.');
      state.setStartJobHourmeter((updated.forklift?.hourmeter || 0).toString());
      state.setConditionChecklist({});
      state.setBeforePhotos([]);
      state.setShowStartJobModal(true);
    } catch (error) {
      showToast.error('Failed to upgrade job', (error as Error).message, error, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, currentUserId, currentUserName, state]);

  const handleDeclineServiceUpgrade = useCallback(async () => {
    if (!job) return;
    const prompt = state.serviceUpgradePrompt;
    try {
      await declineServiceUpgrade(
        job.job_id,
        prompt.forklift_id,
        currentUserId,
        currentUserName,
        prompt.current_hourmeter,
        prompt.target_hourmeter,
        prompt.original_job_type
      );
      state.setServiceUpgradePrompt(prev => ({ ...prev, show: false }));
      showToast.info('Continuing as Minor Service', 'Unit will remain flagged as Service Due.');
      state.setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
      state.setConditionChecklist({});
      state.setBeforePhotos([]);
      state.setShowStartJobModal(true);
    } catch (error) {
      showToast.error('Failed to log decision', (error as Error).message, error, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, currentUserId, currentUserName, state]);

  return {
    handleChecklistToggle,
    handleConditionCheckAll,
    handleConditionUncheckAll,
    handleDeclineServiceUpgrade,
    handleOpenStartJobModal,
    handleServiceUpgrade,
    handleStartJobWithCondition,
  };
}

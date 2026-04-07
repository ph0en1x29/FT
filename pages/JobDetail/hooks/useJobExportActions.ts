import { useCallback } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Job } from '../../../types';
import { JobDetailState } from './useJobDetailState';

interface UseJobExportActionsParams {
  job: Job | null;
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
}

/**
 * Hook for job export/print actions
 */
export const useJobExportActions = ({
  job,
  state,
  currentUserId,
  currentUserName,
}: UseJobExportActionsParams) => {
  const handlePrintServiceReport = useCallback(() => {
    if (!job) return;
    state.setShowReportOptionsModal(true);
  }, [job, state]);

  const handleConfirmPrintServiceReport = useCallback(async (showPrices: boolean) => {
    if (!job) return;
    state.setShowReportOptionsModal(false);
    const { printServiceReport } = await import('../../../components/ServiceReportPDF');
    printServiceReport(job, undefined, showPrices);
  }, [job, state]);

  const handleExportPDF = useCallback(async () => {
    if (!job) return;
    const { printInvoice } = await import('../../../components/InvoicePDF');
    printInvoice(job);
  }, [job]);

  const handleExportToAutoCount = useCallback(async () => {
    if (!job) return;
    state.setExportingToAutoCount(true);
    try {
      await MockDb.createAutoCountExport(job.job_id, currentUserId, currentUserName);
      showToast.success('Export created', 'Invoice queued for AutoCount export');
    } catch (e) {
      showToast.error('Export failed', e instanceof Error ? e.message : 'Unknown error');
    }
    state.setExportingToAutoCount(false);
  }, [job, state, currentUserId, currentUserName]);

  return {
    handlePrintServiceReport,
    handleConfirmPrintServiceReport,
    handleExportPDF,
    handleExportToAutoCount,
  };
};

import type { User } from '../../../types';
import type { JobDetailState } from './useJobDetailState';
import { useJobAdminActions } from './useJobAdminActions';
import { useJobCompletionActions } from './useJobCompletionActions';
import { useJobEditActions } from './useJobEditActions';
import { useJobExportActions } from './useJobExportActions';
import { useJobMeterActions } from './useJobMeterActions';
import { useJobPartsHandlers } from './useJobPartsHandlers';
import { useJobRequestActions } from './useJobRequestActions';
import { useJobStartFlowActions } from './useJobStartFlowActions';
import { useJobStatusActions } from './useJobStatusActions';

interface UseJobActionsParams {
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  technicians: User[];
  loadJob: (opts?: { silent?: boolean }) => Promise<void>;
  loadVanStock: (jobVanStockId?: string) => Promise<void>;
}

/**
 * Composes focused job-action hooks while preserving the original public action API.
 */
export const useJobActions = ({
  state,
  currentUserId,
  currentUserName,
  currentUserRole,
  technicians,
  loadJob,
  loadVanStock,
}: UseJobActionsParams) => {
  const { job, setJob } = state;

  const exportActions = useJobExportActions({
    job,
    state,
    currentUserId,
    currentUserName,
  });

  const requestActions = useJobRequestActions({
    job,
    state,
    currentUserId,
    currentUserName,
    currentUserRole,
    loadJob,
  });

  const partsHandlers = useJobPartsHandlers({
    job,
    state,
    currentUserId,
    currentUserName,
    currentUserRole,
    loadJob,
    loadVanStock,
    setJob,
  });

  const adminActions = useJobAdminActions({
    state,
    currentUserId,
    currentUserName,
    technicians,
  });

  const startFlowActions = useJobStartFlowActions({
    state,
    currentUserId,
    currentUserName,
  });

  const statusActions = useJobStatusActions({
    state,
    currentUserId,
    currentUserName,
    currentUserRole,
  });

  const meterActions = useJobMeterActions({
    state,
    currentUserId,
    currentUserName,
  });

  const completionActions = useJobCompletionActions({
    state,
    currentUserId,
    currentUserName,
  });

  const editActions = useJobEditActions({
    state,
    currentUserId,
    currentUserName,
  });

  return {
    ...adminActions,
    ...startFlowActions,
    ...statusActions,
    ...meterActions,
    ...completionActions,
    ...exportActions,
    ...requestActions,
    ...editActions,
    ...partsHandlers,
  };
};

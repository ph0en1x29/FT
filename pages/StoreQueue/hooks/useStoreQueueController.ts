import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComboboxOption } from '../../../components/Combobox';
import { usePartsForList, useSearchParts } from '../../../hooks/useQueryHooks';
import {
  approveSparePartRequest,
  rejectRequest,
} from '../../../services/jobRequestService';
import { supabase } from '../../../services/supabaseClient';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import type { Job, Part, User } from '../../../types';
import { JobStatus } from '../../../types';
import {
  buildStoreQueue,
  countStoreQueue,
  filterStoreQueue,
  groupStoreQueue,
  type JobRequestRow,
} from '../queueModel';
import type { FilterType, InlinePartRow, JobGroup, QueueItem } from '../types';

export function useStoreQueueController(currentUser: User) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [inlineState, setInlineState] = useState<Record<string, InlinePartRow[]>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectType, setRejectType] = useState<'request' | 'parts' | 'job'>('request');

  const { data: cachedParts = [] } = usePartsForList();
  const parts = cachedParts as unknown as Part[];
  const { parts: searchedParts, isSearching, search } = useSearchParts(30);

  const partOptions: ComboboxOption[] = useMemo(() => {
    const inlinePartIds = new Set<string>();
    for (const rows of Object.values(inlineState)) {
      for (const row of rows) if (row.partId) inlinePartIds.add(row.partId);
    }

    const seen = new Set<string>();
    const merged: Part[] = [];
    for (const p of searchedParts) {
      if (!seen.has(p.part_id)) { merged.push(p); seen.add(p.part_id); }
    }
    for (const p of parts) {
      if (inlinePartIds.has(p.part_id) && !seen.has(p.part_id)) {
        merged.push(p); seen.add(p.part_id);
      }
    }

    return merged.map(p => ({
      id: p.part_id,
      label: p.part_name,
      subLabel: `RM${(p.sell_price ?? p.cost_price)?.toFixed(2) ?? '0.00'} | Stock: ${p.stock_quantity}`,
    }));
  }, [searchedParts, parts, inlineState]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsResult, jobsResult] = await Promise.all([
        supabase
          .from('job_requests')
          .select(`
            *,
            requested_by_user:users!job_requests_requested_by_fkey(user_id, name, full_name),
            job:jobs(job_id, title, status, assigned_technician_name, completed_at, deleted_at,
              customer:customers(name),
              forklift:forklifts!forklift_id(serial_number))
          `)
          .eq('request_type', 'spare_part')
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        MockDb.getJobs(currentUser),
      ]);

      const { items, autoMatched } = buildStoreQueue(
        (requestsResult.data || []) as JobRequestRow[],
        (jobsResult || []) as Job[],
        parts
      );
      setInlineState(prev => ({ ...prev, ...autoMatched }));
      setQueue(items);
    } catch (e) {
      console.error('Failed to load store queue:', e);
      showToast.error('Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [currentUser, parts]);

  useEffect(() => {
    if (parts.length > 0) loadQueue();
  }, [loadQueue, parts]);

  const filteredQueue = useMemo(
    () => filterStoreQueue(queue, filter, searchQuery),
    [queue, filter, searchQuery]
  );
  const groupedQueue = useMemo(
    () => groupStoreQueue(filteredQueue, inlineState),
    [filteredQueue, inlineState]
  );
  const counts = useMemo(() => countStoreQueue(queue), [queue]);

  const markProcessing = (id: string) => setProcessing(prev => new Set(prev).add(id));
  const clearProcessing = (id: string) => setProcessing(prev => { const n = new Set(prev); n.delete(id); return n; });

  const handleApproveRequest = async (
    item: QueueItem,
    options?: { skipReload?: boolean; suppressSuccessToast?: boolean }
  ): Promise<boolean> => {
    if (!item.requestId) return false;
    const rows = inlineState[item.requestId] || [{ partId: '', quantity: '1' }];
    const validRows = rows.filter(r => r.partId);
    if (validRows.length === 0) { showToast.error('Select a part first'); return false; }
    const items = validRows.map(r => ({ partId: r.partId, quantity: parseFloat(r.quantity) || 1 }));

    markProcessing(item.id);
    try {
      const ok = await approveSparePartRequest(
        item.requestId, currentUser.user_id,
        items,
        undefined, currentUser.full_name || currentUser.name, currentUser.role
      );
      if (ok) {
        if (!options?.suppressSuccessToast) showToast.success('Request approved');
        if (!options?.skipReload) await loadQueue();
        return true;
      }
      showToast.error('Approval failed', 'Check stock availability');
      return false;
    } catch (e) {
      showToast.error('Approval failed', (e as Error).message);
      return false;
    } finally { clearProcessing(item.id); }
  };

  const handleConfirmJob = async (
    item: QueueItem,
    options?: { skipReload?: boolean; suppressSuccessToast?: boolean }
  ): Promise<boolean> => {
    markProcessing(item.id);
    try {
      const lockCheck = await MockDb.checkJobLock(item.jobId, currentUser.user_id);
      if (lockCheck.isLocked) {
        showToast.error('Job Locked', `Being reviewed by ${lockCheck.lockedByName || 'another admin'}`);
        return false;
      }
      await MockDb.acquireJobLock(item.jobId, currentUser.user_id, currentUser.name);
      await MockDb.updateJobStatus(item.jobId, JobStatus.COMPLETED, currentUser.user_id, currentUser.name);
      await MockDb.updateJob(item.jobId, {
        job_confirmed_at: new Date().toISOString(),
        job_confirmed_by_id: currentUser.user_id,
        job_confirmed_by_name: currentUser.name,
      });
      await MockDb.releaseJobLock(item.jobId, currentUser.user_id);
      if (!options?.suppressSuccessToast) showToast.success('Job confirmed & completed');
      if (!options?.skipReload) await loadQueue();
      return true;
    } catch (e) {
      showToast.error('Failed', (e as Error).message);
      return false;
    } finally { clearProcessing(item.id); }
  };

  const handleApproveAllForJob = async (group: JobGroup) => {
    if (!group.canShowApproveAll) return;
    const allPartRequests = group.items.every(item => item.type === 'part_request');
    if (!allPartRequests && group.items.length === 1 && group.items[0].type === 'confirm_job') {
      await handleConfirmJob(group.items[0]);
      return;
    }

    let approvedCount = 0;
    for (const item of group.items) {
      const approved = await handleApproveRequest(item, { skipReload: true, suppressSuccessToast: true });
      if (approved) approvedCount++;
    }

    if (approvedCount > 0) {
      showToast.success(
        'Requests approved',
        `${approvedCount} of ${group.items.length} request${group.items.length === 1 ? '' : 's'} approved`
      );
      await loadQueue();
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    markProcessing(rejectingId);
    try {
      if (rejectType === 'request') {
        const item = queue.find(i => i.id === rejectingId);
        if (item?.requestId) {
          const ok = await rejectRequest(item.requestId, currentUser.user_id, rejectReason.trim());
          if (ok) showToast.success('Request rejected');
        }
      } else if (rejectType === 'parts') {
        const jobId = rejectingId.replace('parts-', '');
        await MockDb.updateJob(jobId, { parts_confirmation_notes: `REJECTED: ${rejectReason}` });
        showToast.warning('Parts rejected');
      } else {
        const jobId = rejectingId.replace('job-', '');
        await MockDb.updateJob(jobId, { job_confirmation_notes: `REJECTED: ${rejectReason}` });
        showToast.warning('Job rejected');
      }
      setRejectingId(null);
      setRejectReason('');
      void loadQueue();
    } finally { clearProcessing(rejectingId); }
  };

  const updateInline = (requestId: string, index: number, updates: Partial<InlinePartRow>) => {
    setInlineState(prev => {
      const rows = prev[requestId] || [{ partId: '', quantity: '1' }];
      const newRows = rows.map((r, i) => i === index ? { ...r, ...updates } : r);
      return { ...prev, [requestId]: newRows };
    });
  };

  const addInlineRow = (requestId: string) => {
    setInlineState(prev => {
      const rows = prev[requestId] || [{ partId: '', quantity: '1' }];
      return { ...prev, [requestId]: [...rows, { partId: '', quantity: '1' }] };
    });
  };

  const removeInlineRow = (requestId: string, index: number) => {
    setInlineState(prev => {
      const rows = prev[requestId] || [{ partId: '', quantity: '1' }];
      const newRows = rows.filter((_, i) => i !== index);
      return { ...prev, [requestId]: newRows.length ? newRows : [{ partId: '', quantity: '1' }] };
    });
  };

  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const openReject = (type: 'request' | 'job', id: string) => {
    setRejectType(type);
    setRejectReason('');
    setRejectingId(id);
  };

  return {
    addInlineRow,
    counts,
    expandedJobs,
    filter,
    groupedQueue,
    handleApproveAllForJob,
    handleApproveRequest,
    handleConfirmJob,
    handleReject,
    inlineState,
    isSearching,
    loadQueue,
    loading,
    openReject,
    partOptions,
    processing,
    rejectReason,
    rejectType,
    rejectingId,
    removeInlineRow,
    search,
    searchQuery,
    setFilter,
    setRejectingId,
    setRejectReason,
    setSearchQuery,
    toggleJob,
    updateInline,
  };
}

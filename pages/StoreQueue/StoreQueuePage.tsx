/**
 * StoreQueue - Unified inbox for Store Admin
 * Replaces PendingConfirmations + Part Requests tab.
 * Single prioritized list: part requests → issue → parts confirmation → job confirmation
 */
import {
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  Filter,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Combobox, ComboboxOption } from '../../components/Combobox';
import { usePartsForList } from '../../hooks/useQueryHooks';
import { SkeletonJobList } from '../../components/Skeleton';
import {
  approveSparePartRequest,
  rejectRequest,
  issuePartToTechnician,
} from '../../services/jobRequestService';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { supabase } from '../../services/supabaseClient';
import { Job, JobStatus, Part, User, UserRole } from '../../types';

// ─── Types ───────────────────────────────────────────────────────

type QueueItemType = 'part_request' | 'ready_to_issue' | 'confirm_parts' | 'confirm_job';
type FilterType = 'all' | 'part_request' | 'ready_to_issue' | 'confirm_parts' | 'confirm_job';

interface QueueItem {
  id: string; // unique key
  type: QueueItemType;
  priority: number; // lower = higher priority
  createdAt: string;
  // Part request fields
  requestId?: string;
  requestDescription?: string;
  requestedByName?: string;
  adminResponsePartId?: string;
  adminResponseQuantity?: number;
  issuedAt?: string;
  collectedAt?: string;
  // Job fields
  jobId: string;
  jobTitle: string;
  jobStatus: string;
  customerName: string;
  technicianName: string;
  forkliftSerial: string;
  completedAt?: string;
  // Parts confirmation fields
  partsCount?: number;
  partsTotal?: number;
  partsConfirmedAt?: string;
  jobConfirmedAt?: string;
}

interface StoreQueuePageProps {
  currentUser: User;
  hideHeader?: boolean;
}

// ─── Priority & helpers ──────────────────────────────────────────

function getPriority(type: QueueItemType, createdAt: string): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  const basePriority: Record<QueueItemType, number> = {
    part_request: 0,
    ready_to_issue: 100,
    confirm_parts: 200,
    confirm_job: 300,
  };
  // Within same type, older items have lower priority number (higher urgency)
  return basePriority[type] - Math.min(ageHours, 99);
}

function formatTimeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getTypeLabel(type: QueueItemType): string {
  switch (type) {
    case 'part_request': return 'Part Request';
    case 'ready_to_issue': return 'Ready to Issue';
    case 'confirm_parts': return 'Verify Parts';
    case 'confirm_job': return 'Confirm Job';
  }
}

function getTypeColor(type: QueueItemType): string {
  switch (type) {
    case 'part_request': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'ready_to_issue': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'confirm_parts': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'confirm_job': return 'bg-green-100 text-green-700 border-green-200';
  }
}

function getTypeIcon(type: QueueItemType) {
  switch (type) {
    case 'part_request': return Package;
    case 'ready_to_issue': return PackageCheck;
    case 'confirm_parts': return ShieldCheck;
    case 'confirm_job': return Wrench;
  }
}

function findBestPartMatch(description: string, parts: Part[]): Part | null {
  if (!description || parts.length === 0) return null;
  const descLower = description.toLowerCase();
  const descWords = descLower.split(/[\s,]+/).filter(w => w.length > 2);
  let bestMatch: Part | null = null;
  let bestScore = 0;
  for (const part of parts) {
    if (part.stock_quantity <= 0) continue;
    const partLower = part.part_name.toLowerCase();
    if (partLower === descLower) return part;
    let score = 0;
    for (const word of descWords) {
      if (partLower.includes(word)) score += word.length;
    }
    if (descLower.includes(partLower)) score += partLower.length * 2;
    if (partLower.includes(descLower)) score += descLower.length * 2;
    if (score > bestScore) { bestScore = score; bestMatch = part; }
  }
  return bestScore >= 3 ? bestMatch : null;
}

// ─── Component ───────────────────────────────────────────────────

export default function StoreQueuePage({ currentUser, hideHeader = false }: StoreQueuePageProps) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline approve state for part requests
  const [inlineState, setInlineState] = useState<Record<string, { partId: string; quantity: string }>>({});
  // Reject modal
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectType, setRejectType] = useState<'request' | 'parts' | 'job'>('request');

  const { data: cachedParts = [] } = usePartsForList();
  const parts = cachedParts as unknown as Part[];
  const partOptions: ComboboxOption[] = useMemo(() => parts.map(p => ({
    id: p.part_id,
    label: p.part_name,
    subLabel: `RM${p.sell_price} | Stock: ${p.stock_quantity}`,
  })), [parts]);

  // ─── Load everything into a single queue ─────────────────────

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel fetch: part requests + jobs
      const [requestsResult, jobsResult] = await Promise.all([
        supabase
          .from('job_requests')
          .select(`
            *,
            requested_by_user:users!job_requests_requested_by_fkey(user_id, name, full_name),
            job:jobs(job_id, title, status, assigned_technician_name, completed_at,
              customer:customers(name),
              forklift:forklifts!forklift_id(serial_number))
          `)
          .eq('request_type', 'spare_part')
          .in('status', ['pending', 'approved'])
          .order('created_at', { ascending: true }),
        MockDb.getJobs(currentUser),
      ]);

      const items: QueueItem[] = [];

      // 1. Part requests (pending → need approval)
      const requests = requestsResult.data || [];
      const autoMatched: Record<string, { partId: string; quantity: string }> = {};

      for (const r of requests) {
        const user = r.requested_by_user as Record<string, unknown> | null;
        const job = r.job as Record<string, unknown> | null;
        const customer = job?.customer as Record<string, unknown> | null;
        const forklift = job?.forklift as Record<string, unknown> | null;

        const itemType: QueueItemType = r.status === 'pending' ? 'part_request' : 'ready_to_issue';

        items.push({
          id: `req-${r.request_id}`,
          type: itemType,
          priority: getPriority(itemType, r.created_at as string),
          createdAt: r.created_at as string,
          requestId: r.request_id as string,
          requestDescription: r.description as string,
          requestedByName: (user?.full_name as string) || (user?.name as string) || 'Unknown',
          adminResponsePartId: r.admin_response_part_id as string | undefined,
          adminResponseQuantity: r.admin_response_quantity as number | undefined,
          issuedAt: r.issued_at as string | undefined,
          collectedAt: r.collected_at as string | undefined,
          jobId: (job?.job_id as string) || '',
          jobTitle: (job?.title as string) || 'Unknown Job',
          jobStatus: (job?.status as string) || '',
          customerName: (customer?.name as string) || '',
          technicianName: (job?.assigned_technician_name as string) || '',
          forkliftSerial: (forklift?.serial_number as string) || '',
        });

        // Auto-match for pending requests
        if (r.status === 'pending') {
          const match = findBestPartMatch(r.description as string, parts);
          autoMatched[r.request_id as string] = {
            partId: match?.part_id || '',
            quantity: '1',
          };
        }
      }

      setInlineState(prev => ({ ...prev, ...autoMatched }));

      // 2. Jobs awaiting confirmation
      const awaitingJobs = (jobsResult || []).filter(
        (j: Job) => j.status === JobStatus.AWAITING_FINALIZATION
      );

      for (const job of awaitingJobs) {
        const needsPartsConfirm = job.parts_used.length > 0 && !job.parts_confirmed_at && !job.parts_confirmation_skipped;
        const needsJobConfirm = (job.parts_confirmed_at || job.parts_confirmation_skipped || job.parts_used.length === 0) && !job.job_confirmed_at;

        if (needsPartsConfirm) {
          const partsTotal = job.parts_used.reduce((sum: number, p: { sell_price_at_time: number; quantity: number }) =>
            sum + p.sell_price_at_time * p.quantity, 0
          );
          items.push({
            id: `parts-${job.job_id}`,
            type: 'confirm_parts',
            priority: getPriority('confirm_parts', job.completed_at || job.created_at),
            createdAt: job.completed_at || job.created_at,
            jobId: job.job_id,
            jobTitle: job.title,
            jobStatus: job.status,
            customerName: job.customer?.name || '',
            technicianName: job.assigned_technician_name || '',
            forkliftSerial: job.forklift?.serial_number || '',
            completedAt: job.completed_at,
            partsCount: job.parts_used.length,
            partsTotal,
          });
        }

        if (needsJobConfirm) {
          items.push({
            id: `job-${job.job_id}`,
            type: 'confirm_job',
            priority: getPriority('confirm_job', job.completed_at || job.created_at),
            createdAt: job.completed_at || job.created_at,
            jobId: job.job_id,
            jobTitle: job.title,
            jobStatus: job.status,
            customerName: job.customer?.name || '',
            technicianName: job.assigned_technician_name || '',
            forkliftSerial: job.forklift?.serial_number || '',
            completedAt: job.completed_at,
            partsConfirmedAt: job.parts_confirmed_at,
          });
        }
      }

      // Sort by priority (lower = more urgent)
      items.sort((a, b) => a.priority - b.priority);
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

  // ─── Filtered + searched items ────────────────────────────────

  const filteredQueue = useMemo(() => {
    let items = queue;
    if (filter !== 'all') items = items.filter(i => i.type === filter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        (i.requestDescription || '').toLowerCase().includes(q) ||
        i.jobTitle.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q) ||
        i.technicianName.toLowerCase().includes(q) ||
        i.forkliftSerial.toLowerCase().includes(q) ||
        (i.requestedByName || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [queue, filter, searchQuery]);

  // ─── Counts per type ──────────────────────────────────────────

  const counts = useMemo(() => {
    const c = { part_request: 0, ready_to_issue: 0, confirm_parts: 0, confirm_job: 0, all: 0 };
    for (const item of queue) {
      c[item.type]++;
      c.all++;
    }
    return c;
  }, [queue]);

  // ─── Actions ──────────────────────────────────────────────────

  const markProcessing = (id: string) => setProcessing(prev => new Set(prev).add(id));
  const clearProcessing = (id: string) => setProcessing(prev => { const n = new Set(prev); n.delete(id); return n; });

  const handleApproveRequest = async (item: QueueItem) => {
    if (!item.requestId) return;
    const state = inlineState[item.requestId];
    if (!state?.partId) { showToast.error('Select a part first'); return; }
    const qty = parseFloat(state.quantity) || 1;
    if (qty <= 0) { showToast.error('Invalid quantity'); return; }

    markProcessing(item.id);
    try {
      const ok = await approveSparePartRequest(
        item.requestId, currentUser.user_id, state.partId, qty,
        undefined, currentUser.full_name || currentUser.name, currentUser.role
      );
      if (ok) { showToast.success('Request approved'); loadQueue(); }
      else showToast.error('Approval failed', 'Check stock availability');
    } finally { clearProcessing(item.id); }
  };

  const handleIssue = async (item: QueueItem) => {
    if (!item.requestId) return;
    markProcessing(item.id);
    try {
      const ok = await issuePartToTechnician(
        item.requestId, currentUser.user_id,
        currentUser.full_name || currentUser.name || '', currentUser.role
      );
      if (ok) { showToast.success('Part issued to technician'); loadQueue(); }
      else showToast.error('Issue failed');
    } finally { clearProcessing(item.id); }
  };

  const handleConfirmParts = async (item: QueueItem) => {
    markProcessing(item.id);
    try {
      const lockCheck = await MockDb.checkJobLock(item.jobId, currentUser.user_id);
      if (lockCheck.isLocked) {
        showToast.error('Job Locked', `Being reviewed by ${lockCheck.lockedByName || 'another admin'}`);
        return;
      }
      await MockDb.acquireJobLock(item.jobId, currentUser.user_id, currentUser.name);

      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        parts_confirmed_at: now,
        parts_confirmed_by_id: currentUser.user_id,
        parts_confirmed_by_name: currentUser.name,
      };
      if (currentUser.role === UserRole.ADMIN) {
        updates.job_confirmed_at = now;
        updates.job_confirmed_by_id = currentUser.user_id;
        updates.job_confirmed_by_name = currentUser.name;
      }
      await MockDb.updateJob(item.jobId, updates);
      await MockDb.releaseJobLock(item.jobId, currentUser.user_id);
      showToast.success('Parts verified', currentUser.role === UserRole.ADMIN ? 'Job also auto-confirmed' : undefined);
      loadQueue();
    } catch (e) {
      showToast.error('Failed', (e as Error).message);
    } finally { clearProcessing(item.id); }
  };

  const handleConfirmJob = async (item: QueueItem) => {
    markProcessing(item.id);
    try {
      const lockCheck = await MockDb.checkJobLock(item.jobId, currentUser.user_id);
      if (lockCheck.isLocked) {
        showToast.error('Job Locked', `Being reviewed by ${lockCheck.lockedByName || 'another admin'}`);
        return;
      }
      await MockDb.acquireJobLock(item.jobId, currentUser.user_id, currentUser.name);
      await MockDb.updateJobStatus(item.jobId, JobStatus.COMPLETED, currentUser.user_id, currentUser.name);
      await MockDb.updateJob(item.jobId, {
        job_confirmed_at: new Date().toISOString(),
        job_confirmed_by_id: currentUser.user_id,
        job_confirmed_by_name: currentUser.name,
      });
      await MockDb.releaseJobLock(item.jobId, currentUser.user_id);
      showToast.success('Job confirmed & completed');
      loadQueue();
    } catch (e) {
      showToast.error('Failed', (e as Error).message);
    } finally { clearProcessing(item.id); }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    markProcessing(rejectingId);
    try {
      if (rejectType === 'request') {
        // Find request ID from queue item ID
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
      loadQueue();
    } finally { clearProcessing(rejectingId); }
  };

  const updateInline = (requestId: string, updates: Partial<{ partId: string; quantity: string }>) => {
    setInlineState(prev => ({ ...prev, [requestId]: { ...prev[requestId], ...updates } }));
  };

  // ─── Filter bar config ────────────────────────────────────────

  const filters: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'part_request', label: 'Requests', count: counts.part_request },
    { id: 'ready_to_issue', label: 'Issue', count: counts.ready_to_issue },
    { id: 'confirm_parts', label: 'Parts', count: counts.confirm_parts },
    { id: 'confirm_job', label: 'Jobs', count: counts.confirm_job },
  ];

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Store Queue</h1>
            <p className="text-sm text-[var(--text-muted)]">
              {counts.all} item{counts.all !== 1 ? 's' : ''} need attention
            </p>
          </div>
          <button onClick={loadQueue} className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg transition">
            <RefreshCw className={`w-5 h-5 text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === f.id
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                filter === f.id ? 'bg-white/20' : 'bg-[var(--surface)]'
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search by tech, job, customer, part..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input-premium pl-10 text-sm w-full"
        />
      </div>

      {/* Queue */}
      {loading ? (
        <SkeletonJobList count={4} />
      ) : filteredQueue.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-lg">All clear!</p>
          <p className="text-sm mt-1">
            {filter === 'all' ? 'Nothing needs attention right now.' : `No ${filters.find(f => f.id === filter)?.label.toLowerCase()} items.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQueue.map(item => {
            const Icon = getTypeIcon(item.type);
            const isProc = processing.has(item.id);
            const state = item.requestId ? inlineState[item.requestId] : undefined;
            const matchedPart = state ? parts.find(p => p.part_id === state.partId) : undefined;
            const approvedPart = item.adminResponsePartId ? parts.find(p => p.part_id === item.adminResponsePartId) : undefined;

            return (
              <div key={item.id} className="card-theme rounded-xl p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getTypeColor(item.type).split(' ').slice(0, 1).join(' ')}`}>
                      <Icon className={`w-4 h-4 ${getTypeColor(item.type).split(' ')[1]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* Type badge + description */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getTypeColor(item.type)}`}>
                          {getTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{formatTimeAgo(item.createdAt)}</span>
                      </div>
                      {/* Main content */}
                      <p className="font-medium text-sm text-[var(--text)] mt-1">
                        {item.type === 'part_request' || item.type === 'ready_to_issue'
                          ? item.requestDescription
                          : item.jobTitle
                        }
                      </p>
                      {/* Meta line */}
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)] flex-wrap">
                        {(item.type === 'part_request' || item.type === 'ready_to_issue') && (
                          <>
                            <span>{item.requestedByName}</span>
                            <span>·</span>
                          </>
                        )}
                        <span>{item.jobTitle}</span>
                        {item.customerName && <><span>·</span><span>{item.customerName}</span></>}
                        {item.technicianName && <><span>·</span><span>{item.technicianName}</span></>}
                        {item.forkliftSerial && <><span>·</span><span>{item.forkliftSerial}</span></>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/jobs/${item.jobId}`)}
                    className="p-1.5 hover:bg-[var(--bg-subtle)] rounded-lg transition flex-shrink-0"
                    title="View job details"
                  >
                    <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                </div>

                {/* ── Part Request: inline approve ── */}
                {item.type === 'part_request' && item.requestId && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <div className="flex-1">
                      <Combobox
                        options={partOptions}
                        value={state?.partId || ''}
                        onChange={(val) => updateInline(item.requestId!, { partId: val })}
                        placeholder="Select part..."
                      />
                    </div>
                    <input
                      type="number" min="0.1" step="any"
                      value={state?.quantity || '1'}
                      onChange={e => updateInline(item.requestId!, { quantity: e.target.value })}
                      className="w-16 px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg text-center bg-[var(--surface)]"
                    />
                    <button
                      onClick={() => handleApproveRequest(item)}
                      disabled={isProc || !state?.partId}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      {isProc ? <Spinner /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejectingId(item.id); setRejectType('request'); setRejectReason(''); }}
                      disabled={isProc}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    {matchedPart && (
                      <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                        Stock: {matchedPart.stock_quantity}
                      </span>
                    )}
                  </div>
                )}

                {/* ── Ready to Issue: issue button ── */}
                {item.type === 'ready_to_issue' && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 text-sm">
                      <PackageCheck className="w-4 h-4 text-blue-500" />
                      <span className="text-[var(--text)]">
                        {item.adminResponseQuantity}× {approvedPart?.part_name || 'Part'}
                      </span>
                      {approvedPart && (
                        <span className="text-xs text-[var(--text-muted)]">RM{approvedPart.sell_price} ea</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleIssue(item)}
                      disabled={isProc}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {isProc ? <Spinner /> : <PackageCheck className="w-3.5 h-3.5" />}
                      Issue to Tech
                    </button>
                  </div>
                )}

                {/* ── Confirm Parts: summary + button ── */}
                {item.type === 'confirm_parts' && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--text)]">
                        {item.partsCount} part{item.partsCount !== 1 ? 's' : ''} used
                      </span>
                      <span className="text-[var(--text-muted)]">
                        RM{(item.partsTotal || 0).toFixed(2)} total
                      </span>
                      {item.completedAt && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          (Date.now() - new Date(item.completedAt).getTime()) > 86400000
                            ? 'bg-red-100 text-red-600'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                        }`}>
                          Completed {formatTimeAgo(item.completedAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConfirmParts(item)}
                        disabled={isProc}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
                      >
                        {isProc ? <Spinner /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        Verify Parts
                      </button>
                      <button
                        onClick={() => { setRejectingId(item.id); setRejectType('parts'); setRejectReason(''); }}
                        disabled={isProc}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Confirm Job: button ── */}
                {item.type === 'confirm_job' && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-3 text-sm">
                      {item.partsConfirmedAt && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Parts verified
                        </span>
                      )}
                      {item.completedAt && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          (Date.now() - new Date(item.completedAt).getTime()) > 86400000
                            ? 'bg-red-100 text-red-600'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                        }`}>
                          Completed {formatTimeAgo(item.completedAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConfirmJob(item)}
                        disabled={isProc}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition"
                      >
                        {isProc ? <Spinner /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Confirm Job
                      </button>
                      <button
                        onClick={() => { setRejectingId(item.id); setRejectType('job'); setRejectReason(''); }}
                        disabled={isProc}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRejectingId(null)}>
          <div className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Reject {rejectType === 'request' ? 'Request' : rejectType === 'parts' ? 'Parts' : 'Job'}
            </h4>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="input-premium w-full h-24 resize-none mb-3"
              placeholder="Reason for rejection..."
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setRejectingId(null)} className="btn-premium btn-premium-ghost flex-1">Cancel</button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || processing.has(rejectingId)}
                className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}

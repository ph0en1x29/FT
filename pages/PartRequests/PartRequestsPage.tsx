/**
 * PartRequestsPage - Standalone page for Store Admin to view and quick-approve
 * all pending part requests across jobs, without drilling into each job.
 */
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Clock,
  ExternalLink,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Combobox, ComboboxOption } from '../../components/Combobox';
import { usePartsForList } from '../../hooks/useQueryHooks';
import { approveSparePartRequest, rejectRequest, issuePartToTechnician } from '../../services/jobRequestService';
import { showToast } from '../../services/toastService';
import { supabase } from '../../services/supabaseClient';
import { Part, User } from '../../types';

interface PartRequestRow {
  request_id: string;
  job_id: string;
  request_type: string;
  description: string;
  status: string;
  created_at: string;
  requested_by: string;
  photo_url?: string;
  admin_response_part_id?: string;
  admin_response_quantity?: number;
  admin_response_notes?: string;
  responded_by?: string;
  issued_at?: string;
  collected_at?: string;
  // Joined
  requester_name: string;
  job_title: string;
  job_status: string;
  customer_name: string;
  forklift_serial: string;
}

interface InlineApproveState {
  partId: string;
  quantity: string;
}

interface PartRequestsPageProps {
  currentUser: User;
  hideHeader?: boolean;
}

type FilterTab = 'pending' | 'approved' | 'issued' | 'all';

export default function PartRequestsPage({ currentUser, hideHeader = false }: PartRequestsPageProps) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<PartRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [filterTab, setFilterTab] = useState<FilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline approve state per request
  const [inlineState, setInlineState] = useState<Record<string, InlineApproveState>>({});
  // Reject state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: cachedParts = [] } = usePartsForList();
  const parts = cachedParts as unknown as Part[];

  const partOptions: ComboboxOption[] = useMemo(() => parts.map(p => ({
    id: p.part_id,
    label: p.part_name,
    subLabel: `RM${p.sell_price} | Stock: ${p.stock_quantity}`,
  })), [parts]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('job_requests')
        .select(`
          *,
          requested_by_user:users!job_requests_requested_by_fkey(user_id, name, full_name),
          job:jobs(job_id, title, status, customer:customers(name), forklift:forklifts!forklift_id(serial_number))
        `)
        .eq('request_type', 'spare_part')
        .order('created_at', { ascending: false });

      if (filterTab !== 'all') {
        query = query.eq('status', filterTab);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Failed to load requests:', error);
        setRequests([]);
        return;
      }

      const mapped: PartRequestRow[] = (data || []).map((r: Record<string, unknown>) => {
        const user = r.requested_by_user as Record<string, unknown> | null;
        const job = r.job as Record<string, unknown> | null;
        const customer = job?.customer as Record<string, unknown> | null;
        const forklift = job?.forklift as Record<string, unknown> | null;
        return {
          request_id: r.request_id as string,
          job_id: r.job_id as string,
          request_type: r.request_type as string,
          description: r.description as string,
          status: r.status as string,
          created_at: r.created_at as string,
          requested_by: r.requested_by as string,
          photo_url: r.photo_url as string | undefined,
          admin_response_part_id: r.admin_response_part_id as string | undefined,
          admin_response_quantity: r.admin_response_quantity as number | undefined,
          admin_response_notes: r.admin_response_notes as string | undefined,
          responded_by: r.responded_by as string | undefined,
          issued_at: r.issued_at as string | undefined,
          collected_at: r.collected_at as string | undefined,
          requester_name: (user?.full_name as string) || (user?.name as string) || 'Unknown',
          job_title: (job?.title as string) || 'Unknown Job',
          job_status: (job?.status as string) || '',
          customer_name: (customer?.name as string) || '',
          forklift_serial: (forklift?.serial_number as string) || '',
        };
      });

      setRequests(mapped);

      // Auto-match for pending requests
      const autoMatched: Record<string, InlineApproveState> = {};
      for (const req of mapped) {
        if (req.status === 'pending') {
          const match = findBestPartMatch(req.description, parts);
          autoMatched[req.request_id] = {
            partId: match?.part_id || '',
            quantity: '1',
          };
        }
      }
      setInlineState(prev => ({ ...prev, ...autoMatched }));
    } finally {
      setLoading(false);
    }
  }, [filterTab, parts]);

  useEffect(() => {
    if (parts.length > 0) loadRequests();
  }, [loadRequests, parts]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(r =>
      r.description.toLowerCase().includes(q) ||
      r.requester_name.toLowerCase().includes(q) ||
      r.job_title.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q) ||
      r.forklift_serial.toLowerCase().includes(q)
    );
  }, [requests, searchQuery]);

  const updateInline = (requestId: string, updates: Partial<InlineApproveState>) => {
    setInlineState(prev => ({
      ...prev,
      [requestId]: { ...prev[requestId], ...updates },
    }));
  };

  const handleQuickApprove = async (req: PartRequestRow) => {
    const state = inlineState[req.request_id];
    if (!state?.partId) {
      showToast.error('Select a part first');
      return;
    }
    const qty = parseFloat(state.quantity) || 1;
    if (qty <= 0) { showToast.error('Invalid quantity'); return; }

    setProcessing(prev => new Set(prev).add(req.request_id));
    try {
      const ok = await approveSparePartRequest(
        req.request_id,
        currentUser.user_id,
        [{ partId: state.partId, quantity: qty }],
        undefined,
        currentUser.full_name || currentUser.name,
        currentUser.role
      );
      if (ok) {
        showToast.success('Request approved');
        loadRequests();
      } else {
        showToast.error('Approval failed', 'Check stock availability');
      }
    } finally {
      setProcessing(prev => { const n = new Set(prev); n.delete(req.request_id); return n; });
    }
  };

  const handleQuickIssue = async (req: PartRequestRow) => {
    setProcessing(prev => new Set(prev).add(req.request_id));
    try {
      const ok = await issuePartToTechnician(
        req.request_id,
        currentUser.user_id,
        currentUser.full_name || currentUser.name || '',
        currentUser.role
      );
      if (ok) {
        showToast.success('Part issued');
        loadRequests();
      } else {
        showToast.error('Issue failed');
      }
    } finally {
      setProcessing(prev => { const n = new Set(prev); n.delete(req.request_id); return n; });
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    setProcessing(prev => new Set(prev).add(rejectingId));
    try {
      const ok = await rejectRequest(rejectingId, currentUser.user_id, rejectReason.trim());
      if (ok) {
        showToast.success('Request rejected');
        setRejectingId(null);
        setRejectReason('');
        loadRequests();
      } else {
        showToast.error('Rejection failed');
      }
    } finally {
      setProcessing(prev => { const n = new Set(prev); n.delete(rejectingId!); return n; });
    }
  };

  // Bulk approve all matched pending
  const pendingWithMatch = filteredRequests.filter(
    r => r.status === 'pending' && inlineState[r.request_id]?.partId
  );

  const handleBulkApprove = async () => {
    if (pendingWithMatch.length === 0) return;
    for (const req of pendingWithMatch) {
      await handleQuickApprove(req);
    }
  };

  const formatTimeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const tabCounts = useMemo(() => {
    // We need all statuses for counts, but we only have filtered data
    // Show count from current data
    return {
      pending: requests.length, // Will be accurate when filterTab matches
    };
  }, [requests]);

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Ready to Issue' },
    { id: 'issued', label: 'Issued' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-[var(--accent)]" />
            <h1 className="text-xl font-bold text-[var(--text)]">Part Requests</h1>
          </div>
          <button
            onClick={loadRequests}
            className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg transition"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[var(--bg-subtle)] rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${
              filterTab === tab.id
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
            {tab.id === 'pending' && filteredRequests.length > 0 && filterTab === 'pending' && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                {filteredRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Bulk */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by part, tech, job, customer..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-premium pl-10 text-sm w-full"
          />
        </div>
        {filterTab === 'pending' && pendingWithMatch.length >= 2 && (
          <button
            onClick={handleBulkApprove}
            className="btn-premium btn-premium-primary text-sm whitespace-nowrap flex items-center gap-2"
          >
            <CheckSquare className="w-4 h-4" />
            Approve All ({pendingWithMatch.length})
          </button>
        )}
      </div>

      {/* Request List */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No {filterTab !== 'all' ? filterTab : ''} requests</p>
          <p className="text-sm mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(req => {
            const isProcessing = processing.has(req.request_id);
            const state = inlineState[req.request_id];
            const matchedPart = parts.find(p => p.part_id === state?.partId);
            const approvedPart = parts.find(p => p.part_id === req.admin_response_part_id);

            return (
              <div
                key={req.request_id}
                className={`rounded-xl border p-4 transition ${
                  req.status === 'pending'
                    ? 'border-amber-200 bg-amber-50/30'
                    : req.status === 'approved'
                      ? 'border-blue-200 bg-blue-50/30'
                      : req.status === 'issued'
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                {/* Top row: description + meta */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-[var(--text)]">{req.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
                      <span>{req.requester_name}</span>
                      <span>·</span>
                      <span>{req.job_title}</span>
                      {req.customer_name && <><span>·</span><span>{req.customer_name}</span></>}
                      {req.forklift_serial && <><span>·</span><span>{req.forklift_serial}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-[var(--text-muted)]">{formatTimeAgo(req.created_at)}</span>
                    <button
                      onClick={() => navigate(`/jobs/${req.job_id}`)}
                      className="p-1 hover:bg-[var(--bg-subtle)] rounded transition"
                      title="View job details"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </button>
                  </div>
                </div>

                {/* Pending: Inline approve controls */}
                {req.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <div className="flex-1">
                      <Combobox
                        options={partOptions}
                        value={state?.partId || ''}
                        onChange={(val) => updateInline(req.request_id, { partId: val })}
                        placeholder="Select part..."
                      />
                    </div>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      value={state?.quantity || '1'}
                      onChange={e => updateInline(req.request_id, { quantity: e.target.value })}
                      className="w-16 px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg text-center bg-[var(--surface)]"
                    />
                    <button
                      onClick={() => handleQuickApprove(req)}
                      disabled={isProcessing || !state?.partId}
                      className="btn-premium btn-premium-primary text-xs px-3 disabled:opacity-50"
                      title="Approve"
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => { setRejectingId(req.request_id); setRejectReason(''); }}
                      disabled={isProcessing}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Reject"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    {matchedPart && (
                      <span className="text-xs text-green-600 hidden sm:inline">
                        Stock: {matchedPart.stock_quantity}
                      </span>
                    )}
                  </div>
                )}

                {/* Approved: Show part + Issue button */}
                {req.status === 'approved' && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-[var(--text)]">
                        {req.admin_response_quantity}× {approvedPart?.part_name || 'Part'}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        RM{approvedPart?.sell_price || '—'} each
                      </span>
                    </div>
                    <button
                      onClick={() => handleQuickIssue(req)}
                      disabled={isProcessing}
                      className="btn-premium btn-premium-primary text-xs px-3 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <PackageCheck className="w-3.5 h-3.5" /> Issue
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Issued: Show completion info */}
                {req.status === 'issued' && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                    <PackageCheck className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 font-medium">
                      Issued{req.issued_at ? ` ${formatTimeAgo(req.issued_at)}` : ''}
                    </span>
                    {req.collected_at ? (
                      <span className="text-green-600">· Collected</span>
                    ) : (
                      <span className="text-amber-600">· Awaiting collection</span>
                    )}
                  </div>
                )}

                {/* Rejected */}
                {req.status === 'rejected' && req.admin_response_notes && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-600">Rejected: {req.admin_response_notes}</span>
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
              <XCircle className="w-5 h-5 text-red-500" /> Reject Request
            </h4>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="input-premium w-full h-24 resize-none mb-3"
              placeholder="Reason for rejection..."
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setRejectingId(null)} className="btn-premium btn-premium-ghost flex-1">
                Cancel
              </button>
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

/**
 * Fuzzy match request description to parts inventory
 */
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

    if (score > bestScore) {
      bestScore = score;
      bestMatch = part;
    }
  }

  return bestScore >= 3 ? bestMatch : null;
}

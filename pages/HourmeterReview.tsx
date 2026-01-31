import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  UserRole,
  HourmeterAmendment,
  HourmeterAmendmentStatus,
  HourmeterFlagReason,
} from '../types';
import { SupabaseDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import {
  Gauge,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ChevronRight,
  X,
  Truck,
} from 'lucide-react';

interface HourmeterReviewProps {
  currentUser: User;
  hideHeader?: boolean;
}

type TabType = 'pending' | 'approved' | 'rejected';

const FLAG_REASON_LABELS: Record<HourmeterFlagReason, string> = {
  lower_than_previous: 'Lower than previous',
  excessive_jump: 'Excessive jump',
  pattern_mismatch: 'Pattern mismatch',
  manual_flag: 'Manually flagged',
  timestamp_mismatch: 'Timestamp issue',
};

export default function HourmeterReview({ currentUser, hideHeader = false }: HourmeterReviewProps) {
  const navigate = useNavigate();
  const [amendments, setAmendments] = useState<HourmeterAmendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAmendment, setSelectedAmendment] = useState<HourmeterAmendment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPERVISOR;

  useEffect(() => {
    loadAmendments();
  }, []);

  const loadAmendments = async () => {
    setLoading(true);
    try {
      const data = await SupabaseDb.getHourmeterAmendments();
      setAmendments(data);
    } catch (error) {
      showToast.error('Failed to load hourmeter amendments');
    }
    setLoading(false);
  };

  // Filter amendments by tab and search
  const filteredAmendments = useMemo(() => {
    let result = amendments.filter(a => a.status === activeTab);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.job_id.toLowerCase().includes(query) ||
        a.requested_by_name.toLowerCase().includes(query) ||
        a.reason.toLowerCase().includes(query)
      );
    }

    // Sort by most recent first
    result.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());

    return result;
  }, [amendments, activeTab, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    pending: amendments.filter(a => a.status === 'pending').length,
    approved: amendments.filter(a => a.status === 'approved').length,
    rejected: amendments.filter(a => a.status === 'rejected').length,
  }), [amendments]);

  const handleViewDetail = (amendment: HourmeterAmendment) => {
    setSelectedAmendment(amendment);
    setReviewNotes('');
    setShowDetailModal(true);
  };

  const handleApprove = async () => {
    if (!selectedAmendment) return;
    setProcessing(true);
    try {
      await SupabaseDb.approveHourmeterAmendment(
        selectedAmendment.amendment_id,
        currentUser.user_id,
        currentUser.name,
        reviewNotes || undefined
      );
      showToast.success('Amendment approved', 'Hourmeter reading has been updated');
      setShowDetailModal(false);
      loadAmendments();
    } catch (error) {
      showToast.error('Failed to approve', (error as Error).message);
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedAmendment) return;
    if (!reviewNotes.trim()) {
      showToast.error('Please provide rejection notes');
      return;
    }
    setProcessing(true);
    try {
      await SupabaseDb.rejectHourmeterAmendment(
        selectedAmendment.amendment_id,
        currentUser.user_id,
        currentUser.name,
        reviewNotes
      );
      showToast.success('Amendment rejected');
      setShowDetailModal(false);
      loadAmendments();
    } catch (error) {
      showToast.error('Failed to reject', (error as Error).message);
    }
    setProcessing(false);
  };

  const getTimeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading hourmeter amendments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-theme flex items-center gap-2">
              <Gauge className="w-7 h-7" />
              Hourmeter Review
            </h1>
            <p className="text-sm text-theme-muted mt-1">
              Review and approve hourmeter amendment requests
            </p>
          </div>
          <button
            onClick={loadAmendments}
            className="flex items-center gap-2 px-4 py-2 border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
            activeTab === 'pending'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
              : stats.pending > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-slate-50 border-slate-200'
          }`}
          onClick={() => setActiveTab('pending')}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className={`w-5 h-5 ${stats.pending > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${stats.pending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {stats.pending}
          </div>
          <div className={`text-xs ${stats.pending > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
            Pending Review
          </div>
        </div>

        <div
          className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
            activeTab === 'approved'
              ? 'bg-green-50 border-green-300 ring-2 ring-green-200'
              : 'bg-slate-50 border-slate-200'
          }`}
          onClick={() => setActiveTab('approved')}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className={`w-5 h-5 ${activeTab === 'approved' ? 'text-green-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${activeTab === 'approved' ? 'text-green-600' : 'text-slate-400'}`}>
            {stats.approved}
          </div>
          <div className={`text-xs ${activeTab === 'approved' ? 'text-green-700' : 'text-slate-500'}`}>
            Approved
          </div>
        </div>

        <div
          className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
            activeTab === 'rejected'
              ? 'bg-red-50 border-red-300 ring-2 ring-red-200'
              : 'bg-slate-50 border-slate-200'
          }`}
          onClick={() => setActiveTab('rejected')}
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className={`w-5 h-5 ${activeTab === 'rejected' ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${activeTab === 'rejected' ? 'text-red-600' : 'text-slate-400'}`}>
            {stats.rejected}
          </div>
          <div className={`text-xs ${activeTab === 'rejected' ? 'text-red-700' : 'text-slate-500'}`}>
            Rejected
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by job ID, technician, or reason..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Amendments List */}
      {filteredAmendments.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center theme-transition">
          <Gauge className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No Amendments Found</h3>
          <p className="text-sm text-theme-muted">
            {activeTab === 'pending'
              ? 'No pending hourmeter amendments to review'
              : `No ${activeTab} amendments`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAmendments.map((amendment) => (
            <div
              key={amendment.amendment_id}
              className="card-theme rounded-xl overflow-hidden theme-transition hover:shadow-md cursor-pointer"
              onClick={() => handleViewDetail(amendment)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      amendment.status === 'pending' ? 'bg-amber-100' :
                      amendment.status === 'approved' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <Gauge className={`w-5 h-5 ${
                        amendment.status === 'pending' ? 'text-amber-600' :
                        amendment.status === 'approved' ? 'text-green-600' : 'text-red-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-theme">Job: {amendment.job_id.slice(0, 8)}...</h4>
                      <p className="text-xs text-theme-muted">
                        Requested by {amendment.requested_by_name} • {getTimeSince(amendment.requested_at)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-theme-muted" />
                </div>

                {/* Reading comparison */}
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg mb-3">
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Original</div>
                    <div className="text-lg font-bold text-slate-700">{amendment.original_reading.toLocaleString()}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Amended</div>
                    <div className="text-lg font-bold text-blue-600">{amendment.amended_reading.toLocaleString()}</div>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-xs text-slate-500">Change</div>
                    <div className={`text-sm font-medium ${
                      amendment.amended_reading > amendment.original_reading ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {amendment.amended_reading > amendment.original_reading ? '+' : ''}
                      {(amendment.amended_reading - amendment.original_reading).toLocaleString()} hrs
                    </div>
                  </div>
                </div>

                {/* Flag reasons */}
                {amendment.flag_reasons && amendment.flag_reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {amendment.flag_reasons.map((flag) => (
                      <span
                        key={flag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {FLAG_REASON_LABELS[flag] || flag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Reason preview */}
                <p className="text-sm text-theme-muted line-clamp-2">{amendment.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedAmendment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className={`p-4 border-b ${
              selectedAmendment.status === 'pending' ? 'bg-amber-50' :
              selectedAmendment.status === 'approved' ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Gauge className={`w-6 h-6 ${
                    selectedAmendment.status === 'pending' ? 'text-amber-600' :
                    selectedAmendment.status === 'approved' ? 'text-green-600' : 'text-red-600'
                  }`} />
                  <div>
                    <h2 className="font-semibold text-lg">Hourmeter Amendment</h2>
                    <p className="text-sm text-slate-600">
                      Job: {selectedAmendment.job_id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white/50 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Reading comparison */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-3">Reading Comparison</h3>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-center flex-1">
                    <div className="text-xs text-slate-500 mb-1">Original</div>
                    <div className="text-2xl font-bold text-slate-700">
                      {selectedAmendment.original_reading.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400">hrs</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400" />
                  <div className="text-center flex-1">
                    <div className="text-xs text-slate-500 mb-1">Amended</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedAmendment.amended_reading.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400">hrs</div>
                  </div>
                </div>
              </div>

              {/* Flag reasons */}
              {selectedAmendment.flag_reasons && selectedAmendment.flag_reasons.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Flags Detected
                  </h3>
                  <ul className="space-y-1">
                    {selectedAmendment.flag_reasons.map((flag) => (
                      <li key={flag} className="flex items-center gap-2 text-sm text-red-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {FLAG_REASON_LABELS[flag] || flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Request details */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Reason for Amendment</h3>
                <p className="text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
                  {selectedAmendment.reason}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Requested by:</span>
                  <p className="font-medium">{selectedAmendment.requested_by_name}</p>
                </div>
                <div>
                  <span className="text-slate-500">Requested at:</span>
                  <p className="font-medium">
                    {new Date(selectedAmendment.requested_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Review notes (for approved/rejected) */}
              {selectedAmendment.status !== 'pending' && selectedAmendment.review_notes && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Review Notes</h3>
                  <p className="text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
                    {selectedAmendment.review_notes}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Reviewed by {selectedAmendment.reviewed_by_name} on{' '}
                    {new Date(selectedAmendment.reviewed_at!).toLocaleString()}
                  </p>
                </div>
              )}

              {/* Review notes input (for pending) */}
              {selectedAmendment.status === 'pending' && isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Review Notes {selectedAmendment.status === 'pending' && '(required for rejection)'}
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about your decision..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-slate-50">
              {selectedAmendment.status === 'pending' && isAdmin ? (
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-white text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-white text-sm"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { Gauge, Search, RefreshCw } from 'lucide-react';
import { User, UserRole, HourmeterAmendment } from '../../types';
import { SupabaseDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { TabType } from './constants';
import StatCard from './StatCard';
import AmendmentCard from './AmendmentCard';
import AmendmentDetailModal from './AmendmentDetailModal';

interface HourmeterReviewProps {
  currentUser: User;
  hideHeader?: boolean;
}

export default function HourmeterReview({ currentUser, hideHeader = false }: HourmeterReviewProps) {
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
        <StatCard
          type="pending"
          count={stats.pending}
          isActive={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
        />
        <StatCard
          type="approved"
          count={stats.approved}
          isActive={activeTab === 'approved'}
          onClick={() => setActiveTab('approved')}
        />
        <StatCard
          type="rejected"
          count={stats.rejected}
          isActive={activeTab === 'rejected'}
          onClick={() => setActiveTab('rejected')}
        />
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
            <div key={amendment.amendment_id}>
              <AmendmentCard
                amendment={amendment}
                onClick={() => handleViewDetail(amendment)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedAmendment && (
        <AmendmentDetailModal
          amendment={selectedAmendment}
          isAdmin={isAdmin}
          reviewNotes={reviewNotes}
          onReviewNotesChange={setReviewNotes}
          processing={processing}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setShowDetailModal(false)}
        />
      )}
    </div>
  );
}

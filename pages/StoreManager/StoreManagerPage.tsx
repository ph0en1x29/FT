import { AlertTriangle, CheckCircle, Clock, Package, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { issuePartToTechnician, markPartReceived } from '../../services/jobRequestService';
import { supabase } from '../../services/supabaseClient';
import { showToast } from '../../services/toastService';
import type { User } from '../../types';

interface StoreManagerPageProps {
  currentUser: User;
}

type RequestTab = 'pending' | 'approved' | 'part_ordered' | 'issued' | 'all';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoreRequest = any;

const StoreManagerPage: React.FC<StoreManagerPageProps> = ({ currentUser }) => {
  const [requests, setRequests] = useState<StoreRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RequestTab>('pending');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('job_requests')
        .select(`
          *,
          job:jobs(job_id, title, description, status, assigned_technician_id,
            forklift:forklifts!forklift_id(serial_number, make, model)),
          requested_by_user:users!job_requests_requested_by_fkey(user_id, name, full_name),
          admin_response_part:parts!job_requests_admin_response_part_id_fkey(part_id, part_name, sell_price, stock_quantity)
        `)
        .eq('request_type', 'spare_part')
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data, error } = await query;
      if (error) {
        showToast.error('Failed to load requests');
        return;
      }
      setRequests(data || []);
    } catch {
      showToast.error('Error loading requests');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleIssuePart = async (requestId: string) => {
    const success = await issuePartToTechnician(requestId, currentUser.user_id, currentUser.name);
    if (success) {
      showToast.success('Part issued to technician');
      loadRequests();
    } else {
      showToast.error('Failed to issue part');
    }
  };

  const handleMarkReceived = async (requestId: string) => {
    const success = await markPartReceived(requestId, currentUser.user_id);
    if (success) {
      showToast.success('Part marked as received');
      loadRequests();
    } else {
      showToast.error('Failed to mark as received');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="w-3 h-3" />, label: 'Pending Review' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Ready to Issue' },
      issued: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <PackageCheck className="w-3 h-3" />, label: 'Issued' },
      part_ordered: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Truck className="w-3 h-3" />, label: 'Part Ordered' },
      out_of_stock: { bg: 'bg-orange-100', text: 'text-orange-700', icon: <AlertTriangle className="w-3 h-3" />, label: 'Out of Stock' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: null, label: 'Rejected' },
    };
    const s = styles[status] || styles.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {s.icon} {s.label}
      </span>
    );
  };

  const tabs: { key: RequestTab; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending', count: requests.filter(r => activeTab === 'all' ? r.status === 'pending' : undefined).length },
    { key: 'approved', label: 'Ready to Issue' },
    { key: 'part_ordered', label: 'Ordered' },
    { key: 'issued', label: 'Issued' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
            <Package className="w-7 h-7 text-[var(--accent)]" />
            Store Manager
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage spare part requests, issuance, and supplier orders</p>
        </div>
        <button onClick={loadRequests} className="btn-premium btn-premium-secondary text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Request Cards */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)]">No {activeTab === 'all' ? '' : activeTab} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req: StoreRequest) => (
            <div key={req.request_id} className="card-theme rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(req.status)}
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(req.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text)] font-medium">{req.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                    <span>By: {req.requested_by_user?.full_name || req.requested_by_user?.name || 'Unknown'}</span>
                    {req.job && (
                      <Link to={`/jobs/${req.job.job_id}`} className="text-[var(--accent)] hover:underline">
                        Job: {req.job.title || req.job.description?.slice(0, 40)}
                      </Link>
                    )}
                    {req.job?.forklift && (
                      <span>{req.job.forklift.make} {req.job.forklift.model} ({req.job.forklift.serial_number})</span>
                    )}
                  </div>
                  {req.admin_response_part && (
                    <div className="mt-2 text-xs">
                      <span className="text-[var(--text-muted)]">Part: </span>
                      <span className="font-medium text-[var(--text)]">
                        {req.admin_response_quantity}x {req.admin_response_part.part_name}
                      </span>
                      <span className="text-[var(--text-muted)] ml-2">
                        (Stock: {req.admin_response_part.stock_quantity})
                      </span>
                    </div>
                  )}
                  {req.supplier_order_notes && (
                    <p className="mt-1 text-xs text-purple-600">Supplier: {req.supplier_order_notes}</p>
                  )}
                  {req.issued_at && (
                    <p className="mt-1 text-xs text-blue-600">
                      Issued: {new Date(req.issued_at).toLocaleString()}
                      {req.collected_at && <span className="text-green-600 ml-2">· Collected {new Date(req.collected_at).toLocaleString()}</span>}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {req.status === 'approved' && !req.issued_at && (
                    <button
                      onClick={() => handleIssuePart(req.request_id)}
                      className="btn-premium btn-premium-primary text-xs px-3 py-1.5"
                    >
                      <PackageCheck className="w-3.5 h-3.5" /> Issue
                    </button>
                  )}
                  {req.status === 'part_ordered' && (
                    <button
                      onClick={() => handleMarkReceived(req.request_id)}
                      className="btn-premium btn-premium-primary text-xs px-3 py-1.5"
                    >
                      <Package className="w-3.5 h-3.5" /> Received
                    </button>
                  )}
                  {req.status === 'pending' && (
                    <Link
                      to={`/jobs/${req.job_id}`}
                      className="btn-premium btn-premium-secondary text-xs px-3 py-1.5 text-center"
                    >
                      Review in Job
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoreManagerPage;

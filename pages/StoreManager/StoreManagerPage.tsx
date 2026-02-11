import { AlertTriangle, CheckCircle, Clock, Package, PackageCheck, RefreshCw, Truck, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { issuePartToTechnician, markPartReceived } from '../../services/jobRequestService';
import { approveReplenishmentRequest, fulfillReplenishment, getReplenishmentRequests } from '../../services/replenishmentService';
import { supabase } from '../../services/supabaseClient';
import { showToast } from '../../services/toastService';
import type { User, VanStockReplenishment } from '../../types';

interface StoreManagerPageProps {
  currentUser: User;
}

type MainTab = 'parts' | 'replenishments';
type RequestTab = 'pending' | 'approved' | 'part_ordered' | 'issued' | 'all';
type ReplenishTab = 'pending' | 'approved' | 'in_progress' | 'completed' | 'all';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoreRequest = any;

const StoreManagerPage: React.FC<StoreManagerPageProps> = ({ currentUser }) => {
  const [mainTab, setMainTab] = useState<MainTab>('parts');
  const [requests, setRequests] = useState<StoreRequest[]>([]);
  const [replenishments, setReplenishments] = useState<VanStockReplenishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RequestTab>('pending');
  const [replenishTab, setReplenishTab] = useState<ReplenishTab>('pending');

  // ==================
  // PART REQUESTS
  // ==================
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
      if (error) { showToast.error('Failed to load requests'); return; }
      setRequests(data || []);
    } catch { showToast.error('Error loading requests'); }
    finally { setLoading(false); }
  }, [activeTab]);

  // ==================
  // REPLENISHMENTS
  // ==================
  const loadReplenishments = useCallback(async () => {
    setLoading(true);
    try {
      const filters = replenishTab !== 'all' ? { status: replenishTab as VanStockReplenishment['status'] } : undefined;
      const data = await getReplenishmentRequests(filters);
      setReplenishments(data);
    } catch { showToast.error('Error loading replenishments'); }
    finally { setLoading(false); }
  }, [replenishTab]);

  useEffect(() => {
    if (mainTab === 'parts') loadRequests();
    else loadReplenishments();
  }, [mainTab, loadRequests, loadReplenishments]);

  const handleIssuePart = async (requestId: string) => {
    const success = await issuePartToTechnician(requestId, currentUser.user_id, currentUser.name, currentUser.role);
    if (success) { showToast.success('Part issued'); loadRequests(); }
    else showToast.error('Failed to issue part');
  };

  const handleMarkReceived = async (requestId: string) => {
    const success = await markPartReceived(requestId, currentUser.user_id);
    if (success) { showToast.success('Part received'); loadRequests(); }
    else showToast.error('Failed to mark received');
  };

  const handleApproveReplenishment = async (id: string) => {
    try {
      await approveReplenishmentRequest(id, currentUser.user_id, currentUser.name);
      showToast.success('Replenishment approved');
      loadReplenishments();
    } catch { showToast.error('Failed to approve'); }
  };

  const handleFulfillReplenishment = async (rep: VanStockReplenishment) => {
    try {
      const itemsIssued = (rep.items || []).map(item => ({
        itemId: item.item_id,
        quantityIssued: item.quantity_requested,
      }));
      await fulfillReplenishment(rep.replenishment_id, itemsIssued, currentUser.user_id, currentUser.name);
      showToast.success('Replenishment fulfilled', 'Technician will confirm receipt');
      loadReplenishments();
    } catch { showToast.error('Failed to fulfill'); }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
      issued: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <PackageCheck className="w-3 h-3" />, label: 'Issued' },
      part_ordered: { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Truck className="w-3 h-3" />, label: 'Ordered' },
      out_of_stock: { bg: 'bg-orange-100', text: 'text-orange-700', icon: <AlertTriangle className="w-3 h-3" />, label: 'Out of Stock' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Truck className="w-3 h-3" />, label: 'In Progress' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', icon: null, label: 'Rejected' },
    };
    const s = styles[status] || styles.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {s.icon} {s.label}
      </span>
    );
  };

  const partsTabs: { key: RequestTab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Ready to Issue' },
    { key: 'part_ordered', label: 'Ordered' },
    { key: 'issued', label: 'Issued' },
    { key: 'all', label: 'All' },
  ];

  const replenishTabs: { key: ReplenishTab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'in_progress', label: 'Dispatched' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
            <Package className="w-7 h-7 text-[var(--accent)]" />
            Store Manager
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Spare parts, issuance, van stock replenishment</p>
        </div>
        <button onClick={mainTab === 'parts' ? loadRequests : loadReplenishments} className="btn-premium btn-premium-secondary text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMainTab('parts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            mainTab === 'parts' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <PackageCheck className="w-4 h-4" /> Part Requests
        </button>
        <button
          onClick={() => setMainTab('replenishments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            mainTab === 'replenishments' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Truck className="w-4 h-4" /> Van Stock Replenishments
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {(mainTab === 'parts' ? partsTabs : replenishTabs).map(tab => (
          <button
            key={tab.key}
            onClick={() => mainTab === 'parts' ? setActiveTab(tab.key as RequestTab) : setReplenishTab(tab.key as ReplenishTab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              (mainTab === 'parts' ? activeTab : replenishTab) === tab.key
                ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30'
                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
      ) : mainTab === 'parts' ? (
        /* PART REQUESTS */
        requests.length === 0 ? (
          <EmptyState label={activeTab === 'all' ? '' : activeTab} />
        ) : (
          <div className="space-y-3">
            {requests.map((req: StoreRequest) => (
              <div key={req.request_id} className="card-theme rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(req.status)}
                      <span className="text-xs text-[var(--text-muted)]">{new Date(req.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-[var(--text)] font-medium">{req.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                      <span>By: {req.requested_by_user?.full_name || req.requested_by_user?.name || 'Unknown'}</span>
                      {req.job && (
                        <Link to={`/jobs/${req.job.job_id}`} className="text-[var(--accent)] hover:underline">
                          Job: {req.job.title || req.job.description?.slice(0, 40)}
                        </Link>
                      )}
                    </div>
                    {req.admin_response_part && (
                      <div className="mt-2 text-xs">
                        <span className="text-[var(--text-muted)]">Part: </span>
                        <span className="font-medium text-[var(--text)]">{req.admin_response_quantity}x {req.admin_response_part.part_name}</span>
                        <span className="text-[var(--text-muted)] ml-2">(Stock: {req.admin_response_part.stock_quantity})</span>
                      </div>
                    )}
                    {req.supplier_order_notes && <p className="mt-1 text-xs text-purple-600">Supplier: {req.supplier_order_notes}</p>}
                    {req.issued_at && (
                      <p className="mt-1 text-xs text-blue-600">
                        Issued: {new Date(req.issued_at).toLocaleString()}
                        {req.collected_at && <span className="text-green-600 ml-2">· Collected</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {req.status === 'approved' && !req.issued_at && (
                      <button onClick={() => handleIssuePart(req.request_id)} className="btn-premium btn-premium-primary text-xs px-3 py-1.5">
                        <PackageCheck className="w-3.5 h-3.5" /> Issue
                      </button>
                    )}
                    {req.status === 'part_ordered' && (
                      <button onClick={() => handleMarkReceived(req.request_id)} className="btn-premium btn-premium-primary text-xs px-3 py-1.5">
                        <Package className="w-3.5 h-3.5" /> Received
                      </button>
                    )}
                    {req.status === 'pending' && (
                      <Link to={`/jobs/${req.job_id}`} className="btn-premium btn-premium-secondary text-xs px-3 py-1.5 text-center">
                        Review in Job
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* VAN STOCK REPLENISHMENTS */
        replenishments.length === 0 ? (
          <EmptyState label={replenishTab === 'all' ? '' : replenishTab} />
        ) : (
          <div className="space-y-3">
            {replenishments.map(rep => (
              <div key={rep.replenishment_id} className="card-theme rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(rep.status)}
                      <span className="text-xs text-[var(--text-muted)]">{new Date(rep.created_at).toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                        <Users className="w-3 h-3" /> {rep.technician_name || 'Unknown Tech'}
                      </span>
                    </div>
                    {/* Items list */}
                    <div className="mt-2 space-y-1">
                      {(rep.items || []).map(item => (
                        <div key={item.item_id} className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-[var(--text)]">{item.quantity_requested}x</span>
                          <span className="text-[var(--text)]">{item.part_name}</span>
                          <span className="text-[var(--text-muted)]">({item.part_code})</span>
                          {item.quantity_issued > 0 && item.quantity_issued !== item.quantity_requested && (
                            <span className="text-amber-600">→ {item.quantity_issued} issued</span>
                          )}
                          {item.is_rejected && <span className="text-red-500">Rejected</span>}
                        </div>
                      ))}
                    </div>
                    {rep.notes && <p className="mt-2 text-xs text-[var(--text-muted)]">{rep.notes}</p>}
                    {rep.request_type !== 'manual' && (
                      <span className="inline-block mt-1 text-xs text-purple-600">
                        Auto: {rep.request_type === 'low_stock' ? 'Low stock trigger' : 'Slot-in job'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {rep.status === 'pending' && (
                      <button onClick={() => handleApproveReplenishment(rep.replenishment_id)} className="btn-premium btn-premium-primary text-xs px-3 py-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {rep.status === 'approved' && (
                      <button onClick={() => handleFulfillReplenishment(rep)} className="btn-premium btn-premium-primary text-xs px-3 py-1.5">
                        <Truck className="w-3.5 h-3.5" /> Dispatch
                      </button>
                    )}
                    {rep.status === 'in_progress' && (
                      <span className="text-xs text-blue-600 font-medium">Awaiting tech confirmation</span>
                    )}
                    {rep.status === 'completed' && rep.confirmed_at && (
                      <span className="text-xs text-green-600">✓ {new Date(rep.confirmed_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="text-center py-12">
    <Package className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
    <p className="text-[var(--text-muted)]">No {label} requests</p>
  </div>
);

export default StoreManagerPage;

/**
 * VanFleetOverview — Admin/Supervisor collapsible panel showing all vans,
 * status, temp assignments, and pending access requests.
 * Uses Tailwind theme classes for proper light/dark mode support.
 */
import { ChevronDown, ChevronRight, Edit2, FileText, UserMinus, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { showToast } from '../../../services/toastService';
import {
  assignTempTech,
  getPendingVanRequests,
  getVanAuditLog,
  getVanFleetOverview,
  removeTempTech,
  reviewVanAccessRequest,
  updateVanIdentification,
  updateVanStatus,
} from '../../../services/inventoryService';
import { getUsers } from '../../../services/userService';
import type { User, VanAccessRequest, VanAuditLogEntry, VanFleetItem, VanStatus } from '../../../types';

interface Props {
  currentUser: User;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<VanStatus, { label: string; dotClass: string; badgeClass: string }> = {
  active: { label: 'Active', dotClass: 'bg-emerald-500', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  in_service: { label: 'In Service', dotClass: 'bg-red-500', badgeClass: 'bg-red-50 text-red-700 border-red-200' },
  decommissioned: { label: 'Retired', dotClass: 'bg-gray-400', badgeClass: 'bg-gray-50 text-gray-600 border-gray-200' },
};

const AUDIT_LABELS: Record<string, string> = {
  status_change: '🔄 Status Changed',
  temp_assigned: '👤 Temp Assigned',
  temp_removed: '🚫 Temp Removed',
  request_submitted: '📝 Access Requested',
  request_approved: '✅ Request Approved',
  request_rejected: '❌ Request Rejected',
  van_created: '🆕 Van Created',
  van_updated: '✏️ Van Updated',
};

export default function VanFleetOverview({ currentUser, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [fleet, setFleet] = useState<VanFleetItem[]>([]);
  const [requests, setRequests] = useState<VanAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<User[]>([]);

  const [assignModal, setAssignModal] = useState<{ vanId: string; vanLabel: string } | null>(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [auditModal, setAuditModal] = useState<{ vanId: string; vanLabel: string } | null>(null);
  const [auditLog, setAuditLog] = useState<VanAuditLogEntry[]>([]);
  const [editModal, setEditModal] = useState<VanFleetItem | null>(null);
  const [editPlate, setEditPlate] = useState('');
  const [editCode, setEditCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fleetData, requestData] = await Promise.all([
        getVanFleetOverview(),
        getPendingVanRequests(),
      ]);
      setFleet(fleetData);
      setRequests(requestData);
      const users = await getUsers();
      if (users) setTechnicians(users.filter((u: User) => u.role === 'technician'));
    } catch {
      showToast.error('Failed to load fleet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Track per-item pending state to prevent double-clicks
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const addPending = (id: string) => setPendingActions(prev => new Set(prev).add(id));
  const removePending = (id: string) => setPendingActions(prev => { const s = new Set(prev); s.delete(id); return s; });

  const handleStatusToggle = async (van: VanFleetItem) => {
    if (pendingActions.has(van.van_stock_id)) return;
    addPending(van.van_stock_id);
    try {
      const newStatus: VanStatus = van.van_status === 'active' ? 'in_service' : 'active';
      const ok = await updateVanStatus(van.van_stock_id, newStatus, { id: currentUser.user_id, name: currentUser.name });
      if (ok) {
        showToast.success(`Van ${van.van_plate || van.van_code || ''} → ${STATUS_CONFIG[newStatus].label}`);
        loadData();
        onRefresh();
      } else {
        showToast.error('Failed to update van status');
      }
    } catch {
      showToast.error('Failed to update van status');
    } finally {
      removePending(van.van_stock_id);
    }
  };

  const handleRemoveTemp = async (van: VanFleetItem) => {
    if (pendingActions.has(van.van_stock_id)) return;
    addPending(van.van_stock_id);
    try {
      const ok = await removeTempTech(van.van_stock_id, { id: currentUser.user_id, name: currentUser.name });
      if (ok) {
        showToast.success(`Removed ${van.temporary_tech_name} from van`);
        loadData();
        onRefresh();
      } else {
        showToast.error('Failed to remove temp assignment');
      }
    } catch {
      showToast.error('Failed to remove temp assignment');
    } finally {
      removePending(van.van_stock_id);
    }
  };

  const handleAssign = async () => {
    if (!assignModal || !selectedTechId || submitting) return;
    setSubmitting(true);
    try {
      const tech = technicians.find(t => t.user_id === selectedTechId);
      const ok = await assignTempTech(
        assignModal.vanId, selectedTechId, tech?.name || 'Unknown',
        { id: currentUser.user_id, name: currentUser.name }, assignReason
      );
      if (ok) {
        showToast.success(`${tech?.name} assigned to ${assignModal.vanLabel}`);
        setAssignModal(null);
        setSelectedTechId('');
        setAssignReason('');
        loadData();
        onRefresh();
      } else {
        showToast.error('Failed to assign technician');
      }
    } catch {
      showToast.error('Failed to assign technician');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewRequest = async (requestId: string, approved: boolean) => {
    if (pendingActions.has(requestId)) return;
    addPending(requestId);
    try {
      const ok = await reviewVanAccessRequest(requestId, approved, { id: currentUser.user_id, name: currentUser.name });
      if (ok) {
        showToast.success(approved ? 'Request approved — tech assigned' : 'Request rejected');
        loadData();
        onRefresh();
      } else {
        showToast.error('Failed to process request');
      }
    } catch {
      showToast.error('Failed to process request');
    } finally {
      removePending(requestId);
    }
  };

  const handleViewAudit = async (van: VanFleetItem) => {
    const log = await getVanAuditLog(van.van_stock_id);
    setAuditLog(log);
    setAuditModal({ vanId: van.van_stock_id, vanLabel: van.van_plate || van.van_code || 'Van' });
  };

  const handleSaveIdentification = async () => {
    if (!editModal || submitting) return;
    setSubmitting(true);
    try {
      const ok = await updateVanIdentification(
        editModal.van_stock_id,
        { van_plate: editPlate || undefined, van_code: editCode || undefined },
        { id: currentUser.user_id, name: currentUser.name }
      );
      if (ok) {
        showToast.success('Van details updated');
        setEditModal(null);
        loadData();
      } else {
        showToast.error('Failed to update van details');
      }
    } catch {
      showToast.error('Failed to update van details');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('en-MY', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  if (loading) return <div className="p-4 text-theme-muted text-sm">Loading fleet...</div>;

  return (
    <div className="mb-4">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-theme-surface border border-theme cursor-pointer hover:bg-theme-surface-2 transition-colors ${
          expanded ? 'rounded-t-xl border-b-0' : 'rounded-xl'
        }`}
      >
        <span className="font-semibold text-theme text-sm flex items-center gap-2">
          🚐 Fleet Overview
          {requests.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {requests.length} pending
            </span>
          )}
        </span>
        {expanded ? <ChevronDown className="w-4 h-4 text-theme-muted" /> : <ChevronRight className="w-4 h-4 text-theme-muted" />}
      </button>

      {expanded && (
        <div className="border border-theme border-t-0 rounded-b-xl bg-theme-surface overflow-hidden">
          {/* Pending requests */}
          {requests.length > 0 && (
            <div className="px-4 py-3 border-b border-theme bg-amber-50/50">
              <div className="text-xs font-semibold text-amber-600 mb-2">⚠️ Pending Requests</div>
              {requests.map(req => (
                <div key={req.request_id} className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm text-theme flex-1">
                    <strong>{req.requester_name}</strong>
                    {' → '}
                    {fleet.find(v => v.van_stock_id === req.van_stock_id)?.van_plate || 'Van'}
                    <span className="text-theme-muted italic"> — "{req.reason}"</span>
                  </span>
                  <button onClick={() => handleReviewRequest(req.request_id, true)}
                    className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 font-medium">
                    Approve
                  </button>
                  <button onClick={() => handleReviewRequest(req.request_id, false)}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 font-medium">
                    Reject
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Van list */}
          <div className="divide-y divide-theme">
            {fleet.map(van => {
              const cfg = STATUS_CONFIG[van.van_status] || STATUS_CONFIG.active;
              return (
                <div key={van.van_stock_id} className="flex items-center gap-3 px-4 py-3 hover:bg-theme-surface-2 transition-colors flex-wrap">
                  {/* Status badge */}
                  <button
                    onClick={() => handleStatusToggle(van)}
                    title={`Click to ${van.van_status === 'active' ? 'set In Service' : 'set Active'}`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${cfg.badgeClass}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                    {cfg.label}
                  </button>

                  {/* Van info */}
                  <div className="flex-1 min-w-[120px]">
                    <div className="font-semibold text-theme text-sm">
                      {van.van_plate || van.van_code || 'No plate'}
                      {van.van_code && van.van_plate && (
                        <span className="text-theme-muted font-normal text-xs ml-1">({van.van_code})</span>
                      )}
                    </div>
                    <div className="text-xs text-theme-muted">
                      {van.technician_name} • {van.item_count} items
                      {van.temporary_tech_name && (
                        <span className="text-amber-600"> • Temp: {van.temporary_tech_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    {van.temporary_tech_id ? (
                      <button onClick={() => handleRemoveTemp(van)} title="Remove temp tech"
                        className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => { setAssignModal({ vanId: van.van_stock_id, vanLabel: van.van_plate || van.van_code || 'Van' }); setSelectedTechId(''); setAssignReason(''); }}
                        title="Assign temp tech"
                        className="p-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => { setEditModal(van); setEditPlate(van.van_plate || ''); setEditCode(van.van_code || ''); }}
                      title="Edit van details"
                      className="p-1.5 rounded-lg border border-theme text-theme-muted hover:bg-theme-surface-2 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleViewAudit(van)} title="View audit trail"
                      className="p-1.5 rounded-lg border border-theme text-theme-muted hover:bg-theme-surface-2 transition-colors">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {fleet.length === 0 && (
              <div className="px-4 py-8 text-center text-theme-muted text-sm">No active vans</div>
            )}
          </div>
        </div>
      )}

      {/* Assign Temp Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAssignModal(null)}>
          <div className="bg-theme-surface rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-theme mb-4">Assign Temp Tech → {assignModal.vanLabel}</h3>
            <select value={selectedTechId} onChange={e => setSelectedTechId(e.target.value)}
              className="w-full px-3 py-2.5 border border-theme rounded-lg bg-theme-surface text-theme text-sm mb-3 focus:ring-2 focus:ring-blue-500">
              <option value="">Select technician...</option>
              {technicians.map(t => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
            </select>
            <input placeholder="Reason (optional)" value={assignReason} onChange={e => setAssignReason(e.target.value)}
              className="w-full px-3 py-2.5 border border-theme rounded-lg bg-theme-surface text-theme text-sm mb-4 focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssignModal(null)}
                className="px-4 py-2 border border-theme rounded-lg text-sm text-theme-muted hover:bg-theme-surface-2">Cancel</button>
              <button onClick={handleAssign} disabled={!selectedTechId || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Van Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
          <div className="bg-theme-surface rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-theme mb-4">Edit Van Details</h3>
            <label className="block text-xs font-medium text-theme-muted mb-1">Plate Number</label>
            <input value={editPlate} onChange={e => setEditPlate(e.target.value)} placeholder="e.g., WKL 4521"
              className="w-full px-3 py-2.5 border border-theme rounded-lg bg-theme-surface text-theme text-sm mb-3 focus:ring-2 focus:ring-blue-500" />
            <label className="block text-xs font-medium text-theme-muted mb-1">Van Code / Name</label>
            <input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="e.g., Van A"
              className="w-full px-3 py-2.5 border border-theme rounded-lg bg-theme-surface text-theme text-sm mb-4 focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditModal(null)}
                className="px-4 py-2 border border-theme rounded-lg text-sm text-theme-muted hover:bg-theme-surface-2">Cancel</button>
              <button onClick={handleSaveIdentification} disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {auditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAuditModal(null)}>
          <div className="bg-theme-surface rounded-xl shadow-xl p-6 w-full max-w-md max-h-[70vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-theme mb-4">📋 Audit Trail — {auditModal.vanLabel}</h3>
            {auditLog.length === 0 ? (
              <div className="text-center text-theme-muted py-8 text-sm">No audit entries yet</div>
            ) : (
              <div className="divide-y divide-theme">
                {auditLog.map(entry => (
                  <div key={entry.id} className="py-3">
                    <div className="text-sm font-medium text-theme">
                      {AUDIT_LABELS[entry.action] || entry.action}
                    </div>
                    <div className="text-xs text-theme-muted mt-0.5">
                      by {entry.performed_by_name} • {formatDate(entry.created_at)}
                    </div>
                    {entry.target_tech_name && (
                      <div className="text-xs text-theme mt-1">Tech: {entry.target_tech_name}</div>
                    )}
                    {entry.reason && (
                      <div className="text-xs text-theme-muted mt-1 italic">"{entry.reason}"</div>
                    )}
                    {entry.old_value && entry.new_value && (
                      <div className="text-xs text-theme mt-1">{entry.old_value} → {entry.new_value}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setAuditModal(null)}
              className="mt-4 w-full py-2.5 border border-theme rounded-lg text-sm text-theme-muted hover:bg-theme-surface-2 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

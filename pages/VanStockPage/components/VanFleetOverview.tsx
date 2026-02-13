/**
 * VanFleetOverview — Admin/Supervisor collapsible panel showing all vans,
 * status, temp assignments, and pending access requests.
 */
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
import type { User, VanAccessRequest, VanAuditLogEntry, VanFleetItem, VanStatus } from '../../../types';
import { getUsers } from '../../../services/userService';

interface Props {
  currentUser: User;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<VanStatus, { label: string; color: string; bg: string; icon: string }> = {
  active: { label: 'Active', color: '#10B981', bg: '#10B98120', icon: '🟢' },
  in_service: { label: 'In Service', color: '#F59E0B', bg: '#F59E0B20', icon: '🔴' },
  decommissioned: { label: 'Decommissioned', color: '#6B7280', bg: '#6B728020', icon: '⚫' },
};

export default function VanFleetOverview({ currentUser, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [fleet, setFleet] = useState<VanFleetItem[]>([]);
  const [requests, setRequests] = useState<VanAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<User[]>([]);

  // Modal states
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
    const [fleetData, requestData] = await Promise.all([
      getVanFleetOverview(),
      getPendingVanRequests(),
    ]);
    setFleet(fleetData);
    setRequests(requestData);

    // Load technicians for assign modal
    const users = await getUsers();
    if (users) setTechnicians(users.filter((u: User) => u.role === 'technician'));

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleStatusToggle = async (van: VanFleetItem) => {
    const newStatus: VanStatus = van.van_status === 'active' ? 'in_service' : 'active';
    const ok = await updateVanStatus(van.van_stock_id, newStatus, { id: currentUser.user_id, name: currentUser.name });
    if (ok) {
      showToast.success(`Van ${van.van_plate || van.van_code || ''} set to ${STATUS_CONFIG[newStatus].label}`);
      loadData();
      onRefresh();
    } else {
      showToast.error('Failed to update van status');
    }
  };

  const handleRemoveTemp = async (van: VanFleetItem) => {
    const ok = await removeTempTech(van.van_stock_id, { id: currentUser.user_id, name: currentUser.name });
    if (ok) {
      showToast.success(`Removed ${van.temporary_tech_name} from ${van.van_plate || van.van_code || 'van'}`);
      loadData();
      onRefresh();
    }
  };

  const handleAssign = async () => {
    if (!assignModal || !selectedTechId) return;
    setSubmitting(true);
    const tech = technicians.find(t => t.user_id === selectedTechId);
    const ok = await assignTempTech(
      assignModal.vanId, selectedTechId, tech?.name || 'Unknown',
      { id: currentUser.user_id, name: currentUser.name }, assignReason
    );
    setSubmitting(false);
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
  };

  const handleReviewRequest = async (requestId: string, approved: boolean) => {
    const ok = await reviewVanAccessRequest(requestId, approved, { id: currentUser.user_id, name: currentUser.name });
    if (ok) {
      showToast.success(approved ? 'Request approved — tech assigned' : 'Request rejected');
      loadData();
      onRefresh();
    }
  };

  const handleViewAudit = async (van: VanFleetItem) => {
    const log = await getVanAuditLog(van.van_stock_id);
    setAuditLog(log);
    setAuditModal({ vanId: van.van_stock_id, vanLabel: van.van_plate || van.van_code || 'Van' });
  };

  const handleSaveIdentification = async () => {
    if (!editModal) return;
    setSubmitting(true);
    const ok = await updateVanIdentification(
      editModal.van_stock_id,
      { van_plate: editPlate || undefined, van_code: editCode || undefined },
      { id: currentUser.user_id, name: currentUser.name }
    );
    setSubmitting(false);
    if (ok) {
      showToast.success('Van details updated');
      setEditModal(null);
      loadData();
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('en-MY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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

  if (loading) return <div style={{ padding: 16, color: '#9CA3AF' }}>Loading fleet...</div>;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: '#1F2937', border: '1px solid #374151',
          borderRadius: expanded ? '8px 8px 0 0' : 8, cursor: 'pointer', color: '#F9FAFB',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          🚐 Fleet Overview
          {requests.length > 0 && (
            <span style={{ marginLeft: 8, background: '#EF4444', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 12 }}>
              {requests.length} pending
            </span>
          )}
        </span>
        <span style={{ fontSize: 18 }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div style={{ border: '1px solid #374151', borderTop: 'none', borderRadius: '0 0 8px 8px', background: '#111827' }}>
          {/* Pending requests */}
          {requests.length > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #374151', background: '#7C2D1220' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', marginBottom: 8 }}>⚠️ Pending Requests</div>
              {requests.map(req => (
                <div key={req.request_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: '#D1D5DB', flex: 1 }}>
                    <strong>{req.requester_name}</strong> → Van {fleet.find(v => v.van_stock_id === req.van_stock_id)?.van_plate || '?'}
                    {' — '}<em>"{req.reason}"</em>
                  </span>
                  <button onClick={() => handleReviewRequest(req.request_id, true)}
                    style={{ padding: '4px 12px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                    Approve
                  </button>
                  <button onClick={() => handleReviewRequest(req.request_id, false)}
                    style={{ padding: '4px 12px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                    Reject
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Van list */}
          <div style={{ padding: '8px 12px' }}>
            {fleet.map(van => {
              const cfg = STATUS_CONFIG[van.van_status] || STATUS_CONFIG.active;
              return (
                <div key={van.van_stock_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px',
                  borderBottom: '1px solid #1F2937', flexWrap: 'wrap',
                }}>
                  {/* Status + plate */}
                  <button
                    onClick={() => handleStatusToggle(van)}
                    title={`Click to ${van.van_status === 'active' ? 'set In Service' : 'set Active'}`}
                    style={{
                      padding: '3px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600,
                    }}
                  >
                    {cfg.icon} {cfg.label}
                  </button>

                  {/* Van info */}
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#F9FAFB' }}>
                      {van.van_plate || van.van_code || 'No plate'}
                      {van.van_code && van.van_plate && <span style={{ color: '#6B7280', fontWeight: 400 }}> ({van.van_code})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {van.technician_name} • {van.item_count} items
                      {van.temporary_tech_name && (
                        <span style={{ color: '#F59E0B' }}> • Temp: {van.temporary_tech_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {van.temporary_tech_id ? (
                      <button onClick={() => handleRemoveTemp(van)}
                        style={{ padding: '4px 8px', background: '#EF444420', color: '#EF4444', border: '1px solid #EF444440', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                        Remove Temp
                      </button>
                    ) : (
                      <button onClick={() => { setAssignModal({ vanId: van.van_stock_id, vanLabel: van.van_plate || van.van_code || 'Van' }); setSelectedTechId(''); setAssignReason(''); }}
                        style={{ padding: '4px 8px', background: '#3B82F620', color: '#3B82F6', border: '1px solid #3B82F640', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                        Assign Temp
                      </button>
                    )}
                    <button onClick={() => { setEditModal(van); setEditPlate(van.van_plate || ''); setEditCode(van.van_code || ''); }}
                      style={{ padding: '4px 8px', background: '#6B728020', color: '#9CA3AF', border: '1px solid #6B728040', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                      ✏️
                    </button>
                    <button onClick={() => handleViewAudit(van)}
                      style={{ padding: '4px 8px', background: '#6B728020', color: '#9CA3AF', border: '1px solid #6B728040', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                      📋
                    </button>
                  </div>
                </div>
              );
            })}
            {fleet.length === 0 && <div style={{ padding: 16, color: '#6B7280', textAlign: 'center' }}>No active vans</div>}
          </div>
        </div>
      )}

      {/* Assign Temp Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setAssignModal(null)}>
          <div style={{ background: '#1F2937', borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#F9FAFB', fontSize: 16 }}>Assign Temp Tech → {assignModal.vanLabel}</h3>
            <select value={selectedTechId} onChange={e => setSelectedTechId(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#F9FAFB', marginBottom: 12 }}>
              <option value="">Select technician...</option>
              {technicians.map(t => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
            </select>
            <input placeholder="Reason (optional)" value={assignReason} onChange={e => setAssignReason(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#F9FAFB', marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setAssignModal(null)}
                style={{ padding: '8px 16px', background: '#374151', color: '#D1D5DB', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAssign} disabled={!selectedTechId || submitting}
                style={{ padding: '8px 16px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: !selectedTechId || submitting ? 0.5 : 1 }}>
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Van Modal */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setEditModal(null)}>
          <div style={{ background: '#1F2937', borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#F9FAFB', fontSize: 16 }}>Edit Van Details</h3>
            <label style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>Plate Number</label>
            <input value={editPlate} onChange={e => setEditPlate(e.target.value)} placeholder="e.g., WKL 4521"
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#F9FAFB', marginBottom: 12, boxSizing: 'border-box' }} />
            <label style={{ display: 'block', fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>Van Code / Name</label>
            <input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="e.g., Van A"
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #374151', background: '#111827', color: '#F9FAFB', marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditModal(null)}
                style={{ padding: '8px 16px', background: '#374151', color: '#D1D5DB', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveIdentification} disabled={submitting}
                style={{ padding: '8px 16px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {auditModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setAuditModal(null)}>
          <div style={{ background: '#1F2937', borderRadius: 12, padding: 24, width: 400, maxWidth: '90vw', maxHeight: '70vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#F9FAFB', fontSize: 16 }}>📋 Audit Trail — {auditModal.vanLabel}</h3>
            {auditLog.length === 0 ? (
              <div style={{ color: '#6B7280', textAlign: 'center', padding: 24 }}>No audit entries yet</div>
            ) : (
              auditLog.map(entry => (
                <div key={entry.id} style={{ padding: '10px 0', borderBottom: '1px solid #374151' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F9FAFB' }}>
                    {AUDIT_LABELS[entry.action] || entry.action}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    by {entry.performed_by_name} • {formatDate(entry.created_at)}
                  </div>
                  {entry.target_tech_name && (
                    <div style={{ fontSize: 12, color: '#D1D5DB', marginTop: 2 }}>Tech: {entry.target_tech_name}</div>
                  )}
                  {entry.reason && (
                    <div style={{ fontSize: 12, color: '#D1D5DB', marginTop: 2, fontStyle: 'italic' }}>"{entry.reason}"</div>
                  )}
                  {entry.old_value && entry.new_value && (
                    <div style={{ fontSize: 12, color: '#D1D5DB', marginTop: 2 }}>{entry.old_value} → {entry.new_value}</div>
                  )}
                </div>
              ))
            )}
            <button onClick={() => setAuditModal(null)}
              style={{ marginTop: 16, width: '100%', padding: '10px', background: '#374151', color: '#D1D5DB', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

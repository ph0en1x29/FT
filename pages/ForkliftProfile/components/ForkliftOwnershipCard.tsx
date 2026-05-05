/**
 * ForkliftOwnershipCard — surfaces ownership provenance + audit trail for
 * customer-owned forklifts (BYO or sold-from-fleet).
 *
 * Renders only when forklift.ownership === 'customer'. For Acwer-owned
 * fleet rows, the existing CurrentAssignmentCard already conveys "this is
 * our rental fleet" context via the rental panel.
 *
 * Shows:
 *   - "Sold from Acwer fleet" or "Customer-owned (BYO)" header tag
 *   - For sold-from-fleet: sale date + sale price (when populated)
 *   - Owner customer name + clickable link to customer profile
 *   - Recent forklift_history events (collapsible, last 5)
 */
import { ArrowRightLeft, Building2, ChevronDown, ChevronUp, ExternalLink, History, MoreVertical, Pencil, ShieldCheck, Undo2, UserCheck } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomerById } from '../../../services/customerService';
import { getForkliftHistory } from '../../../services/forkliftService';
import type { Customer, Forklift, ForkliftHistoryEvent, User } from '../../../types';
import { EditOwnershipDetailsModal } from './EditOwnershipDetailsModal';
import { ReverseSaleModal } from './ReverseSaleModal';
import { TransferOwnershipModal } from './TransferOwnershipModal';

interface Props {
  forklift: Forklift;
  /** Admin-only menu (edit / reverse / transfer) renders only when both
   *  `isAdmin` and `currentUser` are provided. */
  isAdmin?: boolean;
  currentUser?: User;
  /** Called after a successful admin correction so the parent page reloads. */
  onAdminAction?: () => void;
}

const formatDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : '—');
const formatDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const EVENT_LABEL: Record<ForkliftHistoryEvent['event_type'], string> = {
  sold_to_customer: 'Sold to customer',
  registered_byo: 'Registered (BYO)',
  transferred: 'Transferred',
  contract_started: 'Contract started',
  contract_ended: 'Contract ended',
  service_status_changed: 'Service status changed',
  note: 'Note',
  sale_reversed: 'Sale reversed',
  ownership_edited: 'Details corrected',
};

const ForkliftOwnershipCard: React.FC<Props> = ({ forklift, isAdmin = false, currentUser, onAdminAction }) => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ForkliftHistoryEvent[]>([]);
  const [owner, setOwner] = useState<Customer | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'edit' | 'reverse' | 'transfer' | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Load history + owner customer in parallel. Bail out early if not customer-owned.
  useEffect(() => {
    if (forklift.ownership !== 'customer') return;
    let cancelled = false;
    Promise.all([
      getForkliftHistory(forklift.forklift_id),
      forklift.current_customer_id
        ? getCustomerById(forklift.current_customer_id).catch(() => null)
        : Promise.resolve(null),
    ]).then(([h, c]) => {
      if (cancelled) return;
      setHistory(h);
      setOwner(c);
    });
    return () => { cancelled = true; };
  }, [forklift.forklift_id, forklift.ownership, forklift.current_customer_id]);

  // Close kebab on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  if (forklift.ownership !== 'customer') return null;

  const isSoldFromFleet = forklift.acquisition_source === 'sold_from_fleet';
  const isByo = forklift.acquisition_source === 'new_byo' || !forklift.acquisition_source;
  const visibleHistory = historyOpen ? history : history.slice(0, 3);
  const showAdminMenu = isAdmin && !!currentUser;

  const handleSuccess = () => {
    setActiveModal(null);
    onAdminAction?.();
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-indigo-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2">
          {isSoldFromFleet
            ? <UserCheck className="w-5 h-5 text-indigo-600 mt-0.5" />
            : <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />}
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 flex-wrap">
              Ownership
              {isSoldFromFleet && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  Sold from Acwer fleet
                </span>
              )}
              {isByo && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  Customer-owned (BYO)
                </span>
              )}
              {forklift.service_management_status === 'dormant' && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600">
                  Dormant
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {isSoldFromFleet
                ? 'Originally an Acwer fleet asset; now serviced under contract or chargeable basis.'
                : 'Customer brought their own machine; serviced under contract or chargeable basis.'}
            </p>
          </div>
        </div>

        {showAdminMenu && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
              aria-label="Admin actions"
              title="Admin corrections"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--surface)] rounded-lg shadow-lg border border-slate-200 py-1 z-30">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setActiveModal('edit'); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4 text-slate-500" />
                  Edit ownership details
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setActiveModal('transfer'); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <ArrowRightLeft className="w-4 h-4 text-slate-500" />
                  Transfer to new owner
                </button>
                {isSoldFromFleet && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); setActiveModal('reverse'); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-amber-50 text-amber-700 flex items-center gap-2"
                    >
                      <Undo2 className="w-4 h-4" />
                      Reverse sale to fleet
                    </button>
                  </>
                )}
                {!isSoldFromFleet && (
                  <div className="px-4 py-2 text-xs text-slate-400 italic">
                    Reverse-sale only for sold-from-fleet records
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Owner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">Owner</div>
          {owner ? (
            <button
              onClick={() => navigate(`/customers/${owner.customer_id}`)}
              className="font-semibold text-slate-800 hover:text-indigo-700 inline-flex items-center gap-1.5 text-sm group"
            >
              <Building2 className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
              {owner.name}
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
            </button>
          ) : (
            <span className="text-sm text-slate-400">{forklift.current_customer_id ? 'Loading…' : 'Unassigned'}</span>
          )}
          {owner?.address && (
            <div className="text-xs text-slate-500 mt-0.5">{owner.address}</div>
          )}
        </div>

        {isSoldFromFleet && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">Sale</div>
            <div className="text-sm text-slate-800">
              {forklift.sold_to_customer_at
                ? formatDate(forklift.sold_to_customer_at)
                : <span className="text-slate-400">Date not recorded</span>}
              {forklift.sold_price != null && (
                <span className="text-slate-500"> · RM {Number(forklift.sold_price).toLocaleString()}</span>
              )}
            </div>
            {forklift.original_fleet_forklift_id && forklift.original_fleet_forklift_id === forklift.forklift_id && (
              <div className="text-xs text-slate-400 mt-0.5">
                Same DB row preserved — service history and hourmeter trace intact.
              </div>
            )}
          </div>
        )}

        {forklift.customer_forklift_no && (
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">Customer's asset no.</div>
            <div className="text-sm font-medium text-slate-800">{forklift.customer_forklift_no}</div>
            <div className="text-xs text-slate-400 mt-0.5">Acwer serial: {forklift.serial_number}</div>
          </div>
        )}
      </div>

      {/* Admin correction modals */}
      {showAdminMenu && activeModal === 'edit' && (
        <EditOwnershipDetailsModal
          forklift={forklift}
          currentUser={currentUser!}
          onClose={() => setActiveModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {showAdminMenu && activeModal === 'reverse' && isSoldFromFleet && (
        <ReverseSaleModal
          forklift={forklift}
          currentUser={currentUser!}
          onClose={() => setActiveModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {showAdminMenu && activeModal === 'transfer' && (
        <TransferOwnershipModal
          forklift={forklift}
          currentUser={currentUser!}
          onClose={() => setActiveModal(null)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Audit trail */}
      {history.length > 0 && (
        <div className="border-t border-slate-200 pt-3">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="w-full flex items-center justify-between text-sm text-slate-600 hover:text-slate-800"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <History className="w-4 h-4" />
              Lifecycle history ({history.length})
            </span>
            {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <ul className="mt-2 space-y-1.5">
            {visibleHistory.map(ev => (
              <li
                key={ev.history_id}
                className="text-xs flex items-start gap-2 px-2 py-1.5 rounded bg-slate-50"
              >
                <span className="text-slate-400 shrink-0 font-mono">{formatDateTime(ev.created_at)}</span>
                <span className="font-medium text-slate-700 shrink-0">{EVENT_LABEL[ev.event_type] || ev.event_type}</span>
                {ev.event_data && (
                  <span className="text-slate-500 truncate">
                    {summarizeEventData(ev.event_type, ev.event_data)}
                  </span>
                )}
                {ev.actor_name && (
                  <span className="ml-auto text-slate-400 italic shrink-0">— {ev.actor_name}</span>
                )}
              </li>
            ))}
          </ul>
          {!historyOpen && history.length > 3 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="text-xs text-indigo-600 hover:text-indigo-700 mt-1.5 font-medium"
            >
              Show {history.length - 3} more event{history.length - 3 === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const summarizeEventData = (type: ForkliftHistoryEvent['event_type'], data: Record<string, unknown>): string => {
  if (type === 'sold_to_customer') {
    const parts: string[] = [];
    if (data.sale_price != null) parts.push(`RM ${Number(data.sale_price).toLocaleString()}`);
    if (data.reason) parts.push(String(data.reason));
    return parts.join(' · ') || '';
  }
  if (type === 'service_status_changed') {
    const from = data.from ?? '?';
    const to = data.to ?? '?';
    const reason = data.reason ? ` (${String(data.reason)})` : '';
    return `${from} → ${to}${reason}`;
  }
  if (type === 'sale_reversed') {
    const parts: string[] = [];
    if (data.previous_sale_price != null) {
      parts.push(`was RM ${Number(data.previous_sale_price).toLocaleString()}`);
    }
    if (data.reason) parts.push(String(data.reason));
    return parts.join(' · ') || '';
  }
  if (type === 'ownership_edited') {
    const changes = (data.changes && typeof data.changes === 'object')
      ? Object.keys(data.changes as Record<string, unknown>)
      : [];
    const fieldLabel: Record<string, string> = {
      sold_to_customer_at: 'sale date',
      sold_price: 'sale price',
      customer_forklift_no: 'asset no.',
    };
    const fields = changes.map(k => fieldLabel[k] || k).join(', ');
    const reason = data.reason ? ` — ${String(data.reason)}` : '';
    return fields ? `${fields}${reason}` : (data.reason ? String(data.reason) : '');
  }
  if (type === 'transferred') {
    const orphans = Number(data.orphaned_active_contracts ?? 0) + Number(data.orphaned_active_schedules ?? 0);
    const reason = data.reason ? String(data.reason) : '';
    if (orphans > 0) {
      return `${reason ? `${reason} · ` : ''}${orphans} obligation${orphans === 1 ? '' : 's'} need manual reassignment`;
    }
    return reason;
  }
  return '';
};

export default ForkliftOwnershipCard;

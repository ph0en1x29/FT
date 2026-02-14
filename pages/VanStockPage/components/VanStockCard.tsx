/**
 * Van Stock Card — Clean design with essential info visible
 * Shows: van identity, technician, item count, value, capacity, last audit, alerts
 * Admin/Supervisor get status dropdown + schedule audit quick action
 * Supports multi-select mode
 */
import { AlertTriangle, Calendar, Check, ChevronDown, Clock, Package } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { updateVanStatus } from '../../../services/inventoryService';
import { showToast } from '../../../services/toastService';
import { VanStatus, VanStock, VanStockReplenishment } from '../../../types';
import { getLowStockItems } from '../hooks/useVanStockData';

const STATUS_OPTIONS: { value: VanStatus; label: string; dot: string }[] = [
  { value: 'active', label: 'Active', dot: 'bg-emerald-500' },
  { value: 'in_service', label: 'In Service', dot: 'bg-red-500' },
  { value: 'decommissioned', label: 'Retired', dot: 'bg-gray-400' },
];

const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, o])) as Record<VanStatus, typeof STATUS_OPTIONS[0]>;

interface VanStockCardProps {
  vanStock: VanStock;
  pendingRequest?: VanStockReplenishment;
  onViewDetails: (vanStock: VanStock) => void;
  onScheduleAudit: (vanStock: VanStock) => void;
  userRole?: string;
  currentUserId?: string;
  currentUserName?: string;
  onStatusChange?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (vanStockId: string) => void;
}

export function VanStockCard({
  vanStock,
  pendingRequest,
  onViewDetails,
  onScheduleAudit,
  userRole,
  currentUserId,
  currentUserName,
  onStatusChange,
  selectable = false,
  selected = false,
  onToggleSelect,
}: VanStockCardProps) {
  const lowItems = getLowStockItems(vanStock.items);
  const vanIdentifier = vanStock.van_plate || vanStock.van_code || 'No Plate';
  const canChangeStatus = userRole === 'admin' || userRole === 'admin_service' || userRole === 'admin_store' || userRole === 'supervisor';
  const isAdmin = canChangeStatus;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const badgeRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen || !badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.right - 140,
    });
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        badgeRef.current && !badgeRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleStatusChange = async (newStatus: VanStatus) => {
    if (newStatus === vanStock.van_status || !currentUserId) return;
    setUpdating(true);
    setDropdownOpen(false);
    try {
      const ok = await updateVanStatus(vanStock.van_stock_id, newStatus, { id: currentUserId, name: currentUserName || 'Admin' });
      if (ok) {
        showToast.success(`${vanIdentifier} → ${STATUS_MAP[newStatus].label}`);
        onStatusChange?.();
      } else {
        showToast.error('Failed to update status');
      }
    } catch {
      showToast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleCardClick = () => {
    if (selectable) {
      onToggleSelect?.(vanStock.van_stock_id);
    } else {
      onViewDetails(vanStock);
    }
  };

  const status = STATUS_MAP[vanStock.van_status] || STATUS_MAP.active;
  const itemCount = vanStock.items?.length || 0;
  const maxItems = vanStock.max_items || 50;
  const capacityPct = Math.round((itemCount / maxItems) * 100);
  const lastAudit = vanStock.last_audit_at
    ? new Date(vanStock.last_audit_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className={`card-theme rounded-xl theme-transition hover:shadow-lg cursor-pointer group relative ${
        selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      onClick={handleCardClick}
    >
      <div className="p-4">
        {/* Row 1: Checkbox (if selectable) + Van identity + status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Checkbox for multi-select */}
            {selectable && (
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'
              }`}>
                {selected && <Check className="w-3 h-3 text-white" />}
              </div>
            )}
            {/* Initials avatar */}
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 font-bold text-sm">
                {vanStock.technician_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'T'}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-theme text-base truncate">{vanIdentifier}</h3>
                {vanStock.van_code && vanStock.van_plate && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">{vanStock.van_code}</span>
                )}
              </div>
              <p className="text-xs text-theme-muted truncate">{vanStock.technician_name || 'Unassigned'}</p>
            </div>
          </div>

          {/* Status badge */}
          {canChangeStatus ? (
            <button
              ref={badgeRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
              disabled={updating}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors flex-shrink-0 ${
                vanStock.van_status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : vanStock.van_status === 'in_service'
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              } ${updating ? 'opacity-50' : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
              <ChevronDown className="w-3 h-3" />
            </button>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
                vanStock.van_status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : vanStock.van_status === 'in_service'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          )}

          {/* Dropdown portal */}
          {dropdownOpen && createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[9999] bg-theme-surface shadow-xl rounded-lg border border-theme py-1 min-w-[140px]"
              style={{ top: dropdownPos.top, left: dropdownPos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStatusChange(option.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-theme-surface-2 transition-colors ${
                    option.value === vanStock.van_status ? 'bg-theme-surface-2' : ''
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${option.dot}`} />
                  <span className="text-theme flex-1 text-left font-medium">{option.label}</span>
                  {option.value === vanStock.van_status && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>

        {/* Row 2: Key stats — items, value, capacity */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-sm">
            <Package className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-theme">{itemCount}</span>
            <span className="text-theme-muted">/ {maxItems} items</span>
          </div>
          <div className="w-px h-3.5 bg-gray-200" />
          <span className="text-sm font-semibold text-green-600">RM {(vanStock.total_value || 0).toLocaleString()}</span>
        </div>

        {/* Row 3: Capacity bar */}
        <div className="mb-3">
          <div className="w-full h-1.5 bg-theme-surface-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                capacityPct > 90 ? 'bg-red-400' : capacityPct > 70 ? 'bg-amber-400' : 'bg-blue-400'
              }`}
              style={{ width: `${Math.min(capacityPct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-theme-muted">{capacityPct}% capacity</span>
            {lastAudit && (
              <span className="text-xs text-theme-muted">Audited {lastAudit}</span>
            )}
            {!lastAudit && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">⚠ No audit</span>
            )}
          </div>
        </div>

        {/* Row 4: Alerts + Quick Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-theme">
          {/* Left: alerts */}
          <div className="flex items-center gap-2 flex-wrap">
            {lowItems.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-md border border-amber-100 font-medium">
                <AlertTriangle className="w-3 h-3" />
                {lowItems.length} low stock
              </span>
            )}
            {pendingRequest && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-md border border-orange-100 font-medium">
                <Clock className="w-3 h-3" />
                Request pending
              </span>
            )}
          </div>

          {/* Right: quick actions */}
          {isAdmin && !selectable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onScheduleAudit(vanStock);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm text-theme-muted hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Schedule Audit"
            >
              <Calendar className="w-3 h-3" />
              Audit
            </button>
          )}
        </div>
      </div>

      {/* Hover indicator */}
      <div className="h-0.5 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
    </div>
  );
}

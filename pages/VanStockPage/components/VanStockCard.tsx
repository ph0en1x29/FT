/**
 * Van Stock Card — Clean, minimal design
 * Shows: van identity, technician, item count, status, alerts
 * Admin/Supervisor get status dropdown
 */
import { AlertTriangle, Check, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
}: VanStockCardProps) {
  const lowItems = getLowStockItems(vanStock.items);
  const vanIdentifier = vanStock.van_plate || vanStock.van_code || 'No Plate';
  const canChangeStatus = userRole === 'admin' || userRole === 'admin_service' || userRole === 'admin_store' || userRole === 'supervisor';

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  const status = STATUS_MAP[vanStock.van_status] || STATUS_MAP.active;
  const hasAlerts = lowItems.length > 0 || !!pendingRequest;

  return (
    <div
      className="card-theme rounded-xl overflow-hidden theme-transition hover:shadow-lg cursor-pointer group"
      onClick={() => onViewDetails(vanStock)}
    >
      <div className="p-4">
        {/* Row 1: Van identity + status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Initials avatar */}
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 font-semibold text-sm">
                {vanStock.technician_name?.charAt(0) || 'T'}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-theme text-sm truncate">{vanIdentifier}</h3>
                {vanStock.van_code && vanStock.van_plate && (
                  <span className="text-xs text-blue-600 font-medium">{vanStock.van_code}</span>
                )}
              </div>
              <p className="text-xs text-theme-muted truncate">{vanStock.technician_name || 'Unassigned'}</p>
            </div>
          </div>

          {/* Status badge */}
          <div className="relative flex-shrink-0" ref={dropdownRef}>
            {canChangeStatus ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}
                disabled={updating}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-theme-muted hover:bg-theme-surface-2 transition-colors ${updating ? 'opacity-50' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
                <ChevronDown className="w-3 h-3" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-theme-muted" onClick={(e) => e.stopPropagation()}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            )}

            {dropdownOpen && (
              <div
                className="absolute top-full right-0 mt-1 z-50 bg-theme-surface shadow-lg rounded-lg border border-theme py-1 min-w-[130px]"
                onClick={(e) => e.stopPropagation()}
              >
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleStatusChange(option.value)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-theme-surface-2 transition-colors ${
                      option.value === vanStock.van_status ? 'bg-theme-surface-2' : ''
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${option.dot}`} />
                    <span className="text-theme flex-1 text-left">{option.label}</span>
                    {option.value === vanStock.van_status && <Check className="w-3 h-3 text-emerald-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Quick stats */}
        <div className="flex items-center gap-4 text-xs text-theme-muted mb-3">
          <span><span className="font-semibold text-theme">{vanStock.items?.length || 0}</span> items</span>
          <span className="text-green-600 font-semibold">RM {(vanStock.total_value || 0).toLocaleString()}</span>
        </div>

        {/* Row 3: Alerts (only if present) */}
        {hasAlerts && (
          <div className="flex items-center gap-2 flex-wrap">
            {lowItems.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-md border border-amber-100">
                <AlertTriangle className="w-3 h-3" />
                {lowItems.length} low stock
              </span>
            )}
            {pendingRequest && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-md border border-orange-100">
                <Clock className="w-3 h-3" />
                Request pending
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover indicator */}
      <div className="h-0.5 bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
    </div>
  );
}

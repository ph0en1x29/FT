/**
 * Individual van stock card component
 * Admin/Supervisor can change van status via dropdown on the badge
 */
import { AlertTriangle, Calendar, Check, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { updateVanStatus } from '../../../services/inventoryService';
import { showToast } from '../../../services/toastService';
import { VanStatus, VanStock, VanStockReplenishment } from '../../../types';
import { getLowStockItems } from '../hooks/useVanStockData';

const STATUS_OPTIONS: { value: VanStatus; label: string; dotClass: string; badgeClass: string }[] = [
  { value: 'active', label: 'Active', dotClass: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  { value: 'in_service', label: 'In Service', dotClass: 'bg-red-500', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
  { value: 'decommissioned', label: 'Retired', dotClass: 'bg-gray-400', badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
];

const STATUS_MAP: Record<VanStatus, typeof STATUS_OPTIONS[0]> = Object.fromEntries(
  STATUS_OPTIONS.map(o => [o.value, o])
) as Record<VanStatus, typeof STATUS_OPTIONS[0]>;

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

  // Close dropdown on outside click
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
      const ok = await updateVanStatus(
        vanStock.van_stock_id,
        newStatus,
        { id: currentUserId, name: currentUserName || 'Admin' }
      );
      if (ok) {
        showToast.success(`Van ${vanIdentifier} → ${STATUS_MAP[newStatus].label}`);
        onStatusChange?.();
      } else {
        showToast.error('Failed to update van status');
      }
    } catch {
      showToast.error('Failed to update van status');
    } finally {
      setUpdating(false);
    }
  };

  const cfg = STATUS_MAP[vanStock.van_status] || STATUS_MAP.active;

  return (
    <div
      className="card-theme rounded-xl overflow-hidden theme-transition hover:shadow-lg cursor-pointer"
      onClick={() => onViewDetails(vanStock)}
    >
      {/* Header */}
      <div className="p-4 border-b border-theme">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                {vanStock.technician_name?.charAt(0) || 'T'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-theme">{vanIdentifier}</h3>
                {/* Status badge — clickable dropdown for admin/supervisor */}
                <div className="relative" ref={dropdownRef}>
                  {canChangeStatus ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(!dropdownOpen);
                      }}
                      disabled={updating}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold leading-none cursor-pointer hover:opacity-80 transition-opacity ${cfg.badgeClass} ${updating ? 'opacity-50' : ''}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                      {cfg.label}
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </button>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold leading-none cursor-default select-none ${cfg.badgeClass}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                      {cfg.label}
                    </span>
                  )}

                  {/* Dropdown */}
                  {dropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleStatusChange(option.value)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            option.value === vanStock.van_status ? 'bg-gray-50 dark:bg-gray-700/50' : ''
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${option.dotClass}`} />
                          <span className="text-theme flex-1 text-left">{option.label}</span>
                          {option.value === vanStock.van_status && (
                            <Check className="w-3 h-3 text-emerald-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-theme-muted">{vanStock.technician_name || 'Unknown'}</span>
                {vanStock.van_code && vanStock.van_plate && (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                    {vanStock.van_code}
                  </span>
                )}
                <span className="text-xs text-theme-muted">{vanStock.items?.length || 0} items</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-theme-muted" />
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-theme-surface-2 rounded-lg">
            <div className="text-lg font-bold text-theme">{vanStock.items?.length || 0}</div>
            <div className="text-xs text-theme-muted">Total Items</div>
          </div>
          <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              RM {(vanStock.total_value || 0).toLocaleString()}
            </div>
            <div className="text-xs text-green-700 dark:text-green-500">Value</div>
          </div>
        </div>

        {/* Indicators */}
        <div className="flex flex-wrap gap-2">
          {lowItems.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {lowItems.length} Low Stock
            </span>
          )}
          {pendingRequest && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full">
              <Clock className="w-3 h-3" />
              Request Pending
            </span>
          )}
          {vanStock.last_audit_at && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs rounded-full">
              <Calendar className="w-3 h-3" />
              Audited {new Date(vanStock.last_audit_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onScheduleAudit(vanStock);
          }}
          className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          Schedule Audit
        </button>
      </div>
    </div>
  );
}

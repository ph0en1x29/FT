/**
 * Individual van stock card component
 */
import { AlertTriangle,Calendar,ChevronRight,Clock } from 'lucide-react';
import { VanStatus, VanStock,VanStockReplenishment } from '../../../types';
import { getLowStockItems } from '../hooks/useVanStockData';

const STATUS_CONFIG: Record<VanStatus, { label: string; dotClass: string; badgeClass: string }> = {
  active: { label: 'Active', dotClass: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-semibold' },
  in_service: { label: 'In Service', dotClass: 'bg-red-500', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800 font-semibold' },
  decommissioned: { label: 'Retired', dotClass: 'bg-gray-400', badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700 font-semibold' },
};

interface VanStockCardProps {
  vanStock: VanStock;
  pendingRequest?: VanStockReplenishment;
  onViewDetails: (vanStock: VanStock) => void;
  onScheduleAudit: (vanStock: VanStock) => void;
}

export function VanStockCard({
  vanStock,
  pendingRequest,
  onViewDetails,
  onScheduleAudit,
}: VanStockCardProps) {
  const lowItems = getLowStockItems(vanStock.items);
  const vanIdentifier = vanStock.van_plate || vanStock.van_code || 'No Plate';

  return (
    <div
      className="card-theme rounded-xl overflow-hidden theme-transition hover:shadow-lg cursor-pointer"
      onClick={() => onViewDetails(vanStock)}
    >
      {/* Header */}
      <div className="p-4 border-b border-theme">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold">
                {vanStock.technician_name?.charAt(0) || 'T'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-theme">{vanIdentifier}</h3>
                {(() => {
                  const cfg = STATUS_CONFIG[vanStock.van_status] || STATUS_CONFIG.active;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs leading-none cursor-default select-none ${cfg.badgeClass}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-theme-muted">{vanStock.technician_name || 'Unknown'}</span>
                {vanStock.van_code && vanStock.van_plate && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
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
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              RM {(vanStock.total_value || 0).toLocaleString()}
            </div>
            <div className="text-xs text-green-700">Value</div>
          </div>
        </div>

        {/* Indicators */}
        <div className="flex flex-wrap gap-2">
          {lowItems.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {lowItems.length} Low Stock
            </span>
          )}
          {pendingRequest && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
              <Clock className="w-3 h-3" />
              Request Pending
            </span>
          )}
          {vanStock.last_audit_at && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
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
          className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Schedule Audit
        </button>
      </div>
    </div>
  );
}

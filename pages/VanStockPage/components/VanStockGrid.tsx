/**
 * Grid component for displaying van stock cards
 * Supports multi-select mode with bulk action toolbar
 */
import { Calendar, CheckSquare, Square, Truck, X } from 'lucide-react';
import { useState } from 'react';
import type { User } from '../../../types';
import { VanStock, VanStockReplenishment } from '../../../types';
import { VanStockCard } from './VanStockCard';

interface VanStockGridProps {
  vanStocks: VanStock[];
  replenishments: VanStockReplenishment[];
  hasFilters: boolean;
  onViewDetails: (vanStock: VanStock) => void;
  onScheduleAudit: (vanStock: VanStock) => void;
  currentUser?: User;
  onStatusChange?: () => void;
  useNewDesign?: boolean;
}

const ADMIN_ROLES: string[] = ['admin', 'admin_service', 'admin_store', 'supervisor'];

export function VanStockGrid({
  vanStocks,
  replenishments,
  hasFilters,
  onViewDetails,
  onScheduleAudit,
  currentUser,
  onStatusChange,
}: VanStockGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const isAdmin = currentUser?.role ? ADMIN_ROLES.includes(currentUser.role) : false;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(vanStocks.map(vs => vs.van_stock_id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleBulkAudit = () => {
    const selected = vanStocks.filter(vs => selectedIds.has(vs.van_stock_id));
    selected.forEach(vs => onScheduleAudit(vs));
    clearSelection();
  };

  if (vanStocks.length === 0) {
    return (
      <div className="card-theme rounded-xl p-12 text-center theme-transition">
        <Truck className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-theme mb-2">No Van Stocks Found</h3>
        <p className="text-sm text-theme-muted">
          {hasFilters
            ? 'Try adjusting your search or filters'
            : 'No technicians have Van Stock assigned yet'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Multi-select toolbar */}
      {isAdmin && (
        <div className="flex items-center justify-between mb-3">
          {!selectMode ? (
            <button
              onClick={() => setSelectMode(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-theme-muted hover:text-theme hover:bg-theme-surface-2 rounded-lg transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Select
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={clearSelection}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-theme-muted hover:text-theme hover:bg-theme-surface-2 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={selectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-theme-muted hover:text-theme hover:bg-theme-surface-2 rounded-lg transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Select All
              </button>
              {selectedIds.size > 0 && (
                <span className="text-xs text-blue-600 font-medium">{selectedIds.size} selected</span>
              )}
            </div>
          )}

          {/* Bulk actions */}
          {selectMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkAudit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                Schedule Audit ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vanStocks.map((vs) => {
          const pendingRequest = replenishments.find(r => r.technician_id === vs.technician_id);
          return (
            <div key={vs.van_stock_id}>
              <VanStockCard
                vanStock={vs}
                pendingRequest={pendingRequest}
                onViewDetails={onViewDetails}
                onScheduleAudit={onScheduleAudit}
                userRole={currentUser?.role}
                currentUserId={currentUser?.user_id}
                currentUserName={currentUser?.name}
                onStatusChange={onStatusChange}
                selectable={selectMode}
                selected={selectedIds.has(vs.van_stock_id)}
                onToggleSelect={toggleSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

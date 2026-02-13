/**
 * Grid component for displaying van stock cards
 */
import { Truck } from 'lucide-react';
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
}

export function VanStockGrid({
  vanStocks,
  replenishments,
  hasFilters,
  onViewDetails,
  onScheduleAudit,
  currentUser,
  onStatusChange,
}: VanStockGridProps) {
  // Empty state
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
            />
          </div>
        );
      })}
    </div>
  );
}

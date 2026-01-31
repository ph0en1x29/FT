/**
 * Header component for VanStockPage
 */
import React from 'react';
import { User, UserRole, VanStock } from '../../../types';
import { Truck, RefreshCw, UserPlus } from 'lucide-react';

interface VanStockHeaderProps {
  currentUser: User;
  vanStocks: VanStock[];
  filteredCount: number;
  totalCount: number;
  isAdmin: boolean;
  onRefresh: () => void;
  onAssign: () => void;
}

export function VanStockHeader({
  currentUser,
  vanStocks,
  filteredCount,
  totalCount,
  isAdmin,
  onRefresh,
  onAssign,
}: VanStockHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-theme flex items-center gap-2">
          <Truck className="w-7 h-7" />
          {currentUser.role === UserRole.TECHNICIAN ? 'My Van Stock' : 'Van Stock Management'}
        </h1>
        <p className="text-sm text-theme-muted mt-1">
          {currentUser.role === UserRole.TECHNICIAN
            ? (vanStocks.length > 0 ? `${vanStocks[0]?.van_code || 'Your van stock'}` : 'No van stock assigned')
            : `${filteredCount} of ${totalCount} technicians`}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        {isAdmin && (
          <button
            onClick={onAssign}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" /> Assign Van Stock
          </button>
        )}
      </div>
    </div>
  );
}

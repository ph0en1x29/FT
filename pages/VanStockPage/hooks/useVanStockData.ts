/**
 * Custom hook for VanStock data management
 * Uses React Query for background refetches — no UI blanking after mutations.
 */
import { useMemo,useState } from 'react';
import { useAllVanStocks,useReplenishmentsPending } from '../../../hooks/useQueryHooks';
import { User,UserRole,VanStockItem } from '../../../types';
import { FilterType,VanStockStats } from '../types';

interface UseVanStockDataProps {
  currentUser: User;
}

export function useVanStockData({ currentUser }: UseVanStockDataProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const isTechnician = currentUser.role === UserRole.TECHNICIAN;

  const { data: allVanStocks = [], isLoading: loadingStocks, refetch: refetchStocks } = useAllVanStocks();
  const { data: replenishments = [], isLoading: loadingReplenishments, refetch: refetchReplenishments } = useReplenishmentsPending();

  // Only show loading spinner on initial fetch (isLoading), not background refetches (isFetching)
  const loading = loadingStocks || loadingReplenishments;

  // Technicians can only see their own van stock
  const vanStocks = useMemo(
    () => isTechnician
      ? allVanStocks.filter(vs => vs.technician_id === currentUser.user_id)
      : allVanStocks,
    [allVanStocks, isTechnician, currentUser.user_id]
  );

  // Explicit refresh for pull-to-refresh / manual refresh buttons
  const loadData = () => {
    refetchStocks();
    refetchReplenishments();
  };

  // Calculate stats
  const stats: VanStockStats = useMemo(() => {
    const totalTechnicians = vanStocks.length;
    const totalItems = vanStocks.reduce((sum, vs) => sum + (vs.items?.length || 0), 0);
    const totalValue = vanStocks.reduce((sum, vs) => sum + (vs.total_value || 0), 0);
    const lowStockCount = vanStocks.reduce((sum, vs) => {
      const lowItems = vs.items?.filter(item => item.quantity <= item.min_quantity) || [];
      return sum + lowItems.length;
    }, 0);
    const pendingAudits = vanStocks.filter(vs => {
      if (!vs.next_audit_due) return false;
      return new Date(vs.next_audit_due) <= new Date();
    }).length;
    const pendingReplenishments = replenishments.length;
    const activeVans = vanStocks.filter(vs => vs.van_status === 'active').length;
    const inServiceVans = vanStocks.filter(vs => vs.van_status === 'in_service').length;
    const decommissionedVans = vanStocks.filter(vs => vs.van_status === 'decommissioned').length;

    return {
      totalTechnicians,
      totalItems,
      totalValue,
      lowStockCount,
      pendingAudits,
      pendingReplenishments,
      activeVans,
      inServiceVans,
      decommissionedVans,
    };
  }, [vanStocks, replenishments]);

  // Filter and search
  const filteredVanStocks = useMemo(() => {
    let result = vanStocks;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(vs =>
        vs.technician_name?.toLowerCase().includes(query) ||
        vs.technician?.email?.toLowerCase().includes(query) ||
        vs.van_code?.toLowerCase().includes(query) ||
        vs.van_plate?.toLowerCase().includes(query)
      );
    }

    if (filterType === 'low_stock') {
      result = result.filter(vs => {
        const lowItems = vs.items?.filter(item => item.quantity <= item.min_quantity) || [];
        return lowItems.length > 0;
      });
    } else if (filterType === 'pending_audit') {
      result = result.filter(vs => {
        if (!vs.next_audit_due) return true;
        return new Date(vs.next_audit_due) <= new Date();
      });
    } else if (filterType === 'pending_replenishment') {
      const techsWithPending = new Set(replenishments.map(r => r.technician_id));
      result = result.filter(vs => techsWithPending.has(vs.technician_id));
    }

    return result;
  }, [vanStocks, searchQuery, filterType, replenishments]);

  return {
    vanStocks,
    replenishments,
    loading,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    stats,
    filteredVanStocks,
    loadData,
    isTechnician,
  };
}

/**
 * Helper function to get low stock items
 */
export function getLowStockItems(items: VanStockItem[] | undefined): VanStockItem[] {
  if (!items) return [];
  return items.filter(item => item.quantity <= item.min_quantity);
}

/**
 * Helper function to get stock status color
 */
export function getStockStatusColor(item: VanStockItem): string {
  const effectiveQty = (item.container_quantity || 0) + (item.bulk_quantity || 0) + (item.quantity || 0);
  if (effectiveQty === 0) return 'text-red-600 bg-red-50';
  if (effectiveQty <= item.min_quantity) return 'text-amber-600 bg-amber-50';
  return 'text-green-600 bg-green-50';
}

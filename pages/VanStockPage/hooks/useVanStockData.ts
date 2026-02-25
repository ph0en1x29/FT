/**
 * Custom hook for VanStock data management
 */
import { useCallback,useEffect,useMemo,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { User,UserRole,VanStock,VanStockItem,VanStockReplenishment } from '../../../types';
import { FilterType,VanStockStats } from '../types';

interface UseVanStockDataProps {
  currentUser: User;
}

export function useVanStockData({ currentUser }: UseVanStockDataProps) {
  const [vanStocks, setVanStocks] = useState<VanStock[]>([]);
  const [replenishments, setReplenishments] = useState<VanStockReplenishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const isTechnician = currentUser.role === UserRole.TECHNICIAN;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stocksData, replenishmentsData] = await Promise.all([
        MockDb.getAllVanStocks(),
        MockDb.getReplenishmentRequests({ status: 'pending' }),
      ]);

      // Technicians can only see their own van stock
      const filteredStocks = isTechnician
        ? stocksData.filter(vs => vs.technician_id === currentUser.user_id)
        : stocksData;

      setVanStocks(filteredStocks);
      setReplenishments(replenishmentsData);
    } catch (_error) {
      showToast.error('Failed to load Van Stock data');
    }
    setLoading(false);
  }, [currentUser.user_id, isTechnician]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(vs =>
        vs.technician_name?.toLowerCase().includes(query) ||
        vs.technician?.email?.toLowerCase().includes(query) ||
        vs.van_code?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType === 'low_stock') {
      result = result.filter(vs => {
        const lowItems = vs.items?.filter(item => item.quantity <= item.min_quantity) || [];
        return lowItems.length > 0;
      });
    } else if (filterType === 'pending_audit') {
      result = result.filter(vs => {
        if (!vs.next_audit_due) return true; // Never audited
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

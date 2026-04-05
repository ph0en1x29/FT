import { useCallback,useMemo,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVanStockByTechnician,useReplenishmentsByTech,queryKeys } from '../../../hooks/useQueryHooks';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { VanStockUsage } from '../../../types';
import { useEffect } from 'react';

interface UseVanStockParams {
  userId: string;
}

interface VanStockStats {
  totalItems: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

export function useVanStock({ userId }: UseVanStockParams) {
  const queryClient = useQueryClient();

  const {
    data: vanStock = null,
    isLoading: loadingStock,
    isError,
    refetch: refetchStock,
  } = useVanStockByTechnician(userId);

  const {
    data: replenishments = [],
    isLoading: loadingReplenishments,
    refetch: refetchReplenishments,
  } = useReplenishmentsByTech(userId);

  // Usage history kept as manual state (infrequently needed, not a perf bottleneck)
  const [usageHistory, setUsageHistory] = useState<VanStockUsage[]>([]);

  useEffect(() => {
    if (!userId) return;
    MockDb.getVanStockUsageHistory(userId, 50)
      .then(setUsageHistory)
      .catch(() => setUsageHistory([]));
  }, [userId]);

  const loading = loadingStock || loadingReplenishments;
  const error = isError;

  // Explicit refresh for manual refresh buttons
  const loadData = useCallback(() => {
    refetchStock();
    refetchReplenishments();
  }, [refetchStock, refetchReplenishments]);

  // Calculate stats
  const stats = useMemo<VanStockStats>(() => {
    if (!vanStock?.items) {
      return { totalItems: 0, lowStock: 0, outOfStock: 0, totalValue: 0 };
    }
    const items = vanStock.items;
    return {
      totalItems: items.length,
      lowStock: items.filter(item => item.quantity > 0 && item.quantity <= item.min_quantity).length,
      outOfStock: items.filter(item => item.quantity === 0).length,
      totalValue: vanStock.total_value || 0,
    };
  }, [vanStock]);

  // Get low stock items for replenishment
  const lowStockItems = useMemo(() => {
    if (!vanStock?.items) return [];
    return vanStock.items.filter(item => item.quantity <= item.min_quantity);
  }, [vanStock?.items]);

  // Confirm receipt of fulfilled replenishment
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmReceipt = useCallback(async (replenishmentId: string) => {
    setConfirmingId(replenishmentId);
    try {
      await MockDb.confirmReplenishmentReceipt(replenishmentId);
      showToast.success('Receipt confirmed');
      // Background invalidation — no UI blanking
      queryClient.invalidateQueries({ queryKey: queryKeys.vanStockTech(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.replenishmentsTech(userId) });
    } catch {
      showToast.error('Failed to confirm receipt');
    }
    setConfirmingId(null);
  }, [userId, queryClient]);

  // Pending replenishments count
  const pendingReplenishmentsCount = useMemo(() => {
    return replenishments.filter(r =>
      r.status === 'pending' || r.status === 'approved' || r.status === 'in_progress'
    ).length;
  }, [replenishments]);

  return {
    vanStock,
    usageHistory,
    replenishments,
    loading,
    error,
    stats,
    lowStockItems,
    pendingReplenishmentsCount,
    confirmReceipt,
    confirmingId,
    loadData,
  };
}

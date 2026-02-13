import { useCallback,useEffect,useMemo,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { VanStock,VanStockReplenishment,VanStockUsage } from '../../../types';

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
  const [vanStock, setVanStock] = useState<VanStock | null>(null);
  const [usageHistory, setUsageHistory] = useState<VanStockUsage[]>([]);
  const [replenishments, setReplenishments] = useState<VanStockReplenishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [stockData, historyData, replenishmentData] = await Promise.all([
        MockDb.getVanStockByTechnician(userId),
        MockDb.getVanStockUsageHistory(userId, 50),
        MockDb.getReplenishmentRequests({ technicianId: userId }),
      ]);
      setVanStock(stockData);
      setUsageHistory(historyData);
      setReplenishments(replenishmentData);
    } catch (_error) {
      setError(true);
      showToast.error('Failed to load Van Stock data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate stats
  const stats = useMemo<VanStockStats>(() => {
    if (!vanStock?.items) {
      return { totalItems: 0, lowStock: 0, outOfStock: 0, totalValue: 0 };
    }

    const items = vanStock.items;
    const totalItems = items.length;
    const lowStock = items.filter(item => item.quantity > 0 && item.quantity <= item.min_quantity).length;
    const outOfStock = items.filter(item => item.quantity === 0).length;
    const totalValue = vanStock.total_value || 0;

    return { totalItems, lowStock, outOfStock, totalValue };
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
      await loadData();
    } catch (_error) {
      showToast.error('Failed to confirm receipt');
    }
    setConfirmingId(null);
  }, [userId, loadData]);

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

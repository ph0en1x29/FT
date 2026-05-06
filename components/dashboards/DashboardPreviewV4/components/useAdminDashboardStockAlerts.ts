import { useEffect, useState } from 'react';
import { getStockAlertParts } from '../../../../services/partsService';

interface StockAlertItem {
  name: string;
  quantity: number;
  min: number;
}

export function useAdminDashboardStockAlerts() {
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<StockAlertItem[]>([]);
  const [oosItems, setOosItems] = useState<StockAlertItem[]>([]);
  const [oosCount, setOosCount] = useState(0);

  useEffect(() => {
    getStockAlertParts()
      .then((parts) => {
        // effective_stock is the DB-side generated column (PR 4 2026-05-07): for
        // liquids it's container*container_size + bulk; for solids it's stock_quantity.
        // Reads here used to branch on stock_quantity alone, which mis-flagged sealed
        // liquid drums as out-of-stock on the admin dashboard.
        const stockOf = (i: typeof parts[number]) => Number(i.effective_stock ?? i.stock_quantity ?? 0);
        const low = parts
          .filter((i) => {
            const qty = stockOf(i);
            const min = i.min_stock_level || 10;
            return qty > 0 && qty <= min;
          })
          .sort((a, b) => stockOf(a) - stockOf(b))
          .map((i) => ({
            name: i.part_name || 'Unknown',
            quantity: stockOf(i),
            min: i.min_stock_level || 10,
          }));

        const oos = parts
          .filter((i) => {
            const qty = stockOf(i);
            const min = i.min_stock_level || 10;
            return qty === 0 && min > 0;
          })
          .sort((a, b) => (a.part_name || '').localeCompare(b.part_name || ''))
          .map((i) => ({
            name: i.part_name || 'Unknown',
            quantity: stockOf(i),
            min: i.min_stock_level || 10,
          }));

        setLowStockItems(low);
        setLowStockCount(low.length);
        setOosItems(oos);
        setOosCount(oos.length);
      }).catch(() => {
        setLowStockItems([]);
        setLowStockCount(0);
        setOosItems([]);
        setOosCount(0);
      });
  }, []);

  return {
    lowStockCount,
    lowStockItems,
    oosCount,
    oosItems,
  };
}

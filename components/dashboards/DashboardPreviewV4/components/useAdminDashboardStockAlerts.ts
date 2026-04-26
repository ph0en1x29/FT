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
        const low = parts
          .filter((i) => {
            const qty = i.stock_quantity || 0;
            const min = i.min_stock_level || 10;
            return qty > 0 && qty <= min;
          })
          .sort((a, b) => (a.stock_quantity || 0) - (b.stock_quantity || 0))
          .map((i) => ({
            name: i.part_name || 'Unknown',
            quantity: i.stock_quantity || 0,
            min: i.min_stock_level || 10,
          }));

        const oos = parts
          .filter((i) => {
            const qty = i.stock_quantity || 0;
            const min = i.min_stock_level || 10;
            return qty === 0 && min > 0;
          })
          .sort((a, b) => (a.part_name || '').localeCompare(b.part_name || ''))
          .map((i) => ({
            name: i.part_name || 'Unknown',
            quantity: i.stock_quantity || 0,
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

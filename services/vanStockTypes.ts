import type { Part, VanStock, VanStockItem } from '../types';

export interface VanStockItemRow extends VanStockItem {
  part?: Part;
}

export type VanStockRow = Omit<VanStock, 'technician' | 'items'> & {
  technician?: { name: string } | null;
  items?: VanStockItemRow[] | null;
};

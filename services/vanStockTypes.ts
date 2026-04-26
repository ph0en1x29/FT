import type { Part, VanStockItem } from '../types';

export interface VanStockItemRow extends VanStockItem {
  part?: Part;
}

/**
 * Van-stock client-side helpers.
 *
 * The DB column `van_stock_items.effective_quantity` is the source of truth
 * (maintained by trigger PR 3 2026-05-07). Some legacy `select(...)` shapes
 * may not project the column yet, so this helper falls back to the dual-unit
 * formula for liquids and the legacy `quantity` for solids.
 */

interface VanStockLikeItem {
  effective_quantity?: number | null;
  quantity?: number | null;
  container_quantity?: number | null;
  bulk_quantity?: number | null;
  part?: {
    is_liquid?: boolean | null;
    container_size?: number | null;
  } | null;
}

export function getVanStockAvailableQty(item: VanStockLikeItem): number {
  if (item.effective_quantity != null) return Number(item.effective_quantity);
  const part = item.part;
  if (part?.is_liquid) {
    const sizeRaw = Number(part.container_size ?? 0);
    const size = sizeRaw > 0 ? sizeRaw : 1;
    return Number(item.container_quantity ?? 0) * size + Number(item.bulk_quantity ?? 0);
  }
  return Number(item.quantity ?? 0);
}

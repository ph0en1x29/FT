/**
 * Inventory Movements Service
 *
 * Single entry point for inserting `inventory_movements` audit rows. Wraps the
 * raw `supabase.from('inventory_movements').insert(...)` so that callers
 * outside `services/` don't need to import `supabase` directly (per the
 * services-layer rule in CLAUDE.md).
 *
 * Existing service-internal writers (`inventoryService.ts`, `liquidInventoryService.ts`,
 * `jobInvoiceService.ts`) are intentionally left as-is — they already abstract
 * supabase from their callers. This service exists for the page/hook callers
 * that were previously bypassing the services layer:
 *   - `pages/InventoryPage/components/BatchReceiveStockModal.tsx`
 *   - `pages/InventoryPage/components/StocktakeTab.tsx`
 *   - `pages/InventoryPage/components/ImportPartsModal.tsx`
 *   - `pages/InventoryPage/hooks/useInventoryData.ts`
 */

import type { InventoryMovementType } from '../types/inventory.types';
import { supabase } from './supabaseClient';

export interface InventoryMovementInput {
  part_id: string;
  movement_type: InventoryMovementType;
  container_qty_change?: number;
  bulk_qty_change?: number;
  performed_by: string;
  performed_by_name?: string | null;
  job_id?: string;
  van_stock_id?: string;
  van_stock_item_id?: string;
  reference_number?: string | null;
  unit_cost_at_time?: number | null;
  total_cost?: number | null;
  notes?: string;
  store_container_qty_after?: number | null;
  store_bulk_qty_after?: number | null;
  van_container_qty_after?: number;
  van_bulk_qty_after?: number;
  adjustment_reason?: string | null;
  performed_at?: string;
  created_at?: string;
}

/**
 * Insert one inventory_movement audit row. Throws on error so callers can
 * decide how to surface the failure (toast, retry, ignore). Mirrors the
 * existing `inventoryService.ts:447` pattern but exposed for non-service
 * callers.
 */
export async function recordInventoryMovement(input: InventoryMovementInput): Promise<void> {
  const { error } = await supabase.from('inventory_movements').insert({
    container_qty_change: 0,
    bulk_qty_change: 0,
    ...input,
  });
  if (error) {
    throw new Error(`Failed to record inventory movement: ${error.message}`);
  }
}

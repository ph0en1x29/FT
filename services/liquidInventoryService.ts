/**
 * Liquid Inventory Service
 * 
 * Handles dual-unit inventory operations for liquid items:
 * - Sealed containers (bottles) for external sales
 * - Loose bulk units (liters) for internal/rental use
 * - One-way break: sealed → loose (never recombine)
 * - Full audit trail via inventory_movements
 */

import type { Part, InventoryMovement, InventoryMovementType } from '../types/inventory.types';
import { supabase } from './supabaseClient';

// =============================================
// INVENTORY MOVEMENT LOGGING
// =============================================

interface LogMovementParams {
  part_id: string;
  movement_type: InventoryMovementType;
  container_qty_change?: number;
  bulk_qty_change?: number;
  job_id?: string;
  van_stock_id?: string;
  van_stock_item_id?: string;
  performed_by: string;
  performed_by_name?: string;
  notes?: string;
  // Snapshots after the operation
  store_container_qty_after?: number;
  store_bulk_qty_after?: number;
  van_container_qty_after?: number;
  van_bulk_qty_after?: number;
  // Cost & forklift tracking
  reference_number?: string;
  unit_cost_at_time?: number;
  total_cost?: number;
  forklift_id?: string;
}

async function logMovement(params: LogMovementParams): Promise<void> {
  const { error } = await supabase
    .from('inventory_movements')
    .insert({
      part_id: params.part_id,
      movement_type: params.movement_type,
      container_qty_change: params.container_qty_change ?? 0,
      bulk_qty_change: params.bulk_qty_change ?? 0,
      job_id: params.job_id ?? null,
      van_stock_id: params.van_stock_id ?? null,
      van_stock_item_id: params.van_stock_item_id ?? null,
      performed_by: params.performed_by,
      performed_by_name: params.performed_by_name ?? null,
      notes: params.notes ?? null,
      store_container_qty_after: params.store_container_qty_after ?? null,
      store_bulk_qty_after: params.store_bulk_qty_after ?? null,
      van_container_qty_after: params.van_container_qty_after ?? null,
      van_bulk_qty_after: params.van_bulk_qty_after ?? null,
      reference_number: params.reference_number ?? null,
      unit_cost_at_time: params.unit_cost_at_time ?? null,
      total_cost: params.total_cost ?? null,
      forklift_id: params.forklift_id ?? null,
    });

  if (error) {
    console.error('Failed to log inventory movement:', error.message);
    // Don't throw — movement logging should not block operations
  }
}

// =============================================
// STORE INVENTORY OPERATIONS
// =============================================

/**
 * Purchase containers into store inventory
 * e.g. Buy 10 bottles of engine oil
 */
export async function purchaseContainers(
  partId: string,
  containerCount: number,
  performedBy: string,
  performedByName?: string,
  notes?: string
): Promise<Part> {
  // Fetch current state
  const { data: part, error: fetchErr } = await supabase
    .from('parts')
    .select('part_id, container_quantity, bulk_quantity, stock_quantity, container_size')
    .eq('part_id', partId)
    .single();

  if (fetchErr || !part) throw new Error(fetchErr?.message ?? 'Part not found');

  const newContainerQty = (part.container_quantity ?? 0) + containerCount;
  const newStockQty = (part.stock_quantity ?? 0) + containerCount;

  const { data: updated, error: updateErr } = await supabase
    .from('parts')
    .update({
      container_quantity: newContainerQty,
      stock_quantity: newStockQty, // Keep legacy field in sync
      updated_at: new Date().toISOString(),
    })
    .eq('part_id', partId)
    .select()
    .single();

  if (updateErr) throw new Error(updateErr.message);

  await logMovement({
    part_id: partId,
    movement_type: 'purchase',
    container_qty_change: containerCount,
    performed_by: performedBy,
    performed_by_name: performedByName,
    notes: notes ?? `Purchased ${containerCount} containers`,
    store_container_qty_after: newContainerQty,
    store_bulk_qty_after: part.bulk_quantity ?? 0,
  });

  return updated as Part;
}

/**
 * Break a sealed container into loose bulk units (one-way)
 * e.g. Open 1 bottle (5L) → container_qty -1, bulk_qty +5
 */
export async function breakContainer(
  partId: string,
  containersToBreak: number,
  performedBy: string,
  performedByName?: string,
  notes?: string
): Promise<Part> {
  const { data: part, error: fetchErr } = await supabase
    .from('parts')
    .select('part_id, container_quantity, bulk_quantity, container_size')
    .eq('part_id', partId)
    .single();

  if (fetchErr || !part) throw new Error(fetchErr?.message ?? 'Part not found');
  if ((part.container_quantity ?? 0) < containersToBreak) {
    throw new Error(`Not enough sealed containers. Have ${part.container_quantity ?? 0}, need ${containersToBreak}`);
  }
  if (!part.container_size || part.container_size <= 0) {
    throw new Error('Container size not set for this part');
  }

  const bulkToAdd = containersToBreak * part.container_size;
  const newContainerQty = (part.container_quantity ?? 0) - containersToBreak;
  const newBulkQty = (part.bulk_quantity ?? 0) + bulkToAdd;

  const { data: updated, error: updateErr } = await supabase
    .from('parts')
    .update({
      container_quantity: newContainerQty,
      bulk_quantity: newBulkQty,
      updated_at: new Date().toISOString(),
    })
    .eq('part_id', partId)
    .select()
    .single();

  if (updateErr) throw new Error(updateErr.message);

  await logMovement({
    part_id: partId,
    movement_type: 'break_container',
    container_qty_change: -containersToBreak,
    bulk_qty_change: bulkToAdd,
    performed_by: performedBy,
    performed_by_name: performedByName,
    notes: notes ?? `Opened ${containersToBreak} container(s), released ${bulkToAdd} ${part.container_size ? 'base units' : ''}`,
    store_container_qty_after: newContainerQty,
    store_bulk_qty_after: newBulkQty,
  });

  return updated as Part;
}

/**
 * Sell sealed containers to external client
 * Only whole sealed containers can be sold externally
 */
export async function sellContainersExternal(
  partId: string,
  containerCount: number,
  jobId: string,
  performedBy: string,
  performedByName?: string
): Promise<Part> {
  const { data: part, error: fetchErr } = await supabase
    .from('parts')
    .select('part_id, container_quantity, bulk_quantity, stock_quantity')
    .eq('part_id', partId)
    .single();

  if (fetchErr || !part) throw new Error(fetchErr?.message ?? 'Part not found');
  if ((part.container_quantity ?? 0) < containerCount) {
    throw new Error(`Not enough sealed containers for external sale. Have ${part.container_quantity ?? 0}, need ${containerCount}`);
  }

  const newContainerQty = (part.container_quantity ?? 0) - containerCount;
  const newStockQty = Math.max(0, (part.stock_quantity ?? 0) - containerCount);

  const { data: updated, error: updateErr } = await supabase
    .from('parts')
    .update({
      container_quantity: newContainerQty,
      stock_quantity: newStockQty,
      updated_at: new Date().toISOString(),
    })
    .eq('part_id', partId)
    .select()
    .single();

  if (updateErr) throw new Error(updateErr.message);

  await logMovement({
    part_id: partId,
    movement_type: 'sell_external',
    container_qty_change: -containerCount,
    job_id: jobId,
    performed_by: performedBy,
    performed_by_name: performedByName,
    notes: `Sold ${containerCount} sealed container(s) to external client`,
    store_container_qty_after: newContainerQty,
    store_bulk_qty_after: part.bulk_quantity ?? 0,
  });

  return updated as Part;
}

/**
 * Use bulk/loose units for internal rental job
 * Auto-breaks a container if insufficient bulk available
 */
export async function useInternalBulk(
  partId: string,
  baseUnitsNeeded: number,
  jobId: string,
  performedBy: string,
  performedByName?: string
): Promise<Part> {
  const { data: part, error: fetchErr } = await supabase
    .from('parts')
    .select('part_id, container_quantity, bulk_quantity, container_size')
    .eq('part_id', partId)
    .single();

  if (fetchErr || !part) throw new Error(fetchErr?.message ?? 'Part not found');

  let currentBulk = part.bulk_quantity ?? 0;
  let currentContainers = part.container_quantity ?? 0;
  const containerSize = part.container_size ?? 0;
  let containersOpened = 0;

  // Auto-break containers if bulk is insufficient
  while (currentBulk < baseUnitsNeeded && currentContainers > 0 && containerSize > 0) {
    currentContainers -= 1;
    currentBulk += containerSize;
    containersOpened += 1;
  }

  if (currentBulk < baseUnitsNeeded) {
    throw new Error(`Insufficient stock. Available: ${currentBulk.toFixed(1)} base units (after opening ${containersOpened} container(s)). Need: ${baseUnitsNeeded}`);
  }

  const newBulkQty = currentBulk - baseUnitsNeeded;

  const { data: updated, error: updateErr } = await supabase
    .from('parts')
    .update({
      container_quantity: currentContainers,
      bulk_quantity: newBulkQty,
      updated_at: new Date().toISOString(),
    })
    .eq('part_id', partId)
    .select()
    .single();

  if (updateErr) throw new Error(updateErr.message);

  // Log container break if it happened
  if (containersOpened > 0) {
    await logMovement({
      part_id: partId,
      movement_type: 'break_container',
      container_qty_change: -containersOpened,
      bulk_qty_change: containersOpened * containerSize,
      performed_by: performedBy,
      performed_by_name: performedByName,
      notes: `Auto-opened ${containersOpened} container(s) for internal use`,
      store_container_qty_after: currentContainers,
      store_bulk_qty_after: newBulkQty + baseUnitsNeeded, // before usage deduction
    });
  }

  // Log the actual usage
  await logMovement({
    part_id: partId,
    movement_type: 'use_internal',
    bulk_qty_change: -baseUnitsNeeded,
    job_id: jobId,
    performed_by: performedBy,
    performed_by_name: performedByName,
    notes: `Used ${baseUnitsNeeded} base units on internal/rental job`,
    store_container_qty_after: currentContainers,
    store_bulk_qty_after: newBulkQty,
  });

  return updated as Part;
}

// =============================================
// VAN STOCK OPERATIONS
// =============================================

/**
 * Transfer sealed containers from store to van
 * Only sealed containers can be transferred
 */
export async function transferToVan(
  partId: string,
  vanStockItemId: string,
  vanStockId: string,
  containerCount: number,
  performedBy: string,
  performedByName?: string
): Promise<void> {
  // 1. Check store has enough sealed containers
  const { data: part, error: partErr } = await supabase
    .from('parts')
    .select('part_id, container_quantity, bulk_quantity, stock_quantity')
    .eq('part_id', partId)
    .single();

  if (partErr || !part) throw new Error(partErr?.message ?? 'Part not found');
  if ((part.container_quantity ?? 0) < containerCount) {
    throw new Error(`Store only has ${part.container_quantity ?? 0} sealed containers`);
  }

  // 2. Get van stock item
  const { data: vanItem, error: vanErr } = await supabase
    .from('van_stock_items')
    .select('item_id, container_quantity, bulk_quantity, quantity')
    .eq('item_id', vanStockItemId)
    .single();

  if (vanErr || !vanItem) throw new Error(vanErr?.message ?? 'Van stock item not found');

  // 3. Deduct from store
  const newStoreContainers = (part.container_quantity ?? 0) - containerCount;
  const newStoreStock = Math.max(0, (part.stock_quantity ?? 0) - containerCount);

  const { error: storeUpdateErr } = await supabase
    .from('parts')
    .update({
      container_quantity: newStoreContainers,
      stock_quantity: newStoreStock,
      updated_at: new Date().toISOString(),
    })
    .eq('part_id', partId);

  if (storeUpdateErr) throw new Error(storeUpdateErr.message);

  // 4. Add to van
  const newVanContainers = (vanItem.container_quantity ?? 0) + containerCount;
  const newVanQty = (vanItem.quantity ?? 0) + containerCount;

  const { error: vanUpdateErr } = await supabase
    .from('van_stock_items')
    .update({
      container_quantity: newVanContainers,
      quantity: newVanQty, // Keep legacy field in sync
      last_replenished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('item_id', vanStockItemId);

  if (vanUpdateErr) throw new Error(vanUpdateErr.message);

  // 5. Log movement
  await logMovement({
    part_id: partId,
    movement_type: 'transfer_to_van',
    container_qty_change: -containerCount,
    van_stock_id: vanStockId,
    van_stock_item_id: vanStockItemId,
    performed_by: performedBy,
    performed_by_name: performedByName,
    notes: `Transferred ${containerCount} sealed container(s) to van`,
    store_container_qty_after: newStoreContainers,
    store_bulk_qty_after: part.bulk_quantity ?? 0,
    van_container_qty_after: newVanContainers,
    van_bulk_qty_after: vanItem.bulk_quantity ?? 0,
  });
}

/**
 * Return sealed containers from van to store
 * Only sealed (unopened) containers can return
 */
export async function returnToStore(
  partId: string,
  vanStockItemId: string,
  vanStockId: string,
  containerCount: number,
  performedBy: string,
  performedByName?: string
): Promise<void> {
  // 1. Check van has enough sealed containers
  const { data: vanItem, error: vanErr } = await supabase
    .from('van_stock_items')
    .select('item_id, container_quantity, bulk_quantity, quantity')
    .eq('item_id', vanStockItemId)
    .single();

  if (vanErr || !vanItem) throw new Error(vanErr?.message ?? 'Van stock item not found');
  if ((vanItem.container_quantity ?? 0) < containerCount) {
    throw new Error(`Van only has ${vanItem.container_quantity ?? 0} sealed containers to return`);
  }

  // 2. Get store part
  const { data: part, error: partErr } = await supabase
    .from('parts')
    .select('part_id, container_quantity, bulk_quantity, stock_quantity')
    .eq('part_id', partId)
    .single();

  if (partErr || !part) throw new Error(partErr?.message ?? 'Part not found');

  // 3. Deduct from van
  const newVanContainers = (vanItem.container_quantity ?? 0) - containerCount;
  const newVanQty = Math.max(0, (vanItem.quantity ?? 0) - containerCount);

  const { error: vanUpdateErr } = await supabase
    .from('van_stock_items')
    .update({
      container_quantity: newVanContainers,
      quantity: newVanQty,
      updated_at: new Date().toISOString(),
    })
    .eq('item_id', vanStockItemId);

  if (vanUpdateErr) throw new Error(vanUpdateErr.message);

  // 4. Add to store
  const newStoreContainers = (part.container_quantity ?? 0) + containerCount;
  const newStoreStock = (part.stock_quantity ?? 0) + containerCount;

  const { error: storeUpdateErr } = await supabase
    .from('parts')
    .update({
      container_quantity: newStoreContainers,
      stock_quantity: newStoreStock,
      updated_at: new Date().toISOString(),
    })
    .eq('part_id', partId);

  if (storeUpdateErr) throw new Error(storeUpdateErr.message);

  // 5. Log movement
  await logMovement({
    part_id: partId,
    movement_type: 'return_to_store',
    container_qty_change: containerCount,
    van_stock_id: vanStockId,
    van_stock_item_id: vanStockItemId,
    performed_by: performedBy,
    performed_by_name: performedByName,
    notes: `Returned ${containerCount} sealed container(s) from van to store`,
    store_container_qty_after: newStoreContainers,
    store_bulk_qty_after: part.bulk_quantity ?? 0,
    van_container_qty_after: newVanContainers,
    van_bulk_qty_after: vanItem.bulk_quantity ?? 0,
  });
}

/**
 * Use bulk from van stock for a job
 * Auto-breaks van's sealed containers if needed
 * Loose liquid stays on van — never returns to store
 */
export async function useVanBulk(
  partId: string,
  vanStockItemId: string,
  vanStockId: string,
  baseUnitsNeeded: number,
  jobId: string,
  performedBy: string,
  performedByName?: string,
  extraParams?: {
    forklift_id?: string;
    unit_cost_at_time?: number;
    total_cost?: number;
    reference_number?: string;
  }
): Promise<{ balanceOverride: boolean }> {
  // 1. Get van item + part container_size
  const { data: vanItem, error: vanErr } = await supabase
    .from('van_stock_items')
    .select('item_id, container_quantity, bulk_quantity, quantity')
    .eq('item_id', vanStockItemId)
    .single();

  if (vanErr || !vanItem) throw new Error(vanErr?.message ?? 'Van stock item not found');

  const { data: part, error: partErr } = await supabase
    .from('parts')
    .select('part_id, container_size')
    .eq('part_id', partId)
    .single();

  if (partErr || !part) throw new Error(partErr?.message ?? 'Part not found');

  let currentBulk = vanItem.bulk_quantity ?? 0;
  let currentContainers = vanItem.container_quantity ?? 0;
  const containerSize = part.container_size ?? 0;
  let containersOpened = 0;

  // Auto-break van's sealed containers if bulk insufficient
  while (currentBulk < baseUnitsNeeded && currentContainers > 0 && containerSize > 0) {
    currentContainers -= 1;
    currentBulk += containerSize;
    containersOpened += 1;
  }

  const balanceInsufficient = currentBulk < baseUnitsNeeded;
  const newBulkQty = currentBulk - baseUnitsNeeded; // May go negative — allowed with warning flag
  const newQty = Math.max(0, (vanItem.quantity ?? 0) - (containersOpened > 0 ? containersOpened : 0));

  // 2. Update van stock (allow negative with warning flag)
  const { error: updateErr } = await supabase
    .from('van_stock_items')
    .update({
      container_quantity: currentContainers,
      bulk_quantity: newBulkQty,
      quantity: newQty,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('item_id', vanStockItemId);

  if (updateErr) throw new Error(updateErr.message);

  // 3. Log break if it happened
  if (containersOpened > 0) {
    await logMovement({
      part_id: partId,
      movement_type: 'break_container',
      container_qty_change: -containersOpened,
      bulk_qty_change: containersOpened * containerSize,
      van_stock_id: vanStockId,
      van_stock_item_id: vanStockItemId,
      performed_by: performedBy,
      performed_by_name: performedByName,
      notes: `Auto-opened ${containersOpened} container(s) on van for job use`,
      van_container_qty_after: currentContainers,
      van_bulk_qty_after: newBulkQty + baseUnitsNeeded,
    });
  }

  // 4. Log usage (with balance_override flag if insufficient)
  await logMovement({
    part_id: partId,
    movement_type: 'use_internal',
    bulk_qty_change: -baseUnitsNeeded,
    job_id: jobId,
    van_stock_id: vanStockId,
    van_stock_item_id: vanStockItemId,
    performed_by: performedBy,
    performed_by_name: performedByName,
    notes: balanceInsufficient
      ? `Used ${baseUnitsNeeded} base units from van on job [balance_override: true — van balance was insufficient]`
      : `Used ${baseUnitsNeeded} base units from van on job`,
    van_container_qty_after: currentContainers,
    van_bulk_qty_after: newBulkQty,
    forklift_id: extraParams?.forklift_id,
    unit_cost_at_time: extraParams?.unit_cost_at_time,
    total_cost: extraParams?.total_cost,
    reference_number: extraParams?.reference_number,
  });

  // Return warning flag so caller can show toast
  return { balanceOverride: balanceInsufficient };
}

// =============================================
// STOCK QUERIES & DISPLAY HELPERS
// =============================================

/**
 * Get total stock in base units for a part
 */
export function getTotalBaseUnits(part: Pick<Part, 'container_quantity' | 'bulk_quantity' | 'container_size'>): number {
  const containers = part.container_quantity ?? 0;
  const bulk = part.bulk_quantity ?? 0;
  const size = part.container_size ?? 1;
  return (containers * size) + bulk;
}

/**
 * Format stock display: "418.0 L" for liquid parts or "50 pcs" for non-liquid.
 * Liquid parts always show total liters = (containers × container_size) + bulk.
 */
export function formatStockDisplay(part: Pick<Part, 'container_quantity' | 'bulk_quantity' | 'container_unit' | 'base_unit' | 'is_liquid' | 'container_size'>): string {
  if (!part.is_liquid) {
    return `${part.container_quantity ?? 0} ${part.base_unit ?? 'pcs'}`;
  }

  const containers = part.container_quantity ?? 0;
  const bulk = part.bulk_quantity ?? 0;
  const size = part.container_size ?? 0;
  const baseUnit = part.base_unit ?? 'L';

  const totalLiters = (containers * size) + bulk;

  if (totalLiters <= 0) {
    return 'Out of stock';
  }
  return `${totalLiters.toFixed(1)} ${baseUnit}`;
}

/**
 * Check for stock mismatch (audit alert)
 * Returns discrepancy if container*size + bulk doesn't match expected
 */
export function checkStockMismatch(
  part: Pick<Part, 'container_quantity' | 'bulk_quantity' | 'container_size' | 'stock_quantity'>
): { hasMismatch: boolean; expected: number; actual: number; difference: number } {
  const containers = part.container_quantity ?? 0;
  const bulk = part.bulk_quantity ?? 0;
  const size = part.container_size ?? 1;
  const actual = (containers * size) + bulk;
  const expected = (part.stock_quantity ?? 0) * size; // Legacy field * size

  const difference = Math.abs(actual - expected);
  return {
    hasMismatch: difference > 0.01, // Float tolerance
    expected,
    actual,
    difference,
  };
}

/**
 * Get movement history for a part
 */
export async function getMovementHistory(
  partId: string,
  limit: number = 50
): Promise<InventoryMovement[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('part_id', partId)
    .order('performed_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data as InventoryMovement[];
}

/**
 * Manual stock adjustment (admin only, audit logged)
 */
export async function adjustStock(
  partId: string,
  containerQtyChange: number,
  bulkQtyChange: number,
  performedBy: string,
  performedByName?: string,
  reason?: string
): Promise<Part> {
  const { data: part, error: fetchErr } = await supabase
    .from('parts')
    .select('part_id, container_quantity, bulk_quantity')
    .eq('part_id', partId)
    .single();

  if (fetchErr || !part) throw new Error(fetchErr?.message ?? 'Part not found');

  const newContainerQty = Math.max(0, (part.container_quantity ?? 0) + containerQtyChange);
  const newBulkQty = Math.max(0, (part.bulk_quantity ?? 0) + bulkQtyChange);

  const { data: updated, error: updateErr } = await supabase
    .from('parts')
    .update({
      container_quantity: newContainerQty,
      bulk_quantity: newBulkQty,
      updated_at: new Date().toISOString(),
    })
    .eq('part_id', partId)
    .select()
    .single();

  if (updateErr) throw new Error(updateErr.message);

  await logMovement({
    part_id: partId,
    movement_type: 'adjustment',
    container_qty_change: containerQtyChange,
    bulk_qty_change: bulkQtyChange,
    performed_by: performedBy,
    performed_by_name: performedByName,
    notes: reason ?? 'Manual stock adjustment',
    store_container_qty_after: newContainerQty,
    store_bulk_qty_after: newBulkQty,
  });

  return updated as Part;
}

// =============================================
// PURCHASE / RECEIVE STOCK
// =============================================

export async function receiveLiquidStock(params: {
  partId: string;
  containerQty: number;
  containerSize: number;
  totalLiters: number;
  totalPrice: number;
  costPerLiter: number;
  poReference?: string;
  notes?: string;
  performedBy: string;
  performedByName: string;
}) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Insert purchase batch record
  const { error: batchError } = await supabase.from('purchase_batches').insert({
    part_id: params.partId,
    container_qty: params.containerQty,
    container_size: params.containerSize,
    total_liters: params.totalLiters,
    total_price: params.totalPrice,
    cost_per_liter: params.costPerLiter,
    po_reference: params.poReference || null,
    notes: params.notes || null,
    performed_by: params.performedBy,
    performed_by_name: params.performedByName,
  });
  if (batchError) throw batchError;

  // Fetch current part quantities
  const { data: part, error: partError } = await supabase
    .from('parts')
    .select('part_id, bulk_quantity, container_quantity')
    .eq('part_id', params.partId)
    .single();
  if (partError) throw partError;

  const newBulkQty = (part.bulk_quantity ?? 0) + params.totalLiters;
  const newContainerQty = (part.container_quantity ?? 0) + params.containerQty;

  // Update parts table
  const { error: updateError } = await supabase
    .from('parts')
    .update({
      bulk_quantity: newBulkQty,
      container_quantity: newContainerQty,
    })
    .eq('part_id', params.partId);
  if (updateError) throw updateError;

  // Log to inventory_movements
  const { error: movError } = await supabase.from('inventory_movements').insert({
    part_id: params.partId,
    movement_type: 'purchase',
    container_qty_change: params.containerQty,
    bulk_qty_change: params.totalLiters,
    performed_by: params.performedBy,
    performed_by_name: params.performedByName,
    store_container_qty_after: newContainerQty,
    store_bulk_qty_after: newBulkQty,
    reference_number: params.poReference || null,
    notes: params.notes
      ? `PO: ${params.poReference || 'N/A'} | ${params.notes}`
      : `PO: ${params.poReference || 'N/A'} | Received ${params.containerQty} containers × ${params.containerSize}L = ${params.totalLiters}L`,
  });
  if (movError) throw movError;
}

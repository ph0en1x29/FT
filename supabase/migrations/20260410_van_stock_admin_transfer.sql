-- Admin 2 Store — van stock transfer in/out with central inventory
--
-- Problem
-- -------
-- Admin 2 (role = 'admin_store') is the store keeper. They manage both the
-- central parts warehouse and the van stock fleet, and part of their daily job
-- is moving parts between the two: loading a van at the start of the week,
-- returning leftover sealed stock at the end of a job, reallocating between
-- technicians. Today we have two half-solutions:
--
--   1. addVanStockItem() — inserts a van_stock_items row with a quantity but
--      DOES NOT touch parts.stock_quantity. So the van gets the parts, the
--      central warehouse also thinks it still has them. Net effect: phantom
--      stock.
--   2. liquidInventoryService.transferToVan / returnToStore — works correctly
--      for liquid parts (oils, coolants) using sealed-container semantics,
--      triggered from the VanStockDetailModal via a `prompt()` dialog. But
--      it's hard-gated on `item.part?.is_liquid`, so regular count-based parts
--      (filters, belts, fuses) have NO transfer path at all.
--
-- Neither path creates a proper inventory_movements audit row for non-liquid
-- admin transfers, which means the Store Ledger tab shows nothing when Admin 2
-- loads a van or takes parts back.
--
-- Fix
-- ---
-- Two new PL/pgSQL RPCs exposed via PostgREST, both SECURITY DEFINER with
-- search_path locked to public. Each one handles one side of the flow
-- atomically inside a single function call — no multi-step client code, no
-- race between the two UPDATE statements:
--
--   rpc_transfer_part_to_van — store → van
--   rpc_return_part_to_store — van → store
--
-- Design notes baked into each function:
--
--  * Role check at the top: auth.uid() → users.role must be in
--    ('admin', 'admin_service', 'admin_store', 'supervisor'). Technicians
--    cannot invoke these directly — their flow is useVanStockPart() (for
--    consumption on a job) or the multi-step replenishment workflow (request
--    → Admin 2 approves → fulfil → tech confirms). This RPC is specifically
--    the Admin 2 one-step path.
--
--  * Row locks on both sides: SELECT ... FOR UPDATE on parts and
--    van_stock_items. Prevents concurrent admin transfers from over-drawing
--    stock. The functions run inside their own BEGIN..COMMIT so the locks
--    release cleanly at function exit.
--
--  * Upsert for brand-new parts: rpc_transfer_part_to_van accepts
--    p_van_stock_id + p_part_id (not an existing item_id) so that loading
--    a brand-new SKU onto a van works in one call. If (van_stock_id, part_id)
--    already exists, we increment its quantity; otherwise we INSERT a fresh
--    row with the requested quantity and the part's default min/max hints.
--
--  * Return-to-store leaves the row in place even when quantity hits zero.
--    The per-part config (min_quantity, max_quantity, is_core_item) is
--    meaningful even for a depleted item — deleting the row would lose that
--    configuration and force re-entry next time. Admin 2 can delete the row
--    explicitly via the existing van_stock_items CRUD if they really want to.
--
--  * A non-empty reason is mandatory. Goes into both inventory_movements.notes
--    (human-readable summary) and inventory_movements.adjustment_reason (raw
--    admin input, for auditors). An empty or whitespace-only reason is
--    rejected with a clear error.
--
--  * movement_type uses the existing 'transfer_to_van' / 'return_to_store'
--    values of the inventory_movement_type enum. No enum changes needed.
--
--  * The functions return the updated (or newly inserted) van_stock_items row
--    so the client can apply the optimistic update without a round-trip
--    re-fetch. Following the existing RPC-then-select pattern used by
--    increment_van_stock_quantity.

-- =====================================================================
-- 1. rpc_transfer_part_to_van — store → van
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rpc_transfer_part_to_van(
  p_part_id UUID,
  p_van_stock_id UUID,
  p_quantity NUMERIC,
  p_performed_by UUID,
  p_performed_by_name TEXT,
  p_reason TEXT
)
RETURNS van_stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_part RECORD;
  v_existing_item van_stock_items;
  v_new_item van_stock_items;
  v_new_store_qty INTEGER;
  v_new_van_qty NUMERIC;
BEGIN
  -- Validate inputs
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required for van stock transfers';
  END IF;

  -- Role check — only store admins and supervisors can move stock
  SELECT role INTO v_caller_role
    FROM users
   WHERE auth_id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'admin_service', 'admin_store', 'supervisor') THEN
    RAISE EXCEPTION 'Only store admins or supervisors can transfer stock to a van (role=%)', COALESCE(v_caller_role, 'unknown');
  END IF;

  -- Lock the central parts row and read current qty
  SELECT part_id, part_name, stock_quantity, container_quantity, bulk_quantity
    INTO v_part
    FROM parts
   WHERE part_id = p_part_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part % not found', p_part_id;
  END IF;

  IF COALESCE(v_part.stock_quantity, 0) < p_quantity THEN
    RAISE EXCEPTION 'Central stock has only % of part "%", cannot transfer %',
      COALESCE(v_part.stock_quantity, 0), v_part.part_name, p_quantity;
  END IF;

  -- Try to find an existing van_stock_items row for this (van, part)
  SELECT * INTO v_existing_item
    FROM van_stock_items
   WHERE van_stock_id = p_van_stock_id AND part_id = p_part_id
   FOR UPDATE;

  v_new_store_qty := v_part.stock_quantity - p_quantity::INTEGER;

  IF FOUND THEN
    -- Increment existing row
    v_new_van_qty := COALESCE(v_existing_item.quantity, 0) + p_quantity;
    UPDATE van_stock_items
       SET quantity = v_new_van_qty,
           last_replenished_at = NOW(),
           updated_at = NOW()
     WHERE item_id = v_existing_item.item_id
     RETURNING * INTO v_new_item;
  ELSE
    -- Insert a brand-new row. min/max default to 0 and the caller can edit later.
    v_new_van_qty := p_quantity;
    INSERT INTO van_stock_items (
      van_stock_id, part_id, quantity, min_quantity, max_quantity,
      is_core_item, last_replenished_at, created_at, updated_at
    ) VALUES (
      p_van_stock_id, p_part_id, p_quantity, 0, 0,
      false, NOW(), NOW(), NOW()
    )
    RETURNING * INTO v_new_item;
  END IF;

  -- Decrement central stock
  UPDATE parts
     SET stock_quantity = v_new_store_qty,
         updated_at = NOW()
   WHERE part_id = p_part_id;

  -- Log the movement
  INSERT INTO inventory_movements (
    part_id, movement_type, container_qty_change, bulk_qty_change,
    van_stock_id, van_stock_item_id, performed_by, performed_by_name,
    notes, adjustment_reason,
    store_container_qty_after, store_bulk_qty_after,
    van_container_qty_after, van_bulk_qty_after
  ) VALUES (
    p_part_id, 'transfer_to_van', -p_quantity::INTEGER, 0,
    p_van_stock_id, v_new_item.item_id, p_performed_by, p_performed_by_name,
    format('Transferred %s of "%s" from store to van', p_quantity, v_part.part_name),
    p_reason,
    v_new_store_qty, COALESCE(v_part.bulk_quantity, 0),
    v_new_van_qty::INTEGER, COALESCE(v_new_item.bulk_quantity, 0)
  );

  RETURN v_new_item;
END;
$$;

COMMENT ON FUNCTION public.rpc_transfer_part_to_van IS
  'Admin 2 Store one-click transfer of a part from the central warehouse into a van. Atomically decrements parts.stock_quantity, upserts van_stock_items (increments if (van,part) already exists, inserts otherwise), and logs an inventory_movements row with type=transfer_to_van. Role-gated to admin/admin_service/admin_store/supervisor. Reason is mandatory. Row locks prevent concurrent over-draws.';

-- =====================================================================
-- 2. rpc_return_part_to_store — van → store
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rpc_return_part_to_store(
  p_van_stock_item_id UUID,
  p_quantity NUMERIC,
  p_performed_by UUID,
  p_performed_by_name TEXT,
  p_reason TEXT
)
RETURNS van_stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_item van_stock_items;
  v_part RECORD;
  v_new_van_qty NUMERIC;
  v_new_store_qty INTEGER;
  v_updated_item van_stock_items;
BEGIN
  -- Validate inputs
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required for van stock returns';
  END IF;

  -- Role check
  SELECT role INTO v_caller_role
    FROM users
   WHERE auth_id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'admin_service', 'admin_store', 'supervisor') THEN
    RAISE EXCEPTION 'Only store admins or supervisors can return stock from a van (role=%)', COALESCE(v_caller_role, 'unknown');
  END IF;

  -- Lock the van_stock_items row and read current qty
  SELECT * INTO v_item
    FROM van_stock_items
   WHERE item_id = p_van_stock_item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Van stock item % not found', p_van_stock_item_id;
  END IF;

  IF COALESCE(v_item.quantity, 0) < p_quantity THEN
    RAISE EXCEPTION 'Van only has % of this part, cannot return %',
      COALESCE(v_item.quantity, 0), p_quantity;
  END IF;

  -- Lock the central parts row
  SELECT part_id, part_name, stock_quantity, container_quantity, bulk_quantity
    INTO v_part
    FROM parts
   WHERE part_id = v_item.part_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Central part row % not found (orphaned van item)', v_item.part_id;
  END IF;

  v_new_van_qty := v_item.quantity - p_quantity;
  v_new_store_qty := COALESCE(v_part.stock_quantity, 0) + p_quantity::INTEGER;

  -- Decrement van
  UPDATE van_stock_items
     SET quantity = v_new_van_qty,
         updated_at = NOW()
   WHERE item_id = p_van_stock_item_id
   RETURNING * INTO v_updated_item;

  -- Increment store
  UPDATE parts
     SET stock_quantity = v_new_store_qty,
         updated_at = NOW()
   WHERE part_id = v_item.part_id;

  -- Log the movement
  INSERT INTO inventory_movements (
    part_id, movement_type, container_qty_change, bulk_qty_change,
    van_stock_id, van_stock_item_id, performed_by, performed_by_name,
    notes, adjustment_reason,
    store_container_qty_after, store_bulk_qty_after,
    van_container_qty_after, van_bulk_qty_after
  ) VALUES (
    v_item.part_id, 'return_to_store', p_quantity::INTEGER, 0,
    v_item.van_stock_id, p_van_stock_item_id, p_performed_by, p_performed_by_name,
    format('Returned %s of "%s" from van to store', p_quantity, v_part.part_name),
    p_reason,
    v_new_store_qty, COALESCE(v_part.bulk_quantity, 0),
    v_new_van_qty::INTEGER, COALESCE(v_updated_item.bulk_quantity, 0)
  );

  RETURN v_updated_item;
END;
$$;

COMMENT ON FUNCTION public.rpc_return_part_to_store IS
  'Admin 2 Store one-click return of a part from a van back into the central warehouse. Atomically decrements van_stock_items.quantity, increments parts.stock_quantity, logs an inventory_movements row with type=return_to_store. Role-gated to admin/admin_service/admin_store/supervisor. Reason is mandatory. Leaves the van_stock_items row in place even if quantity reaches zero, preserving per-part configuration (min/max/is_core).';

-- =====================================================================
-- 3. Grants — allow authenticated users to call (role check is inside the function)
-- =====================================================================

GRANT EXECUTE ON FUNCTION public.rpc_transfer_part_to_van TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_return_part_to_store TO authenticated;

-- =====================================================================
-- 4. Post-apply sanity checks
-- =====================================================================

DO $$
DECLARE
  fn_in_exists BOOLEAN;
  fn_out_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rpc_transfer_part_to_van'
  ) INTO fn_in_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rpc_return_part_to_store'
  ) INTO fn_out_exists;

  IF NOT fn_in_exists THEN
    RAISE EXCEPTION 'Sanity check failed: rpc_transfer_part_to_van was not created';
  END IF;
  IF NOT fn_out_exists THEN
    RAISE EXCEPTION 'Sanity check failed: rpc_return_part_to_store was not created';
  END IF;
END;
$$;

-- 20260515_return_to_store_liquid_support.sql
--
-- Symmetric fix for `rpc_return_part_to_store` — the partner of
-- `rpc_transfer_part_to_van` had the same liquid-blind bug:
--
--   • Validates against `van_stock_items.quantity` only (= 0 for liquids;
--     real qty lives in `bulk_quantity` after the
--     trg_route_liquid_to_bulk_quantity trigger fires).
--   • Increments `parts.stock_quantity` only on return (= 0 for liquids;
--     real central stock is `container_quantity * container_size +
--     bulk_quantity`).
--
-- This rewrites the RPC to branch on `parts.is_liquid`:
--
--   For LIQUID parts:
--     1) Compute van's available liters:
--          van_avail = container_quantity * container_size + bulk_quantity
--        (Van containers exist when an admin returned a whole container
--        previously and the route-trigger preserved it. Most liquid van
--        rows have 0 containers and a `bulk_quantity` > 0.)
--     2) Validate van_avail >= requested.
--     3) Decrement van using container-breaking math (same logic as
--        the central side in 20260515_transfer_to_van_liquid_support).
--     4) Increment central stock by adding p_quantity to
--        parts.bulk_quantity. We DO NOT auto-package returned liters
--        back into containers — when a technician returns loose oil
--        from a van to the store, it stays loose. The store admin can
--        manually consolidate via Adjust Stock if needed.
--
--   For NON-LIQUID parts:
--     Keep the exact existing behaviour byte-for-byte.

CREATE OR REPLACE FUNCTION public.rpc_return_part_to_store(
  p_van_stock_item_id uuid,
  p_quantity          numeric,
  p_performed_by      uuid,
  p_performed_by_name text,
  p_reason            text
)
RETURNS van_stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_role     TEXT;
  v_item            van_stock_items;
  v_part            RECORD;
  v_new_van_qty     NUMERIC;
  v_new_store_qty   INTEGER;
  v_updated_item    van_stock_items;

  -- Liquid bookkeeping
  v_is_liquid          BOOLEAN;
  v_van_avail          NUMERIC;
  v_new_van_container  INTEGER;
  v_new_van_bulk       NUMERIC;
  v_containers_broken  INTEGER;
  v_deficit            NUMERIC;
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

  -- Lock the van_stock_items row
  SELECT * INTO v_item
    FROM van_stock_items
   WHERE item_id = p_van_stock_item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Van stock item % not found', p_van_stock_item_id;
  END IF;

  -- Lock the central parts row
  SELECT part_id, part_name, is_liquid,
         stock_quantity, container_quantity, container_size, bulk_quantity
    INTO v_part
    FROM parts
   WHERE part_id = v_item.part_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Central part row % not found (orphaned van item)', v_item.part_id;
  END IF;

  v_is_liquid := COALESCE(v_part.is_liquid, FALSE);

  -- ══════════════════════════════════════════════════════════════════
  -- Validate + decrement van side
  -- ══════════════════════════════════════════════════════════════════
  IF v_is_liquid THEN
    v_van_avail := (COALESCE(v_item.container_quantity, 0) * COALESCE(v_part.container_size, 0))
                 + COALESCE(v_item.bulk_quantity, 0);

    IF v_van_avail < p_quantity THEN
      RAISE EXCEPTION 'Van has only %L of liquid part "%", cannot return %L',
        v_van_avail, v_part.part_name, p_quantity;
    END IF;

    -- Container-breaking math on the van side
    IF COALESCE(v_item.bulk_quantity, 0) >= p_quantity THEN
      v_new_van_container := COALESCE(v_item.container_quantity, 0);
      v_new_van_bulk      := COALESCE(v_item.bulk_quantity, 0) - p_quantity;
      v_containers_broken := 0;
    ELSE
      v_deficit := p_quantity - COALESCE(v_item.bulk_quantity, 0);
      IF COALESCE(v_part.container_size, 0) <= 0 THEN
        RAISE EXCEPTION 'Cannot return %L of liquid part "%": insufficient van bulk (%L) and container_size is not configured',
          p_quantity, v_part.part_name, COALESCE(v_item.bulk_quantity, 0);
      END IF;
      v_containers_broken := CEIL(v_deficit / v_part.container_size)::INTEGER;
      v_new_van_container := COALESCE(v_item.container_quantity, 0) - v_containers_broken;
      v_new_van_bulk      := (v_containers_broken * v_part.container_size) - v_deficit;
    END IF;

    UPDATE van_stock_items
       SET quantity           = 0,                       -- liquid: keep at 0 (trigger contract)
           container_quantity = v_new_van_container,
           bulk_quantity      = v_new_van_bulk,
           updated_at         = NOW()
     WHERE item_id = p_van_stock_item_id
     RETURNING * INTO v_updated_item;

    v_new_van_qty := v_new_van_bulk;
  ELSE
    -- Non-liquid: validate + decrement on quantity only
    IF COALESCE(v_item.quantity, 0) < p_quantity THEN
      RAISE EXCEPTION 'Van only has % of this part, cannot return %',
        COALESCE(v_item.quantity, 0), p_quantity;
    END IF;
    v_new_van_qty := v_item.quantity - p_quantity;
    UPDATE van_stock_items
       SET quantity   = v_new_van_qty,
           updated_at = NOW()
     WHERE item_id = p_van_stock_item_id
     RETURNING * INTO v_updated_item;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- Increment central stock
  --   Liquids → add to parts.bulk_quantity (loose, not packaged).
  --   Solids  → keep legacy stock_quantity behaviour.
  -- ══════════════════════════════════════════════════════════════════
  IF v_is_liquid THEN
    UPDATE parts
       SET bulk_quantity = COALESCE(bulk_quantity, 0) + p_quantity,
           updated_at    = NOW()
     WHERE part_id = v_item.part_id;
    v_new_store_qty := COALESCE(v_part.stock_quantity, 0);  -- unchanged
  ELSE
    v_new_store_qty := COALESCE(v_part.stock_quantity, 0) + p_quantity::INTEGER;
    UPDATE parts
       SET stock_quantity = v_new_store_qty,
           updated_at     = NOW()
     WHERE part_id = v_item.part_id;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- Audit log
  -- ══════════════════════════════════════════════════════════════════
  INSERT INTO inventory_movements (
    part_id, movement_type,
    container_qty_change, bulk_qty_change,
    van_stock_id, van_stock_item_id,
    performed_by, performed_by_name,
    notes, adjustment_reason,
    store_container_qty_after, store_bulk_qty_after,
    van_container_qty_after,   van_bulk_qty_after
  ) VALUES (
    v_item.part_id, 'return_to_store',
    CASE WHEN v_is_liquid THEN 0 ELSE p_quantity::INTEGER END,
    CASE WHEN v_is_liquid THEN p_quantity ELSE 0 END,
    v_item.van_stock_id, p_van_stock_item_id,
    p_performed_by, p_performed_by_name,
    format('Returned %s of "%s" from van to store', p_quantity, v_part.part_name),
    p_reason,
    COALESCE(v_part.container_quantity, 0)::INTEGER,
    CASE WHEN v_is_liquid THEN COALESCE(v_part.bulk_quantity, 0) + p_quantity
         ELSE COALESCE(v_part.bulk_quantity, 0) END,
    v_new_van_container,
    v_new_van_bulk
  );

  RETURN v_updated_item;
END;
$function$;

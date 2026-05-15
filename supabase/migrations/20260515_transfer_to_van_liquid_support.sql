-- 20260515_transfer_to_van_liquid_support.sql
--
-- Problem
-- -------
-- Client report (S-01044 GRANTT ATF DEX-III [18L], "LUBRICAN"):
--   Inventory shows 270L available.
--   "Transfer to Van" modal shows 0L available.
--
-- Root cause (DB layer): `rpc_transfer_part_to_van` is completely liquid-
-- blind. It validates `IF v_part.stock_quantity < p_quantity` and decrements
-- only `parts.stock_quantity`. For liquid parts, `stock_quantity` is 0 by
-- convention — actual liquid stock lives in
--   container_quantity × container_size + bulk_quantity
-- So every transfer of a liquid part would either fail validation OR
-- silently drive stock_quantity negative without touching the real values.
--
-- This migration rewrites the RPC to branch on `parts.is_liquid`:
--
--   • For NON-liquid parts: keep the exact existing behaviour
--     (decrement stock_quantity, validate against it).
--
--   • For liquid parts:
--       1) Compute total available liters
--            available = container_quantity × container_size + bulk_quantity
--       2) Validate available ≥ requested quantity (interpreted as liters).
--       3) Decrement using container-breaking math:
--            – If bulk_quantity ≥ requested: just subtract from bulk.
--            – Else: open just enough containers to cover the deficit.
--              containers_to_break = CEIL((requested − bulk_quantity) / container_size)
--              new_container_qty   = container_quantity − containers_to_break
--              new_bulk_qty        = (containers_to_break × container_size)
--                                    − (requested − bulk_quantity)
--       4) Log to inventory_movements with proper container_qty_change /
--          bulk_qty_change so the audit trail reflects what actually moved.
--
-- The van side already handles liquids correctly: the existing trigger
-- `trg_route_liquid_to_bulk_quantity` (route_liquid_to_bulk_quantity)
-- intercepts INSERT/UPDATE on van_stock_items and reroutes a positive
-- `quantity` for liquid parts into `bulk_quantity`. So we still write
-- `quantity = p_quantity` to van_stock_items here and let the trigger
-- handle the routing on liquid parts.
--
-- Backward compatibility
-- ----------------------
-- Non-liquid transfers continue to work byte-identically — the function
-- still decrements `parts.stock_quantity` on solids and logs the movement
-- the same way.

CREATE OR REPLACE FUNCTION public.rpc_transfer_part_to_van(
  p_part_id          uuid,
  p_van_stock_id     uuid,
  p_quantity         numeric,
  p_performed_by     uuid,
  p_performed_by_name text,
  p_reason           text
)
RETURNS van_stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_role     TEXT;
  v_part            RECORD;
  v_existing_item   van_stock_items;
  v_new_item        van_stock_items;
  v_new_van_qty     NUMERIC;

  -- Liquid bookkeeping
  v_is_liquid          BOOLEAN;
  v_avail_total        NUMERIC;
  v_new_store_stock_qty INTEGER;
  v_new_container_qty   INTEGER;
  v_new_bulk_qty        NUMERIC;
  v_containers_broken   INTEGER;
  v_deficit             NUMERIC;
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

  -- Lock the central parts row and read everything we may need
  SELECT part_id, part_name, is_liquid,
         stock_quantity, container_quantity, container_size, bulk_quantity
    INTO v_part
    FROM parts
   WHERE part_id = p_part_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part % not found', p_part_id;
  END IF;

  v_is_liquid := COALESCE(v_part.is_liquid, FALSE);

  -- ══════════════════════════════════════════════════════════════════
  -- Stock validation + decrement plan
  -- ══════════════════════════════════════════════════════════════════
  IF v_is_liquid THEN
    -- Total available in base units (liters). container_size is the per-
    -- container volume; falling back to 0 means treat all stock as bulk.
    v_avail_total := (COALESCE(v_part.container_quantity, 0) * COALESCE(v_part.container_size, 0))
                   + COALESCE(v_part.bulk_quantity, 0);

    IF v_avail_total < p_quantity THEN
      RAISE EXCEPTION 'Central stock has only %L of liquid part "%", cannot transfer %L',
        v_avail_total, v_part.part_name, p_quantity;
    END IF;

    -- Container-breaking math
    IF COALESCE(v_part.bulk_quantity, 0) >= p_quantity THEN
      -- Sufficient loose bulk — no need to open a container.
      v_new_container_qty := COALESCE(v_part.container_quantity, 0);
      v_new_bulk_qty      := COALESCE(v_part.bulk_quantity, 0) - p_quantity;
      v_containers_broken := 0;
    ELSE
      -- Need to break open container(s) to cover the deficit.
      v_deficit := p_quantity - COALESCE(v_part.bulk_quantity, 0);

      IF COALESCE(v_part.container_size, 0) <= 0 THEN
        RAISE EXCEPTION 'Cannot transfer %L of liquid part "%": insufficient bulk (%L) and container_size is not configured',
          p_quantity, v_part.part_name, COALESCE(v_part.bulk_quantity, 0);
      END IF;

      v_containers_broken := CEIL(v_deficit / v_part.container_size)::INTEGER;
      v_new_container_qty := COALESCE(v_part.container_quantity, 0) - v_containers_broken;
      v_new_bulk_qty      := (v_containers_broken * v_part.container_size) - v_deficit;
    END IF;

    -- stock_quantity stays at 0 for liquid parts (legacy column).
    v_new_store_stock_qty := COALESCE(v_part.stock_quantity, 0);
  ELSE
    -- Non-liquid path — same logic as before.
    IF COALESCE(v_part.stock_quantity, 0) < p_quantity THEN
      RAISE EXCEPTION 'Central stock has only % of part "%", cannot transfer %',
        COALESCE(v_part.stock_quantity, 0), v_part.part_name, p_quantity;
    END IF;
    v_new_store_stock_qty := v_part.stock_quantity - p_quantity::INTEGER;
    v_new_container_qty   := COALESCE(v_part.container_quantity, 0);
    v_new_bulk_qty        := COALESCE(v_part.bulk_quantity, 0);
    v_containers_broken   := 0;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- Van side: insert or increment. The route_liquid_to_bulk_quantity
  -- BEFORE trigger reroutes `quantity` → `bulk_quantity` for liquids on
  -- INSERT/UPDATE, so we can keep writing `quantity = p_quantity` here.
  -- ══════════════════════════════════════════════════════════════════
  SELECT * INTO v_existing_item
    FROM van_stock_items
   WHERE van_stock_id = p_van_stock_id AND part_id = p_part_id
   FOR UPDATE;

  IF FOUND THEN
    v_new_van_qty := COALESCE(v_existing_item.quantity, 0) + p_quantity;
    UPDATE van_stock_items
       SET quantity = v_new_van_qty,
           last_replenished_at = NOW(),
           updated_at = NOW()
     WHERE item_id = v_existing_item.item_id
     RETURNING * INTO v_new_item;
  ELSE
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

  -- ══════════════════════════════════════════════════════════════════
  -- Persist the central-stock decrement
  -- ══════════════════════════════════════════════════════════════════
  UPDATE parts
     SET stock_quantity     = v_new_store_stock_qty,
         container_quantity = v_new_container_qty,
         bulk_quantity      = v_new_bulk_qty,
         updated_at         = NOW()
   WHERE part_id = p_part_id;

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
    p_part_id, 'transfer_to_van',
    CASE WHEN v_is_liquid THEN -v_containers_broken ELSE -p_quantity::INTEGER END,
    CASE WHEN v_is_liquid THEN (v_new_bulk_qty - COALESCE(v_part.bulk_quantity, 0)) ELSE 0 END,
    p_van_stock_id, v_new_item.item_id,
    p_performed_by, p_performed_by_name,
    format('Transferred %s of "%s" from store to van', p_quantity, v_part.part_name),
    p_reason,
    v_new_container_qty,
    v_new_bulk_qty,
    COALESCE(v_new_item.container_quantity, 0)::INTEGER,
    COALESCE(v_new_item.bulk_quantity, 0)
  );

  RETURN v_new_item;
END;
$function$;

-- Sanity check on a known liquid part
DO $$
DECLARE
  v_avail NUMERIC;
BEGIN
  SELECT (container_quantity * container_size + bulk_quantity)
    INTO v_avail
    FROM parts WHERE part_code = 'S-01044';
  RAISE NOTICE 'S-01044 available liters via liquid math = %', v_avail;
END $$;

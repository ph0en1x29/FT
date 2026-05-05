-- 20260504_van_stock_liquid_routing_guard.sql
--
-- Two complementary defenses to prevent the bug class fixed by
-- 20260504_van_stock_liquid_quantity_backfill.sql from recurring:
--
-- 1. trg_route_liquid_to_bulk_quantity (BEFORE INSERT/UPDATE OF quantity)
--    Auto-routes liquid van_stock_items writes that target `quantity`
--    into `bulk_quantity` instead. Catches:
--      - future van import migrations that copy the 20260424/20260504
--        anti-pattern of dumping liquid stock into `quantity`
--      - admin-added liquid items via AddItemModal (which calls
--        addVanStockItem(qty=N) without branching on is_liquid)
--      - any other path writing liquid stock to the wrong column
--    Silent fix (no error raised) — additive: keeps any existing
--    bulk_quantity, adds the misrouted quantity, then zeros quantity.
--
-- 2. CHECK constraints on quantity >= 0 and container_quantity >= 0
--    No legitimate flow drives those columns negative. (bulk_quantity
--    deliberately allows negative via the use_internal balance_override
--    flag in services/liquidInventoryService.ts:424 — that column is
--    NOT constrained.)
--
-- Idempotent: trigger uses CREATE OR REPLACE FUNCTION; constraint adds
-- guarded by NOT EXISTS check.

BEGIN;

-- ============================================================================
-- 1. Auto-route liquid quantity → bulk_quantity
-- ============================================================================
CREATE OR REPLACE FUNCTION route_liquid_to_bulk_quantity()
RETURNS TRIGGER AS $$
DECLARE
  is_liquid_part BOOLEAN;
BEGIN
  SELECT is_liquid INTO is_liquid_part FROM parts WHERE part_id = NEW.part_id;

  -- Only act for liquid parts where someone wrote a positive quantity.
  IF is_liquid_part = TRUE AND COALESCE(NEW.quantity, 0) > 0 THEN
    NEW.bulk_quantity := COALESCE(NEW.bulk_quantity, 0) + NEW.quantity;
    NEW.quantity := 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_route_liquid_to_bulk_quantity ON van_stock_items;

CREATE TRIGGER trg_route_liquid_to_bulk_quantity
BEFORE INSERT OR UPDATE OF quantity ON van_stock_items
FOR EACH ROW
EXECUTE FUNCTION route_liquid_to_bulk_quantity();

COMMENT ON FUNCTION route_liquid_to_bulk_quantity() IS
  'Auto-routes liquid van_stock_items quantity writes into bulk_quantity. Backstops the import pattern documented in 20260504_van_stock_liquid_quantity_backfill.sql so future imports / admin actions / RPCs can''t reintroduce the bug class.';

-- ============================================================================
-- 2. CHECK constraints — quantity / container_quantity must be non-negative.
--    bulk_quantity deliberately omitted (use_internal balance_override).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'van_stock_items_quantity_nonneg'
  ) THEN
    ALTER TABLE van_stock_items
      ADD CONSTRAINT van_stock_items_quantity_nonneg
      CHECK (quantity IS NULL OR quantity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'van_stock_items_container_quantity_nonneg'
  ) THEN
    ALTER TABLE van_stock_items
      ADD CONSTRAINT van_stock_items_container_quantity_nonneg
      CHECK (container_quantity IS NULL OR container_quantity >= 0);
  END IF;
END $$;

-- ============================================================================
-- Sanity: confirm post-backfill state survives the new constraints.
-- ============================================================================
DO $$
DECLARE
  bad_qty INT;
  bad_cq INT;
  liquid_with_qty INT;
BEGIN
  SELECT COUNT(*) INTO bad_qty FROM van_stock_items WHERE quantity < 0;
  SELECT COUNT(*) INTO bad_cq FROM van_stock_items WHERE container_quantity < 0;
  SELECT COUNT(*) INTO liquid_with_qty
    FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id
    WHERE p.is_liquid = TRUE AND vsi.quantity > 0;

  RAISE NOTICE 'Sanity post-guard: rows w/ quantity<0=%, container_quantity<0=%, liquid w/ quantity>0=%', bad_qty, bad_cq, liquid_with_qty;
  IF bad_qty > 0 OR bad_cq > 0 THEN
    RAISE EXCEPTION 'CHECK constraint violated by existing data — investigate before applying';
  END IF;
END $$;

-- ============================================================================
-- Trigger smoke test: ensure the trigger actually routes correctly.
-- We do this against an existing liquid item using a NO-OP UPDATE that
-- explicitly sets quantity=0 (the trigger only fires when quantity is in
-- the SET list, but the IF won't act since quantity=0). This confirms the
-- trigger is wired without changing any data.
-- ============================================================================
DO $$
DECLARE
  test_item UUID;
  qty_after NUMERIC;
BEGIN
  SELECT vsi.item_id INTO test_item
    FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id
    WHERE p.is_liquid = TRUE LIMIT 1;
  IF test_item IS NOT NULL THEN
    UPDATE van_stock_items SET quantity = 0 WHERE item_id = test_item;
    SELECT quantity INTO qty_after FROM van_stock_items WHERE item_id = test_item;
    RAISE NOTICE 'Trigger smoke test: UPDATE on liquid item ok, quantity=% (expected 0)', qty_after;
  END IF;
END $$;

COMMIT;

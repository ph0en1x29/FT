-- 20260504_van_stock_liquid_quantity_backfill.sql
--
-- Backfills liquid van_stock_items rows seeded by 20260424_van_stock_6_vans_initial
-- and 20260504_van_stock_3_vans_addition migrations. Both imports populated
-- only `quantity` for every row, regardless of liquid/non-liquid — but for
-- liquid SKUs the runtime tracking uses `container_quantity` and
-- `bulk_quantity` (dual-unit math). After the imports a separate process
-- duplicated `quantity` into `bulk_quantity` for SOME rows but not all.
-- The result is three different broken states across the same column pair:
--
--   STATE A (11 rows on 3 vans imported 2026-05-04):
--     qty>0, bq=0, no movements. Time bomb — first job consuming any
--     liquid would drive bq negative.
--
--   STATE B (18 rows, no movements):
--     qty>0, bq=qty (duplicate). The two columns hold the same physical
--     stock; using both would double-count.
--
--   STATE C (1 row, VEW 9631 S-01925, 3 use_internal movements):
--     qty=32, bq=24, sum_of_movements=-8. bq started at qty (32) and
--     was reduced by movements (-8 → 24). Truth = current bq.
--
--   STATE D (2 rows on VFG 7238 / HAFIZ, 5 use_internal movements):
--     qty=20/32, bq=-7/-9, sum_of_movements=-7/-9. bq started at 0
--     (NOT at qty) and was reduced by job consumption. Truth = qty + bq.
--
-- DETERMINISTIC HEURISTIC distinguishing C from D:
--   compute s = SUM(bulk_qty_change) over inventory_movements for the row.
--   IF |bq − s| ≤ 2  → bq tracks movements only (started at 0). Truth = qty + bq.
--                       Catches D (bq=-7, s=-8 → diff 1) and A (bq=0, s=NULL→0 → diff 0).
--   ELSE             → bq has seed component (started at qty or higher). Truth = bq.
--                       Catches B (bq=N, s=NULL→0 → diff N) and C (bq=24, s=-8 → diff 32).
--
-- Tolerance of 2 covers the audit-log inconsistency observed on VFG 7238
-- SHELL TELLUS (sum_of_movements=-8 but bq=-7 — one duplicate audit row
-- that didn't update the running balance).
--
-- POST-CONDITION FOR EVERY LIQUID ROW: quantity = 0; bulk_quantity holds
-- the canonical current stock in base units (liters).
--
-- ============================================================================
-- TEMPLATE FOR FUTURE LIQUID IMPORTS:
-- ============================================================================
-- For new van imports, branch on parts.is_liquid:
--   non-liquid → INSERT (quantity = N, container_quantity = 0, bulk_quantity = 0)
--   liquid     → INSERT (quantity = 0, container_quantity = 0, bulk_quantity = N)
-- Don't repeat the 20260424/20260504 mistake of dumping liquid stock into
-- `quantity`. The runtime tracking only sees `container_quantity` and
-- `bulk_quantity`.
-- ============================================================================

BEGIN;

-- Pre-migration audit log
DO $$
DECLARE
  state_a INT; state_b INT; state_c INT; state_d INT;
BEGIN
  SELECT COUNT(*) INTO state_a
    FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id
    WHERE p.is_liquid AND vsi.quantity > 0 AND COALESCE(vsi.bulk_quantity,0) = 0;
  SELECT COUNT(*) INTO state_b
    FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id
    WHERE p.is_liquid AND vsi.quantity > 0 AND vsi.bulk_quantity > 0
      AND NOT EXISTS (SELECT 1 FROM inventory_movements im WHERE im.van_stock_item_id = vsi.item_id);
  SELECT COUNT(*) INTO state_c
    FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id
    WHERE p.is_liquid AND vsi.quantity > 0 AND vsi.bulk_quantity > 0
      AND EXISTS (SELECT 1 FROM inventory_movements im WHERE im.van_stock_item_id = vsi.item_id);
  SELECT COUNT(*) INTO state_d
    FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id
    WHERE p.is_liquid AND vsi.quantity > 0 AND vsi.bulk_quantity < 0;
  RAISE NOTICE 'PRE: state_a=% state_b=% state_c=% state_d=% (total to fix=%)', state_a, state_b, state_c, state_d, state_a+state_b+state_c+state_d;
END $$;

-- The corrective UPDATE: per-row decision based on movement sum.
UPDATE van_stock_items vsi
SET bulk_quantity = CASE
      WHEN ABS(
        COALESCE(vsi.bulk_quantity, 0)
        - COALESCE((SELECT SUM(bulk_qty_change) FROM inventory_movements im WHERE im.van_stock_item_id = vsi.item_id), 0)
      ) <= 2
        THEN COALESCE(vsi.bulk_quantity, 0) + vsi.quantity
      ELSE vsi.bulk_quantity
    END,
    quantity = 0,
    updated_at = NOW()
FROM parts p
WHERE p.part_id = vsi.part_id
  AND p.is_liquid = TRUE
  AND vsi.quantity > 0;

-- Post-migration validation
DO $$
DECLARE
  residual_qty INT;
  still_negative INT;
  with_stock INT;
BEGIN
  SELECT COUNT(*) INTO residual_qty
    FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id
    WHERE p.is_liquid AND vsi.quantity > 0;
  SELECT COUNT(*) INTO still_negative
    FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id
    WHERE p.is_liquid AND vsi.bulk_quantity < 0;
  SELECT COUNT(*) INTO with_stock
    FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id
    WHERE p.is_liquid AND vsi.bulk_quantity > 0;
  RAISE NOTICE 'POST: residual_qty=% still_negative=% with_real_stock=%', residual_qty, still_negative, with_stock;
  IF residual_qty > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % liquid rows still have quantity>0', residual_qty;
  END IF;
END $$;

COMMIT;

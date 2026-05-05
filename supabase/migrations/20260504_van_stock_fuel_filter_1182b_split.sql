-- 20260504_van_stock_fuel_filter_1182b_split.sql
--
-- Splits the merged FUEL FILTER 1182 row into its two distinct catalog SKUs
-- on 5 vans where the 20260424_van_stock_6_vans_initial.sql import had
-- summed both Excel codes (`23303-64010` and `23303-64010 B`) into a single
-- van_stock_items row pointing at part_code `23303-64010`.
--
-- ============================================================================
-- BACKGROUND (2026-05-04 client clarification)
-- ============================================================================
-- Shin sent a screenshot of his Excel checklist (rows 37 & 38) showing the
-- two are different physical SKUs:
--   - 23303-64010   FUEL FILTER 1182             RM 11.60
--   - 23303-64010 B FUEL FILTER 1182 @ NISSIN    RM 10.50  (different supplier)
--
-- The catalog already has them as separate parts:
--   - part_code = '23303-64010'   FUEL FILTER 1182             cost_price 11.60
--   - part_code = '23303-64010B'  FUEL FILTER 1182B @ NISSIN   cost_price 10.50
--
-- The 20260424 import handled this incorrectly: it dropped the B variant on
-- 5 vans and folded the qty into the non-B row. The 20260504 import got it
-- right (3 vans BRK 3280, FA 8326, MDT 6631 each have separate B rows in DB).
--
-- This migration fixes the 5 affected vans by:
--   1) Decrementing the existing 23303-64010 row by the Excel B qty
--   2) Inserting a new 23303-64010B row at the Excel B qty
-- Net total per van is unchanged — we're just splitting one merged row into
-- two correct rows.
--
-- Source of truth: parsed from /home/jay/Downloads/Ft/<TECH> <PLATE>.xlsx
-- via openpyxl on 2026-05-04, cross-verified against the screenshot Shin
-- provided.
-- ============================================================================

BEGIN;

-- Pre-fix audit
DO $$
DECLARE
  affected_count INT;
BEGIN
  SELECT COUNT(*) INTO affected_count
    FROM van_stock_items vsi
    JOIN parts p ON p.part_id = vsi.part_id
    JOIN van_stocks vs ON vs.van_stock_id = vsi.van_stock_id
    WHERE p.part_code = '23303-64010'
      AND vs.van_plate IN ('BNX8936','FA 9238','VEW 9631','VEW8236','VFG 7238');
  RAISE NOTICE 'PRE: % rows on 5 affected vans currently point at 23303-64010 (will be split).', affected_count;
END $$;

-- Step 1: decrement the existing 23303-64010 row by the Excel-B qty per van.
-- (Per-van adjustments because the B qty differs.)
WITH adjustments(plate, b_qty) AS (
  VALUES
    ('BNX8936'::TEXT, 1::INTEGER),
    ('FA 9238',  3),
    ('VEW 9631', 1),
    ('VEW8236',  1),
    ('VFG 7238', 2)
)
UPDATE van_stock_items vsi
SET quantity = vsi.quantity - adj.b_qty,
    updated_at = NOW()
FROM adjustments adj, van_stocks vs, parts p
WHERE vs.van_plate = adj.plate
  AND vsi.van_stock_id = vs.van_stock_id
  AND vsi.part_id = p.part_id
  AND p.part_code = '23303-64010';

-- Step 2: INSERT a new 23303-64010B row per affected van at the Excel-B qty.
-- (van_stock_items has UNIQUE(van_stock_id, part_id) — these vans don't have
-- the B row yet so insertion is safe.)
WITH new_rows(plate, b_qty) AS (
  VALUES
    ('BNX8936'::TEXT, 1::INTEGER),
    ('FA 9238',  3),
    ('VEW 9631', 1),
    ('VEW8236',  1),
    ('VFG 7238', 2)
)
INSERT INTO van_stock_items (
  van_stock_id, part_id, quantity, min_quantity, max_quantity,
  is_core_item, container_quantity, bulk_quantity
)
SELECT
  vs.van_stock_id,
  p.part_id,
  nr.b_qty,
  1, 5,           -- min/max defaults matching the prior import pattern
  TRUE,
  0, 0
FROM new_rows nr
JOIN van_stocks vs ON vs.van_plate = nr.plate
JOIN parts p ON p.part_code = '23303-64010B';

-- Post-fix verification
DO $$
DECLARE
  v RECORD;
  total_a INT; total_b INT;
BEGIN
  RAISE NOTICE 'POST per-van verification (target = Excel qtys):';
  FOR v IN
    SELECT vs.van_plate,
           COALESCE((SELECT vsi.quantity FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id WHERE p.part_code = '23303-64010' AND vsi.van_stock_id = vs.van_stock_id), 0) AS a_qty,
           COALESCE((SELECT vsi.quantity FROM van_stock_items vsi JOIN parts p ON p.part_id = vsi.part_id WHERE p.part_code = '23303-64010B' AND vsi.van_stock_id = vs.van_stock_id), 0) AS b_qty
    FROM van_stocks vs
    WHERE vs.van_plate IN ('BNX8936','FA 9238','VEW 9631','VEW8236','VFG 7238')
    ORDER BY vs.van_plate
  LOOP
    RAISE NOTICE '  %  → A=%, B=%', v.van_plate, v.a_qty, v.b_qty;
  END LOOP;
END $$;

COMMIT;

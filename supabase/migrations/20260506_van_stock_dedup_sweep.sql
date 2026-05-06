-- 2026-05-06 — Sweep duplicate van_stock_usage rows from the dual-deduction bug.
-- Client report (Shin, 5/6 4:03 AM, JOB-260506-021): 3 pcs used but 6 deducted.
-- Cause: every van-stock usage today double-fires —
--   (1) services/vanStockUsageService.useVanStockPart inserts a usage row + decrements quantity,
--   (2) trigger_deduct_van_stock (on job_parts INSERT) inserts another usage row + decrements again.
-- Both rows are real but the second decrement is the bug. Trigger gets dropped in a later PR;
-- this migration cleans the existing duplicates so users see correct stock now.
--
-- Strategy:
--  • Pair candidates: same (job_id, van_stock_item_id, quantity_used) within 5s,
--    one row with job_part_id IS NULL (service), one with job_part_id IS NOT NULL (trigger).
--  • Refund quantity_used per pair to van_stock_items.quantity (the trigger's extra decrement).
--  • Delete the service-side row (job_part_id IS NULL). Keep the trigger row — it has the
--    proper FK back to job_parts and matches the future RPC's output shape.
--  • Liquid pairs: separate logic (would write to bulk_quantity), but live count = 0 today.
--    Migration aborts if any appear, since untested.
--  • inventory_movements untouched (only the service writes there; one row per use is correct).

BEGIN;
SET LOCAL statement_timeout = '120s';

CREATE TEMP TABLE _dup_pairs ON COMMIT DROP AS
SELECT svc.usage_id      AS svc_id,
       trg.usage_id      AS trg_id,
       svc.van_stock_item_id,
       svc.quantity_used,
       p.is_liquid
  FROM van_stock_usage svc
  JOIN van_stock_usage trg
    ON trg.van_stock_item_id = svc.van_stock_item_id
   AND trg.job_id            = svc.job_id
   AND trg.quantity_used     = svc.quantity_used
   AND trg.usage_id         <> svc.usage_id
   AND ABS(EXTRACT(EPOCH FROM (trg.used_at - svc.used_at))) < 5
  JOIN van_stock_items vsi ON vsi.item_id = svc.van_stock_item_id
  JOIN parts p             ON p.part_id   = vsi.part_id
 WHERE svc.job_part_id IS NULL
   AND trg.job_part_id IS NOT NULL;

-- Pre-flight: report counts and abort on liquids (untested branch).
DO $$
DECLARE n_pairs INTEGER; n_liquid INTEGER; n_solid_qty NUMERIC;
BEGIN
  SELECT COUNT(*) INTO n_pairs   FROM _dup_pairs;
  SELECT COUNT(*) INTO n_liquid  FROM _dup_pairs WHERE is_liquid;
  SELECT COALESCE(SUM(quantity_used),0) INTO n_solid_qty FROM _dup_pairs WHERE NOT is_liquid;
  RAISE NOTICE 'dup pairs: total=% liquid=% solid_qty=%', n_pairs, n_liquid, n_solid_qty;
  IF n_liquid > 0 THEN
    RAISE EXCEPTION 'Liquid dup pairs found (%)— refund formula needs container/bulk math; abort.', n_liquid;
  END IF;
END $$;

-- Refund the extra decrement (sum per item).
WITH refund AS (
  SELECT van_stock_item_id, SUM(quantity_used) AS qty
    FROM _dup_pairs
   GROUP BY van_stock_item_id
)
UPDATE van_stock_items vsi
   SET quantity   = quantity + r.qty,
       updated_at = NOW()
  FROM refund r
 WHERE vsi.item_id = r.van_stock_item_id;

-- Delete the service-side rows.
DELETE FROM van_stock_usage
 WHERE usage_id IN (SELECT svc_id FROM _dup_pairs);

-- Post-check: zero remaining same-tuple-within-5s pairs.
DO $$
DECLARE n_remain INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_remain
    FROM van_stock_usage a
    JOIN van_stock_usage b
      ON b.van_stock_item_id = a.van_stock_item_id
     AND b.job_id            = a.job_id
     AND b.quantity_used     = a.quantity_used
     AND b.usage_id         <> a.usage_id
     AND ABS(EXTRACT(EPOCH FROM (a.used_at - b.used_at))) < 5
   WHERE a.job_part_id IS NULL AND b.job_part_id IS NOT NULL;
  IF n_remain <> 0 THEN
    RAISE EXCEPTION 'Post-check: % unhandled dup pairs remain', n_remain;
  END IF;
END $$;

COMMIT;

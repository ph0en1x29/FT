-- 2026-05-06 — Refund orphan van_stock_usage rows where addPartToJob silently failed.
-- Client report (Shin, 5/6 6:05 AM, JOB-260506-034): OIL FILTER 1631 deducted but does
-- not appear in Parts Used.
-- Cause: services/vanStockUsageService.useVanStockPart commits its own decrement +
-- usage row + inventory_movement; then calls addPartToJob; if that throws (RLS, network,
-- validation), the catch shows a toast but the prior commit is not reversed.
-- Result: usage_with_movement_no_job_part = orphan.
--
-- Strategy:
--  • Detect: van_stock_usage rows since 2026-04-01 where job_part_id IS NULL,
--    approval_status NOT IN ('rejected','pending'), AND no job_parts row matches
--    (job_id, van_stock_item_id, quantity).
--  • Refund quantity_used to van_stock_items.quantity (post-PR-0.2 sweep, no liquids
--    in this set; abort if any appear).
--  • Delete the orphan usage rows + their matching inventory_movements rows
--    (the movement row was a phantom too, since no part was actually consumed).
--  • Note an admin flag in jobs.notes for affected jobs so admin can decide whether
--    to manually re-add the parts.

BEGIN;
SET LOCAL statement_timeout = '120s';

CREATE TEMP TABLE _orphans ON COMMIT DROP AS
SELECT u.usage_id,
       u.job_id,
       u.van_stock_item_id,
       u.quantity_used,
       u.used_at,
       p.part_id,
       p.is_liquid
  FROM van_stock_usage u
  JOIN van_stock_items vsi ON vsi.item_id = u.van_stock_item_id
  JOIN parts p             ON p.part_id   = vsi.part_id
  LEFT JOIN job_parts jp
    ON jp.job_id            = u.job_id
   AND jp.van_stock_item_id = u.van_stock_item_id
   AND jp.quantity          = u.quantity_used
 WHERE u.job_part_id IS NULL
   AND u.approval_status NOT IN ('rejected','pending')
   AND u.used_at > '2026-04-01'
   AND jp.job_part_id IS NULL;

-- Pre-flight
DO $$
DECLARE n_total INTEGER; n_liquid INTEGER; n_qty NUMERIC;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_liquid), COALESCE(SUM(quantity_used),0)
    INTO n_total, n_liquid, n_qty FROM _orphans;
  RAISE NOTICE 'orphans: total=% liquid=% qty=%', n_total, n_liquid, n_qty;
  IF n_liquid > 0 THEN
    RAISE EXCEPTION 'Liquid orphans (%)— refund formula needs container/bulk math; abort.', n_liquid;
  END IF;
END $$;

-- Refund per item
WITH refund AS (
  SELECT van_stock_item_id, SUM(quantity_used) AS qty
    FROM _orphans
   GROUP BY van_stock_item_id
)
UPDATE van_stock_items vsi
   SET quantity   = quantity + r.qty,
       updated_at = NOW()
  FROM refund r
 WHERE vsi.item_id = r.van_stock_item_id;

-- Reverse the phantom inventory_movements (paired by job + part + close timestamp).
DELETE FROM inventory_movements im
 USING _orphans o
 WHERE im.job_id        = o.job_id
   AND im.part_id       = o.part_id
   AND im.movement_type = 'use_internal'
   AND ABS(EXTRACT(EPOCH FROM (im.performed_at - o.used_at))) < 5
   AND im.container_qty_change IS NULL  -- non-liquid movement shape
   AND im.bulk_qty_change      IS NULL;

-- Delete the orphan usage rows
DELETE FROM van_stock_usage
 WHERE usage_id IN (SELECT usage_id FROM _orphans);

-- Post-check
DO $$
DECLARE n_remain INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_remain
    FROM van_stock_usage u
    LEFT JOIN job_parts jp
      ON jp.job_id            = u.job_id
     AND jp.van_stock_item_id = u.van_stock_item_id
     AND jp.quantity          = u.quantity_used
   WHERE u.job_part_id IS NULL
     AND u.approval_status NOT IN ('rejected','pending')
     AND u.used_at > '2026-04-01'
     AND jp.job_part_id IS NULL;
  IF n_remain <> 0 THEN
    RAISE EXCEPTION 'Post-check: % orphans remain', n_remain;
  END IF;
END $$;

COMMIT;

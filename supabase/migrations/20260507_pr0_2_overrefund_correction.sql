-- 2026-05-07 — Correct over-refund from 20260506_van_stock_dedup_sweep.sql.
--
-- Bug in original sweep: when a tech rapidly tapped "Use from van stock" twice within
-- 5 seconds, both the service-side and trigger-side rows for each tap fell into the
-- same 5-second window, so `_dup` matched cross-pairs (s1↔t1, s1↔t2, s2↔t1, s2↔t2)
-- giving 4 rows for one logical double-tap. The DELETE collapsed to 2 distinct service
-- rows (correct), but the SUM refund counted all 4 rows (incorrect — over by 2).
-- Same shape for triple-tap (5 rows in _dup vs 3 actual deletions, over by 2).
--
-- Live audit shows exactly 2 items affected, both verified by hand:
--   REAR HUB SCREW (2.0-2.5TON) item 2075e9a8 — current 5, expected 3 (user reported)
--   OIL FILTER 1637          item adabe24a — current 11, expected 9
-- Each over-refunded by exactly 2 units.

BEGIN;
SET LOCAL statement_timeout = '30s';

-- Pre-flight: confirm exactly the 2 items with the same shape (surviving close-time
-- trigger-side pairs). If the count drifts, abort.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM (
    SELECT vsi.item_id FROM van_stock_items vsi
     WHERE EXISTS (
       SELECT 1 FROM van_stock_usage u1
        JOIN van_stock_usage u2 USING (van_stock_item_id, job_id, quantity_used)
       WHERE u1.van_stock_item_id = vsi.item_id
         AND u1.usage_id < u2.usage_id
         AND ABS(EXTRACT(EPOCH FROM (u1.used_at - u2.used_at))) < 5
         AND u1.job_part_id IS NOT NULL AND u2.job_part_id IS NOT NULL)
  ) x;
  IF n <> 2 THEN
    RAISE EXCEPTION 'Pre-flight: expected 2 over-refund items but found %', n;
  END IF;
END $$;

-- Deduct 2 units per affected item.
UPDATE van_stock_items
   SET quantity   = quantity - 2,
       updated_at = NOW()
 WHERE item_id IN ('2075e9a8-5871-4486-9849-471af2d84f2c', 'adabe24a-784b-4f2e-98ee-f6a9824286ba');

-- Post-check: target stocks
DO $$
DECLARE rhs NUMERIC; oilf NUMERIC;
BEGIN
  SELECT quantity INTO rhs  FROM van_stock_items WHERE item_id = '2075e9a8-5871-4486-9849-471af2d84f2c';
  SELECT quantity INTO oilf FROM van_stock_items WHERE item_id = 'adabe24a-784b-4f2e-98ee-f6a9824286ba';
  IF rhs <> 3 THEN RAISE EXCEPTION 'REAR HUB SCREW expected 3 but got %', rhs; END IF;
  IF oilf <> 9 THEN RAISE EXCEPTION 'OIL FILTER 1637 expected 9 but got %', oilf; END IF;
  RAISE NOTICE 'Corrected: REAR HUB SCREW=3 (matches user report), OIL FILTER 1637=9';
END $$;

COMMIT;

-- 20260517_backfill_van_stock_zero_prices.sql
--
-- Companion to 20260517_van_stock_use_price_fallback.sql.
--
-- Between 2026-05-07 (when rpc_use_van_stock_part went live with the
-- COALESCE-without-cost-fallback bug) and 2026-05-17 (when we fixed it),
-- van-stock part uses on parts where `parts.sell_price IS NULL` snapshotted
-- sell_price_at_time = 0 onto job_parts. Reviewer 3 found ~35 such rows
-- across 15 parts, including 29 on Completed (invoiced) jobs — that's real
-- revenue that the company effectively gave away on invoices.
--
-- Backfill: where a job_parts row from a van-stock use has
-- sell_price_at_time = 0 but cost_price_at_time > 0, lift sell_price_at_time
-- to cost_price_at_time (zero-margin floor). This matches what the fixed RPC
-- would have written. It does NOT add markup — the catalog hygiene problem
-- (3,020 parts with NULL sell_price) is flagged separately for the client.

BEGIN;
SET LOCAL statement_timeout = '30s';

-- Pre-flight: how many rows match?
DO $$
DECLARE
  n_match INT;
  n_completed INT;
  total_underbill NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM jobs j WHERE j.job_id = jp.job_id AND j.status = 'Completed')),
    COALESCE(SUM(jp.cost_price_at_time * jp.quantity), 0)
    INTO n_match, n_completed, total_underbill
    FROM job_parts jp
   WHERE jp.from_van_stock = TRUE
     AND jp.sell_price_at_time = 0
     AND jp.cost_price_at_time > 0
     AND jp.created_at >= '2026-05-07';

  RAISE NOTICE 'Backfill candidates: % rows (% on Completed jobs). Estimated underbilled cost basis: RM %.', n_match, n_completed, total_underbill;
END $$;

-- Apply the backfill
WITH updated AS (
  UPDATE job_parts jp
     SET sell_price_at_time = jp.cost_price_at_time
   WHERE jp.from_van_stock = TRUE
     AND jp.sell_price_at_time = 0
     AND jp.cost_price_at_time > 0
     AND jp.created_at >= '2026-05-07'
   RETURNING jp.job_part_id, jp.cost_price_at_time, jp.quantity
)
SELECT COUNT(*) AS rows_updated, SUM(cost_price_at_time * quantity) AS total_uplift FROM updated;

-- Post-check
DO $$
DECLARE
  n_remaining INT;
BEGIN
  SELECT COUNT(*) INTO n_remaining
    FROM job_parts jp
   WHERE jp.from_van_stock = TRUE
     AND jp.sell_price_at_time = 0
     AND jp.cost_price_at_time > 0
     AND jp.created_at >= '2026-05-07';
  RAISE NOTICE 'Remaining zero-priced van-stock rows since 2026-05-07: %', n_remaining;
END $$;

COMMIT;

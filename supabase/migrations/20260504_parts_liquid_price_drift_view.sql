-- 20260504_parts_liquid_price_drift_view.sql
--
-- Audit view: parts_liquid_price_drift
--
-- Surfaces liquid SKUs whose `cost_price` and `last_purchase_cost_per_liter`
-- disagree by more than 5%. Both columns should reflect the same per-unit
-- rate (whether the unit is "per liter" or "per bottle/drum" depends on how
-- that part was entered, but BOTH columns should agree on the same rate).
-- A large disagreement means one column is stored in a different unit than
-- the other — i.e. catalog data drift, fix needed.
--
-- Background (2026-05-04 client report from Shin):
--   Van Stock total_value showed RM 6,416.55 for VEW8236 vs Shin's
--   verification Excel showing RM 5,218.50 (Δ RM 1,198.05). Audit across
--   all 9 active vans found Δ RM 20,190.24 fleet-wide, with 99.5% of the
--   gap traceable to one row: GRANTT ATF DEX-III [18L] (S-01044), where
--   cost_price = 210 (per 18L drum) and last_purchase_cost_per_liter = 11
--   (per L). The two columns held the same item priced in different units
--   and the application read the wrong one.
--
-- The application-side fix (services/liquidInventoryService.ts) now prefers
-- last_purchase_cost_per_liter for liquid line values — matching Shin's
-- Excel. This view exists so future drift between the two columns is
-- visible and can be cleaned up at the catalog level.
--
-- Idempotent (CREATE OR REPLACE VIEW). Read-only.

BEGIN;

-- DROP first because CREATE OR REPLACE VIEW cannot reorder/rename columns —
-- a prior iteration of this migration shipped slightly different column
-- names. DROP+CREATE is safe since the view is read-only.
DROP VIEW IF EXISTS parts_liquid_price_drift;

CREATE VIEW parts_liquid_price_drift AS
SELECT
  part_id,
  part_code,
  part_name,
  cost_price,
  last_purchase_cost_per_liter,
  avg_cost_per_liter,
  container_size,
  -- How much do the two price columns disagree, as a percentage of
  -- last_purchase_cost_per_liter? Both columns should reflect the same
  -- rate; disagreement → one is wrong, find out which.
  CASE
    WHEN COALESCE(last_purchase_cost_per_liter, 0) > 0
      THEN ROUND((
        ABS(cost_price - last_purchase_cost_per_liter)
        / last_purchase_cost_per_liter
        * 100
      )::numeric, 2)
    ELSE NULL
  END AS price_disagreement_pct,
  -- Implied per-liter rate IF cost_price was meant per-container — useful
  -- for guessing what the right value is when fixing the drift.
  CASE
    WHEN container_size > 0
      THEN ROUND((cost_price / container_size)::numeric, 4)
    ELSE NULL
  END AS implied_cost_per_liter_if_per_container,
  -- Flag: TRUE if cost_price and last_purchase_cost_per_liter disagree by
  -- more than 5% (the alert threshold).
  CASE
    WHEN COALESCE(last_purchase_cost_per_liter, 0) > 0
      AND ABS(cost_price - last_purchase_cost_per_liter)
          / last_purchase_cost_per_liter
          > 0.05
    THEN TRUE ELSE FALSE
  END AS has_drift
FROM parts
WHERE is_liquid = TRUE
  AND COALESCE(last_purchase_cost_per_liter, 0) > 0;

COMMENT ON VIEW parts_liquid_price_drift IS
  'Audit: liquid SKUs where parts.cost_price and parts.last_purchase_cost_per_liter disagree by >5%. Both columns should reflect the same per-unit rate (whichever unit the catalog uses); a large disagreement means one column is stored in different units than the other and needs fixing. Van Stock total_value math uses last_purchase_cost_per_liter (so it matches the customer Excel); job invoices use cost_price.';

-- Post-apply diagnostic.
DO $$
DECLARE
  drift_count INT;
  worst_row TEXT;
BEGIN
  SELECT COUNT(*) INTO drift_count FROM parts_liquid_price_drift WHERE has_drift = TRUE;
  SELECT format('%s (%s) — cost_price=%s, last_purchase_cost_per_liter=%s, disagreement=%s%%, implied_per_L_if_per_container=%s',
                part_code, part_name, cost_price,
                last_purchase_cost_per_liter, price_disagreement_pct,
                implied_cost_per_liter_if_per_container)
    INTO worst_row
    FROM parts_liquid_price_drift
    WHERE has_drift = TRUE
    ORDER BY price_disagreement_pct DESC NULLS LAST
    LIMIT 1;

  RAISE NOTICE 'parts_liquid_price_drift: % liquid SKU(s) with >5%% disagreement between cost_price and last_purchase_cost_per_liter.', drift_count;
  IF drift_count > 0 THEN
    RAISE NOTICE 'Worst offender: %', worst_row;
    RAISE NOTICE 'Action: confirm canonical rate with Shin, then UPDATE the wrong column.';
  END IF;
END $$;

COMMIT;

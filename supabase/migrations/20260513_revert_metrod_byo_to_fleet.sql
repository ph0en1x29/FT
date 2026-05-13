-- 20260513_revert_metrod_byo_to_fleet.sql
--
-- Data correction: revert 3 Metrod forklifts from customer-owned (BYO)
-- back to Acwer fleet assets.
--
-- Client report (Metrod Malaysia): "Please help reverse all units currently
-- listed as Customer-owned (BYO) back to Acwer assets. I'm not sure whether
-- this happened during testing or if the system updated them automatically."
--
-- Root cause: the 3 units were registered via the "Register customer-owned
-- forklift" (BYO) button on the customer profile page — likely during
-- testing/data setup in mid-April 2026 — and never reverted.
--
-- Affected units (all on Metrod M55, customer_id 077f8d41):
--   (A1836) -CP1-24307  forklift_id 5fd7a93d-bc07-40f5-8c1c-bc130fe504e8
--   37229                forklift_id e15d535b-f8f5-491f-a533-90c2a39684e7
--   37778                forklift_id 259d9318-023f-4ecb-af2d-f39200f891be
--
-- Changes per unit:
--   ownership:          'customer' → 'company'
--   ownership_type:     'external' → 'fleet'
--   acquisition_source: 'new_byo'  → NULL
--   current_customer_id: unchanged (stays on Metrod M55 — Acwer asset assigned there)
--
-- No service contracts or active rentals are linked to these units.
--
-- NOTE: This migration was already applied manually to the live DB on
-- 2026-05-13. It is recorded here for audit trail and reproducibility.

BEGIN;

UPDATE forklifts
   SET ownership          = 'company',
       ownership_type     = 'fleet',
       acquisition_source = NULL,
       updated_at         = NOW()
 WHERE forklift_id IN (
   '5fd7a93d-bc07-40f5-8c1c-bc130fe504e8',
   'e15d535b-f8f5-491f-a533-90c2a39684e7',
   '259d9318-023f-4ecb-af2d-f39200f891be'
 )
   AND ownership = 'customer';

-- Post-check
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n
    FROM forklifts
   WHERE forklift_id IN (
     '5fd7a93d-bc07-40f5-8c1c-bc130fe504e8',
     'e15d535b-f8f5-491f-a533-90c2a39684e7',
     '259d9318-023f-4ecb-af2d-f39200f891be'
   )
     AND ownership = 'company'
     AND ownership_type = 'fleet';

  IF n <> 3 THEN
    RAISE EXCEPTION 'Post-check: expected 3 fleet forklifts but found %', n;
  END IF;
END $$;

COMMIT;

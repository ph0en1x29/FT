-- 20260513_revert_all_byo_to_fleet.sql
--
-- Data correction: revert ALL customer-owned (BYO) forklifts across the
-- entire database back to Acwer fleet assets.
--
-- Client report: "Please help reverse all units currently listed as
-- Customer-owned (BYO) back to Acwer assets. I'm not sure whether this
-- happened during testing or if the system updated them automatically,
-- but the ownership classification is currently incorrect."
--
-- Root cause: 60 forklifts across 43 customers were registered via the
-- "Register customer-owned forklift" (BYO) button on customer profile
-- pages during testing/data setup (created between 2026-04-07 and
-- 2026-05-11) and never reverted.
--
-- Changes (blanket, all units where ownership='customer'):
--   ownership:          'customer' → 'company'
--   ownership_type:     'external' → 'fleet'
--   acquisition_source: 'new_byo'/NULL → NULL
--   current_customer_id: unchanged (Acwer assets stay assigned to customer)
--
-- NOTE: This migration was already applied manually to the live DB on
-- 2026-05-13. 60 forklifts were reverted. It is recorded here for
-- audit trail and reproducibility.

BEGIN;

UPDATE forklifts
   SET ownership          = 'company',
       ownership_type     = 'fleet',
       acquisition_source = NULL,
       updated_at         = NOW()
 WHERE ownership = 'customer';

-- Post-check: zero customer-owned forklifts should remain
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM forklifts WHERE ownership = 'customer';
  IF n <> 0 THEN
    RAISE EXCEPTION 'Post-check: expected 0 customer-owned forklifts but found %', n;
  END IF;
END $$;

COMMIT;

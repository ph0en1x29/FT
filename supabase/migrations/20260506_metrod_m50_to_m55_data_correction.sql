-- 2026-05-06 — Data correction: move 4 forklifts from METROD M50 to METROD M55
-- Client report (Shin, 5/6 5:22 AM): METROD has two accounts (M50 / M55) for different
-- locations. All 4 units below were placed under M50 by mistake.
--
-- Customer rows (verified live):
--   M50  customer_id 4d9621ff-3723-4c69-87eb-f8ca10d722cd  account_number 3000/M50
--   M55  customer_id 077f8d41-8bde-4859-96e9-599c4d3a23ca  account_number 3000/M55
--
-- Forklifts to move (all currently current_customer_id = M50, customer_id NULL):
--   7FBR13-12312, 7FD45-38065, 8FD30-73970, 8FD15-60424
--
-- Scope: only forklifts.current_customer_id is touched. customer_id stays NULL.
-- Open jobs / billing / contracts are not in scope (no changes there).

BEGIN;
SET LOCAL statement_timeout = '30s';

-- Pre-flight: confirm exactly 4 rows on M50 (id-based, name-blind, ownership-aware)
DO $$
DECLARE n_pre INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_pre
    FROM forklifts
   WHERE serial_number IN ('7FBR13-12312','7FD45-38065','8FD30-73970','8FD15-60424')
     AND current_customer_id = '4d9621ff-3723-4c69-87eb-f8ca10d722cd';
  IF n_pre <> 4 THEN
    RAISE EXCEPTION 'Pre-flight: expected 4 rows on M50 but found %', n_pre;
  END IF;
END $$;

-- Apply
UPDATE forklifts
   SET current_customer_id = '077f8d41-8bde-4859-96e9-599c4d3a23ca',
       updated_at          = NOW()
 WHERE serial_number IN ('7FBR13-12312','7FD45-38065','8FD30-73970','8FD15-60424')
   AND current_customer_id = '4d9621ff-3723-4c69-87eb-f8ca10d722cd';

-- Post-check: same 4 rows now on M55
DO $$
DECLARE n_post INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_post
    FROM forklifts
   WHERE serial_number IN ('7FBR13-12312','7FD45-38065','8FD30-73970','8FD15-60424')
     AND current_customer_id = '077f8d41-8bde-4859-96e9-599c4d3a23ca';
  IF n_post <> 4 THEN
    RAISE EXCEPTION 'Post-check: expected 4 rows on M55 but found %', n_post;
  END IF;
END $$;

COMMIT;

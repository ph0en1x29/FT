-- 20260424_tech_account_cleanup.sql
--
-- Client cleanup of technician roster (Shin, 2026-04-23 WhatsApp):
--   1. tech4 (GOH YUEH HAN) and service@acwer.com (MOHD BASRI) are unused
--      duplicates of tech10 / tech17 respectively. Hard-delete (verified
--      0 FK references across all 84 FK columns pointing at users.user_id).
--   2. tech20 was MOHAMAD YAZID BIN YAACOB (26 past jobs). Yazid has left
--      Acwer; Shin wants the same account renamed to SYUKRI so the 26 jobs
--      stay attached to the seat rather than forking history to a new row.
--      Email (`tech20@example.com`) stays unchanged.
--   3. tech2 / tech3 are helpers. Keep role='technician' (they may promote
--      later) but record the helper status in users.notes so roster-facing
--      UI can distinguish them.
--   4. Acwer Nilai branch techs are deliberately out of scope per Shin.
--
-- Safety: wrapped in BEGIN/COMMIT with post-apply assertions that raise on
-- any drift (wrong row count affected, duplicates still present, etc.).

BEGIN;

-- ----------------------------------------------------------------------
-- 1. Hard-delete duplicate accounts
-- ----------------------------------------------------------------------

-- tech4 GOH YUEH HAN (duplicate of tech10@example.com)
DELETE FROM users
WHERE user_id = '96bcf76f-bae1-4fdc-8157-08fb02cb3ecd'
  AND email = 'tech4@example.com'
  AND full_name = 'GOH YUEH HAN';

-- service@acwer.com MOHD BASRI (duplicate of tech17@example.com)
DELETE FROM users
WHERE user_id = '01634ed2-6a2d-4523-8daf-b40572c8ca23'
  AND email = 'service@acwer.com';

-- Sanity: the two duplicates must be gone, and the canonical rows must remain.
DO $$
DECLARE
  v_dup_count int;
  v_canonical_count int;
BEGIN
  SELECT COUNT(*) INTO v_dup_count
  FROM users
  WHERE user_id IN (
    '96bcf76f-bae1-4fdc-8157-08fb02cb3ecd',
    '01634ed2-6a2d-4523-8daf-b40572c8ca23'
  );
  IF v_dup_count <> 0 THEN
    RAISE EXCEPTION 'Duplicate cleanup failed: % duplicate rows still present', v_dup_count;
  END IF;

  SELECT COUNT(*) INTO v_canonical_count
  FROM users
  WHERE email IN ('tech10@example.com', 'tech17@example.com');
  IF v_canonical_count <> 2 THEN
    RAISE EXCEPTION 'Canonical rows missing: expected 2, found %', v_canonical_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------
-- 2. Rename tech20 MOHAMAD YAZID -> SYUKRI
-- ----------------------------------------------------------------------

UPDATE users
SET full_name = 'SYUKRI',
    notes    = COALESCE(NULLIF(notes, '') || E'\n', '')
             || '[2026-04-24] Account repurposed: previously MOHAMAD YAZID BIN YAACOB (left Acwer). '
             || '26 historical jobs retained on this user_id per client request.',
    updated_at = NOW()
WHERE user_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND email = 'tech20@example.com';

DO $$
DECLARE
  v_name text;
BEGIN
  SELECT full_name INTO v_name
  FROM users
  WHERE user_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c';
  IF v_name <> 'SYUKRI' THEN
    RAISE EXCEPTION 'tech20 rename failed: full_name is "%", expected "SYUKRI"', v_name;
  END IF;
END $$;

-- ----------------------------------------------------------------------
-- 3. Tag tech2 / tech3 as helpers (role stays 'technician')
-- ----------------------------------------------------------------------

UPDATE users
SET notes = CASE
              WHEN notes IS NULL OR notes = '' THEN 'Helper (see [2026-04-24] client note)'
              WHEN notes ILIKE '%Helper%' THEN notes
              ELSE notes || E'\n[2026-04-24] Helper (role remains technician pending promotion).'
            END,
    updated_at = NOW()
WHERE email IN ('tech2@example.com', 'tech3@example.com');

DO $$
DECLARE
  v_bad_role int;
  v_missing_tag int;
BEGIN
  SELECT COUNT(*) INTO v_bad_role
  FROM users
  WHERE email IN ('tech2@example.com', 'tech3@example.com')
    AND role <> 'technician';
  IF v_bad_role <> 0 THEN
    RAISE EXCEPTION 'tech2/tech3 role drifted off technician on % row(s)', v_bad_role;
  END IF;

  SELECT COUNT(*) INTO v_missing_tag
  FROM users
  WHERE email IN ('tech2@example.com', 'tech3@example.com')
    AND (notes IS NULL OR notes NOT ILIKE '%Helper%');
  IF v_missing_tag <> 0 THEN
    RAISE EXCEPTION 'Helper tag missing on % tech2/tech3 row(s)', v_missing_tag;
  END IF;
END $$;

COMMIT;

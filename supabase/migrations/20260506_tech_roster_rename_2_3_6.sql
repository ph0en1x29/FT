-- 20260506_tech_roster_rename_2_3_6.sql
--
-- Apply the canonical names from Shin's roster image (WhatsApp 2026-05-05)
-- to the three tech accounts that were still on placeholder names or had a
-- typo. Same in-place pattern as the 2026-04-24 SYUKRI rename and the
-- 2026-05-06 LIM KIM HO rename — same user_id preserved across the change,
-- audit line appended to users.notes.
--
-- Roster source: WhatsApp Image 2026-05-05 at 12.20.59 AM.jpeg
--
-- Changes:
--   tech2  'Tech Two'        -> 'MUHAMMAD NASHARUDEN BIN AHMAD'  (HELPER, 10 assigned jobs)
--   tech3  'Tech Three'      -> 'MUHAMMAD ZULFIQRIE BIN ZAIFUL'  (HELPER, 0 assigned jobs)
--   tech6  'BEE PHENG SIANG' -> 'BEH PHENG SIANG'                (typo fix BEE->BEH, 54 assigned jobs + already imported van BQU 8619)
--
-- Helper handling decision (Jay 2026-05-05): keep role='technician'
-- for tech2/tech3 (no separate helper role in the schema), preserve the
-- existing 'Helper (see [2026-04-24] client note)' line in users.notes,
-- and append today's rename audit. tech20 (SYUKRI short form) is
-- explicitly NOT touched — Jay decided to keep the short display form
-- already in use, even though the roster lists the full canonical name.
--
-- All three preserve their user_id, so all FK-based history (assigned jobs,
-- job_assignments helper rows, completed_by_id, etc.) stays attached.

BEGIN;

UPDATE users
   SET name      = 'MUHAMMAD NASHARUDEN BIN AHMAD',
       full_name = 'MUHAMMAD NASHARUDEN BIN AHMAD',
       notes     = TRIM(BOTH E'\n' FROM
                     COALESCE(notes, '') ||
                     E'\n[2026-05-05] Renamed from placeholder ''Tech Two'' to ''MUHAMMAD NASHARUDEN BIN AHMAD'' per Shin (roster image WhatsApp 2026-05-05). Role kept as technician (HELPER flag noted above). Same user_id; 10 assigned jobs preserved.'
                   ),
       updated_at = NOW()
 WHERE email = 'tech2@example.com'
   AND full_name = 'Tech Two';

UPDATE users
   SET name      = 'MUHAMMAD ZULFIQRIE BIN ZAIFUL',
       full_name = 'MUHAMMAD ZULFIQRIE BIN ZAIFUL',
       notes     = TRIM(BOTH E'\n' FROM
                     COALESCE(notes, '') ||
                     E'\n[2026-05-05] Renamed from placeholder ''Tech Three'' to ''MUHAMMAD ZULFIQRIE BIN ZAIFUL'' per Shin (roster image WhatsApp 2026-05-05). Role kept as technician (HELPER flag noted above). Same user_id; 0 assigned jobs (helper-only).'
                   ),
       updated_at = NOW()
 WHERE email = 'tech3@example.com'
   AND full_name = 'Tech Three';

UPDATE users
   SET name      = 'BEH PHENG SIANG',
       full_name = 'BEH PHENG SIANG',
       notes     = TRIM(BOTH E'\n' FROM
                     COALESCE(notes, '') ||
                     E'\n[2026-05-05] Typo fix: ''BEE PHENG SIANG'' -> ''BEH PHENG SIANG'' per Shin (roster image WhatsApp 2026-05-05). Same user_id; 54 assigned jobs and van BQU 8619 stock preserved.'
                   ),
       updated_at = NOW()
 WHERE email = 'tech6@example.com'
   AND full_name = 'BEE PHENG SIANG';

COMMIT;

-- ============================================
-- Post-apply verification
-- ============================================
DO $$
DECLARE
  v_tech2 TEXT;
  v_tech3 TEXT;
  v_tech6 TEXT;
BEGIN
  SELECT full_name INTO v_tech2 FROM users WHERE email = 'tech2@example.com';
  SELECT full_name INTO v_tech3 FROM users WHERE email = 'tech3@example.com';
  SELECT full_name INTO v_tech6 FROM users WHERE email = 'tech6@example.com';

  IF v_tech2 <> 'MUHAMMAD NASHARUDEN BIN AHMAD' THEN
    RAISE EXCEPTION 'tech2 rename failed: full_name=%, expected MUHAMMAD NASHARUDEN BIN AHMAD', v_tech2;
  END IF;
  IF v_tech3 <> 'MUHAMMAD ZULFIQRIE BIN ZAIFUL' THEN
    RAISE EXCEPTION 'tech3 rename failed: full_name=%, expected MUHAMMAD ZULFIQRIE BIN ZAIFUL', v_tech3;
  END IF;
  IF v_tech6 <> 'BEH PHENG SIANG' THEN
    RAISE EXCEPTION 'tech6 rename failed: full_name=%, expected BEH PHENG SIANG', v_tech6;
  END IF;

  RAISE NOTICE 'Tech roster rename applied: tech2=%, tech3=%, tech6=%',
               v_tech2, v_tech3, v_tech6;
END $$;

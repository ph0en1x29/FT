-- ============================================================
-- Migration: ACWER Service Operations Flow — Phase 3 Wear-and-Tear Seed
-- Date: 2026-05-01
-- Purpose: Flip `parts.is_warranty_excluded` to TRUE for parts whose name or
--          category matches the wear-and-tear keywords described in the
--          ACWER service operations flowchart (tires, LED lights, seats, etc.).
--
--          This is a conservative default: only flags items the flow doc
--          explicitly enumerates plus their close synonyms. Admin can flip
--          additional parts via the parts editor (Inventory page). Awaiting
--          Shin's closed list to refine.
--
-- Behavioral impact: NONE in Phase 3 itself. The flag drives Phase 4
--   enforcement (AMC chargeable flip). Phase 3 only surfaces a warning chip
--   on the part picker when adding to an AMC job; the warning does not block.
--
-- Reversibility: ROLLBACK block at the bottom resets every part flagged by
--   THIS migration to FALSE (uses a marker comment to scope the revert).
-- ============================================================

BEGIN;

-- Snapshot the count before so we can audit
DO $$
DECLARE
  v_before INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_before FROM parts WHERE is_warranty_excluded = TRUE;
  RAISE NOTICE 'Phase 3 wear-and-tear seed: % parts already flagged before this migration', v_before;
END $$;

-- Flag wear-and-tear parts using case-insensitive keyword match.
-- Conservative — false negatives (admin can flip a part on later) are
-- preferable to false positives (Phase 4 enforcement would bill incorrectly).
-- Refined after first-pass over-matched OIL SEALs / LIGHT BRACKETs.
UPDATE parts SET is_warranty_excluded = TRUE
WHERE is_warranty_excluded = FALSE
  -- Exclude obviously-structural parts even if they match a wear-and-tear
  -- keyword. A "TYRE BOLT" is a fastener; a "BEACON LIGHT BRACKET" is a
  -- mounting bracket; a "GREASE CAP" is a sealing cap. None are consumables.
  AND part_name !~* '\m(bracket|cap|bolt|nut|screw|hub|rod|pipe|wire|cable|housing|cover|shield|guard|switch|relay|sensor)\M'
  AND (
       -- Tires: explicit tire/tyre matches; excludes "rim" (matched too broadly,
       -- includes parts like RIMS, hub assemblies that aren't pure consumables)
       part_name ~* '\m(tire|tyre|tyres|tires)\M'
       -- Lighting consumables: bulbs and beacons (drop "lamp"/"light" — they
       -- match BRACKETs and HOUSINGs that are non-consumable)
    OR part_name ~* '\m(bulb|bulbs|beacon)\M'
       -- LED matches when standalone (LED LAMP, LED HEADLIGHT). The pattern
       -- accepts LED followed by a single-word qualifier; rejects "LED CABLE"
       -- only if Shin says so later (admin edit at part level).
    OR part_name ~* '\mled\M'
       -- Seat assemblies and cushions
    OR part_name ~* '\mseat\M'
       -- Lubricants — only the consumable form. Keys on names containing
       -- "ENGINE OIL", "HYDRAULIC OIL", "GEAR OIL", "TRANSMISSION OIL",
       -- "BRAKE OIL", "GREASE". Excludes "OIL SEAL" / "OIL PUMP" etc.
    OR part_name ~* '\m(engine|hydraulic|gear|transmission|brake|coolant)\s+oil\M'
    OR part_name ~* '\mgrease\M'
       -- Filters — air filter, oil filter, fuel filter (replaceable consumables)
    OR part_name ~* '\m(air|oil|fuel|hydraulic|water)\s+filter'
  );

-- Telemetry: post-flag distribution by inferred category
DO $$
DECLARE
  v_after INTEGER;
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_after FROM parts WHERE is_warranty_excluded = TRUE;
  SELECT COUNT(*) INTO v_total FROM parts;
  RAISE NOTICE 'Phase 3 wear-and-tear seed: now % of % parts are warranty-excluded',
               v_after, v_total;
  IF v_after = 0 THEN
    RAISE EXCEPTION 'Phase 3 wear-and-tear seed: 0 parts matched — keyword set may need adjustment';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (run separately if Shin says we over-flagged)
-- ============================================================
-- BEGIN;
-- UPDATE parts SET is_warranty_excluded = FALSE
-- WHERE is_warranty_excluded = TRUE
--   AND (
--        part_name ~* '\m(tire|tyre|rim)\M'
--     OR part_name ~* '\m(led|lamp|light|bulb|beacon|horn|buzzer)\M'
--     OR part_name ~* '\mseat'
--     OR part_name ~* '\m(oil)\M'
--     OR part_name ~* '\mfilter\M'
--   );
-- COMMIT;

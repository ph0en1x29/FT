-- ============================================================
-- Migration: ACWER Service Operations Flow — Phase 6 Accident + Overage
-- Date: 2026-05-01
-- Purpose: Add Path C chargeable-exception gates per the flow doc:
--          (a) accident / customer negligence flag on the job;
--          (b) consumable usage overage (per-part-per-period quotas).
--          Either condition flips a fleet (Path C) job to chargeable.
--
-- Behavioral impact:
--   - jobs.is_accident defaults FALSE (no behaviour change for existing jobs).
--   - parts_usage_quotas is empty until this migration seeds the defaults.
--   - addPartToJob (service-layer) is updated separately to read these.
--
-- Reversibility: ROLLBACK block at the bottom.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. is_accident flag on jobs
-- ============================================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_accident BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accident_notes TEXT;

COMMENT ON COLUMN jobs.is_accident IS
  'ACWER Phase 6 — TRUE = job is the result of accident / customer negligence / external-party damage. Flips Path C (fleet) jobs to chargeable per the flow doc''s "Accident Case?" gate.';

-- ============================================================
-- 2. Seed default consumable usage quotas — per the flow doc's
--    "1 set tires/year per fleet forklift" example, plus reasonable
--    defaults for the other wear-and-tear classes.
--    All quotas are GLOBAL scope (apply to all fleet forklifts) until
--    Shin gives per-customer or per-forklift overrides.
-- ============================================================

-- NOTE: `parts.category` uses the human-readable labels actually in the
-- parts catalog ("Wheels & Tyres", "Lights & Bulbs", "Filters", etc.).
-- The seeds match those exactly. Admin can refine via per-customer / per-
-- forklift quotas inserted with `scope_type='per_forklift'` etc.
INSERT INTO parts_usage_quotas (scope_type, part_category, period_unit, max_quantity, notes)
VALUES
  ('global', 'Wheels & Tyres', 'year', 4, 'Default — 1 set (4 wheels) of tires/year per fleet forklift. Overage flips Path C job to chargeable.'),
  ('global', 'Lights & Bulbs', 'year', 4, 'Default — 4 lights/bulbs/year per fleet forklift.'),
  ('global', 'Filters',        'year', 4, 'Default — 4 filters/year per fleet forklift.')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Helper function — count usage of a part-category for a given
--    forklift over the past N days. Used by the application layer.
-- ============================================================

CREATE OR REPLACE FUNCTION acwer_part_category_usage_for_forklift(
  p_forklift_id UUID,
  p_category    TEXT,
  p_days_back   INTEGER DEFAULT 365
)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(jp.quantity), 0)
    INTO v_total
  FROM job_parts jp
  JOIN jobs j ON jp.job_id = j.job_id
  JOIN parts p ON jp.part_id = p.part_id
  WHERE j.forklift_id = p_forklift_id
    AND j.deleted_at IS NULL
    AND jp.created_at >= NOW() - (p_days_back || ' days')::interval
    AND p.category = p_category;
  RETURN COALESCE(v_total, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION acwer_part_category_usage_for_forklift(UUID, TEXT, INTEGER) IS
  'ACWER Phase 6: returns the total quantity of a given part-category used on a forklift in the last N days. Inputs: forklift_id, category (e.g. "tire"), days_back (default 365). Used by application layer to evaluate parts_usage_quotas overages.';

-- ============================================================
-- 4. Sanity check
-- ============================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jobs' AND column_name='is_accident';
  IF v_count = 0 THEN RAISE EXCEPTION 'Phase 6: jobs.is_accident not added'; END IF;

  SELECT COUNT(*) INTO v_count FROM parts_usage_quotas WHERE scope_type='global';
  IF v_count < 3 THEN
    RAISE EXCEPTION 'Phase 6: expected ≥3 default global quotas, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname='acwer_part_category_usage_for_forklift';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Phase 6: helper function not created';
  END IF;

  RAISE NOTICE 'Phase 6 accident + overage: schema + seed + helper in place.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS acwer_part_category_usage_for_forklift(UUID, TEXT, INTEGER);
-- DELETE FROM parts_usage_quotas WHERE scope_type='global'
--   AND notes LIKE 'Default — %';
-- ALTER TABLE jobs DROP COLUMN IF EXISTS accident_notes;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS is_accident;
-- COMMIT;

-- ============================================================
-- Migration: ACWER follow-up — cost_price_at_time on job_parts
-- Date: 2026-05-02
-- Purpose: Capture the part's cost_price at the moment it's added to a job,
--          mirroring the existing `sell_price_at_time` snapshot. Lets
--          ServiceReportPDF render an internal-cost / margin view (Phase 9b
--          / Tier 4.2 follow-up) without a JOIN at every read.
--
--          The `addPartToJob` service is updated separately to write this
--          column on every new row.
--
-- Behavioral impact: NONE for existing flows. Reports that don't ask for
--   internal-cost view continue to read only `sell_price_at_time`.
--
-- Reversibility: ROLLBACK block at the bottom.
-- ============================================================

BEGIN;

-- 1. Add the audit column
ALTER TABLE job_parts
  ADD COLUMN IF NOT EXISTS cost_price_at_time NUMERIC;

COMMENT ON COLUMN job_parts.cost_price_at_time IS
  '**(NEW 2026-05-02)** Snapshot of parts.cost_price at the time this row was added to the job. Used by the cost-margin internal report variant (ServiceReportPDF view=''internal_cost''). NULL for rows added before this migration; backfill below uses the part''s current cost_price as the best approximation.';

-- 2. Backfill from parts.cost_price for existing rows.
-- This is approximate: parts.cost_price may have changed since the row was
-- added. The truthful answer is unknowable for legacy rows; using the
-- current value gives reports something to compute margin against. New
-- rows will capture the value at insertion and be accurate.
UPDATE job_parts jp
SET cost_price_at_time = COALESCE(p.cost_price, 0)
FROM parts p
WHERE jp.part_id = p.part_id
  AND jp.cost_price_at_time IS NULL;

-- 3. Sanity check
DO $$
DECLARE
  v_null INTEGER;
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM job_parts;
  SELECT COUNT(*) INTO v_null FROM job_parts WHERE cost_price_at_time IS NULL AND part_id IS NOT NULL;
  RAISE NOTICE 'Phase 9b backfill: % of % job_parts rows have cost_price_at_time populated (% NULL where part_id is non-null and would have backfilled)',
               v_total - v_null, v_total, v_null;
  IF v_null > 0 THEN
    RAISE NOTICE 'Note: % job_parts rows still have cost_price_at_time NULL — these point at parts the join didn''t resolve (deleted parts? orphan rows?). Reports degrade gracefully via COALESCE.', v_null;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- BEGIN;
-- ALTER TABLE job_parts DROP COLUMN IF EXISTS cost_price_at_time;
-- COMMIT;

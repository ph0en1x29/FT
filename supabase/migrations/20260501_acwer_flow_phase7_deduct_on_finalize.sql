-- ============================================================
-- Migration: ACWER Service Operations Flow — Phase 7 Deduct-on-Finalize
-- Date: 2026-05-01
-- Purpose: Audit columns + finalize-time deduction function. The actual
--          behavior switch is gated behind `acwer_settings.feature_deduct_on_finalize`
--          which defaults FALSE — meaning this migration ships the
--          infrastructure but production behavior stays as today
--          (immediate deduction on add) until admin explicitly flips the flag.
--
-- Behavioral impact:
--   - job_parts gains deducted_at / deducted_by_* columns. Existing rows get
--     deducted_at backfilled to created_at (their stock was already deducted
--     at add time per the legacy immediate-deduct behavior — recording that
--     after-the-fact is the truthful representation).
--   - acwer_finalize_job_part_deduction() is created but NOT auto-called
--     anywhere by this migration. The application layer wires it into the
--     Admin 2 confirmParts() flow, gated on `feature_deduct_on_finalize=TRUE`.
--   - As long as the flag stays FALSE (default), stock continues to deduct
--     on add exactly as today.
--
-- Reversibility: ROLLBACK block at the bottom.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Audit columns on job_parts
-- ============================================================

ALTER TABLE job_parts
  ADD COLUMN IF NOT EXISTS deducted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deducted_by_id UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS deducted_by_name TEXT;

COMMENT ON COLUMN job_parts.deducted_at IS
  'ACWER Phase 7 — TIMESTAMPTZ when this row''s stock was actually deducted from `parts`. NULL = pending (when feature_deduct_on_finalize=TRUE). Backfilled to created_at for existing rows.';

-- Backfill existing rows: under the legacy immediate-deduct behaviour, every
-- existing job_parts row already had its stock deducted at created_at time.
-- Stamping deducted_at = created_at is the truthful representation.
UPDATE job_parts
  SET deducted_at = created_at
  WHERE deducted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_parts_pending_deduct
  ON job_parts(job_id) WHERE deducted_at IS NULL;

-- ============================================================
-- 2. Finalize-time deduction function
--    Called from the application layer when Admin 2 confirms parts AND
--    feature_deduct_on_finalize=TRUE. Walks all pending (deducted_at IS NULL,
--    not in any return state) job_parts for the job and deducts stock + logs
--    a movement, mirroring the immediate-deduct path's behaviour.
-- ============================================================

CREATE OR REPLACE FUNCTION acwer_finalize_job_part_deduction(
  p_job_id UUID,
  p_actor_id UUID DEFAULT NULL,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_jp RECORD;
  v_part RECORD;
  v_new_stock INTEGER;
BEGIN
  FOR v_jp IN
    SELECT jp.job_part_id, jp.part_id, jp.quantity, jp.from_van_stock, jp.return_status
    FROM job_parts jp
    WHERE jp.job_id = p_job_id
      AND jp.deducted_at IS NULL
      AND (jp.return_status IS NULL OR jp.return_status NOT IN ('pending_return', 'returned'))
      AND NOT jp.from_van_stock                  -- van-stock parts already deducted via van_stock_items
  LOOP
    SELECT part_id, part_name, stock_quantity, is_liquid, container_quantity, bulk_quantity, container_size
      INTO v_part
      FROM parts
      WHERE part_id = v_jp.part_id
      FOR UPDATE;

    IF v_part.part_id IS NULL THEN CONTINUE; END IF;

    -- Non-liquid: simple stock_quantity decrement. Liquid: this is the
    -- minimal Phase-7 path; complex liquid sell modes (sealed-vs-bulk) are
    -- not retried here — at Phase 7's gate, liquids that need the sealed/
    -- internal split keep using their existing immediate-deduct path
    -- (admin can keep liquids on the immediate-deduct flow indefinitely
    -- by leaving the feature flag off, OR by adding a per-part opt-out).
    IF v_part.is_liquid THEN
      -- Skip — liquids continue to deduct via the addPartToJob immediate path
      -- Stamp deducted_at so we don't re-process
      UPDATE job_parts SET
        deducted_at = NOW(),
        deducted_by_id = p_actor_id,
        deducted_by_name = p_actor_name
      WHERE job_part_id = v_jp.job_part_id;
      v_count := v_count + 1;
      CONTINUE;
    END IF;

    v_new_stock := GREATEST(0, COALESCE(v_part.stock_quantity, 0) - v_jp.quantity);
    UPDATE parts SET stock_quantity = v_new_stock WHERE part_id = v_part.part_id;

    -- Log to inventory_movements (mirrors the immediate-deduct path's log)
    INSERT INTO inventory_movements (
      part_id, movement_type, container_qty_change, bulk_qty_change,
      job_id, performed_by, performed_by_name, notes,
      store_container_qty_after, store_bulk_qty_after
    ) VALUES (
      v_jp.part_id, 'use_internal',
      -v_jp.quantity, 0,
      p_job_id, p_actor_id, p_actor_name,
      'Deferred deduction at Admin 2 finalize (Phase 7)',
      v_new_stock, 0
    );

    UPDATE job_parts SET
      deducted_at = NOW(),
      deducted_by_id = p_actor_id,
      deducted_by_name = p_actor_name
    WHERE job_part_id = v_jp.job_part_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION acwer_finalize_job_part_deduction(UUID, UUID, TEXT) IS
  'ACWER Phase 7: deducts pending (deducted_at IS NULL) job_parts for a given job. Used when feature_deduct_on_finalize=TRUE — Admin 2 confirmParts triggers it. Returns the count of rows processed. Skips returned / pending_return rows and from_van_stock rows.';

-- ============================================================
-- 3. Sanity check
-- ============================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
    WHERE table_schema='public' AND table_name='job_parts'
      AND column_name IN ('deducted_at', 'deducted_by_id', 'deducted_by_name');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Phase 7: expected 3 audit columns on job_parts, found %', v_count;
  END IF;

  -- Backfill should leave 0 rows with deducted_at IS NULL
  SELECT COUNT(*) INTO v_count FROM job_parts WHERE deducted_at IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7: backfill incomplete — % rows still have deducted_at NULL', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname='acwer_finalize_job_part_deduction';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Phase 7: finalize function not created';
  END IF;

  -- Confirm the feature flag still defaults FALSE (we want behaviour unchanged)
  SELECT COUNT(*) INTO v_count FROM acwer_settings WHERE feature_deduct_on_finalize = TRUE;
  IF v_count > 0 THEN
    RAISE WARNING 'Phase 7: feature_deduct_on_finalize is already TRUE — behaviour will switch on next part-add';
  ELSE
    RAISE NOTICE 'Phase 7: feature_deduct_on_finalize is FALSE; production behaviour unchanged.';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS acwer_finalize_job_part_deduction(UUID, UUID, TEXT);
-- DROP INDEX IF EXISTS idx_job_parts_pending_deduct;
-- ALTER TABLE job_parts DROP COLUMN IF EXISTS deducted_by_name;
-- ALTER TABLE job_parts DROP COLUMN IF EXISTS deducted_by_id;
-- ALTER TABLE job_parts DROP COLUMN IF EXISTS deducted_at;
-- COMMIT;

-- 20260507_external_purchase_and_van_stock_marker.sql
--
-- Two related additions to job_parts:
--
-- 1. EXTERNAL PURCHASE / WILDCARD PARTS
--    Techs sometimes need to buy a part from an outside vendor when Acwer
--    inventory is short. They need to add it to a job with a custom name,
--    price, and a flag indicating it's NOT from our inventory.
--
--    Schema: `is_external_purchase BOOLEAN` + `external_purchase_notes TEXT`.
--    Row insertion uses `part_id = NULL` (already nullable), with `part_name`
--    holding the tech's free-form name, and `sell_price_at_time` /
--    `cost_price_at_time` set from the tech's input (typically equal — what
--    they paid is what the customer is charged; admin can edit later).
--
--    No stock deduction happens because there's no parts catalog row.
--
-- 2. VAN STOCK MARKER (BACKFILL)
--    `job_parts.from_van_stock` exists but every row has it FALSE because
--    the van-stock-usage flow (`useJobPartsHandlers.handleUseVanStockPart`)
--    calls `addPartToJob` without setting the flag. The flag will be set
--    by the service-layer change in this same release; this migration just
--    guarantees the column has a sensible default and an index for the
--    "(VS)" rendering filter on the parts list.
--
-- Both changes are additive; no destruction.

BEGIN;

-- ============================================================================
-- 1. New columns on job_parts
-- ============================================================================
ALTER TABLE job_parts
  ADD COLUMN IF NOT EXISTS is_external_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS external_purchase_notes TEXT;

COMMENT ON COLUMN job_parts.is_external_purchase IS
  'TRUE when this part was purchased externally by the tech (not from Acwer inventory) due to stock shortage. Companion: part_id is typically NULL on these rows; part_name holds the free-form name.';
COMMENT ON COLUMN job_parts.external_purchase_notes IS
  'Optional context recorded by the tech, e.g. vendor name, receipt number.';

-- ============================================================================
-- 2. from_van_stock — coerce existing NULLs to FALSE so the UI can rely on
--    a boolean. (No NOT NULL constraint to avoid breaking anything writing
--    NULL; but the default already handles new rows.)
-- ============================================================================
UPDATE job_parts SET from_van_stock = FALSE WHERE from_van_stock IS NULL;

-- ============================================================================
-- 3. Validity guard: if a row claims to be from van stock, it should also
--    have a van_stock_item_id; if it claims to be an external purchase, it
--    should have a part_name set (since part_id will be NULL).
--    NOT VALID skips the historical scan — only enforces on new writes.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_parts_van_stock_consistency'
  ) THEN
    ALTER TABLE job_parts
      ADD CONSTRAINT job_parts_van_stock_consistency
      CHECK (from_van_stock IS NOT TRUE OR van_stock_item_id IS NOT NULL)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_parts_external_purchase_has_name'
  ) THEN
    ALTER TABLE job_parts
      ADD CONSTRAINT job_parts_external_purchase_has_name
      CHECK (is_external_purchase IS NOT TRUE OR (part_name IS NOT NULL AND part_name <> ''))
      NOT VALID;
  END IF;
END $$;

-- ============================================================================
-- 4. Indexes for "(VS)" / "(EXT)" filter performance on the parts list
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_job_parts_from_van_stock
  ON job_parts (job_id) WHERE from_van_stock = TRUE;

CREATE INDEX IF NOT EXISTS idx_job_parts_external_purchase
  ON job_parts (job_id) WHERE is_external_purchase = TRUE;

COMMIT;

-- ============================================================================
-- Post-apply verification
-- ============================================================================
DO $$
DECLARE
  v_cols INT;
  v_nulls INT;
BEGIN
  SELECT COUNT(*) INTO v_cols FROM information_schema.columns
   WHERE table_name='job_parts'
     AND column_name IN ('is_external_purchase','external_purchase_notes');
  IF v_cols <> 2 THEN
    RAISE EXCEPTION 'Expected 2 new job_parts columns, got %', v_cols;
  END IF;

  SELECT COUNT(*) INTO v_nulls FROM job_parts WHERE from_van_stock IS NULL;
  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % rows with NULL from_van_stock', v_nulls;
  END IF;

  RAISE NOTICE 'Migration applied. job_parts now supports external_purchase + van_stock marker.';
END $$;

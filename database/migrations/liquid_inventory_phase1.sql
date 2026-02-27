-- =============================================================================
-- Liquid Inventory Phase 1: Cost Tracking & Purchase Flow
-- Created: 2026-02-27
-- DO NOT RUN — Phoenix will apply this manually.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend inventory_movement_type enum with new values (if not present)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'van_transfer'
      AND enumtypid = 'inventory_movement_type'::regtype
  ) THEN
    ALTER TYPE inventory_movement_type ADD VALUE 'van_transfer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'job_usage'
      AND enumtypid = 'inventory_movement_type'::regtype
  ) THEN
    ALTER TYPE inventory_movement_type ADD VALUE 'job_usage';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'special_sale'
      AND enumtypid = 'inventory_movement_type'::regtype
  ) THEN
    ALTER TYPE inventory_movement_type ADD VALUE 'special_sale';
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. Add columns to inventory_movements
-- -----------------------------------------------------------------------------
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS reference_number    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS unit_cost_at_time   NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS total_cost          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS forklift_id         UUID REFERENCES forklifts(forklift_id) ON DELETE SET NULL;

COMMENT ON COLUMN inventory_movements.reference_number  IS 'PO number, job ID, van name, etc.';
COMMENT ON COLUMN inventory_movements.unit_cost_at_time IS 'Cost per liter at time of movement (for FIFO costing)';
COMMENT ON COLUMN inventory_movements.total_cost        IS 'unit_cost_at_time x quantity moved';
COMMENT ON COLUMN inventory_movements.forklift_id       IS 'Forklift associated with job_usage movements';

-- -----------------------------------------------------------------------------
-- 3. Add cost columns to parts
-- -----------------------------------------------------------------------------
ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS avg_cost_per_liter           NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS last_purchase_cost_per_liter NUMERIC(10,4);

COMMENT ON COLUMN parts.avg_cost_per_liter           IS 'Weighted average cost per liter, updated on each purchase';
COMMENT ON COLUMN parts.last_purchase_cost_per_liter IS 'Cost per liter from the most recent purchase batch';

-- -----------------------------------------------------------------------------
-- 4. Create purchase_batches table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_batches (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id                  UUID NOT NULL REFERENCES parts(part_id) ON DELETE RESTRICT,

  -- Container details
  container_qty            NUMERIC NOT NULL CHECK (container_qty > 0),
  container_size_liters    NUMERIC NOT NULL CHECK (container_size_liters > 0),
  total_liters             NUMERIC GENERATED ALWAYS AS (container_qty * container_size_liters) STORED,

  -- Pricing
  total_purchase_price_myr NUMERIC(10,2) NOT NULL CHECK (total_purchase_price_myr >= 0),
  cost_per_liter           NUMERIC(10,4) GENERATED ALWAYS AS (
                             total_purchase_price_myr / NULLIF(container_qty * container_size_liters, 0)
                           ) STORED,

  -- Reference
  po_reference             VARCHAR(50),

  -- Receipt details
  received_by              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  received_by_name         VARCHAR,
  received_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE purchase_batches IS 'Records of liquid product purchased from suppliers, with per-liter cost calculation';

-- -----------------------------------------------------------------------------
-- 5. Indexes on purchase_batches
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchase_batches_part_id
  ON purchase_batches(part_id);

CREATE INDEX IF NOT EXISTS idx_purchase_batches_received_at
  ON purchase_batches(received_at DESC);

-- -----------------------------------------------------------------------------
-- 6. RLS on purchase_batches
-- -----------------------------------------------------------------------------
ALTER TABLE purchase_batches ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "purchase_batches_admin_all"
  ON purchase_batches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- All authenticated users can read
CREATE POLICY "purchase_batches_read"
  ON purchase_batches
  FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 7. Function: update_avg_cost_per_liter
--    Recalculates weighted average cost per liter for a part from all batches.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_avg_cost_per_liter(p_part_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_cost           NUMERIC(10,4);
  v_last_purchase_cost NUMERIC(10,4);
BEGIN
  -- Weighted average: sum(total_price) / sum(total_liters)
  SELECT
    SUM(total_purchase_price_myr) / NULLIF(SUM(total_liters), 0),
    (
      SELECT cost_per_liter
      FROM purchase_batches
      WHERE part_id = p_part_id
        AND total_liters > 0
      ORDER BY received_at DESC
      LIMIT 1
    )
  INTO v_avg_cost, v_last_purchase_cost
  FROM purchase_batches
  WHERE part_id = p_part_id
    AND total_liters > 0;

  UPDATE parts
  SET
    avg_cost_per_liter           = v_avg_cost,
    last_purchase_cost_per_liter = v_last_purchase_cost
  WHERE part_id = p_part_id;
END;
$$;

COMMENT ON FUNCTION update_avg_cost_per_liter(UUID) IS
  'Recalculates weighted average cost per liter for a part from all purchase_batches. Call after every purchase batch insert.';

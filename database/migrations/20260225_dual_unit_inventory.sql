-- ============================================
-- DUAL-UNIT INVENTORY TRACKING
-- Supports liquid items (oil, coolant, etc.) with
-- sealed containers + loose bulk quantities
-- ============================================

-- ============================================
-- 1. Add dual-unit columns to parts catalog
-- ============================================
ALTER TABLE parts ADD COLUMN IF NOT EXISTS base_unit VARCHAR(10) DEFAULT 'pcs';
ALTER TABLE parts ADD COLUMN IF NOT EXISTS container_unit VARCHAR(20) DEFAULT NULL;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS container_size DECIMAL(10,3) DEFAULT NULL;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS container_quantity INTEGER DEFAULT 0;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS bulk_quantity DECIMAL(12,3) DEFAULT 0;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS price_per_base_unit DECIMAL(12,2) DEFAULT NULL;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS is_liquid BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN parts.base_unit IS 'Base tracking unit: pcs, L, ml, kg';
COMMENT ON COLUMN parts.container_unit IS 'Container type: bottle, drum, jerry_can, box (NULL = no container)';
COMMENT ON COLUMN parts.container_size IS 'Base units per container (e.g. 5.0 = 1 bottle holds 5L)';
COMMENT ON COLUMN parts.container_quantity IS 'Sealed/full containers in store inventory';
COMMENT ON COLUMN parts.bulk_quantity IS 'Loose base units (opened/partial containers)';
COMMENT ON COLUMN parts.price_per_base_unit IS 'Price per base unit (sell_price / container_size for liquids)';
COMMENT ON COLUMN parts.is_liquid IS 'Auto-detected or manually set liquid flag';

-- ============================================
-- 2. Add dual-unit columns to van_stock_items
-- ============================================
ALTER TABLE van_stock_items ADD COLUMN IF NOT EXISTS container_quantity INTEGER DEFAULT 0;
ALTER TABLE van_stock_items ADD COLUMN IF NOT EXISTS bulk_quantity DECIMAL(12,3) DEFAULT 0;

COMMENT ON COLUMN van_stock_items.container_quantity IS 'Sealed containers on van';
COMMENT ON COLUMN van_stock_items.bulk_quantity IS 'Loose base units on van (stays on van until used)';

-- ============================================
-- 3. Inventory movements audit trail
-- ============================================
CREATE TYPE inventory_movement_type AS ENUM (
  'purchase',         -- Store buys from supplier
  'break_container',  -- Sealed -> loose (one-way, logged)
  'use_internal',     -- Used on internal/rental unit job
  'sell_external',    -- Sold sealed to external client
  'transfer_to_van',  -- Store -> Van (sealed bottles only)
  'return_to_store',  -- Van -> Store (sealed bottles only)
  'adjustment',       -- Manual stock correction
  'initial_stock'     -- Initial inventory setup
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES parts(part_id),
  
  -- What happened
  movement_type inventory_movement_type NOT NULL,
  
  -- Quantities
  container_qty_change INTEGER DEFAULT 0,      -- +/- sealed containers
  bulk_qty_change DECIMAL(12,3) DEFAULT 0,     -- +/- loose base units
  
  -- Context
  job_id UUID REFERENCES jobs(job_id),                          -- Which job (if usage)
  van_stock_id UUID REFERENCES van_stocks(van_stock_id),        -- Which van (if transfer)
  van_stock_item_id UUID REFERENCES van_stock_items(item_id),   -- Which van item
  
  -- Who & when
  performed_by UUID NOT NULL,
  performed_by_name VARCHAR(255),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Audit
  notes TEXT,
  
  -- Snapshot at time of movement (for reconciliation)
  store_container_qty_after INTEGER,
  store_bulk_qty_after DECIMAL(12,3),
  van_container_qty_after INTEGER,
  van_bulk_qty_after DECIMAL(12,3),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inv_movements_part ON inventory_movements(part_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inv_movements_job ON inventory_movements(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_movements_van ON inventory_movements(van_stock_id) WHERE van_stock_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_movements_date ON inventory_movements(performed_at);

-- ============================================
-- 4. Migrate existing stock_quantity data
-- For non-liquid parts: stock_quantity -> container_quantity
-- (bulk_quantity stays 0 for pcs-based items)
-- ============================================
UPDATE parts
SET container_quantity = COALESCE(stock_quantity, 0),
    base_unit = COALESCE(unit, 'pcs')
WHERE container_quantity = 0 AND COALESCE(stock_quantity, 0) > 0;

-- ============================================
-- 5. Migrate existing van_stock_items quantity
-- ============================================
UPDATE van_stock_items
SET container_quantity = COALESCE(quantity, 0)
WHERE container_quantity = 0 AND COALESCE(quantity, 0) > 0;

-- ============================================
-- 6. RLS policies for inventory_movements
-- ============================================
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read movements for their org's parts
CREATE POLICY "inventory_movements_select" ON inventory_movements
  FOR SELECT TO authenticated
  USING (
    part_id IN (SELECT part_id FROM parts)
  );

-- Admins and techs can insert movements
CREATE POLICY "inventory_movements_insert" ON inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
  );

-- Migration: Van History Tab + Decimal Quantity Support
-- Date: 2026-02-16
-- Features:
--   1. Add unit field to parts table (for display: "pcs", "L", "kg", etc.)
--   2. Alter quantity columns to DECIMAL for decimal support (e.g., 1.5L hydraulic oil)
--   3. Create index on van_stock_usage for history queries

-- ============================================
-- 1. Add unit field to parts
-- ============================================
ALTER TABLE parts ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'pcs';

-- ============================================
-- 2. Alter van_stock_items quantities to DECIMAL
-- ============================================
ALTER TABLE van_stock_items 
  ALTER COLUMN quantity TYPE DECIMAL(10,2) USING quantity::DECIMAL(10,2),
  ALTER COLUMN min_quantity TYPE DECIMAL(10,2) USING min_quantity::DECIMAL(10,2),
  ALTER COLUMN max_quantity TYPE DECIMAL(10,2) USING max_quantity::DECIMAL(10,2);

-- ============================================
-- 3. Alter van_stock_usage quantity to DECIMAL
-- ============================================
ALTER TABLE van_stock_usage 
  ALTER COLUMN quantity_used TYPE DECIMAL(10,2) USING quantity_used::DECIMAL(10,2);

-- ============================================
-- 4. Alter job_parts quantity to DECIMAL (if integer)
-- ============================================
ALTER TABLE job_parts 
  ALTER COLUMN quantity TYPE DECIMAL(10,2) USING quantity::DECIMAL(10,2);

-- ============================================
-- 5. Alter van_stock_replenishment_items quantities to DECIMAL
-- ============================================
ALTER TABLE van_stock_replenishment_items 
  ALTER COLUMN quantity_requested TYPE DECIMAL(10,2) USING quantity_requested::DECIMAL(10,2),
  ALTER COLUMN quantity_issued TYPE DECIMAL(10,2) USING quantity_issued::DECIMAL(10,2);

-- ============================================
-- 6. Indexes for van history queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_van_stock_usage_van_item 
  ON van_stock_usage(van_stock_item_id);

CREATE INDEX IF NOT EXISTS idx_van_stock_usage_job 
  ON van_stock_usage(job_id);

CREATE INDEX IF NOT EXISTS idx_van_stock_usage_used_at 
  ON van_stock_usage(used_at DESC);

-- ============================================
-- 7. Drop and recreate the low stock index (was on INTEGER, now DECIMAL)
-- ============================================
DROP INDEX IF EXISTS idx_van_stock_items_low_stock;
CREATE INDEX idx_van_stock_items_low_stock 
  ON van_stock_items(van_stock_id, quantity) 
  WHERE quantity < min_quantity;

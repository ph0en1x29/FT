-- Migration: Simplified Forklift Rental System (v2)
-- Cleaner architecture without circular FKs
-- Run this AFTER dropping the old structure if it exists

-- =====================================================
-- 1. DROP OLD PROBLEMATIC STRUCTURE (if exists)
-- =====================================================
DROP TRIGGER IF EXISTS trg_update_forklift_on_rental ON forklift_rentals;
DROP FUNCTION IF EXISTS update_forklift_on_rental();
DROP VIEW IF EXISTS active_rentals_view;

-- Remove circular FK from forklifts if it exists
ALTER TABLE forklifts DROP CONSTRAINT IF EXISTS forklifts_current_rental_id_fkey;
ALTER TABLE forklifts DROP COLUMN IF EXISTS current_rental_id;

-- =====================================================
-- 2. ENSURE FORKLIFTS TABLE HAS NEEDED COLUMNS
-- =====================================================
-- Add current_customer_id if not exists (simple one-way FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'forklifts' AND column_name = 'current_customer_id'
  ) THEN
    ALTER TABLE forklifts ADD COLUMN current_customer_id UUID REFERENCES customers(customer_id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for quick customer lookup
CREATE INDEX IF NOT EXISTS idx_forklifts_current_customer ON forklifts(current_customer_id);

-- =====================================================
-- 3. CREATE/UPDATE FORKLIFT RENTALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS forklift_rentals (
  rental_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  
  -- Rental period
  start_date DATE NOT NULL,
  end_date DATE,  -- NULL means ongoing/indefinite rental
  
  -- Status: 'active', 'ended'
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  
  -- Snapshot of location at time of rental (for history)
  rental_location TEXT,
  
  -- Notes
  notes TEXT,
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID,
  created_by_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by_id UUID,
  ended_by_name TEXT
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_rentals_forklift ON forklift_rentals(forklift_id);
CREATE INDEX IF NOT EXISTS idx_rentals_customer ON forklift_rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON forklift_rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_active ON forklift_rentals(forklift_id, status) WHERE status = 'active';

-- =====================================================
-- 5. CONSTRAINT: Only one active rental per forklift
-- =====================================================
-- This ensures data integrity at the DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_rental_per_forklift 
  ON forklift_rentals(forklift_id) 
  WHERE status = 'active';

-- =====================================================
-- 6. HELPER VIEW: Active Rentals with Details
-- =====================================================
CREATE OR REPLACE VIEW v_active_rentals AS
SELECT 
  r.rental_id,
  r.forklift_id,
  r.customer_id,
  r.start_date,
  r.end_date,
  r.rental_location,
  r.notes,
  r.created_at,
  f.serial_number,
  f.make,
  f.model,
  f.type AS forklift_type,
  f.hourmeter,
  f.status AS forklift_status,
  c.name AS customer_name,
  c.address AS customer_address,
  c.phone AS customer_phone
FROM forklift_rentals r
JOIN forklifts f ON r.forklift_id = f.forklift_id
JOIN customers c ON r.customer_id = c.customer_id
WHERE r.status = 'active';

-- =====================================================
-- 7. HELPER VIEW: Forklift Summary with Current Rental
-- =====================================================
CREATE OR REPLACE VIEW v_forklifts_with_rentals AS
SELECT 
  f.*,
  r.rental_id AS active_rental_id,
  r.start_date AS rental_start_date,
  r.end_date AS rental_end_date,
  r.notes AS rental_notes,
  c.name AS current_customer_name,
  c.address AS current_customer_address,
  c.phone AS current_customer_phone
FROM forklifts f
LEFT JOIN forklift_rentals r ON f.forklift_id = r.forklift_id AND r.status = 'active'
LEFT JOIN customers c ON r.customer_id = c.customer_id;

-- =====================================================
-- 8. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE forklift_rentals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON forklift_rentals;
CREATE POLICY "Allow all for authenticated" ON forklift_rentals
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- NOTES ON APPLICATION LOGIC:
-- =====================================================
-- The application layer (supabaseService.ts) handles:
-- 
-- When CREATING a rental:
--   1. Insert into forklift_rentals with status='active'
--   2. Update forklifts SET current_customer_id = X, location = customer_address
--
-- When ENDING a rental:
--   1. Update forklift_rentals SET status='ended', ended_at=NOW()
--   2. Update forklifts SET current_customer_id = NULL
--
-- This approach:
--   - Avoids circular FKs and trigger complexity
--   - Keeps logic in one place (application)
--   - Is easier to debug and extend
--   - Still maintains data integrity via unique index
-- =====================================================

-- Migration: Forklift Rental/Assignment System
-- This enables tracking which forklifts are rented to which customers
-- with rental start/end dates and automatic location sync

-- =====================================================
-- 1. CREATE FORKLIFT RENTALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS forklift_rentals (
  rental_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  
  -- Rental period
  start_date DATE NOT NULL,
  end_date DATE,  -- NULL means ongoing/indefinite rental
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'scheduled')),
  
  -- Location tracking (synced from customer address)
  rental_location TEXT,
  
  -- Notes for this specific rental
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID REFERENCES users(user_id),
  created_by_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by_id UUID REFERENCES users(user_id),
  ended_by_name TEXT
);

-- =====================================================
-- 2. ADD INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_forklift_rentals_forklift ON forklift_rentals(forklift_id);
CREATE INDEX IF NOT EXISTS idx_forklift_rentals_customer ON forklift_rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_forklift_rentals_status ON forklift_rentals(status);
CREATE INDEX IF NOT EXISTS idx_forklift_rentals_dates ON forklift_rentals(start_date, end_date);

-- =====================================================
-- 3. UPDATE FORKLIFTS TABLE (if not already has customer_id)
-- =====================================================
-- Add current_customer_id for quick lookup of current assignment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'forklifts' AND column_name = 'current_customer_id'
  ) THEN
    ALTER TABLE forklifts ADD COLUMN current_customer_id UUID REFERENCES customers(customer_id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'forklifts' AND column_name = 'current_rental_id'
  ) THEN
    ALTER TABLE forklifts ADD COLUMN current_rental_id UUID REFERENCES forklift_rentals(rental_id);
  END IF;
END $$;

-- =====================================================
-- 4. FUNCTION TO AUTO-UPDATE FORKLIFT LOCATION ON RENTAL
-- =====================================================
CREATE OR REPLACE FUNCTION update_forklift_on_rental()
RETURNS TRIGGER AS $$
DECLARE
  customer_address TEXT;
BEGIN
  -- When a new rental is created with 'active' status
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    -- Get customer address
    SELECT address INTO customer_address FROM customers WHERE customer_id = NEW.customer_id;
    
    -- Update forklift with new customer and location
    UPDATE forklifts SET
      current_customer_id = NEW.customer_id,
      current_rental_id = NEW.rental_id,
      location = COALESCE(customer_address, NEW.rental_location),
      updated_at = NOW()
    WHERE forklift_id = NEW.forklift_id;
    
    -- Store the location in rental record
    NEW.rental_location := COALESCE(NEW.rental_location, customer_address);
  END IF;
  
  -- When rental status changes to 'ended'
  IF TG_OP = 'UPDATE' AND NEW.status = 'ended' AND OLD.status = 'active' THEN
    -- Clear forklift's current customer
    UPDATE forklifts SET
      current_customer_id = NULL,
      current_rental_id = NULL,
      updated_at = NOW()
    WHERE forklift_id = NEW.forklift_id;
    
    -- Set ended timestamp
    NEW.ended_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_forklift_on_rental ON forklift_rentals;
CREATE TRIGGER trg_update_forklift_on_rental
  BEFORE INSERT OR UPDATE ON forklift_rentals
  FOR EACH ROW
  EXECUTE FUNCTION update_forklift_on_rental();

-- =====================================================
-- 5. VIEW FOR ACTIVE RENTALS WITH FULL DETAILS
-- =====================================================
CREATE OR REPLACE VIEW active_rentals_view AS
SELECT 
  r.rental_id,
  r.forklift_id,
  r.customer_id,
  r.start_date,
  r.end_date,
  r.status,
  r.rental_location,
  r.notes,
  r.created_at,
  f.serial_number,
  f.make,
  f.model,
  f.type AS forklift_type,
  f.hourmeter,
  c.name AS customer_name,
  c.address AS customer_address,
  c.phone AS customer_phone
FROM forklift_rentals r
JOIN forklifts f ON r.forklift_id = f.forklift_id
JOIN customers c ON r.customer_id = c.customer_id
WHERE r.status = 'active';

-- =====================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE forklift_rentals ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users" ON forklift_rentals
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- USAGE NOTES:
-- =====================================================
-- To assign a forklift to a customer:
-- INSERT INTO forklift_rentals (forklift_id, customer_id, start_date, status)
-- VALUES ('forklift-uuid', 'customer-uuid', '2024-01-15', 'active');
--
-- To end a rental:
-- UPDATE forklift_rentals SET status = 'ended', end_date = CURRENT_DATE
-- WHERE rental_id = 'rental-uuid';
--
-- The trigger will automatically:
-- 1. Update the forklift's location to match customer's address
-- 2. Set current_customer_id on the forklift
-- 3. Clear customer_id when rental ends

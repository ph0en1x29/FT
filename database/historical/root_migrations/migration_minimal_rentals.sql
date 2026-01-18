-- MINIMAL MIGRATION: Add current_customer_id column only
-- Run this first if you get errors about missing columns

-- Add current_customer_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'forklifts' AND column_name = 'current_customer_id'
  ) THEN
    ALTER TABLE forklifts ADD COLUMN current_customer_id UUID;
  END IF;
END $$;

-- Create forklift_rentals table if it doesn't exist
CREATE TABLE IF NOT EXISTS forklift_rentals (
  rental_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  rental_location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_id UUID,
  created_by_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by_id UUID,
  ended_by_name TEXT
);

-- Enable RLS
ALTER TABLE forklift_rentals ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now
DROP POLICY IF EXISTS "Allow all" ON forklift_rentals;
CREATE POLICY "Allow all" ON forklift_rentals FOR ALL USING (true) WITH CHECK (true);

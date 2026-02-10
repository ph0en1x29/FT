-- =============================================
-- Phase 1: Store Manager + Part Request Flow
-- Adds issuance tracking and out-of-stock workflow
-- =============================================

-- Add new columns to job_requests for issuance tracking
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES users(user_id);
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS supplier_order_notes TEXT;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS supplier_order_date TIMESTAMPTZ;
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS part_received_at TIMESTAMPTZ;

-- Update status check constraint to include new statuses
-- First drop existing constraint if any
ALTER TABLE job_requests DROP CONSTRAINT IF EXISTS job_requests_status_check;
ALTER TABLE job_requests ADD CONSTRAINT job_requests_status_check 
  CHECK (status IN ('pending', 'approved', 'issued', 'out_of_stock', 'part_ordered', 'rejected'));

-- Add "Pending Parts" to jobs status (no constraint change needed — status is text)
-- Just document it here for reference

-- Index for Store Manager dashboard queries
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);
CREATE INDEX IF NOT EXISTS idx_job_requests_issued_by ON job_requests(issued_by);

-- Add foreign key for issued_by user join
COMMENT ON COLUMN job_requests.issued_by IS 'Admin 2 (Store) who physically issued the part';
COMMENT ON COLUMN job_requests.issued_at IS 'When the part was physically issued';
COMMENT ON COLUMN job_requests.collected_at IS 'When technician confirmed collection';
COMMENT ON COLUMN job_requests.supplier_order_notes IS 'Notes about supplier order when out of stock';
COMMENT ON COLUMN job_requests.supplier_order_date IS 'When supplier order was placed';
COMMENT ON COLUMN job_requests.part_received_at IS 'When ordered part was received from supplier';

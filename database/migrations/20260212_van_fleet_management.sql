-- Van Fleet Management: status, temp assignments, access requests, audit trail
-- Migration: 20260212_van_fleet_management.sql

-- 1. Add fleet management columns to van_stocks
ALTER TABLE van_stocks 
  ADD COLUMN IF NOT EXISTS van_status text NOT NULL DEFAULT 'active' 
    CHECK (van_status IN ('active', 'in_service', 'decommissioned')),
  ADD COLUMN IF NOT EXISTS temporary_tech_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS temporary_tech_name text,
  ADD COLUMN IF NOT EXISTS temp_assigned_at timestamptz;

-- Add van identification columns
ALTER TABLE van_stocks
  ADD COLUMN IF NOT EXISTS van_code text,
  ADD COLUMN IF NOT EXISTS van_plate text,
  ADD COLUMN IF NOT EXISTS notes text;

-- van_plate = license plate (required going forward, but nullable for existing rows)
-- van_code = internal van identifier (e.g., "Van A")

-- 2. Van access requests table
CREATE TABLE IF NOT EXISTS van_access_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  van_stock_id uuid NOT NULL REFERENCES van_stocks(van_stock_id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES auth.users(id),
  requester_name text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_id uuid REFERENCES auth.users(id),
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Van audit log table
CREATE TABLE IF NOT EXISTS van_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  van_stock_id uuid NOT NULL REFERENCES van_stocks(van_stock_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'status_change', 'temp_assigned', 'temp_removed', 
    'request_submitted', 'request_approved', 'request_rejected',
    'van_created', 'van_updated'
  )),
  performed_by_id uuid NOT NULL,
  performed_by_name text NOT NULL,
  target_tech_id uuid,
  target_tech_name text,
  reason text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_van_access_requests_status ON van_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_van_access_requests_van ON van_access_requests(van_stock_id);
CREATE INDEX IF NOT EXISTS idx_van_audit_log_van ON van_audit_log(van_stock_id);
CREATE INDEX IF NOT EXISTS idx_van_audit_log_created ON van_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_van_stocks_temp_tech ON van_stocks(temporary_tech_id);
CREATE INDEX IF NOT EXISTS idx_van_stocks_status ON van_stocks(van_status);

-- RLS
ALTER TABLE van_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE van_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "van_access_requests_all" ON van_access_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "van_audit_log_all" ON van_audit_log FOR ALL USING (true) WITH CHECK (true);

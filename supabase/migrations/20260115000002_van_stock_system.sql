-- Migration: Van Stock System
-- Run this in Supabase SQL Editor
-- Date: 2026-01-14

-- ============================================
-- 1. Create van_stocks table (technician Van Stock assignment)
-- ============================================
CREATE TABLE IF NOT EXISTS van_stocks (
  van_stock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Configuration
  max_items INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_id UUID REFERENCES users(user_id),
  created_by_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_audit_at TIMESTAMPTZ,
  next_audit_due TIMESTAMPTZ,

  -- One Van Stock per technician
  UNIQUE(technician_id)
);

-- ============================================
-- 2. Create van_stock_items table
-- ============================================
CREATE TABLE IF NOT EXISTS van_stock_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  van_stock_id UUID NOT NULL REFERENCES van_stocks(van_stock_id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts(part_id),

  -- Quantities
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 1,
  max_quantity INTEGER NOT NULL DEFAULT 5,

  -- Tracking
  last_replenished_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,

  -- Core vs specialty
  is_core_item BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique part per van stock
  UNIQUE(van_stock_id, part_id)
);

-- ============================================
-- 3. Create van_stock_usage table
-- ============================================
CREATE TABLE IF NOT EXISTS van_stock_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  van_stock_item_id UUID NOT NULL REFERENCES van_stock_items(item_id),
  job_id UUID NOT NULL REFERENCES jobs(job_id),
  job_part_id UUID REFERENCES job_parts(job_part_id),

  quantity_used INTEGER NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_by_id UUID NOT NULL REFERENCES users(user_id),
  used_by_name TEXT NOT NULL,

  -- Approval for customer-owned forklifts
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by_id UUID REFERENCES users(user_id),
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ,
  approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT
);

-- ============================================
-- 4. Create van_stock_replenishments table
-- ============================================
CREATE TABLE IF NOT EXISTS van_stock_replenishments (
  replenishment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  van_stock_id UUID NOT NULL REFERENCES van_stocks(van_stock_id),
  technician_id UUID NOT NULL REFERENCES users(user_id),

  -- Request details
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'cancelled')),
  request_type TEXT NOT NULL CHECK (request_type IN ('manual', 'auto_slot_in', 'low_stock')),
  triggered_by_job_id UUID REFERENCES jobs(job_id),

  -- Workflow
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by_id UUID REFERENCES users(user_id),
  requested_by_name TEXT,

  -- Admin 2 (Store) approval
  approved_by_id UUID REFERENCES users(user_id),
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ,

  -- Fulfillment
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by_id UUID REFERENCES users(user_id),
  fulfilled_by_name TEXT,

  -- Technician confirmation
  confirmed_by_technician BOOLEAN DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  confirmation_photo_url TEXT,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. Create van_stock_replenishment_items table
-- ============================================
CREATE TABLE IF NOT EXISTS van_stock_replenishment_items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  replenishment_id UUID NOT NULL REFERENCES van_stock_replenishments(replenishment_id) ON DELETE CASCADE,
  van_stock_item_id UUID NOT NULL REFERENCES van_stock_items(item_id),
  part_id UUID NOT NULL REFERENCES parts(part_id),
  part_name TEXT NOT NULL,
  part_code TEXT NOT NULL,

  quantity_requested INTEGER NOT NULL,
  quantity_issued INTEGER DEFAULT 0,

  -- Serial numbers for warranty (JSONB array)
  serial_numbers JSONB DEFAULT '[]'::jsonb,

  -- Rejection
  is_rejected BOOLEAN DEFAULT FALSE,
  rejection_reason TEXT
);

-- ============================================
-- 6. Create van_stock_audits table
-- ============================================
CREATE TABLE IF NOT EXISTS van_stock_audits (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  van_stock_id UUID NOT NULL REFERENCES van_stocks(van_stock_id),
  technician_id UUID NOT NULL REFERENCES users(user_id),

  -- Schedule
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'discrepancy_found')),

  -- Audit details
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  audited_by_id UUID REFERENCES users(user_id),
  audited_by_name TEXT,

  -- Results
  total_expected_value DECIMAL(10,2) DEFAULT 0,
  total_actual_value DECIMAL(10,2) DEFAULT 0,
  discrepancy_value DECIMAL(10,2) DEFAULT 0,

  -- Resolution
  discrepancy_notes TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_id UUID REFERENCES users(user_id),
  resolved_by_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 7. Create van_stock_audit_items table
-- ============================================
CREATE TABLE IF NOT EXISTS van_stock_audit_items (
  audit_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES van_stock_audits(audit_id) ON DELETE CASCADE,
  van_stock_item_id UUID NOT NULL REFERENCES van_stock_items(item_id),
  part_id UUID NOT NULL REFERENCES parts(part_id),
  part_name TEXT NOT NULL,

  expected_quantity INTEGER NOT NULL,
  actual_quantity INTEGER NOT NULL,
  discrepancy INTEGER GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED,

  notes TEXT
);

-- ============================================
-- 8. Add Van Stock tracking to job_parts
-- ============================================
ALTER TABLE job_parts
ADD COLUMN IF NOT EXISTS from_van_stock BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS van_stock_item_id UUID REFERENCES van_stock_items(item_id);

-- ============================================
-- 9. Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_van_stocks_technician ON van_stocks(technician_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_items_van_stock ON van_stock_items(van_stock_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_items_part ON van_stock_items(part_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_items_low_stock ON van_stock_items(van_stock_id, quantity) WHERE quantity < min_quantity;
CREATE INDEX IF NOT EXISTS idx_van_stock_usage_job ON van_stock_usage(job_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_usage_pending ON van_stock_usage(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_van_stock_replenishments_status ON van_stock_replenishments(status);
CREATE INDEX IF NOT EXISTS idx_van_stock_replenishments_pending ON van_stock_replenishments(status, requested_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_van_stock_audits_scheduled ON van_stock_audits(scheduled_date, status);

-- ============================================
-- 10. Create trigger for auto-replenishment on Slot-In
-- ============================================
CREATE OR REPLACE FUNCTION trigger_slot_in_replenishment()
RETURNS TRIGGER AS $$
DECLARE
  v_van_stock_id UUID;
  v_tech_id UUID;
  v_replenishment_id UUID;
  v_item RECORD;
BEGIN
  -- Only for Slot-In jobs when status changes to Completed
  IF NEW.job_type = 'Slot-In' AND NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
    -- Get technician's van stock
    SELECT van_stock_id, technician_id INTO v_van_stock_id, v_tech_id
    FROM van_stocks
    WHERE technician_id = NEW.assigned_technician_id AND is_active = TRUE;

    IF v_van_stock_id IS NOT NULL THEN
      -- Check if any Van Stock items were used and need replenishment
      FOR v_item IN
        SELECT vsi.item_id, vsi.part_id, vsi.quantity, vsi.min_quantity, vsi.max_quantity,
               p.part_name, p.part_code
        FROM van_stock_items vsi
        JOIN parts p ON vsi.part_id = p.part_id
        WHERE vsi.van_stock_id = v_van_stock_id
          AND vsi.quantity < vsi.min_quantity
      LOOP
        -- Create auto-replenishment request if not exists
        IF NOT EXISTS (
          SELECT 1 FROM van_stock_replenishments
          WHERE van_stock_id = v_van_stock_id
            AND status IN ('pending', 'approved', 'in_progress')
            AND request_type = 'auto_slot_in'
            AND triggered_by_job_id = NEW.job_id
        ) THEN
          INSERT INTO van_stock_replenishments (
            van_stock_id, technician_id, status, request_type,
            triggered_by_job_id, requested_at, notes
          ) VALUES (
            v_van_stock_id, v_tech_id, 'pending', 'auto_slot_in',
            NEW.job_id, NOW(), 'Auto-generated from Slot-In job completion'
          )
          RETURNING replenishment_id INTO v_replenishment_id;
        ELSE
          SELECT replenishment_id INTO v_replenishment_id
          FROM van_stock_replenishments
          WHERE van_stock_id = v_van_stock_id
            AND request_type = 'auto_slot_in'
            AND triggered_by_job_id = NEW.job_id
          LIMIT 1;
        END IF;

        -- Add item to replenishment if not already added
        INSERT INTO van_stock_replenishment_items (
          replenishment_id, van_stock_item_id, part_id, part_name, part_code,
          quantity_requested
        )
        SELECT v_replenishment_id, v_item.item_id, v_item.part_id,
               v_item.part_name, v_item.part_code,
               v_item.max_quantity - v_item.quantity
        WHERE NOT EXISTS (
          SELECT 1 FROM van_stock_replenishment_items
          WHERE replenishment_id = v_replenishment_id
            AND van_stock_item_id = v_item.item_id
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_slot_in_van_stock_replenishment ON jobs;
CREATE TRIGGER trigger_slot_in_van_stock_replenishment
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_slot_in_replenishment();

-- ============================================
-- 11. Create function to deduct Van Stock on usage
-- ============================================
CREATE OR REPLACE FUNCTION deduct_van_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.from_van_stock = TRUE AND NEW.van_stock_item_id IS NOT NULL THEN
    -- Deduct from Van Stock
    UPDATE van_stock_items
    SET quantity = quantity - NEW.quantity,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE item_id = NEW.van_stock_item_id;

    -- Record usage
    INSERT INTO van_stock_usage (
      van_stock_item_id, job_id, job_part_id, quantity_used,
      used_by_id, used_by_name, requires_approval, approval_status
    )
    SELECT
      NEW.van_stock_item_id,
      NEW.job_id,
      NEW.job_part_id,
      NEW.quantity,
      j.assigned_technician_id,
      j.assigned_technician_name,
      CASE WHEN f.ownership = 'customer' THEN TRUE ELSE FALSE END,
      CASE WHEN f.ownership = 'customer' THEN 'pending' ELSE 'approved' END
    FROM jobs j
    LEFT JOIN forklifts f ON j.forklift_id = f.forklift_id
    WHERE j.job_id = NEW.job_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deduct_van_stock ON job_parts;
CREATE TRIGGER trigger_deduct_van_stock
  AFTER INSERT ON job_parts
  FOR EACH ROW
  EXECUTE FUNCTION deduct_van_stock();

-- ============================================
-- 12. Create view for Van Stock dashboard
-- ============================================
CREATE OR REPLACE VIEW van_stock_summary AS
SELECT
  vs.van_stock_id,
  vs.technician_id,
  u.name as technician_name,
  vs.is_active,
  vs.last_audit_at,
  vs.next_audit_due,
  COUNT(vsi.item_id) as total_items,
  COUNT(vsi.item_id) FILTER (WHERE vsi.quantity < vsi.min_quantity) as low_stock_items,
  COALESCE(SUM(vsi.quantity * p.cost_price), 0) as total_value,
  (SELECT COUNT(*) FROM van_stock_replenishments vsr
   WHERE vsr.van_stock_id = vs.van_stock_id AND vsr.status = 'pending') as pending_replenishments
FROM van_stocks vs
JOIN users u ON vs.technician_id = u.user_id
LEFT JOIN van_stock_items vsi ON vs.van_stock_id = vsi.van_stock_id
LEFT JOIN parts p ON vsi.part_id = p.part_id
GROUP BY vs.van_stock_id, vs.technician_id, u.name, vs.is_active, vs.last_audit_at, vs.next_audit_due;

-- ============================================
-- 13. Create view for pending Van Stock approvals (customer forklifts)
-- ============================================
CREATE OR REPLACE VIEW pending_van_stock_approvals AS
SELECT
  vsu.usage_id,
  vsu.job_id,
  j.title as job_title,
  c.name as customer_name,
  f.serial_number as forklift_serial,
  f.ownership as forklift_ownership,
  p.part_name,
  p.part_code,
  vsu.quantity_used,
  vsu.used_at,
  vsu.used_by_name,
  u.name as technician_name
FROM van_stock_usage vsu
JOIN van_stock_items vsi ON vsu.van_stock_item_id = vsi.item_id
JOIN parts p ON vsi.part_id = p.part_id
JOIN jobs j ON vsu.job_id = j.job_id
JOIN users u ON vsu.used_by_id = u.user_id
LEFT JOIN customers c ON j.customer_id = c.customer_id
LEFT JOIN forklifts f ON j.forklift_id = f.forklift_id
WHERE vsu.approval_status = 'pending'
ORDER BY vsu.used_at DESC;

-- ============================================
-- 14. Schedule quarterly audits function
-- ============================================
CREATE OR REPLACE FUNCTION schedule_quarterly_audits()
RETURNS INTEGER AS $$
DECLARE
  scheduled_count INTEGER := 0;
  v_next_quarter DATE;
BEGIN
  -- Calculate next quarter start
  v_next_quarter := DATE_TRUNC('quarter', CURRENT_DATE + INTERVAL '3 months')::DATE;

  -- Schedule audits for all active Van Stocks that don't have one scheduled
  INSERT INTO van_stock_audits (van_stock_id, technician_id, scheduled_date, status)
  SELECT vs.van_stock_id, vs.technician_id, v_next_quarter, 'scheduled'
  FROM van_stocks vs
  WHERE vs.is_active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM van_stock_audits vsa
      WHERE vsa.van_stock_id = vs.van_stock_id
        AND vsa.scheduled_date >= v_next_quarter
        AND vsa.status IN ('scheduled', 'in_progress')
    );

  GET DIAGNOSTICS scheduled_count = ROW_COUNT;

  -- Update next_audit_due on van_stocks
  UPDATE van_stocks vs
  SET next_audit_due = v_next_quarter
  WHERE vs.is_active = TRUE
    AND (vs.next_audit_due IS NULL OR vs.next_audit_due < v_next_quarter);

  RETURN scheduled_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROLLBACK COMMANDS (if needed):
-- ============================================
-- DROP FUNCTION IF EXISTS schedule_quarterly_audits();
-- DROP VIEW IF EXISTS pending_van_stock_approvals;
-- DROP VIEW IF EXISTS van_stock_summary;
-- DROP TRIGGER IF EXISTS trigger_deduct_van_stock ON job_parts;
-- DROP FUNCTION IF EXISTS deduct_van_stock();
-- DROP TRIGGER IF EXISTS trigger_slot_in_van_stock_replenishment ON jobs;
-- DROP FUNCTION IF EXISTS trigger_slot_in_replenishment();
-- ALTER TABLE job_parts DROP COLUMN IF EXISTS van_stock_item_id;
-- ALTER TABLE job_parts DROP COLUMN IF EXISTS from_van_stock;
-- DROP TABLE IF EXISTS van_stock_audit_items;
-- DROP TABLE IF EXISTS van_stock_audits;
-- DROP TABLE IF EXISTS van_stock_replenishment_items;
-- DROP TABLE IF EXISTS van_stock_replenishments;
-- DROP TABLE IF EXISTS van_stock_usage;
-- DROP TABLE IF EXISTS van_stock_items;
-- DROP TABLE IF EXISTS van_stocks;

COMMIT;

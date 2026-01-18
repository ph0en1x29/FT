-- Migration: AutoCount Integration (Invoice Export Only)
-- Run this in Supabase SQL Editor
-- Date: 2026-01-15

-- ============================================
-- 1. Create autocount_exports table
-- ============================================
CREATE TABLE IF NOT EXISTS autocount_exports (
  export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,

  -- Export details
  export_type TEXT NOT NULL DEFAULT 'invoice' CHECK (export_type IN ('invoice', 'credit_note')),
  autocount_invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'exported', 'failed', 'cancelled')),

  -- Invoice data snapshot
  customer_code TEXT,
  customer_name TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  total_amount DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MYR',

  -- Line items (JSONB array)
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Export tracking
  exported_at TIMESTAMPTZ,
  exported_by_id UUID REFERENCES users(user_id),
  exported_by_name TEXT,
  export_error TEXT,

  -- Retry tracking
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Create autocount_customer_mappings table
-- ============================================
CREATE TABLE IF NOT EXISTS autocount_customer_mappings (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  autocount_customer_code TEXT NOT NULL,
  autocount_customer_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique mapping per customer
  UNIQUE(customer_id)
);

-- ============================================
-- 3. Create autocount_item_mappings table
-- ============================================
CREATE TABLE IF NOT EXISTS autocount_item_mappings (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES parts(part_id) ON DELETE CASCADE,
  autocount_item_code TEXT NOT NULL,
  autocount_item_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique mapping per part
  UNIQUE(part_id)
);

-- ============================================
-- 4. Create autocount_settings table
-- ============================================
CREATE TABLE IF NOT EXISTS autocount_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  api_endpoint TEXT,
  company_code TEXT,
  default_tax_code TEXT,
  default_currency TEXT NOT NULL DEFAULT 'MYR',
  auto_export_on_finalize BOOLEAN NOT NULL DEFAULT FALSE,
  labor_item_code TEXT,
  extra_charge_item_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_id UUID REFERENCES users(user_id),
  updated_by_name TEXT
);

-- Insert default settings
INSERT INTO autocount_settings (
  setting_id,
  is_enabled,
  default_currency,
  auto_export_on_finalize
) VALUES (
  gen_random_uuid(),
  FALSE,
  'MYR',
  FALSE
) ON CONFLICT DO NOTHING;

-- ============================================
-- 5. Add autocount fields to jobs table
-- ============================================
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS autocount_export_id UUID REFERENCES autocount_exports(export_id),
ADD COLUMN IF NOT EXISTS autocount_exported_at TIMESTAMPTZ;

-- ============================================
-- 6. Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_autocount_exports_job ON autocount_exports(job_id);
CREATE INDEX IF NOT EXISTS idx_autocount_exports_status ON autocount_exports(status) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_autocount_customer_mappings_code ON autocount_customer_mappings(autocount_customer_code);
CREATE INDEX IF NOT EXISTS idx_autocount_item_mappings_code ON autocount_item_mappings(autocount_item_code);

-- ============================================
-- 7. Create function to prepare invoice export
-- ============================================
CREATE OR REPLACE FUNCTION prepare_autocount_export(p_job_id UUID)
RETURNS UUID AS $$
DECLARE
  v_job RECORD;
  v_export_id UUID;
  v_customer_code TEXT;
  v_line_items JSONB := '[]'::jsonb;
  v_total DECIMAL(12,2) := 0;
  v_part RECORD;
  v_item_code TEXT;
BEGIN
  -- Get job details
  SELECT j.*, c.name as customer_name, c.customer_id as cust_id
  INTO v_job
  FROM jobs j
  LEFT JOIN customers c ON j.customer_id = c.customer_id
  WHERE j.job_id = p_job_id;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Get customer mapping
  SELECT autocount_customer_code INTO v_customer_code
  FROM autocount_customer_mappings
  WHERE customer_id = v_job.cust_id AND is_active = TRUE;

  -- Add labor as first line item if applicable
  IF v_job.labor_cost IS NOT NULL AND v_job.labor_cost > 0 THEN
    v_line_items := v_line_items || jsonb_build_object(
      'description', 'Labor - ' || COALESCE(v_job.title, 'Service'),
      'quantity', 1,
      'unit_price', v_job.labor_cost,
      'amount', v_job.labor_cost,
      'source_type', 'labor',
      'source_id', v_job.job_id::text
    );
    v_total := v_total + v_job.labor_cost;
  END IF;

  -- Add parts used
  FOR v_part IN
    SELECT jp.*, p.part_name, p.part_code, p.sell_price,
           aim.autocount_item_code
    FROM job_parts jp
    JOIN parts p ON jp.part_id = p.part_id
    LEFT JOIN autocount_item_mappings aim ON jp.part_id = aim.part_id AND aim.is_active = TRUE
    WHERE jp.job_id = p_job_id
  LOOP
    v_item_code := COALESCE(v_part.autocount_item_code, v_part.part_code);
    v_line_items := v_line_items || jsonb_build_object(
      'item_code', v_item_code,
      'description', v_part.part_name,
      'quantity', v_part.quantity,
      'unit_price', COALESCE(v_part.unit_price, v_part.sell_price),
      'amount', v_part.quantity * COALESCE(v_part.unit_price, v_part.sell_price),
      'source_type', 'part',
      'source_id', v_part.job_part_id::text
    );
    v_total := v_total + (v_part.quantity * COALESCE(v_part.unit_price, v_part.sell_price));
  END LOOP;

  -- Add extra charges
  IF v_job.extra_charges IS NOT NULL AND jsonb_array_length(v_job.extra_charges) > 0 THEN
    FOR i IN 0..jsonb_array_length(v_job.extra_charges) - 1 LOOP
      v_line_items := v_line_items || jsonb_build_object(
        'description', v_job.extra_charges->i->>'description',
        'quantity', 1,
        'unit_price', (v_job.extra_charges->i->>'amount')::decimal,
        'amount', (v_job.extra_charges->i->>'amount')::decimal,
        'source_type', 'extra_charge'
      );
      v_total := v_total + (v_job.extra_charges->i->>'amount')::decimal;
    END LOOP;
  END IF;

  -- Create export record
  INSERT INTO autocount_exports (
    job_id,
    export_type,
    customer_code,
    customer_name,
    invoice_date,
    total_amount,
    line_items,
    status
  ) VALUES (
    p_job_id,
    'invoice',
    v_customer_code,
    v_job.customer_name,
    CURRENT_DATE,
    v_total,
    v_line_items,
    'pending'
  )
  RETURNING export_id INTO v_export_id;

  -- Update job with export reference
  UPDATE jobs
  SET autocount_export_id = v_export_id
  WHERE job_id = p_job_id;

  RETURN v_export_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Create view for pending exports
-- ============================================
CREATE OR REPLACE VIEW pending_autocount_exports AS
SELECT
  ae.export_id,
  ae.job_id,
  j.title as job_title,
  j.service_report_number,
  ae.customer_name,
  ae.customer_code,
  ae.total_amount,
  ae.status,
  ae.retry_count,
  ae.export_error,
  ae.created_at,
  ae.updated_at
FROM autocount_exports ae
JOIN jobs j ON ae.job_id = j.job_id
WHERE ae.status IN ('pending', 'failed')
ORDER BY ae.created_at ASC;

-- ============================================
-- 9. Create view for export history
-- ============================================
CREATE OR REPLACE VIEW autocount_export_history AS
SELECT
  ae.export_id,
  ae.job_id,
  j.title as job_title,
  j.service_report_number,
  ae.autocount_invoice_number,
  ae.customer_name,
  ae.total_amount,
  ae.status,
  ae.exported_at,
  ae.exported_by_name,
  ae.export_error
FROM autocount_exports ae
JOIN jobs j ON ae.job_id = j.job_id
ORDER BY ae.created_at DESC;

-- ============================================
-- ROLLBACK COMMANDS (if needed):
-- ============================================
-- DROP VIEW IF EXISTS autocount_export_history;
-- DROP VIEW IF EXISTS pending_autocount_exports;
-- DROP FUNCTION IF EXISTS prepare_autocount_export(UUID);
-- ALTER TABLE jobs DROP COLUMN IF EXISTS autocount_exported_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS autocount_export_id;
-- DROP TABLE IF EXISTS autocount_settings;
-- DROP TABLE IF EXISTS autocount_item_mappings;
-- DROP TABLE IF EXISTS autocount_customer_mappings;
-- DROP TABLE IF EXISTS autocount_exports;

COMMIT;

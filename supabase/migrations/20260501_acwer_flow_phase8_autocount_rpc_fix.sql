-- ============================================================
-- Migration: ACWER Service Operations Flow — Phase 8 AutoCount RPC fix
-- Date: 2026-05-01
-- Purpose: Fix pre-existing bug in prepare_autocount_export(uuid). Original
--          was added in 20260115000006_autocount_integration.sql but
--          referenced v_part.unit_price which is NOT in the cursor SELECT
--          list. Calling the RPC failed with 42703 every time. Job_parts
--          uses sell_price_at_time as the per-row price.
-- ============================================================

BEGIN;

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
  v_unit_price NUMERIC;
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

  -- Add parts used. job_parts uses sell_price_at_time as the per-row price;
  -- fall back to the parts.sell_price snapshot if missing.
  FOR v_part IN
    SELECT jp.job_part_id, jp.quantity, jp.sell_price_at_time,
           p.part_name, p.part_code, p.sell_price,
           aim.autocount_item_code
    FROM job_parts jp
    JOIN parts p ON jp.part_id = p.part_id
    LEFT JOIN autocount_item_mappings aim ON jp.part_id = aim.part_id AND aim.is_active = TRUE
    WHERE jp.job_id = p_job_id
  LOOP
    v_item_code := COALESCE(v_part.autocount_item_code, v_part.part_code);
    v_unit_price := COALESCE(v_part.sell_price_at_time, v_part.sell_price, 0);
    v_line_items := v_line_items || jsonb_build_object(
      'item_code', v_item_code,
      'description', v_part.part_name,
      'quantity', v_part.quantity,
      'unit_price', v_unit_price,
      'amount', v_part.quantity * v_unit_price,
      'source_type', 'part',
      'source_id', v_part.job_part_id::text
    );
    v_total := v_total + (v_part.quantity * v_unit_price);
  END LOOP;

  -- Add extra charges from the dedicated extra_charges table (the original
  -- migration tried to read v_job.extra_charges which doesn't exist on the
  -- jobs row — a column-vs-relation confusion in the 2026-01-15 ship).
  DECLARE
    v_charge RECORD;
  BEGIN
    FOR v_charge IN
      SELECT description, amount FROM extra_charges WHERE job_id = p_job_id
    LOOP
      v_line_items := v_line_items || jsonb_build_object(
        'description', v_charge.description,
        'quantity', 1,
        'unit_price', v_charge.amount,
        'amount', v_charge.amount,
        'source_type', 'extra_charge'
      );
      v_total := v_total + v_charge.amount;
    END LOOP;
  END;

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

COMMIT;

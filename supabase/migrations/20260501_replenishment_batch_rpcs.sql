-- =============================================
-- FieldPro Migration: Replenishment batch RPCs
-- =============================================
-- Date: 2026-05-01
-- Purpose:
--   services/replenishmentService.ts had two N+1 patterns:
--     1. fulfillReplenishment looped per item-row to update van_stock_replenishment_items
--     2. confirmReplenishmentReceipt did a read-modify-write loop against
--        van_stock_items (one SELECT + one UPDATE per line)
--   Both collapse into single SQL functions: one batched UPDATE for the
--   line items, one increment-in-place for the stock quantity.
-- =============================================

BEGIN;

-- 1. Fulfill: update each line's quantity_issued + serial_numbers in one
--    statement, then update the parent header. p_items is a JSON array of
--    { item_id, quantity_issued, serial_numbers? }.
CREATE OR REPLACE FUNCTION fulfill_replenishment(
  p_replenishment_id uuid,
  p_items jsonb,
  p_fulfilled_by_id uuid,
  p_fulfilled_by_name text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE van_stock_replenishment_items vsri
  SET
    quantity_issued = (i ->> 'quantity_issued')::numeric,
    serial_numbers = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(i -> 'serial_numbers')),
      '{}'::text[]
    )
  FROM jsonb_array_elements(p_items) AS i
  WHERE vsri.item_id = (i ->> 'item_id')::uuid
    AND vsri.replenishment_id = p_replenishment_id;

  UPDATE van_stock_replenishments
  SET
    status = 'in_progress',
    fulfilled_at = NOW(),
    fulfilled_by_id = p_fulfilled_by_id,
    fulfilled_by_name = p_fulfilled_by_name,
    updated_at = NOW()
  WHERE replenishment_id = p_replenishment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fulfill_replenishment(uuid, jsonb, uuid, text) TO authenticated;

-- 2. Confirm receipt: replaces the per-item read-then-write loop. Increments
--    van_stock_items.quantity by the issued qty for every non-rejected line
--    in a single statement, then updates the parent header.
CREATE OR REPLACE FUNCTION confirm_replenishment_receipt(
  p_replenishment_id uuid,
  p_confirmation_photo_url text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE van_stock_items vsi
  SET
    quantity = vsi.quantity + vsri.quantity_issued,
    last_replenished_at = NOW(),
    updated_at = NOW()
  FROM van_stock_replenishment_items vsri
  WHERE vsri.replenishment_id = p_replenishment_id
    AND vsri.van_stock_item_id = vsi.item_id
    AND vsri.quantity_issued > 0
    AND vsri.is_rejected = FALSE;

  UPDATE van_stock_replenishments
  SET
    status = 'completed',
    confirmed_by_technician = TRUE,
    confirmed_at = NOW(),
    confirmation_photo_url = p_confirmation_photo_url,
    updated_at = NOW()
  WHERE replenishment_id = p_replenishment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_replenishment_receipt(uuid, text) TO authenticated;

COMMIT;

-- Verify
SELECT proname FROM pg_proc
WHERE proname IN ('fulfill_replenishment', 'confirm_replenishment_receipt')
ORDER BY proname;

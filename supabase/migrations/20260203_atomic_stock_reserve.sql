-- =============================================
-- FieldPro Migration: Atomic Stock Reserve Function
-- =============================================
-- Date: 2026-02-03
-- Purpose: Prevent race conditions in spare part approvals
--          Uses atomic UPDATE with row-level locking
-- =============================================

-- Function to atomically reserve stock
-- Returns true if stock was successfully reserved, false if insufficient
CREATE OR REPLACE FUNCTION reserve_part_stock(
  p_part_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  -- Atomic update: only succeeds if stock >= quantity
  -- Uses row-level lock to prevent concurrent modifications
  UPDATE parts 
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  WHERE part_id = p_part_id 
    AND stock_quantity >= p_quantity;
  
  -- Check if update affected any rows
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  
  RETURN v_row_count > 0;
END;
$$;

-- Function to rollback stock reservation
CREATE OR REPLACE FUNCTION rollback_part_stock(
  p_part_id UUID,
  p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE parts 
  SET stock_quantity = stock_quantity + p_quantity,
      updated_at = now()
  WHERE part_id = p_part_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reserve_part_stock(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_part_stock(UUID, INTEGER) TO authenticated;

-- Add comments
COMMENT ON FUNCTION reserve_part_stock IS 
  'Atomically reserves stock for a part. Returns true if successful, false if insufficient stock. Prevents race conditions.';
COMMENT ON FUNCTION rollback_part_stock IS 
  'Rolls back a stock reservation. Used when subsequent operations fail after stock was reserved.';

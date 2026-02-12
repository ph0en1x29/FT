-- Migration: Van Stock Hardening
-- 1. Atomic increment function for restock (avoids stale read race)
-- 2. DB trigger to prevent van change after parts used from van stock

-- ============================================
-- 1. Atomic increment for van stock item quantity
-- ============================================
CREATE OR REPLACE FUNCTION increment_van_stock_quantity(
  p_item_id UUID,
  p_increment INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE van_stock_items
  SET quantity = quantity + p_increment,
      updated_at = NOW()
  WHERE item_id = p_item_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Van stock item % not found', p_item_id;
  END IF;
END;
$$;

-- ============================================
-- 2. Prevent van change after parts used from van stock
-- ============================================
CREATE OR REPLACE FUNCTION prevent_van_change_after_parts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check when job_van_stock_id is being changed
  IF OLD.job_van_stock_id IS DISTINCT FROM NEW.job_van_stock_id THEN
    -- Check if any parts were used from van stock for this job
    IF EXISTS (
      SELECT 1 FROM job_parts
      WHERE job_id = NEW.job_id
        AND from_van_stock = TRUE
    ) THEN
      RAISE EXCEPTION 'Cannot change van after parts have been used from van stock';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_van_change ON jobs;
CREATE TRIGGER trigger_prevent_van_change
  BEFORE UPDATE OF job_van_stock_id ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_van_change_after_parts();

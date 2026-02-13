-- Atomic RPC for assigning temp tech (prevents race conditions)
CREATE OR REPLACE FUNCTION assign_temp_tech(
  p_van_stock_id uuid,
  p_tech_id uuid,
  p_tech_name text,
  p_performed_by_id uuid,
  p_performed_by_name text,
  p_reason text DEFAULT NULL
) RETURNS boolean AS $$
BEGIN
  -- Clear any existing temp assignment for this tech (atomically)
  UPDATE van_stocks 
  SET temporary_tech_id = NULL, temporary_tech_name = NULL, temp_assigned_at = NULL
  WHERE temporary_tech_id = p_tech_id;

  -- Assign to the target van
  UPDATE van_stocks
  SET temporary_tech_id = p_tech_id,
      temporary_tech_name = p_tech_name,
      temp_assigned_at = now(),
      updated_at = now()
  WHERE van_stock_id = p_van_stock_id;

  -- Audit log
  INSERT INTO van_audit_log (van_stock_id, action, performed_by_id, performed_by_name, target_tech_id, target_tech_name, reason)
  VALUES (p_van_stock_id, 'temp_assigned', p_performed_by_id, p_performed_by_name, p_tech_id, p_tech_name, p_reason);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic RPC for reviewing van access request (prevents double-approval race)
CREATE OR REPLACE FUNCTION review_van_access_request(
  p_request_id uuid,
  p_approved boolean,
  p_reviewer_id uuid,
  p_reviewer_name text
) RETURNS boolean AS $$
DECLARE
  v_request van_access_requests%ROWTYPE;
  v_new_status text;
BEGIN
  -- Lock and check status atomically
  SELECT * INTO v_request
  FROM van_access_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status != 'pending' THEN
    RETURN false;
  END IF;

  v_new_status := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;

  UPDATE van_access_requests
  SET status = v_new_status,
      reviewed_by_id = p_reviewer_id,
      reviewed_by_name = p_reviewer_name,
      reviewed_at = now()
  WHERE request_id = p_request_id;

  -- Audit log
  INSERT INTO van_audit_log (van_stock_id, action, performed_by_id, performed_by_name, target_tech_id, target_tech_name, reason)
  VALUES (v_request.van_stock_id,
          CASE WHEN p_approved THEN 'request_approved' ELSE 'request_rejected' END,
          p_reviewer_id, p_reviewer_name, v_request.requester_id, v_request.requester_name, v_request.reason);

  -- Auto-assign on approval
  IF p_approved THEN
    PERFORM assign_temp_tech(v_request.van_stock_id, v_request.requester_id, v_request.requester_name, p_reviewer_id, p_reviewer_name, 'Approved: ' || v_request.reason);
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

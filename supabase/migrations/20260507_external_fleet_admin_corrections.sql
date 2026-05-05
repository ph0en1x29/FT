-- 20260507_external_fleet_admin_corrections.sql
--
-- Admin correction tools for the external/customer-owned fleet flow that
-- shipped in 20260506_external_fleet_management.sql. Three new SECURITY
-- DEFINER RPCs:
--
--   1. acwer_edit_ownership_details      — fix mistakes in sale_date,
--                                          sale_price, customer_asset_no
--                                          (plus optional reason).
--   2. acwer_reverse_sale_to_fleet       — undo a sold_from_fleet sale.
--                                          Customer-owned (sold-from-fleet)
--                                          → company-owned. Refuses BYO.
--   3. acwer_transfer_between_customers  — owner change Customer A → B,
--                                          Acwer keeps servicing.
--
-- Each RPC is atomic and writes a forklift_history audit row.
--
-- forklift_history.event_type CHECK is widened to include two new values:
--   - 'sale_reversed'
--   - 'ownership_edited'
-- ('transferred' is reused as-is for customer-to-customer.)
--
-- Pre-existing live state (verified 2026-05-07 prep):
--   - 1321 fleet + 55 customer-owned forklifts
--   - forklift_history exists, populated by 20260506 migration
--   - 'transferred' is allowed by CHECK but no RPC writes it yet — this
--     migration wires that up.
--
-- Idempotent: rerunning is a no-op (CREATE OR REPLACE FUNCTION + checked
-- ALTER on the CHECK constraint). Safe to re-apply.

BEGIN;

-- ============================================================================
-- 1. forklift_history.event_type — widen CHECK to include new event types
-- ============================================================================
ALTER TABLE forklift_history
  DROP CONSTRAINT IF EXISTS forklift_history_event_type_check;

ALTER TABLE forklift_history
  ADD CONSTRAINT forklift_history_event_type_check
  CHECK (event_type IN (
    'sold_to_customer',
    'registered_byo',
    'transferred',
    'contract_started',
    'contract_ended',
    'service_status_changed',
    'note',
    -- new in this migration:
    'sale_reversed',
    'ownership_edited'
  ));

-- ============================================================================
-- 2. RPC: acwer_edit_ownership_details
--    Correct sale_date / sale_price / customer_asset_no on a customer-owned
--    forklift (typically a sold-from-fleet record). All fields optional —
--    only non-NULL parameters cause a UPDATE column. Writes an
--    'ownership_edited' audit row with before/after diff.
-- ============================================================================
CREATE OR REPLACE FUNCTION acwer_edit_ownership_details(
  p_forklift_id        UUID,
  p_sale_date          DATE           DEFAULT NULL,
  p_sale_price         NUMERIC(12,2)  DEFAULT NULL,
  p_customer_asset_no  TEXT           DEFAULT NULL,
  p_actor_id           UUID           DEFAULT NULL,
  p_actor_name         TEXT           DEFAULT NULL,
  p_correction_reason  TEXT           DEFAULT NULL,
  p_clear_sale_price   BOOLEAN        DEFAULT FALSE,
  p_clear_asset_no     BOOLEAN        DEFAULT FALSE
)
RETURNS forklifts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before        forklifts%ROWTYPE;
  v_after         forklifts%ROWTYPE;
  v_diff          JSONB := '{}'::jsonb;
BEGIN
  -- Load current row
  SELECT * INTO v_before FROM forklifts WHERE forklift_id = p_forklift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forklift % not found', p_forklift_id;
  END IF;

  IF v_before.ownership <> 'customer' THEN
    RAISE EXCEPTION 'Forklift % is not customer-owned (ownership=%); use acwer_transition_fleet_to_customer first',
                    p_forklift_id, v_before.ownership;
  END IF;

  -- Apply non-NULL updates. Use COALESCE to leave columns alone when arg is NULL.
  -- Honor explicit "clear" flags when admin wants to set NULL.
  UPDATE forklifts
     SET sold_to_customer_at = CASE
                                 WHEN p_sale_date IS NOT NULL
                                   THEN p_sale_date::timestamptz
                                 ELSE sold_to_customer_at
                               END,
         sold_price          = CASE
                                 WHEN p_clear_sale_price THEN NULL
                                 WHEN p_sale_price IS NOT NULL THEN p_sale_price
                                 ELSE sold_price
                               END,
         customer_forklift_no = CASE
                                  WHEN p_clear_asset_no THEN NULL
                                  WHEN p_customer_asset_no IS NOT NULL
                                       AND length(trim(p_customer_asset_no)) > 0
                                    THEN trim(p_customer_asset_no)
                                  ELSE customer_forklift_no
                                END,
         updated_at          = NOW()
   WHERE forklift_id = p_forklift_id
   RETURNING * INTO v_after;

  -- Build before/after diff for audit
  IF v_before.sold_to_customer_at IS DISTINCT FROM v_after.sold_to_customer_at THEN
    v_diff := v_diff || jsonb_build_object(
      'sold_to_customer_at',
      jsonb_build_object('from', v_before.sold_to_customer_at, 'to', v_after.sold_to_customer_at)
    );
  END IF;
  IF v_before.sold_price IS DISTINCT FROM v_after.sold_price THEN
    v_diff := v_diff || jsonb_build_object(
      'sold_price',
      jsonb_build_object('from', v_before.sold_price, 'to', v_after.sold_price)
    );
  END IF;
  IF v_before.customer_forklift_no IS DISTINCT FROM v_after.customer_forklift_no THEN
    v_diff := v_diff || jsonb_build_object(
      'customer_forklift_no',
      jsonb_build_object('from', v_before.customer_forklift_no, 'to', v_after.customer_forklift_no)
    );
  END IF;

  -- Only write audit row when something actually changed
  IF v_diff <> '{}'::jsonb THEN
    INSERT INTO forklift_history (
      forklift_id, event_type, event_data, actor_id, actor_name
    ) VALUES (
      p_forklift_id,
      'ownership_edited',
      jsonb_build_object('changes', v_diff, 'reason', p_correction_reason),
      p_actor_id,
      p_actor_name
    );
  END IF;

  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION acwer_edit_ownership_details IS
  'Admin correction RPC for customer-owned forklifts: edit sale_date, sale_price, customer_asset_no. NULL args leave columns unchanged. Set p_clear_sale_price=TRUE / p_clear_asset_no=TRUE to explicitly NULL a column. Writes an ownership_edited forklift_history row with a before/after diff when anything changes.';

-- ============================================================================
-- 3. RPC: acwer_reverse_sale_to_fleet
--    Undo a sold_from_fleet sale. Flips ownership back to company,
--    clears sale_date/sale_price, sets acquisition_source NULL.
--    Status returns to Available. Refuses BYO and refuses anything not
--    sold_from_fleet. Active rentals are NOT auto-reopened (admin starts
--    a fresh rental if needed).
-- ============================================================================
CREATE OR REPLACE FUNCTION acwer_reverse_sale_to_fleet(
  p_forklift_id  UUID,
  p_actor_id     UUID  DEFAULT NULL,
  p_actor_name   TEXT  DEFAULT NULL,
  p_reason       TEXT  DEFAULT NULL
)
RETURNS forklifts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before        forklifts%ROWTYPE;
  v_after         forklifts%ROWTYPE;
BEGIN
  SELECT * INTO v_before FROM forklifts WHERE forklift_id = p_forklift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forklift % not found', p_forklift_id;
  END IF;

  IF v_before.ownership <> 'customer' THEN
    RAISE EXCEPTION 'Forklift % is not customer-owned — nothing to reverse', p_forklift_id;
  END IF;

  IF v_before.acquisition_source IS DISTINCT FROM 'sold_from_fleet' THEN
    RAISE EXCEPTION 'Forklift % was not sold from fleet (acquisition_source=%); reversal is only supported for sold_from_fleet records',
                    p_forklift_id, COALESCE(v_before.acquisition_source, 'NULL');
  END IF;

  -- Flip back to fleet. Preserve original_fleet_forklift_id for the audit
  -- trail but clear the sale-specific provenance fields. customer_id is
  -- cleared too — the fleet doesn't belong to a customer anymore.
  UPDATE forklifts
     SET ownership                  = 'company',
         ownership_type             = 'fleet',
         acquisition_source         = NULL,
         current_customer_id        = NULL,
         customer_id                = NULL,
         customer_forklift_no       = NULL,
         sold_to_customer_at        = NULL,
         sold_price                 = NULL,
         service_management_status  = 'active',
         status                     = 'Available',
         updated_at                 = NOW()
   WHERE forklift_id = p_forklift_id
   RETURNING * INTO v_after;

  INSERT INTO forklift_history (
    forklift_id, event_type, event_data, actor_id, actor_name
  ) VALUES (
    p_forklift_id,
    'sale_reversed',
    jsonb_build_object(
      'previous_owner_customer_id', v_before.current_customer_id,
      'previous_sale_date',         v_before.sold_to_customer_at,
      'previous_sale_price',        v_before.sold_price,
      'previous_customer_asset_no', v_before.customer_forklift_no,
      'reason',                     p_reason
    ),
    p_actor_id,
    p_actor_name
  );

  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION acwer_reverse_sale_to_fleet IS
  'Admin RPC: undoes acwer_transition_fleet_to_customer for a sold_from_fleet record. Flips ownership back to company, clears sale fields, sets status=Available. Refuses BYO units and any non-sold-from-fleet customer-owned forklift. Active rentals are NOT auto-reopened. Writes a sale_reversed forklift_history row.';

-- ============================================================================
-- 4. RPC: acwer_transfer_between_customers
--    Customer-to-customer ownership change. Acwer continues to service.
--    Optionally updates customer_forklift_no for the new owner. Writes a
--    'transferred' audit row.
--
--    NOT auto-moved (intentional, to avoid silent invoicing breakage):
--      - service_contracts.customer_id (admin reassigns manually)
--      - recurring_schedules.customer_id (admin reassigns manually)
--    The RPC returns metadata about how many of those exist so the UI can
--    warn the admin.
-- ============================================================================
CREATE OR REPLACE FUNCTION acwer_transfer_between_customers(
  p_forklift_id            UUID,
  p_new_customer_id        UUID,
  p_transfer_date          DATE,
  p_actor_id               UUID  DEFAULT NULL,
  p_actor_name             TEXT  DEFAULT NULL,
  p_reason                 TEXT  DEFAULT NULL,
  p_new_customer_asset_no  TEXT  DEFAULT NULL,
  p_clear_asset_no         BOOLEAN DEFAULT FALSE
)
RETURNS forklifts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before              forklifts%ROWTYPE;
  v_after               forklifts%ROWTYPE;
  v_old_customer_id     UUID;
  v_active_contracts    INT;
  v_active_schedules    INT;
BEGIN
  SELECT * INTO v_before FROM forklifts WHERE forklift_id = p_forklift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forklift % not found', p_forklift_id;
  END IF;

  IF v_before.ownership <> 'customer' THEN
    RAISE EXCEPTION 'Forklift % is fleet-owned — use acwer_transition_fleet_to_customer instead',
                    p_forklift_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_id = p_new_customer_id) THEN
    RAISE EXCEPTION 'Customer % not found', p_new_customer_id;
  END IF;

  v_old_customer_id := v_before.current_customer_id;

  IF v_old_customer_id = p_new_customer_id THEN
    RAISE EXCEPTION 'Forklift % is already owned by customer %', p_forklift_id, p_new_customer_id;
  END IF;

  -- Apply the transfer
  UPDATE forklifts
     SET current_customer_id  = p_new_customer_id,
         customer_id          = p_new_customer_id,
         customer_forklift_no = CASE
                                  WHEN p_clear_asset_no THEN NULL
                                  WHEN p_new_customer_asset_no IS NOT NULL
                                       AND length(trim(p_new_customer_asset_no)) > 0
                                    THEN trim(p_new_customer_asset_no)
                                  ELSE customer_forklift_no
                                END,
         acquisition_source   = COALESCE(acquisition_source, 'transferred'),
         updated_at           = NOW()
   WHERE forklift_id = p_forklift_id
   RETURNING * INTO v_after;

  -- Count contracts/schedules tied to old customer that cover this forklift,
  -- so the UI can warn the admin to reassign manually.
  SELECT COUNT(*) INTO v_active_contracts
    FROM service_contracts sc
   WHERE sc.customer_id = v_old_customer_id
     AND sc.is_active = TRUE
     AND CURRENT_DATE BETWEEN sc.start_date AND sc.end_date
     AND (sc.covered_forklift_ids IS NULL
          OR cardinality(sc.covered_forklift_ids) = 0
          OR p_forklift_id = ANY(sc.covered_forklift_ids));

  SELECT COUNT(*) INTO v_active_schedules
    FROM recurring_schedules rs
   WHERE rs.forklift_id = p_forklift_id
     AND rs.customer_id = v_old_customer_id
     AND rs.is_active = TRUE;

  INSERT INTO forklift_history (
    forklift_id, event_type, event_data, actor_id, actor_name
  ) VALUES (
    p_forklift_id,
    'transferred',
    jsonb_build_object(
      'from_customer_id',         v_old_customer_id,
      'to_customer_id',           p_new_customer_id,
      'transfer_date',             p_transfer_date,
      'new_customer_asset_no',     p_new_customer_asset_no,
      'reason',                    p_reason,
      'orphaned_active_contracts', v_active_contracts,
      'orphaned_active_schedules', v_active_schedules
    ),
    p_actor_id,
    p_actor_name
  );

  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION acwer_transfer_between_customers IS
  'Admin RPC: transfers a customer-owned forklift from one customer to another (Acwer continues servicing). Updates current_customer_id + customer_id + optionally customer_asset_no. Does NOT auto-move active service_contracts or recurring_schedules tied to the old customer — those need manual reassignment. The audit row records orphaned_active_contracts / orphaned_active_schedules counts so the UI can prompt the admin.';

-- ============================================================================
-- 5. Helper: count contracts/schedules pinned to a customer that cover a
--    forklift. Used by the transfer modal preflight to show the warning
--    before the admin commits.
-- ============================================================================
CREATE OR REPLACE FUNCTION acwer_count_orphaned_obligations(
  p_forklift_id  UUID,
  p_customer_id  UUID
)
RETURNS TABLE (
  active_contracts  INT,
  active_schedules  INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  SELECT COUNT(*) INTO active_contracts
    FROM service_contracts sc
   WHERE sc.customer_id = p_customer_id
     AND sc.is_active = TRUE
     AND CURRENT_DATE BETWEEN sc.start_date AND sc.end_date
     AND (sc.covered_forklift_ids IS NULL
          OR cardinality(sc.covered_forklift_ids) = 0
          OR p_forklift_id = ANY(sc.covered_forklift_ids));

  SELECT COUNT(*) INTO active_schedules
    FROM recurring_schedules rs
   WHERE rs.forklift_id = p_forklift_id
     AND rs.customer_id = p_customer_id
     AND rs.is_active = TRUE;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION acwer_count_orphaned_obligations IS
  'Read-only preflight: how many active contracts/schedules a customer has that cover a given forklift. The transfer-between-customers modal calls this before opening the confirm step so the admin sees what they will leave behind.';

COMMIT;

-- ============================================================================
-- Post-apply verification
-- ============================================================================
DO $$
DECLARE
  v_check_def TEXT;
  v_func_count INT;
BEGIN
  -- Verify CHECK constraint includes new event types
  SELECT pg_get_constraintdef(oid) INTO v_check_def
    FROM pg_constraint
   WHERE conname = 'forklift_history_event_type_check';

  IF v_check_def IS NULL THEN
    RAISE EXCEPTION 'forklift_history_event_type_check constraint missing';
  END IF;
  IF position('sale_reversed' in v_check_def) = 0 THEN
    RAISE EXCEPTION 'CHECK does not include sale_reversed: %', v_check_def;
  END IF;
  IF position('ownership_edited' in v_check_def) = 0 THEN
    RAISE EXCEPTION 'CHECK does not include ownership_edited: %', v_check_def;
  END IF;

  -- Verify the 4 functions exist
  SELECT COUNT(*) INTO v_func_count
    FROM pg_proc
   WHERE proname IN (
           'acwer_edit_ownership_details',
           'acwer_reverse_sale_to_fleet',
           'acwer_transfer_between_customers',
           'acwer_count_orphaned_obligations'
         );
  IF v_func_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 admin RPCs created, found %', v_func_count;
  END IF;

  RAISE NOTICE 'External fleet admin corrections migration applied: 4 RPCs, 2 new event types';
END $$;

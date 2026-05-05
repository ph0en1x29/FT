-- 20260506_external_fleet_management.sql
--
-- External / Customer-Owned Fleet Management — v1
--
-- Adds the schema, RPC, trigger, and view extensions needed to manage
-- forklifts that Acwer SERVICES but does not OWN. Two scenarios:
--   1. Sold-fleet — Acwer sold a fleet forklift to a customer; same row,
--      ownership flipped to 'customer', acquisition_source recorded.
--   2. BYO       — customer-owned from day one (acquisition_source='new_byo').
--
-- This is purely additive — no destructive ALTERs, no data movement.
-- Existing fleet rentals + AMC contract behaviour remains unchanged.
--
-- Sibling files in same release:
--   - types/forklift.types.ts  (new fields)
--   - types/service-flow.types.ts (extended ServiceContract)
--   - services/forkliftService.ts (RPC wrapper, expanded queries)
--   - pages/ForkliftsTabs/components/ExternalFleetTab.tsx (new tab)
--   - pages/ForkliftProfile/components/TransitionToCustomerModal.tsx (new)
--   - pages/CustomerProfile/components/AddCustomerOwnedForkliftModal.tsx (new)
--   - pages/ForkliftProfile/components/RecurrenceSection.tsx (drop fleet-only gate)
--   - pages/CustomerProfile/components/ContractsSection.tsx (auto-recurrence fields)
--   - pages/CreateJob/CreateJobPage.tsx (drop RENTED_OUT-only gate)
--
-- Pre-existing live state (verified 2026-05-05 02:30 MYT):
--   - forklifts: 1321 fleet + 55 customer-owned (already first-class).
--   - service_contracts: 1 row, schema as designed in phase0.
--   - recurring_schedules: 7 rows, 2 with current_customer_id, 5 without
--     (pure-fleet warehouse units).
--   - customer_forklift_no column ALREADY EXISTS on forklifts — reused as
--     the customer's own asset code, so no `customer_asset_no` is added.
--   - Rental table is `forklift_rentals` (NOT `rentals`).
--   - `forklift_history` does NOT exist yet — created here as a small
--     audit log following the `*_audit_log` pattern (see van_audit_log /
--     job_audit_log).

BEGIN;

-- ============================================================================
-- 1. forklifts — new columns to track external/sold-fleet provenance
-- ============================================================================
ALTER TABLE forklifts
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT
    CHECK (acquisition_source IN ('new_byo', 'sold_from_fleet', 'transferred')),
  ADD COLUMN IF NOT EXISTS original_fleet_forklift_id UUID REFERENCES forklifts(forklift_id),
  ADD COLUMN IF NOT EXISTS service_management_status TEXT
    CHECK (service_management_status IN ('active', 'dormant', 'contract_ended'))
    DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sold_to_customer_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sold_price NUMERIC(12,2);

COMMENT ON COLUMN forklifts.acquisition_source IS
  'How this forklift entered Acwer''s service responsibility. NULL = legacy fleet (pre-2026-05-06). new_byo = customer brought their own. sold_from_fleet = Acwer sold this unit to the customer. transferred = manual override.';
COMMENT ON COLUMN forklifts.original_fleet_forklift_id IS
  'For sold_from_fleet rows: self-reference to the forklift_id at the time of sale (preserved across the ownership flip). For others: NULL.';
COMMENT ON COLUMN forklifts.service_management_status IS
  'Whether Acwer is actively servicing this unit. dormant = customer no longer using us; contract_ended = AMC expired with no renewal. Drives visibility in the new ExternalFleetTab.';

-- Backfill: every existing customer-owned forklift gets new_byo by default
-- (we have no historical record of which were sold-from-fleet).
UPDATE forklifts
   SET acquisition_source = 'new_byo'
 WHERE ownership = 'customer'
   AND acquisition_source IS NULL;

-- ============================================================================
-- 2. service_contracts — recurrence defaults so contract creation auto-seeds
--    a recurring_schedules row per covered forklift.
-- ============================================================================
ALTER TABLE service_contracts
  ADD COLUMN IF NOT EXISTS auto_generate_recurring BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS default_frequency TEXT
    CHECK (default_frequency IN ('monthly', 'quarterly', 'yearly', 'hourmeter')),
  ADD COLUMN IF NOT EXISTS default_hourmeter_interval INT,
  ADD COLUMN IF NOT EXISTS default_lead_time_days INT NOT NULL DEFAULT 7;

COMMENT ON COLUMN service_contracts.auto_generate_recurring IS
  'When TRUE, the trg_seed_recurring_from_contract trigger seeds one recurring_schedules row per covered_forklift_id at INSERT/UPDATE time.';

-- ============================================================================
-- 3. recurring_schedules — denormalize customer_id for fast filtering /
--    cross-customer overdue dashboards. Backfill from forklift's current
--    customer where available.
-- ============================================================================
ALTER TABLE recurring_schedules
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(customer_id);

UPDATE recurring_schedules rs
   SET customer_id = COALESCE(f.current_customer_id, f.customer_id)
  FROM forklifts f
 WHERE rs.forklift_id = f.forklift_id
   AND rs.customer_id IS NULL
   AND COALESCE(f.current_customer_id, f.customer_id) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_customer_id
  ON recurring_schedules(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================================================
-- 4. forklift_history — audit log for ownership transitions and lifecycle
--    events (sold-to-customer, registered-byo, contract-ended, etc.). Mirror
--    the lightweight pattern of job_audit_log / van_audit_log.
-- ============================================================================
CREATE TABLE IF NOT EXISTS forklift_history (
  history_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL
    CHECK (event_type IN (
      'sold_to_customer',
      'registered_byo',
      'transferred',
      'contract_started',
      'contract_ended',
      'service_status_changed',
      'note'
    )),
  event_data  JSONB,
  actor_id    UUID,
  actor_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forklift_history_forklift_id_created
  ON forklift_history(forklift_id, created_at DESC);

COMMENT ON TABLE forklift_history IS
  'Append-only audit log of forklift lifecycle events. Read by ForkliftProfilePage to render ownership timeline.';

-- ============================================================================
-- 5. RPC: acwer_transition_fleet_to_customer
--    Atomic sold-fleet flow. Flips ownership, closes active rental, sets
--    audit row. Returns the updated forklift row so the UI can re-render
--    without an extra read.
-- ============================================================================
CREATE OR REPLACE FUNCTION acwer_transition_fleet_to_customer(
  p_forklift_id        UUID,
  p_customer_id        UUID,
  p_sale_date          DATE,
  p_sale_price         NUMERIC(12,2)  DEFAULT NULL,
  p_customer_asset_no  TEXT           DEFAULT NULL,
  p_actor_id           UUID           DEFAULT NULL,
  p_actor_name         TEXT           DEFAULT NULL,
  p_reason             TEXT           DEFAULT NULL
)
RETURNS forklifts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_ownership TEXT;
  v_updated_row   forklifts%ROWTYPE;
BEGIN
  -- Verify the forklift exists + is currently fleet-owned
  SELECT ownership INTO v_old_ownership FROM forklifts WHERE forklift_id = p_forklift_id;
  IF v_old_ownership IS NULL THEN
    RAISE EXCEPTION 'Forklift % not found', p_forklift_id;
  END IF;
  IF v_old_ownership = 'customer' THEN
    RAISE EXCEPTION 'Forklift % is already customer-owned (cannot re-transition)', p_forklift_id;
  END IF;

  -- Verify customer exists
  IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_id = p_customer_id) THEN
    RAISE EXCEPTION 'Customer % not found', p_customer_id;
  END IF;

  -- Flip ownership + record provenance
  UPDATE forklifts
     SET ownership                  = 'customer',
         ownership_type             = 'external',
         acquisition_source         = 'sold_from_fleet',
         original_fleet_forklift_id = forklift_id,
         current_customer_id        = p_customer_id,
         customer_id                = p_customer_id,
         customer_forklift_no       = COALESCE(p_customer_asset_no, customer_forklift_no),
         sold_to_customer_at        = p_sale_date::timestamptz,
         sold_price                 = p_sale_price,
         service_management_status  = 'active',
         status                     = 'Available',  -- no longer rented to a fleet customer
         updated_at                 = NOW()
   WHERE forklift_id = p_forklift_id
   RETURNING * INTO v_updated_row;

  -- Close any active rental on this forklift (sold-fleet implies rental over)
  UPDATE forklift_rentals
     SET status            = 'ended',
         end_date          = p_sale_date,
         ended_at          = NOW(),
         ended_by_id       = p_actor_id,
         ended_by_name     = p_actor_name,
         hourmeter_at_end  = COALESCE(hourmeter_at_end, v_updated_row.hourmeter),
         updated_at        = NOW(),
         notes             = TRIM(BOTH ' ' FROM
                              COALESCE(notes, '') ||
                              CASE WHEN notes IS NOT NULL THEN E'\n' ELSE '' END ||
                              '[Auto-closed on ' || p_sale_date::text || ' — forklift sold to customer]'
                            )
   WHERE forklift_id = p_forklift_id
     AND status = 'active';

  -- Audit row
  INSERT INTO forklift_history (
    forklift_id, event_type, event_data, actor_id, actor_name
  ) VALUES (
    p_forklift_id,
    'sold_to_customer',
    jsonb_build_object(
      'customer_id', p_customer_id,
      'sale_date', p_sale_date,
      'sale_price', p_sale_price,
      'customer_asset_no', p_customer_asset_no,
      'reason', p_reason,
      'previous_ownership', v_old_ownership
    ),
    p_actor_id,
    p_actor_name
  );

  RETURN v_updated_row;
END;
$$;

COMMENT ON FUNCTION acwer_transition_fleet_to_customer IS
  'Sold-fleet transition. Single transaction: flips forklift ownership to customer, records sale price/date/customer asset code, closes the active rental, writes a forklift_history audit row. Idempotency-safe: rejects if forklift is already customer-owned.';

-- ============================================================================
-- 6. Trigger: auto-seed recurring_schedules from new/updated service_contracts
--    when auto_generate_recurring=TRUE and default_frequency is set.
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_recurring_from_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_forklift_id UUID;
BEGIN
  -- Skip if no recurrence requested or no frequency set or contract not active
  IF NEW.auto_generate_recurring IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.default_frequency IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- For each covered forklift (NULL/empty array means "all customer's forklifts")
  IF NEW.covered_forklift_ids IS NULL OR cardinality(NEW.covered_forklift_ids) = 0 THEN
    FOR v_forklift_id IN
      SELECT forklift_id FROM forklifts
       WHERE current_customer_id = NEW.customer_id
         AND ownership = 'customer'
    LOOP
      INSERT INTO recurring_schedules (
        forklift_id, contract_id, customer_id, frequency,
        hourmeter_interval, next_due_date, lead_time_days, is_active
      ) VALUES (
        v_forklift_id, NEW.contract_id, NEW.customer_id, NEW.default_frequency,
        NEW.default_hourmeter_interval,
        NEW.start_date,  -- first due on contract start; cron will roll forward
        NEW.default_lead_time_days,
        TRUE
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  ELSE
    FOREACH v_forklift_id IN ARRAY NEW.covered_forklift_ids
    LOOP
      INSERT INTO recurring_schedules (
        forklift_id, contract_id, customer_id, frequency,
        hourmeter_interval, next_due_date, lead_time_days, is_active
      ) VALUES (
        v_forklift_id, NEW.contract_id, NEW.customer_id, NEW.default_frequency,
        NEW.default_hourmeter_interval,
        NEW.start_date,
        NEW.default_lead_time_days,
        TRUE
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_recurring_from_contract ON service_contracts;
CREATE TRIGGER trg_seed_recurring_from_contract
AFTER INSERT OR UPDATE OF auto_generate_recurring, default_frequency, covered_forklift_ids
ON service_contracts
FOR EACH ROW
EXECUTE FUNCTION seed_recurring_from_contract();

COMMENT ON FUNCTION seed_recurring_from_contract IS
  'Materializes recurring_schedules rows from service_contracts when auto_generate_recurring=TRUE. Idempotent via ON CONFLICT DO NOTHING. Triggered AFTER INSERT/UPDATE of contract recurrence fields.';

-- Note: there is NO unique constraint on (forklift_id, contract_id) in
-- recurring_schedules today, so ON CONFLICT DO NOTHING is a soft guard.
-- Add one to make the idempotency rigorous.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'recurring_schedules_forklift_contract_unique'
  ) THEN
    ALTER TABLE recurring_schedules
      ADD CONSTRAINT recurring_schedules_forklift_contract_unique
      UNIQUE (forklift_id, contract_id);
  END IF;
END $$;

-- ============================================================================
-- 7. Replace v_forklift_service_predictions to add ownership-aware columns.
--    Strict superset: every existing column kept, three new appended:
--      - ownership                  (forklifts.ownership)
--      - ownership_type             (forklifts.ownership_type)
--      - service_responsibility     (derived)
-- ============================================================================
CREATE OR REPLACE VIEW v_forklift_service_predictions AS
SELECT f.forklift_id,
       f.serial_number,
       f.make,
       f.model,
       f.type,
       f.fuel_type,
       f.status,
       f.hourmeter AS current_hourmeter,
       f.last_service_hourmeter,
       f.last_service_date,
       f.service_interval_hours,
       f.next_target_service_hour,
       f.next_service_due,
       f.avg_daily_usage,
       f.customer_id,
       f.current_customer_id,
       pred.predicted_date,
       pred.days_remaining,
       pred.hours_until_service,
       pred.avg_daily_hours,
       pred.next_service_hourmeter,
       pred.confidence,
       CASE
         WHEN pred.days_remaining <= 0  THEN 'overdue'::text
         WHEN pred.days_remaining <= 7  THEN 'due_soon'::text
         WHEN pred.days_remaining <= 14 THEN 'upcoming'::text
         ELSE 'ok'::text
       END AS service_urgency,
       -- New columns:
       f.ownership,
       f.ownership_type,
       f.service_management_status,
       f.acquisition_source,
       f.customer_forklift_no,
       CASE
         WHEN f.ownership = 'company' THEN 'fleet'
         WHEN f.ownership = 'customer' AND EXISTS (
           SELECT 1 FROM service_contracts sc
            WHERE sc.customer_id = COALESCE(f.current_customer_id, f.customer_id)
              AND sc.is_active = TRUE
              AND sc.contract_type = 'amc'
              AND CURRENT_DATE BETWEEN sc.start_date AND sc.end_date
              AND (sc.covered_forklift_ids IS NULL
                   OR cardinality(sc.covered_forklift_ids) = 0
                   OR f.forklift_id = ANY(sc.covered_forklift_ids))
         ) THEN 'amc'
         WHEN f.ownership = 'customer' THEN 'chargeable_external'
         ELSE 'unmanaged'
       END AS service_responsibility
  FROM forklifts f
  LEFT JOIN LATERAL calculate_predicted_service_date(f.forklift_id)
         pred(predicted_date, days_remaining, hours_until_service,
              avg_daily_hours, next_service_hourmeter, confidence) ON TRUE;

COMMENT ON VIEW v_forklift_service_predictions IS
  'Single source for service-due lists. service_responsibility classifies each forklift as fleet (Acwer-owned), amc (customer + active AMC contract covering this unit), chargeable_external (customer-owned, no contract), or unmanaged. Used by ServiceDueTab + ExternalFleetTab.';

COMMIT;

-- ============================================================================
-- Post-apply verification
-- ============================================================================
DO $$
DECLARE
  v_new_forklift_cols INT;
  v_new_contract_cols INT;
  v_recurring_cust_count INT;
  v_history_table_exists BOOLEAN;
  v_view_cols INT;
  v_amc_count INT;
  v_external_count INT;
BEGIN
  SELECT COUNT(*) INTO v_new_forklift_cols
    FROM information_schema.columns
   WHERE table_name = 'forklifts'
     AND column_name IN ('acquisition_source','original_fleet_forklift_id',
                         'service_management_status','sold_to_customer_at','sold_price');
  IF v_new_forklift_cols <> 5 THEN
    RAISE EXCEPTION 'forklifts: expected 5 new columns, got %', v_new_forklift_cols;
  END IF;

  SELECT COUNT(*) INTO v_new_contract_cols
    FROM information_schema.columns
   WHERE table_name = 'service_contracts'
     AND column_name IN ('auto_generate_recurring','default_frequency',
                         'default_hourmeter_interval','default_lead_time_days');
  IF v_new_contract_cols <> 4 THEN
    RAISE EXCEPTION 'service_contracts: expected 4 new columns, got %', v_new_contract_cols;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_name='forklift_history' AND table_schema='public')
    INTO v_history_table_exists;
  IF NOT v_history_table_exists THEN
    RAISE EXCEPTION 'forklift_history table not created';
  END IF;

  SELECT COUNT(*) INTO v_view_cols
    FROM information_schema.columns
   WHERE table_name='v_forklift_service_predictions';
  -- Pre: 23 cols, Post: 23 + 6 new = 29
  --   (ownership, ownership_type, service_management_status, acquisition_source,
  --    customer_forklift_no, service_responsibility)
  IF v_view_cols <> 29 THEN
    RAISE EXCEPTION 'v_forklift_service_predictions: expected 29 columns, got %', v_view_cols;
  END IF;

  -- Backfill check: every customer-owned forklift now has acquisition_source
  IF EXISTS (
    SELECT 1 FROM forklifts WHERE ownership='customer' AND acquisition_source IS NULL
  ) THEN
    RAISE EXCEPTION 'Backfill incomplete: customer-owned forklifts missing acquisition_source';
  END IF;

  -- Sanity peek
  SELECT COUNT(*) INTO v_amc_count
    FROM v_forklift_service_predictions WHERE service_responsibility='amc';
  SELECT COUNT(*) INTO v_external_count
    FROM v_forklift_service_predictions WHERE service_responsibility='chargeable_external';

  RAISE NOTICE 'External fleet management migration applied: % AMC forklifts, % chargeable-external forklifts',
               v_amc_count, v_external_count;
END $$;

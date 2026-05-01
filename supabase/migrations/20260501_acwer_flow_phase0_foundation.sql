-- ============================================================
-- Migration: ACWER Service Operations Flow — Phase 0 Foundation
-- Date: 2026-05-01
-- Purpose: Add the schema substrate for the 3-path billing model
--          (Path A: AMC, Path B: Chargeable, Path C: Fleet) without
--          changing any user-visible behavior. All later phases of the
--          ACWER flow enhancement build on the tables/columns added here.
--
-- Behavioral impact: NONE. New columns default to safe no-op values
--   - jobs.billing_path defaults to 'unset' (legacy jobs unaffected)
--   - parts.is_warranty_excluded defaults to FALSE
--   - New tables are empty until populated by Phase 2/3/5/6 features
--   - acwer_settings.feature_deduct_on_finalize defaults to FALSE
--     (preserves the current immediate-deduction inventory rule)
--
-- Reversibility: full ROLLBACK block at the bottom of this file.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. billing_path enum + columns on jobs
-- ============================================================

DO $$ BEGIN
  CREATE TYPE billing_path_enum AS ENUM ('amc', 'chargeable', 'fleet', 'unset');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS billing_path billing_path_enum NOT NULL DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS billing_path_reason TEXT,
  ADD COLUMN IF NOT EXISTS billing_path_overridden_by_id UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS billing_path_overridden_at TIMESTAMPTZ;

COMMENT ON COLUMN jobs.billing_path IS
  'ACWER service flow path classification. amc=Path A (under AMC contract), chargeable=Path B (ad-hoc), fleet=Path C (Acwer-owned fleet), unset=legacy/unclassified. Phase 0 default = unset.';
COMMENT ON COLUMN jobs.billing_path_reason IS
  'Human-readable reason for the path classification (e.g. "Forklift is Acwer-owned (Path C)").';
COMMENT ON COLUMN jobs.billing_path_overridden_by_id IS
  'Admin who manually overrode the auto-classified path (NULL when path is auto-derived).';

-- ============================================================
-- 2. service_contracts (Path A foundation, populated in Phase 2)
-- ============================================================

CREATE TABLE IF NOT EXISTS service_contracts (
  contract_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  contract_number TEXT,
  contract_type TEXT NOT NULL DEFAULT 'amc'
    CHECK (contract_type IN ('amc', 'warranty', 'maintenance')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- Coverage scope: NULL or empty array = all customer's forklifts
  covered_forklift_ids UUID[],
  includes_parts BOOLEAN NOT NULL DEFAULT TRUE,
  includes_labor BOOLEAN NOT NULL DEFAULT TRUE,
  -- Per-contract wear-and-tear override list (overrides global parts.is_warranty_excluded)
  wear_tear_part_ids UUID[],
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_id UUID REFERENCES users(user_id),
  created_by_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_id UUID REFERENCES users(user_id),
  updated_by_name TEXT,
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_service_contracts_customer
  ON service_contracts(customer_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_service_contracts_dates
  ON service_contracts(start_date, end_date) WHERE is_active = TRUE;

COMMENT ON TABLE service_contracts IS
  'Customer service contracts (AMC / warranty / maintenance). Drives Path A classification in classifyBillingPath().';

-- ============================================================
-- 3. parts.is_warranty_excluded (Path A wear-and-tear flag)
-- ============================================================

ALTER TABLE parts
  ADD COLUMN IF NOT EXISTS is_warranty_excluded BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN parts.is_warranty_excluded IS
  'TRUE = wear-and-tear part not covered by AMC. Triggers Path A chargeable flip in Phase 4. Default seed list per Shin (tires, LED lights, seats, etc.) applied in Phase 3 migration.';

-- ============================================================
-- 4. parts_usage_quotas (Path C overage validator, populated in Phase 6)
-- ============================================================

CREATE TABLE IF NOT EXISTS parts_usage_quotas (
  quota_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('global', 'per_forklift', 'per_customer')),
  scope_id UUID,                                  -- forklift_id or customer_id, NULL for global
  part_id UUID REFERENCES parts(part_id) ON DELETE CASCADE,
  part_category TEXT,                             -- alternative: limit by category
  period_unit TEXT NOT NULL DEFAULT 'year'
    CHECK (period_unit IN ('year', 'quarter', 'month')),
  max_quantity NUMERIC NOT NULL CHECK (max_quantity > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (part_id IS NOT NULL OR part_category IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_parts_usage_quotas_scope
  ON parts_usage_quotas(scope_type, scope_id) WHERE is_active = TRUE;

COMMENT ON TABLE parts_usage_quotas IS
  'Consumable usage limits (e.g. "1 set tires/year per fleet forklift"). Phase 6 enforcement flips Path C jobs to chargeable when exceeded.';

-- ============================================================
-- 5. recurring_schedules (Path C scheduler, populated in Phase 5)
-- ============================================================

CREATE TABLE IF NOT EXISTS recurring_schedules (
  schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id) ON DELETE CASCADE,
  service_interval_id UUID REFERENCES service_intervals(interval_id),
  contract_id UUID REFERENCES service_contracts(contract_id) ON DELETE SET NULL,
  frequency TEXT NOT NULL
    CHECK (frequency IN ('monthly', 'quarterly', 'yearly', 'hourmeter')),
  hourmeter_interval INTEGER,                     -- when frequency='hourmeter'
  next_due_date DATE,
  next_due_hourmeter INTEGER,
  lead_time_days INTEGER NOT NULL DEFAULT 7,      -- create job N days before due
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_due
  ON recurring_schedules(next_due_date) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_forklift
  ON recurring_schedules(forklift_id) WHERE is_active = TRUE;

COMMENT ON TABLE recurring_schedules IS
  'Recurrence rules for fleet (Acwer-owned) forklift maintenance. Phase 5 cron generates ScheduledService records ahead of next_due_date.';

-- ============================================================
-- 6. acwer_settings (single-row global settings)
-- ============================================================

CREATE TABLE IF NOT EXISTS acwer_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_labor_rate_myr NUMERIC NOT NULL DEFAULT 150,
  default_transport_flat_myr NUMERIC NOT NULL DEFAULT 50,
  default_transport_per_km_myr NUMERIC NOT NULL DEFAULT 1.50,
  default_transport_flat_threshold_km NUMERIC NOT NULL DEFAULT 50,
  amc_warranty_default_months INTEGER NOT NULL DEFAULT 6,
  fleet_default_frequency TEXT NOT NULL DEFAULT 'quarterly'
    CHECK (fleet_default_frequency IN ('monthly', 'quarterly', 'yearly', 'hourmeter')),
  fleet_default_hourmeter_interval INTEGER NOT NULL DEFAULT 500,
  -- Phase 7 feature flag: deduct on Admin 2 finalize instead of immediate
  feature_deduct_on_finalize BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_id UUID REFERENCES users(user_id),
  updated_by_name TEXT
);

INSERT INTO acwer_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE acwer_settings IS
  'ACWER-wide single-row settings. id=1 is the only allowed row. Houses defaults for labor rate, transport, AMC warranty length, fleet recurrence cadence, and Phase 7+ feature flags.';

-- ============================================================
-- 7. Row Level Security on new tables
-- ============================================================

ALTER TABLE service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_usage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE acwer_settings ENABLE ROW LEVEL SECURITY;

-- service_contracts: admin/admin_service/supervisor can write; everyone authenticated reads
DROP POLICY IF EXISTS service_contracts_admin ON service_contracts;
CREATE POLICY service_contracts_admin ON service_contracts
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
              AND users.role IN ('admin', 'admin_service', 'supervisor'))
  );

DROP POLICY IF EXISTS service_contracts_read ON service_contracts;
CREATE POLICY service_contracts_read ON service_contracts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
              AND users.role IN ('admin', 'admin_service', 'admin_store', 'supervisor', 'accountant', 'technician'))
  );

-- parts_usage_quotas: admin/admin_service/admin_store/supervisor write; all authed read
DROP POLICY IF EXISTS parts_usage_quotas_admin ON parts_usage_quotas;
CREATE POLICY parts_usage_quotas_admin ON parts_usage_quotas
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
              AND users.role IN ('admin', 'admin_service', 'admin_store', 'supervisor'))
  );

DROP POLICY IF EXISTS parts_usage_quotas_read ON parts_usage_quotas;
CREATE POLICY parts_usage_quotas_read ON parts_usage_quotas
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
              AND users.role IN ('admin', 'admin_service', 'admin_store', 'supervisor', 'accountant', 'technician'))
  );

-- recurring_schedules: admin/admin_service/supervisor only
DROP POLICY IF EXISTS recurring_schedules_admin ON recurring_schedules;
CREATE POLICY recurring_schedules_admin ON recurring_schedules
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
              AND users.role IN ('admin', 'admin_service', 'supervisor'))
  );

DROP POLICY IF EXISTS recurring_schedules_read ON recurring_schedules;
CREATE POLICY recurring_schedules_read ON recurring_schedules
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
              AND users.role IN ('admin', 'admin_service', 'admin_store', 'supervisor', 'accountant', 'technician'))
  );

-- acwer_settings: admin/supervisor write; everyone reads
DROP POLICY IF EXISTS acwer_settings_admin ON acwer_settings;
CREATE POLICY acwer_settings_admin ON acwer_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
              AND users.role IN ('admin', 'supervisor'))
  );

DROP POLICY IF EXISTS acwer_settings_read ON acwer_settings;
CREATE POLICY acwer_settings_read ON acwer_settings
  FOR SELECT TO authenticated
  USING (TRUE);

-- ============================================================
-- 8. Sanity check — fail loudly if anything is missing
-- ============================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- billing_path column on jobs
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'billing_path';
  IF v_count = 0 THEN RAISE EXCEPTION 'Phase 0: jobs.billing_path was not added'; END IF;

  -- All 4 supporting columns on jobs
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name IN ('billing_path', 'billing_path_reason',
                          'billing_path_overridden_by_id', 'billing_path_overridden_at');
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Phase 0: expected 4 billing_path columns on jobs, found %', v_count;
  END IF;

  -- New tables
  SELECT COUNT(*) INTO v_count FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('service_contracts', 'parts_usage_quotas',
                         'recurring_schedules', 'acwer_settings');
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Phase 0: expected 4 new tables, found %', v_count;
  END IF;

  -- parts.is_warranty_excluded column
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parts'
      AND column_name = 'is_warranty_excluded';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Phase 0: parts.is_warranty_excluded was not added';
  END IF;

  -- acwer_settings has exactly 1 row
  SELECT COUNT(*) INTO v_count FROM acwer_settings;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Phase 0: expected acwer_settings to have 1 row, found %', v_count;
  END IF;

  -- billing_path_enum has all 4 expected values
  SELECT COUNT(*) INTO v_count FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'billing_path_enum'
      AND e.enumlabel IN ('amc', 'chargeable', 'fleet', 'unset');
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Phase 0: billing_path_enum is missing values, found %', v_count;
  END IF;

  -- RLS enabled on all 4 new tables
  SELECT COUNT(*) INTO v_count FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname IN ('service_contracts', 'parts_usage_quotas',
                        'recurring_schedules', 'acwer_settings')
      AND c.relrowsecurity = TRUE;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'Phase 0: RLS not enabled on all 4 tables, only %', v_count;
  END IF;

  RAISE NOTICE 'Phase 0 foundation: all sanity checks passed.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (run as a separate transaction if needed)
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS acwer_settings_read ON acwer_settings;
-- DROP POLICY IF EXISTS acwer_settings_admin ON acwer_settings;
-- DROP POLICY IF EXISTS recurring_schedules_read ON recurring_schedules;
-- DROP POLICY IF EXISTS recurring_schedules_admin ON recurring_schedules;
-- DROP POLICY IF EXISTS parts_usage_quotas_read ON parts_usage_quotas;
-- DROP POLICY IF EXISTS parts_usage_quotas_admin ON parts_usage_quotas;
-- DROP POLICY IF EXISTS service_contracts_read ON service_contracts;
-- DROP POLICY IF EXISTS service_contracts_admin ON service_contracts;
-- DROP TABLE IF EXISTS acwer_settings;
-- DROP TABLE IF EXISTS recurring_schedules;
-- DROP TABLE IF EXISTS parts_usage_quotas;
-- DROP TABLE IF EXISTS service_contracts;
-- ALTER TABLE parts DROP COLUMN IF EXISTS is_warranty_excluded;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS billing_path_overridden_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS billing_path_overridden_by_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS billing_path_reason;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS billing_path;
-- DROP TYPE IF EXISTS billing_path_enum;
-- COMMIT;

-- Rental + Hourmeter import preparation
-- Created: 2026-03-09

-- Allow imported customer sites to exist before addresses are known
ALTER TABLE customer_sites
  ALTER COLUMN address DROP NOT NULL;

-- Strengthen forklift and rental linkage for site-aware imports
ALTER TABLE forklifts
  ADD COLUMN IF NOT EXISTS current_site_id UUID REFERENCES customer_sites(site_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS source_item_group TEXT;

ALTER TABLE forklift_rentals
  ADD COLUMN IF NOT EXISTS site TEXT,
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES customer_sites(site_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_forklifts_current_site ON forklifts(current_site_id);
CREATE INDEX IF NOT EXISTS idx_forklift_rentals_site_id ON forklift_rentals(site_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_forklifts_forklift_no_nonempty_unique
  ON forklifts (UPPER(BTRIM(forklift_no)))
  WHERE forklift_no IS NOT NULL AND BTRIM(forklift_no) <> '';

-- Alias mapping tables for reviewable source-name reconciliation
CREATE TABLE IF NOT EXISTS customer_aliases (
  alias_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  alias_name TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_site_aliases (
  alias_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES customer_sites(site_id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  alias_name TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_aliases_source_normalized
  ON customer_aliases(source_system, normalized_alias);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_site_aliases_source_normalized
  ON customer_site_aliases(source_system, normalized_alias);
CREATE INDEX IF NOT EXISTS idx_customer_aliases_customer_id
  ON customer_aliases(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_site_aliases_site_id
  ON customer_site_aliases(site_id);

ALTER TABLE customer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_site_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage customer_aliases" ON customer_aliases;
CREATE POLICY "Authenticated users can manage customer_aliases"
  ON customer_aliases FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage customer_site_aliases" ON customer_site_aliases;
CREATE POLICY "Authenticated users can manage customer_site_aliases"
  ON customer_site_aliases FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow import audit entries in hourmeter history
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = con.connamespace
  WHERE rel.relname = 'hourmeter_history'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%source%job_start%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.hourmeter_history DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE hourmeter_history
  DROP CONSTRAINT IF EXISTS hourmeter_history_source_check;

ALTER TABLE hourmeter_history
  ADD CONSTRAINT hourmeter_history_source_check
  CHECK (source IN ('job_start', 'job_end', 'amendment', 'audit', 'manual', 'import'));

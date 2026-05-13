-- 20260513_supabase_linter_security_fixes.sql
--
-- Fixes three Supabase linter ERROR findings without breaking existing
-- read paths.
--
-- 1. SECURITY DEFINER view: `public.v_forklift_service_predictions`
--    Used by serviceTrackingService + servicePredictionService for the
--    Service Due tab, Serviced Externals tab, and fleet predictions.
--    Linter doc: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
--
-- 2. SECURITY DEFINER view: `public.parts_liquid_price_drift`
--    Surfaced for the liquid-inventory price-drift audit.
--    Same linter rule.
--
-- 3. RLS disabled on public table: `public.forklift_history`
--    Append-only audit log read by ForkliftProfile.
--    Linter doc: https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
--
-- Why this is safe
-- ----------------
-- Views: switching to `security_invoker = true` (Postgres 15+) makes the
-- views run with the calling user's permissions + RLS. The underlying
-- tables (`forklifts`, `parts`) BOTH already have RLS enabled with
-- permissive policies for `authenticated`, so authenticated reads continue
-- to work as before.
--
-- forklift_history writes: all five writer functions are SECURITY DEFINER:
--   acwer_auto_flip_external_dormant
--   acwer_edit_ownership_details
--   acwer_reverse_sale_to_fleet
--   acwer_transfer_between_customers
--   acwer_transition_fleet_to_customer
-- Each runs with the owner's (postgres) privileges, bypassing RLS entirely.
-- So writes continue to work without a new INSERT policy.
--
-- forklift_history reads: getForkliftHistory(forkliftId) in
-- services/forkliftService.ts:183 is called from the ForkliftProfile
-- page. We add a SELECT policy for `authenticated` so the read path
-- keeps working.

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- 1 & 2. SECURITY DEFINER views → SECURITY INVOKER
-- ════════════════════════════════════════════════════════════════════
ALTER VIEW public.v_forklift_service_predictions SET (security_invoker = true);
ALTER VIEW public.parts_liquid_price_drift        SET (security_invoker = true);

-- ════════════════════════════════════════════════════════════════════
-- 3. Enable RLS on forklift_history + permissive SELECT for authenticated
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.forklift_history ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policy (idempotent re-apply safety)
DROP POLICY IF EXISTS forklift_history_read_authenticated ON public.forklift_history;

CREATE POLICY forklift_history_read_authenticated
  ON public.forklift_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Intentionally no INSERT/UPDATE/DELETE policies — the only legitimate
-- writers are the five acwer_* SECURITY DEFINER RPCs, which bypass RLS.
-- Direct PATCH/POST from authenticated users will now be rejected, which
-- is the correct audit-log invariant.

-- ════════════════════════════════════════════════════════════════════
-- Post-apply sanity checks
-- ════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_si_pred BOOLEAN;
  v_si_drift BOOLEAN;
  v_rls_history BOOLEAN;
  v_policies INT;
BEGIN
  -- View invoker flags
  SELECT (reloptions::text ILIKE '%security_invoker=true%')
    INTO v_si_pred
    FROM pg_class
   WHERE relname = 'v_forklift_service_predictions'
     AND relnamespace = 'public'::regnamespace;
  IF NOT v_si_pred THEN
    RAISE EXCEPTION 'security_invoker not set on v_forklift_service_predictions';
  END IF;

  SELECT (reloptions::text ILIKE '%security_invoker=true%')
    INTO v_si_drift
    FROM pg_class
   WHERE relname = 'parts_liquid_price_drift'
     AND relnamespace = 'public'::regnamespace;
  IF NOT v_si_drift THEN
    RAISE EXCEPTION 'security_invoker not set on parts_liquid_price_drift';
  END IF;

  -- RLS on forklift_history
  SELECT relrowsecurity
    INTO v_rls_history
    FROM pg_class
   WHERE relname = 'forklift_history'
     AND relnamespace = 'public'::regnamespace;
  IF NOT v_rls_history THEN
    RAISE EXCEPTION 'RLS not enabled on forklift_history';
  END IF;

  -- At least one SELECT policy on forklift_history
  SELECT COUNT(*)
    INTO v_policies
    FROM pg_policies
   WHERE tablename = 'forklift_history'
     AND cmd = 'SELECT';
  IF v_policies < 1 THEN
    RAISE EXCEPTION 'No SELECT policy on forklift_history — read path will break';
  END IF;

  RAISE NOTICE 'Linter fixes applied: views→security_invoker, forklift_history RLS+SELECT policy';
END $$;

COMMIT;

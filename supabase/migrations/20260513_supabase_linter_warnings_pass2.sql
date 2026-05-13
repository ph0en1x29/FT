-- 20260513_supabase_linter_warnings_pass2.sql
--
-- Pass 2: revoke EXECUTE from `anon` on all 64 SECURITY DEFINER functions in
-- the public schema. Resolves the linter findings:
--   - anon_security_definer_function_executable (~64 rows)
--
-- Why this is safe
-- ----------------
-- Every one of these functions is a mutation, audit, admin, or
-- authenticated-only helper:
--   • acwer_* — fleet/customer transitions (admin)
--   • admin_* — admin lock override
--   • cancel_*, complete_*, start_*, finalize_* — job lifecycle (authenticated)
--   • rpc_* — van stock mutations (authenticated)
--   • cleanup_* — scheduled cron jobs (run by service_role)
--   • acwer_auto_flip_external_dormant, escalate_*, send_scheduled_* — cron
--   • trigger functions (auto_create_*, log_*, notify_*, on_service_job_completed,
--     prevent_*, track_*, validate_*, guard_*, check_*, evaluate_*) — fire
--     automatically inside the DB; never called from the API
--   • has_*, is_*, get_my_*, get_current_user_*, get_user_*, get_user_id_*
--     — RLS helpers called server-side; not called by clients directly
--   • prepare_user_creation, complete_user_creation — confirmed called from
--     userService.createUser() which is invoked by an authenticated admin
--     creating other users (not anon signup)
--
-- The Supabase Auth signup flow goes through `supabase.auth.signUp()`
-- which talks to the `auth` schema, not to any of these `public` RPCs.
--
-- If anything breaks unexpectedly (very unlikely), GRANT can be re-added
-- per-function: `GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO anon;`
--
-- Findings still deferred to a future pass
-- ----------------------------------------
-- • extension_in_public (pg_trgm, vector) — moving extensions risks breaking
--   downstream functions; needs careful per-reference audit.
-- • auth_leaked_password_protection — Supabase Dashboard setting, not SQL.
--   Enable manually at:
--   Authentication → Settings → "Leaked Password Protection".
-- • authenticated_security_definer_function_executable (~70 functions) —
--   most are intentionally callable by signed-in users with role gates
--   enforced inside the function. The linter is asking for explicit intent;
--   in-function role checks already cover the risk. A blanket revoke would
--   break the app.

BEGIN;

-- Postgres grants EXECUTE TO PUBLIC by default on every new function.
-- `anon` is a member of PUBLIC, so REVOKE … FROM anon alone is insufficient.
-- We REVOKE FROM PUBLIC + anon, then re-GRANT explicitly to authenticated
-- and service_role so legitimate callers keep working.
DO $$
DECLARE
  fn_rec RECORD;
  revoked_count INT := 0;
BEGIN
  FOR fn_rec IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosecdef = true
       AND p.prokind = 'f'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
      fn_rec.proname,
      fn_rec.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
      fn_rec.proname,
      fn_rec.args
    );
    revoked_count := revoked_count + 1;
  END LOOP;
  RAISE NOTICE 'Rescoped EXECUTE on % SECURITY DEFINER functions (revoked PUBLIC+anon, granted authenticated+service_role).', revoked_count;
END $$;

-- Sanity check: zero SECURITY DEFINER functions should remain anon-callable
DO $$
DECLARE n_remaining INT;
BEGIN
  SELECT COUNT(*) INTO n_remaining
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef = true
     AND p.prokind = 'f'
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF n_remaining > 0 THEN
    RAISE EXCEPTION 'Sanity check failed: % SECURITY DEFINER functions still anon-callable', n_remaining;
  END IF;
  RAISE NOTICE 'Confirmed: 0 SECURITY DEFINER functions remain anon-callable.';
END $$;

COMMIT;

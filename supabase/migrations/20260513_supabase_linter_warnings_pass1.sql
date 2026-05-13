-- 20260513_supabase_linter_warnings_pass1.sql
--
-- Pass 1 of Supabase linter WARN findings — only the changes that are safe
-- to apply without risking breakage of legitimate flows.
--
-- Findings addressed:
--
-- A. function_search_path_mutable (~35 of our project functions)
--    All public functions get an explicit `SET search_path = public, pg_temp`
--    so an attacker cannot hijack name resolution by creating a same-named
--    object in a schema they control.
--
-- B. public_bucket_allows_listing (job-photos, signatures)
--    Both buckets are `public=true`, so file URLs are world-readable —
--    that's intentional (we share photo/signature URLs to customers).
--    But the SELECT policies on storage.objects used role `public`, letting
--    anyone enumerate the bucket via the listing API. Replaced with
--    `authenticated` — URL downloads still work (public-bucket rule),
--    only LIST is gated.
--
-- Findings INTENTIONALLY DEFERRED (need manual review per function, out of
-- scope for a blanket fix):
--
-- C. anon_security_definer_function_executable (64 functions)
--    Some functions may legitimately need anon EXECUTE (e.g. signup flow).
--    A blanket REVOKE could break login. Will audit per-function in a
--    follow-up pass and revoke only from mutation/admin functions.
--
-- D. authenticated_security_definer_function_executable (~70 functions)
--    Most of these are correct — they're SECURITY DEFINER admin actions
--    that signed-in users with the right role should be able to call. The
--    linter is asking "did you mean for this?" rather than flagging a real
--    issue. In-function role checks are the right gate.
--
-- E. extension_in_public (pg_trgm, vector)
--    Moving extensions risks breaking every function that references their
--    operators/types. Defer.
--
-- F. auth_leaked_password_protection
--    Supabase Auth dashboard setting, not SQL. Document for manual enabling
--    in Supabase Dashboard > Authentication > Settings > "Leaked Password
--    Protection".

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- A. Pin search_path on every public-schema function we own
-- ════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  fn_rec RECORD;
  fixed_count INT := 0;
  skipped_count INT := 0;
BEGIN
  FOR fn_rec IN
    SELECT n.nspname AS schema_name,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_roles r ON r.oid = p.proowner
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       -- Skip extension-provided functions (e.g. vector, pg_trgm).
       AND NOT EXISTS (
         SELECT 1 FROM pg_depend d
          WHERE d.objid = p.oid
            AND d.deptype = 'e'
       )
       -- Only fix functions that don't already have search_path pinned.
       AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'))
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
        fn_rec.proname,
        fn_rec.args
      );
      fixed_count := fixed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Some signatures (e.g. trigger functions with no args, or those using
      -- types not in search_path) may fail; log and continue.
      RAISE NOTICE 'Skipped %(%) — %', fn_rec.proname, fn_rec.args, SQLERRM;
      skipped_count := skipped_count + 1;
    END;
  END LOOP;
  RAISE NOTICE 'search_path pinned on % functions (% skipped).', fixed_count, skipped_count;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- B. Restrict bucket listing to authenticated (not public)
--
--    The SELECT policies on storage.objects for the job-photos and
--    signatures buckets were assigned to role `public` (= anon + everyone).
--    Public buckets serve their files via direct CDN URL regardless of RLS,
--    so anon can still download a known URL. But the listing API
--    (SELECT * FROM storage.objects WHERE bucket_id = 'X') should require
--    authentication so the file inventory isn't enumerable by random
--    visitors.
-- ════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS job_photos_select_policy ON storage.objects;
CREATE POLICY job_photos_select_policy
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-photos');

DROP POLICY IF EXISTS signatures_select_policy ON storage.objects;
CREATE POLICY signatures_select_policy
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'signatures');

-- ════════════════════════════════════════════════════════════════════
-- Post-apply sanity checks
-- ════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n_mutable INT;
  n_public_select INT;
BEGIN
  -- How many of our functions still have a mutable search_path?
  SELECT COUNT(*) INTO n_mutable
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind = 'f'
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
     AND (p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%'));
  RAISE NOTICE 'Project functions still with mutable search_path: %', n_mutable;

  -- Bucket SELECT policies should now be authenticated-only.
  SELECT COUNT(*) INTO n_public_select
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname IN ('job_photos_select_policy', 'signatures_select_policy')
     AND 'public' = ANY(roles);
  IF n_public_select > 0 THEN
    RAISE EXCEPTION 'Sanity check failed: bucket SELECT policies still on role public';
  END IF;
END $$;

COMMIT;

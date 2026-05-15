-- 20260515_bulk_sign_readiness_fix.sql
--
-- Problem
-- -------
-- Client report (AQUASPERSIONS / "AQUA"): bulk sign-off modal shows the
-- jobs as un-selectable. Tech can't proceed.
--
-- Live DB confirmed: 5 In-Progress jobs at AQUASPERSIONS. The pre-flight
-- `check_job_completion_readiness` returns `can_complete = false` for ALL
-- 5 — two with blocker "Technician signature is required" (Gate 7) and
-- three with "Parts must be recorded" (Gate 4). The modal then routes
-- every job into the read-only "blockedJobs" bucket and disables the
-- checkbox.
--
-- The Parts blocker (Gate 4) is legitimate — the tech has to record
-- parts on the job page first. That's correct behaviour, and the modal
-- shows the reason inline.
--
-- The Technician signature blocker (Gate 7) is a FALSE POSITIVE in the
-- bulk-sign context. The whole purpose of the bulk-sign modal is to
-- CAPTURE the missing signature via a swipe gesture. The completion RPC
-- (`rpc_bulk_complete_jobs`) already synthesises the post-write signature
-- state before calling `evaluate_job_completion`, so the actual transition
-- works. But the readiness pre-check uses the RAW row and rejects.
--
-- Fix
-- ---
-- Rewrite `check_job_completion_readiness` to mirror what
-- `rpc_bulk_complete_jobs` does: synthesise placeholder non-NULL
-- signatures on the row before evaluating. This makes the pre-check an
-- accurate preview of what the bulk-sign RPC will actually accept.
--
-- The only consumer is the bulk-sign banner
-- (services/jobCompletionService.checkJobCompletionReadiness, called
-- from pages/JobBoard/components/SiteSignOffBanner.tsx). No other read
-- paths use this RPC, so changing its semantics is safe.

CREATE OR REPLACE FUNCTION public.check_job_completion_readiness(p_job_ids uuid[])
RETURNS TABLE(job_id uuid, can_complete boolean, blocker text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_role        TEXT;
    v_row         public.jobs;
    v_blocker     TEXT;
    v_sig_stub    JSONB := jsonb_build_object(
                             'signed_by_name', '__readiness_preview__',
                             'signed_at', NOW()::TEXT,
                             'signature_url', ''
                           );
BEGIN
    SELECT u.role INTO v_role FROM users u WHERE u.auth_id = auth.uid();

    FOR v_row IN
        SELECT * FROM jobs WHERE jobs.job_id = ANY(p_job_ids) AND jobs.deleted_at IS NULL
    LOOP
        -- Synthesise the post-bulk-sign row state so the readiness check
        -- gives an accurate preview of what `rpc_bulk_complete_jobs` will
        -- accept. The signature stubs are placeholders only — they exist
        -- to defeat Gate 7/8 in `evaluate_job_completion`. Actual sig
        -- payloads are written by `rpc_bulk_complete_jobs` itself.
        v_row.technician_signature := COALESCE(v_row.technician_signature, v_sig_stub);
        v_row.customer_signature   := COALESCE(v_row.customer_signature, v_sig_stub);

        v_blocker := evaluate_job_completion(v_row, v_role);
        job_id := v_row.job_id;
        can_complete := v_blocker IS NULL;
        blocker := v_blocker;
        RETURN NEXT;
    END LOOP;
END;
$function$;

-- Sanity check on a known-blocked AQUA job: the 3 jobs blocked by Gate 4
-- (parts not recorded) should STILL be blocked; the 2 jobs that were only
-- blocked by Gate 7 (no tech signature) should now be marked ready.
DO $$
DECLARE
  v_aqua_id UUID;
  v_can     BOOLEAN;
  v_blocker TEXT;
BEGIN
  SELECT customer_id INTO v_aqua_id FROM customers WHERE name ILIKE '%aquaspersions%' LIMIT 1;
  IF v_aqua_id IS NULL THEN
    RAISE NOTICE 'No AQUASPERSIONS customer found — skipping sanity check.';
    RETURN;
  END IF;

  FOR v_can, v_blocker IN
    SELECT can_complete, blocker
      FROM check_job_completion_readiness(
        ARRAY(SELECT job_id FROM jobs WHERE customer_id = v_aqua_id AND status = 'In Progress' AND deleted_at IS NULL)::uuid[]
      )
  LOOP
    RAISE NOTICE 'AQUA readiness preview — can_complete: %, blocker: %', v_can, v_blocker;
  END LOOP;
END $$;

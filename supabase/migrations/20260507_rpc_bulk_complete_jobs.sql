-- 20260507_rpc_bulk_complete_jobs.sql
--
-- Atomic bulk-complete RPC for the bulk sign-off flow.
--
-- Fixes the "signatures persisted but status didn't advance" stuck-state bug:
-- the previous flow did 3 separate writes (tech sig, customer sig, status)
-- and accepted partial failures, leaving jobs with both sigs but stuck at
-- 'In Progress' when the trigger rejected the status transition.
--
-- This RPC takes the whole batch as one call and processes per job in an
-- implicit subtransaction (PL/pgSQL BEGIN ... EXCEPTION ... END):
--   1. Lock the row (FOR UPDATE NOWAIT — fail fast on concurrent writes)
--   2. Pre-evaluate via the helper using the about-to-be-written row state
--   3. If blocker, return ok=false WITHOUT writing
--   4. Otherwise: single UPDATE writes both sigs + status (trigger fires
--      and confirms gates against the same state)
--   5. Upsert job_service_records for the *_signature_at columns that
--      downstream finalization/invoicing reads
--   6. Successful jobs commit at outer transaction; failed jobs roll back
--      their subtransaction without affecting siblings
--
-- Tech-sig idempotency via COALESCE — re-entry preserves the original
-- signed_at audit trail. Customer-sig always written from the call payload
-- (customer name/IC can vary across attempts).

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_bulk_complete_jobs(
    p_job_ids UUID[],
    p_tech_name TEXT,
    p_tech_signed_at TIMESTAMPTZ,
    p_customer_name TEXT,
    p_customer_ic TEXT,
    p_customer_signed_at TIMESTAMPTZ
) RETURNS TABLE (
    job_id UUID,
    ok BOOLEAN,
    blocker TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
    v_id UUID;
    v_role TEXT;
    v_user_id UUID;
    v_actor_name TEXT;
    v_row public.jobs;
    v_locked BOOLEAN;
    v_blocker TEXT;
    v_tech_sig JSONB;
    v_customer_sig JSONB;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- Resolve caller (admin bypass + signed_by_name fallback for tech)
    SELECT u.role, u.user_id, u.name
      INTO v_role, v_user_id, v_actor_name
      FROM users u
     WHERE u.auth_id = auth.uid();

    -- Build sig payloads. signature_url stays empty for swipe sigs (matches
    -- the existing swipeSignJob / bulkSwipeSignJobs payload shape).
    v_tech_sig := jsonb_build_object(
        'signed_by_name', COALESCE(p_tech_name, v_actor_name),
        'signed_at', COALESCE(p_tech_signed_at, v_now)::TEXT,
        'signature_url', ''
    );
    v_customer_sig := jsonb_build_object(
        'signed_by_name', p_customer_name,
        'signed_at', COALESCE(p_customer_signed_at, v_now)::TEXT,
        'signature_url', '',
        'ic_no', p_customer_ic
    );

    FOREACH v_id IN ARRAY p_job_ids LOOP
        BEGIN
            -- 1. Lock row (skip immediately if another session has it).
            --    Aliased to "j" because the OUT param "job_id" otherwise
            --    shadows column references inside this function (the
            --    PL/pgSQL parser flags even qualified `jobs.job_id` as
            --    ambiguous when an OUT parameter shares the column name).
            BEGIN
                SELECT j.* INTO v_row FROM jobs j
                  WHERE j.job_id = v_id AND j.deleted_at IS NULL
                  FOR UPDATE NOWAIT;
                v_locked := FOUND;
            EXCEPTION WHEN lock_not_available THEN
                job_id := v_id;
                ok := FALSE;
                blocker := 'Job is locked by another session — please retry.';
                RETURN NEXT;
                CONTINUE;
            END;

            IF NOT v_locked THEN
                job_id := v_id;
                ok := FALSE;
                blocker := 'Job not found or deleted.';
                RETURN NEXT;
                CONTINUE;
            END IF;

            -- 2. Synthesize the post-write row and pre-evaluate
            --    Tech sig: idempotent — preserve existing if any
            --    Customer sig: always overwritten from input
            v_row.technician_signature := COALESCE(v_row.technician_signature, v_tech_sig);
            v_row.customer_signature := v_customer_sig;
            v_row.status := 'Awaiting Finalization';

            v_blocker := evaluate_job_completion(v_row, v_role);
            IF v_blocker IS NOT NULL THEN
                job_id := v_id;
                ok := FALSE;
                blocker := v_blocker;
                RETURN NEXT;
                CONTINUE;
            END IF;

            -- 3. Single atomic UPDATE: tech sig (idempotent via COALESCE),
            --    customer sig, status. Trigger fires and re-validates with
            --    the same state we just synthesized.
            UPDATE jobs j
               SET technician_signature = COALESCE(j.technician_signature, v_tech_sig),
                   customer_signature = v_customer_sig,
                   status = 'Awaiting Finalization'
             WHERE j.job_id = v_id;

            -- 4. Mirror to job_service_records for the *_signature_at
            --    timestamp columns. UPDATE-only path covers the common
            --    case (every In-Progress job has a service record by
            --    construction). The INSERT fallback is defensive — uses
            --    assigned_technician_id to satisfy the NOT NULL on
            --    technician_id.
            UPDATE job_service_records jsr
               SET technician_signature = COALESCE(jsr.technician_signature, v_tech_sig),
                   technician_signature_at = COALESCE(jsr.technician_signature_at, COALESCE(p_tech_signed_at, v_now)),
                   customer_signature = v_customer_sig,
                   customer_signature_at = COALESCE(p_customer_signed_at, v_now),
                   updated_at = v_now
             WHERE jsr.job_id = v_id;

            IF NOT FOUND AND v_row.assigned_technician_id IS NOT NULL THEN
                INSERT INTO job_service_records (
                    job_id, technician_id,
                    technician_signature, technician_signature_at,
                    customer_signature,   customer_signature_at,
                    updated_at
                ) VALUES (
                    v_id, v_row.assigned_technician_id,
                    v_tech_sig, COALESCE(p_tech_signed_at, v_now),
                    v_customer_sig, COALESCE(p_customer_signed_at, v_now),
                    v_now
                );
            END IF;

            job_id := v_id;
            ok := TRUE;
            blocker := NULL;
            RETURN NEXT;

        EXCEPTION WHEN OTHERS THEN
            -- Implicit subtransaction rolls back this iteration; loop continues.
            -- Surface the actual SQLERRM to the caller (not a generic message).
            job_id := v_id;
            ok := FALSE;
            blocker := SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_bulk_complete_jobs(
    UUID[], TEXT, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated, service_role;

COMMIT;

-- Post-apply sanity:
--
-- 1. Dry-run with a stuck job (rolled back):
--   BEGIN;
--   SET LOCAL request.jwt.claim.sub = '<tech-auth-uuid>';
--   SET LOCAL ROLE authenticated;
--   SELECT * FROM rpc_bulk_complete_jobs(
--     ARRAY['77991d44-fef1-4cc2-b249-c177ff155c84']::uuid[],
--     'Test Tech', now(),
--     'Test Customer', '900101-10-1234', now()
--   );
--   ROLLBACK;
--
-- 2. Bad job (missing checklist) returns ok=false, blocker=specific reason
--    without writing anything.

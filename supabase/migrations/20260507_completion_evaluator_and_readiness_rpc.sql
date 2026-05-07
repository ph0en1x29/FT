-- 20260507_completion_evaluator_and_readiness_rpc.sql
--
-- Refactors the existing completion-gate trigger into a reusable evaluator
-- and adds a read-only RPC the bulk-sign banner can call to pre-check
-- whether each job in a candidate set is ready for AWAITING_FINALIZATION.
--
-- Why: today the bulk-sign modal optimistically writes signatures, then
-- attempts the status transition. If the trigger rejects it (missing
-- checklist, service notes, parts, etc.), the signatures persist but the
-- job is stuck in a half-state and the modal shows a misleading
-- "check hourmeter" toast. Pre-checking lets the modal render the actual
-- per-job blocker so the tech knows what to fix BEFORE swiping.
--
-- Trigger logic is unchanged (the trigger now delegates to the evaluator).

BEGIN;

-- ==========================================================================
-- 1. evaluate_job_completion — shared helper used by trigger AND read RPC
--
-- Returns the blocker reason as TEXT, or NULL if the job is ready.
-- Caller passes the post-transition jobs row (NEW from a trigger, or a
-- freshly-read row from the readiness RPC) and the caller's user role.
--
-- IMPORTANT: this function does NOT check status transition validity (i.e.
-- it does not verify NEW.status='Awaiting Finalization' AND OLD.status<>...).
-- The trigger does that early-return separately before delegating here.
-- The readiness RPC just wants the gate evaluation, regardless of status.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.evaluate_job_completion(
    p_row public.jobs,
    p_user_role TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    service_record RECORD;
    has_parts BOOLEAN;
    has_any_parts_row BOOLEAN;
    has_spare_part_photo BOOLEAN;
    v_job_started BOOLEAN;
BEGIN
    -- Admin bypass: maintains current trigger behavior. Admins/supervisors
    -- can transition jobs even when other gates aren't satisfied.
    IF p_user_role IN ('admin', 'Admin 1', 'Admin 2', 'Admin 1 (Service)', 'Admin 2 (Store)', 'supervisor') THEN
        RETURN NULL;
    END IF;

    SELECT * INTO service_record
      FROM job_service_records
     WHERE job_id = p_row.job_id;

    -- Gate 1: job started (any of started_at / repair_start_time / arrival_time on either record)
    v_job_started := COALESCE(service_record.started_at IS NOT NULL, FALSE)
                  OR p_row.started_at IS NOT NULL
                  OR p_row.repair_start_time IS NOT NULL
                  OR p_row.arrival_time IS NOT NULL;
    IF NOT v_job_started THEN
        RETURN 'Cannot complete job: Job was never started (no start time recorded).';
    END IF;

    -- Gate 2: checklist filled (only required for non-Repair, non-FTS job_types)
    IF p_row.job_type NOT IN ('Repair', 'Field Technical Services') THEN
        IF (service_record.checklist_data IS NULL OR service_record.checklist_data = '{}'::JSONB)
           AND (p_row.condition_checklist IS NULL OR p_row.condition_checklist::JSONB = '{}'::JSONB) THEN
            RETURN 'Cannot complete job: Checklist has not been filled.';
        END IF;
    END IF;

    -- Gate 3: service notes or job_carried_out present in some form
    IF (COALESCE(service_record.service_notes, '') = '' AND COALESCE(service_record.job_carried_out, '') = '')
       AND COALESCE(p_row.job_carried_out, '') = '' THEN
        RETURN 'Cannot complete job: Service notes or job carried out description is required.';
    END IF;

    -- Gate 4: parts recorded OR explicitly marked no_parts_used
    has_parts := EXISTS (
        SELECT 1 FROM job_parts
         WHERE job_id = p_row.job_id
           AND COALESCE(return_status, '') NOT IN ('pending_return', 'returned')
    );
    IF NOT has_parts THEN
        has_parts := EXISTS (SELECT 1 FROM job_inventory_usage WHERE job_id = p_row.job_id);
    END IF;
    IF NOT has_parts AND NOT COALESCE(service_record.no_parts_used, FALSE) THEN
        RETURN 'Cannot complete job: Parts must be recorded, or explicitly mark no parts used.';
    END IF;

    -- Gate 5: approved spare-part request must be acknowledged via at least one job_parts row
    -- (returned rows count — pressing Return is a deliberate acknowledgment).
    has_any_parts_row := EXISTS (SELECT 1 FROM job_parts WHERE job_id = p_row.job_id);
    IF NOT has_any_parts_row AND EXISTS (
        SELECT 1 FROM job_requests
         WHERE job_id = p_row.job_id
           AND request_type = 'spare_part'
           AND status IN ('approved', 'issued')
    ) THEN
        RETURN 'Cannot complete job: Parts have been approved for this job. Please ensure all used parts are added to the Used Part section before completing.';
    END IF;

    -- Gate 6: spare-part photo + no_parts_used conflict
    has_spare_part_photo := EXISTS (
        SELECT 1 FROM job_media
         WHERE job_id = p_row.job_id
           AND category = 'spare_part'
    );
    IF has_spare_part_photo AND NOT has_parts AND COALESCE(service_record.no_parts_used, FALSE) THEN
        RETURN 'Cannot complete job: You uploaded photos tagged as "Parts" but ticked "No parts used". Either add the parts you used to the Used Parts list, or re-tag the photos (Condition / Evidence / Other).';
    END IF;

    -- Gate 7: technician signature
    IF COALESCE(service_record.technician_signature, p_row.technician_signature) IS NULL THEN
        RETURN 'Cannot complete job: Technician signature is required.';
    END IF;

    -- Gate 8: customer signature
    IF COALESCE(service_record.customer_signature, p_row.customer_signature) IS NULL THEN
        RETURN 'Cannot complete job: Customer signature is required.';
    END IF;

    RETURN NULL;
END;
$function$;

-- ==========================================================================
-- 2. validate_job_completion_requirements — refactored trigger
--
-- Same external behavior as before, just delegates the gate logic.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.validate_job_completion_requirements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    user_role TEXT;
    v_blocker TEXT;
BEGIN
    -- Only fire on transitions INTO 'Awaiting Finalization'
    IF NEW.status != 'Awaiting Finalization' OR OLD.status = 'Awaiting Finalization' THEN
        RETURN NEW;
    END IF;

    SELECT u.role INTO user_role FROM users u WHERE u.auth_id = auth.uid();

    v_blocker := evaluate_job_completion(NEW, user_role);
    IF v_blocker IS NOT NULL THEN
        RAISE EXCEPTION '%', v_blocker;
    END IF;

    RETURN NEW;
END;
$function$;

-- ==========================================================================
-- 3. check_job_completion_readiness — read-only RPC for bulk-sign banner
--
-- For each job_id in the input array, returns a row with:
--   - can_complete: TRUE if the trigger would accept the transition now
--   - blocker:      NULL if can_complete, else the blocker message
--
-- SECURITY INVOKER so RLS on the read tables (jobs / job_service_records /
-- job_parts / job_requests / job_media / job_inventory_usage) governs
-- access. auth.uid() flows through the calling tech's JWT regardless.
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.check_job_completion_readiness(
    p_job_ids UUID[]
) RETURNS TABLE (
    job_id UUID,
    can_complete BOOLEAN,
    blocker TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
STABLE
AS $function$
DECLARE
    v_role TEXT;
    v_row public.jobs;
    v_blocker TEXT;
BEGIN
    SELECT u.role INTO v_role FROM users u WHERE u.auth_id = auth.uid();

    FOR v_row IN
        SELECT * FROM jobs WHERE jobs.job_id = ANY(p_job_ids) AND jobs.deleted_at IS NULL
    LOOP
        v_blocker := evaluate_job_completion(v_row, v_role);
        job_id := v_row.job_id;
        can_complete := v_blocker IS NULL;
        blocker := v_blocker;
        RETURN NEXT;
    END LOOP;
END;
$function$;

-- Grants: PostgREST (anon / authenticated roles) needs EXECUTE
GRANT EXECUTE ON FUNCTION public.check_job_completion_readiness(UUID[])
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_job_completion(public.jobs, TEXT)
    TO authenticated, service_role;

COMMIT;

-- ==========================================================================
-- Post-apply sanity (run separately, not in the BEGIN block)
-- ==========================================================================
-- 1. Pick a known-good job (status='Awaiting Finalization' already) and
--    verify readiness returns can_complete=true:
--
--   SELECT * FROM check_job_completion_readiness(ARRAY['<known-good-uuid>']::uuid[]);
--
-- 2. Pick a known-blocked stuck job and verify the specific blocker:
--
--   SELECT * FROM check_job_completion_readiness(ARRAY['0b24133f-8e75-4bdd-8a37-3e301f1bc920']::uuid[]);
--   -- expect: can_complete=false, blocker='Cannot complete job: Checklist has not been filled.'
--
-- 3. Re-run an existing completion transition under a tech JWT to verify the
--    refactored trigger still raises the same error message text:
--
--   BEGIN;
--   SET LOCAL request.jwt.claim.sub = '<tech-auth-uuid>';
--   SET LOCAL ROLE authenticated;
--   UPDATE jobs SET status = 'Awaiting Finalization' WHERE job_id = '<known-blocked>';
--   -- expect: ERROR  Cannot complete job: ...
--   ROLLBACK;

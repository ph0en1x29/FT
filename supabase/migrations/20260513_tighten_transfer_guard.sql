-- 20260513_tighten_transfer_guard.sql
--
-- Tightens the transfer guard added in 20260513_transfer_status_and_permission_fix.sql
-- after a security review flagged a privilege-escalation path.
--
-- Problem (security review, 2026-05-13)
-- -------------------------------------
-- The first iteration of the transfer guard fired whenever
-- `NEW.status = 'Incomplete - Reassigned' AND OLD.status != 'Incomplete - Reassigned'`
-- and only checked the user role. It did NOT restrict OLD.status, and it
-- did NOT require the reassignment metadata to be present. This let any
-- authenticated `admin_service` user issue a PostgREST PATCH like
--
--   PATCH /rest/v1/jobs?job_id=eq.X
--   { "status": "Incomplete - Reassigned" }
--
-- against ANY job — including Completed, Disputed, Cancelled jobs — and
-- silently flip its status to Incomplete - Reassigned with no audit trail
-- (reassigned_by_id / reassigned_at left NULL). Because the guard
-- early-returned before the backward-transition check (line 173+), this
-- skipped the admin/supervisor gate that would normally catch a backward
-- jump from Completed (idx 4) → Incomplete - Reassigned (idx 2).
--
-- Blast radius: silent reversion of terminal financial state (invoiced
-- jobs), broken KPI math (kpiSynthesizer's status mapping), and untraceable
-- audit history.
--
-- Fix
-- ---
-- 1. Restrict OLD.status to the legitimate pre-transfer states. A job can
--    only be transferred from active/assigned/in-progress/pending-parts —
--    never from terminal states (Completed, Disputed, Cancelled,
--    Completed Awaiting Ack, Awaiting Finalization).
-- 2. Require reassignment metadata (reassigned_by_id, reassigned_at) to be
--    non-NULL. This mirrors the technician-rejection whitelist's
--    metadata-presence pattern at line 174.
-- 3. Keep the role check (admin/supervisor/admin_service).
--
-- Anyone bypassing this guard now hits the regular forward/backward
-- check, which gates backward moves to admin/supervisor only.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_job_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    current_idx INTEGER;
    new_idx INTEGER;
BEGIN
    -- Get current user's role
    SELECT role INTO user_role FROM users WHERE user_id = auth.uid();

    -- Skip validation for system/service role operations
    IF user_role IS NULL THEN
        BEGIN
            IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
                RETURN NEW;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- If status hasn't changed, allow
    IF OLD.status = NEW.status OR (TG_OP = 'INSERT') THEN
        RETURN NEW;
    END IF;

    -- ── Transfer guard (TIGHTENED 2026-05-13): admin roles can set
    --    'Incomplete - Reassigned' ONLY:
    --      • from a non-terminal status (Assigned, In Progress, Incomplete
    --        - Continuing, Pending Parts); never from Completed/Disputed/etc.
    --      • with reassigned_by_id AND reassigned_at populated (proves the
    --        write came from the legitimate transferJobToTechnician path,
    --        not a bare PATCH that omits the audit fields).
    --    Early-returns before the forward/backward index logic.
    IF NEW.status = 'Incomplete - Reassigned' AND OLD.status != 'Incomplete - Reassigned' THEN
        IF user_role NOT IN ('admin', 'supervisor', 'admin_service') THEN
            RAISE EXCEPTION 'Only admin, supervisor, or service coordinator can transfer jobs. User role: %', user_role;
        END IF;
        IF OLD.status NOT IN ('Assigned', 'In Progress', 'Incomplete - Continuing', 'Pending Parts') THEN
            RAISE EXCEPTION 'Cannot transfer a job from status "%" — only Assigned / In Progress / Incomplete - Continuing / Pending Parts jobs may be transferred.', OLD.status;
        END IF;
        IF NEW.reassigned_by_id IS NULL OR NEW.reassigned_at IS NULL THEN
            RAISE EXCEPTION 'Transfer requires reassigned_by_id and reassigned_at metadata. Use the transfer flow, not a bare status update.';
        END IF;
        RETURN NEW;
    END IF;

    -- Status order: New(0) → Assigned(1) → In Progress(2) → Awaiting Finalization(3) → Completed(4)
    current_idx := get_status_order(OLD.status);
    new_idx := get_status_order(NEW.status);

    -- Forward transitions
    IF new_idx > current_idx THEN
        IF new_idx - current_idx > 1 AND user_role != 'admin' THEN
            RAISE EXCEPTION 'Cannot skip status steps. Move from "%" to "%" is not allowed.', OLD.status, NEW.status;
        END IF;

        IF user_role = 'technician' THEN
            IF NOT (
                (OLD.status = 'Assigned' AND NEW.status = 'In Progress') OR
                (OLD.status = 'In Progress' AND NEW.status = 'Awaiting Finalization')
            ) THEN
                RAISE EXCEPTION 'Technician can only move jobs from Assigned to In Progress, or In Progress to Awaiting Finalization';
            END IF;
        END IF;

        IF user_role = 'accountant' THEN
            IF NOT (OLD.status = 'Awaiting Finalization' AND NEW.status = 'Completed') THEN
                RAISE EXCEPTION 'Accountant can only move jobs from Awaiting Finalization to Completed';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- Backward transitions: only admin/supervisor allowed, with one tightly-scoped exception:
    -- a technician rejecting their own currently-assigned job (Assigned -> New).
    IF new_idx < current_idx THEN
        IF user_role = 'technician'
           AND OLD.status = 'Assigned'
           AND NEW.status = 'New'
           AND OLD.assigned_technician_id = auth.uid()
           AND NEW.technician_rejected_at IS NOT NULL
           AND NEW.assigned_technician_id IS NULL THEN
            RETURN NEW;
        END IF;

        IF user_role NOT IN ('admin', 'supervisor') THEN
            RAISE EXCEPTION 'Only admin or supervisor can move jobs backward. User role: %', user_role;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sanity check: confirm the function source contains the new guards
DO $$
DECLARE src TEXT;
BEGIN
  SELECT prosrc INTO src FROM pg_proc WHERE proname = 'validate_job_status_transition';
  IF src NOT LIKE '%OLD.status NOT IN%' THEN
    RAISE EXCEPTION 'Sanity check failed: tightened guard missing OLD.status whitelist';
  END IF;
  IF src NOT LIKE '%reassigned_by_id IS NULL%' THEN
    RAISE EXCEPTION 'Sanity check failed: tightened guard missing metadata check';
  END IF;
  IF src NOT LIKE '%admin_service%' THEN
    RAISE EXCEPTION 'Sanity check failed: admin_service whitelist regressed';
  END IF;
END $$;

COMMIT;

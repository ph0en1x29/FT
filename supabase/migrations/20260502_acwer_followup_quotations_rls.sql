-- ============================================================
-- Migration: ACWER follow-up — tighten RLS on `quotations`
-- Date: 2026-05-02
-- Purpose: The legacy `quotations_auth_all` policy was `auth.uid() IS NOT
--          NULL` — any authenticated user (including technicians) could
--          read AND write any row. That's wrong now that admin operates
--          quotations through the new QuotationsSection UI. Replace with
--          the same role-based pattern the other ACWER tables already use:
--          admin/admin_service/supervisor can write; everyone authed reads.
--
-- Behavioral impact: technicians and other non-admin roles can no longer
--   write quotations. Reads remain open. The new QuotationsSection UI
--   already gates the write paths to admin/admin_service/supervisor at
--   the React layer, so this change just enforces the same intent at the
--   DB layer.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS quotations_auth_all ON quotations;

CREATE POLICY quotations_admin ON quotations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
              AND users.role IN ('admin', 'admin_service', 'supervisor'))
  );

CREATE POLICY quotations_read ON quotations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
              AND users.role IN ('admin', 'admin_service', 'admin_store', 'supervisor', 'accountant', 'technician'))
  );

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE tablename = 'quotations';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 policies on quotations (admin + read), found %', v_count;
  END IF;
  RAISE NOTICE 'Quotations RLS tightened: 2 policies in place.';
END $$;

COMMIT;

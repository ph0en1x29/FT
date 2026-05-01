-- =============================================
-- FieldPro Migration: AutoCount export queue — lightweight projection
-- =============================================
-- Date: 2026-05-01
-- Purpose:
--   getJobsPendingExport() previously returned a full DETAIL payload per
--   job (`*, customer:customers(*), forklift:forklifts(*), parts_used,
--   media, extra_charges`) just to render a small queue list. The UI
--   consumes only `job_id`, `title`, `customer_name`, and a computed
--   total. With 100 pending jobs this could pull 50–100 MB to the browser.
--
--   New RPC returns only those fields. The total is computed server-side
--   from parts (excluding returned), labor, and extra_charges in a single
--   query.
-- =============================================

BEGIN;

CREATE OR REPLACE FUNCTION get_jobs_pending_export()
RETURNS TABLE (
  job_id uuid,
  job_number text,
  title text,
  customer_id uuid,
  customer_name text,
  job_confirmed_at timestamptz,
  total_amount numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    j.job_id,
    j.job_number,
    j.title,
    j.customer_id,
    c.name AS customer_name,
    j.job_confirmed_at,
    (
      COALESCE(j.labor_cost, 0)
      + COALESCE((
          SELECT SUM(jp.quantity * COALESCE(jp.sell_price_at_time, 0))
          FROM job_parts jp
          WHERE jp.job_id = j.job_id
            AND COALESCE(jp.return_status, '') NOT IN ('pending_return', 'returned')
        ), 0)
      + COALESCE((
          SELECT SUM(ec.amount)
          FROM extra_charges ec
          WHERE ec.job_id = j.job_id
        ), 0)
    )::numeric AS total_amount
  FROM jobs j
  LEFT JOIN customers c ON c.customer_id = j.customer_id
  WHERE j.parts_confirmed_at IS NOT NULL
    AND j.job_confirmed_at IS NOT NULL
    AND j.autocount_export_id IS NULL
    AND j.deleted_at IS NULL
    AND j.billing_path != 'fleet'
  ORDER BY j.job_confirmed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_jobs_pending_export() TO authenticated;

COMMIT;

SELECT proname FROM pg_proc WHERE proname = 'get_jobs_pending_export';

-- Migration: fix forklift service predictions view security invoker
-- Date: 2026-03-18
-- Author: Phoenix (AI)

-- Supabase linter error:
-- public.v_forklift_service_predictions is marked as SECURITY DEFINER.
-- Views should run as SECURITY INVOKER so they respect the querying user's
-- RLS and permissions instead of the view creator's privileges.

ALTER VIEW IF EXISTS public.v_forklift_service_predictions
SET (security_invoker = true);

COMMENT ON VIEW public.v_forklift_service_predictions IS
  'Dashboard view showing service predictions for all engine-based forklifts; runs as security invoker to respect caller RLS';

-- ROLLBACK:
-- ALTER VIEW public.v_forklift_service_predictions SET (security_invoker = false);

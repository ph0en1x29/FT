#!/bin/bash
# Auto-fix tables with RLS enabled but no policies
# Adds permissive policy for authenticated users

set -e

source /home/jay/clawd/.credentials/supabase-ft.env

echo "🔧 Fixing RLS policies..."

# Find and fix tables with RLS but no policies
FIX_QUERY="DO \$\$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT c.relname as table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' 
      AND n.nspname = 'public'
      AND c.relrowsecurity = true
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname)
  LOOP
    EXECUTE format('CREATE POLICY \"%s_authenticated_all\" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', r.table_name, r.table_name);
    EXECUTE format('GRANT ALL ON public.%I TO authenticated', r.table_name);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', r.table_name);
    RAISE NOTICE 'Fixed: %', r.table_name;
  END LOOP;
END \$\$;"

RESULT=$(curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_MANAGEMENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$FIX_QUERY" | jq -Rs .)}")

echo "✅ Done. Result: $RESULT"

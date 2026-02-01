#!/bin/bash
# Check for tables with RLS enabled but no policies
# Run this after any migration that touches RLS

set -e

# Load credentials
source /home/jay/clawd/.credentials/supabase-ft.env

echo "🔍 Checking for RLS issues..."

# Find tables with RLS enabled but no policies
QUERY="SELECT c.relname as table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' 
  AND n.nspname = 'public'
  AND c.relrowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname
  )
ORDER BY c.relname;"

RESULT=$(curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_MANAGEMENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$QUERY\"}")

if [ "$RESULT" == "[]" ]; then
  echo "✅ All tables with RLS have policies"
else
  echo "⚠️  Tables with RLS but NO policies:"
  echo "$RESULT" | jq -r '.[].table_name' 2>/dev/null || echo "$RESULT"
  echo ""
  echo "Run: npm run fix:rls to add default policies"
  exit 1
fi

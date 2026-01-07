# Security Guidelines

## Credential Handling

### ⚠️ Before Going Live

When FieldPro goes live with ACWER or becomes public:
- Move test credentials from USER_GUIDE.md to private doc
- Rotate all test account passwords
- Use .env.example with placeholders only

### Current Status (Demo Phase)

✅ **OK for now** — Repo is private, demo only
⚠️ **Before production** — Remove or relocate test credentials

---

## Environment Variables

### For Local Development

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

The `.env.local` file is in `.gitignore` and will not be committed.

### Required Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `VITE_GEMINI_API_KEY` | Google Gemini API (AI features) |

---

## Supabase Security Checklist

### Before ACWER Go-Live

- [ ] **Enable email confirmation**
  - Authentication → Providers → Email → Confirm email ✓
- [ ] **Enable leaked password protection** ⚠️ (was enabled 2026-01-03, linter shows disabled 2026-01-05)
  - Authentication → Settings → Enable Leaked Password Protection
  - **ACTION REQUIRED**: Re-enable in Supabase Dashboard
- [x] **Fix RLS on all tables** ✅ (2026-01-03)
  - Enabled RLS + policies on: `quotations`, `service_intervals`, `scheduled_services`, `notifications`, `technician_kpi_snapshots`
  - See `database/migrations/security_fix_linter_issues.sql`
- [x] **Fix role case mismatch in RLS** ✅ (2026-01-05)
  - Bug: Role functions returned lowercase but policies compared Title case
  - Also fixed: `get_current_user_role()` used wrong column (`user_id` → `auth_id`)
  - See `database/migrations/fix_role_case_mismatch.sql`
- [x] **Fix missing RLS policies on job_parts/job_media** ✅ (2026-01-05)
  - Bug: RLS redesign enabled RLS but forgot to create new policies
  - Fixed: Added role-based policies for Admin, Supervisor, Accountant, Technician
  - Tables: `job_parts`, `job_media`, `extra_charges`
  - See `database/migrations/fix_missing_rls_policies.sql`
- [x] **Fix Security Definer views** ✅ (2026-01-05 - Re-fixed after merge migration)
  - HR views were recreated during user-employee merge without `security_invoker`
  - Converted 4 views to SECURITY INVOKER: `v_todays_leave`, `v_expiring_licenses`, `v_pending_leaves`, `v_expiring_permits`
  - Updated original migration to include `WITH (security_invoker = true)`
  - See `database/migrations/fix_security_linter_warnings.sql`
- [x] **Fix notification RLS for realtime** ✅ (2026-01-07)
  - Bug: Notifications not delivered reliably, missing INSERT policy for system notifications
  - Fixed: Added `authenticated_insert_notifications` policy for system-generated notifications
  - Enabled REPLICA IDENTITY FULL for realtime subscriptions
  - Added notifications and job_requests tables to supabase_realtime publication
  - Migration is idempotent (safe to run multiple times)
  - See `database/migrations/fix_notification_realtime.sql`
- [x] **Fix RLS on backup tables** ✅ (2026-01-05)
  - Enabled RLS on `_backup_users_before_merge` and `_backup_employees_before_merge`
  - Created restrictive policy (`USING (false)`) - only service_role can access
  - See `database/migrations/fix_security_linter_warnings.sql`
- [x] **Add search_path to functions** ✅ (2026-01-05 - Additional 3 functions fixed)
  - Fixed 44 functions (2026-01-03) + 3 new functions (2026-01-05)
  - New: `update_job_assignments_updated_at`, `update_user_timestamp`, `update_job_requests_updated_at`
  - See `database/migrations/fix_function_search_paths.sql` and `fix_function_search_paths_v2.sql`
- [x] **Fix RLS performance issues** ✅ (2026-01-03)
  - Fixed 25 Auth RLS InitPlan issues (auth.uid() caching)
  - Consolidated 70+ duplicate policies into ~50 optimized policies
  - See `database/migrations/fix_rls_performance_v2.sql`
- [x] **Add foreign key indexes** ✅ (2026-01-03)
  - Added 48 indexes for unindexed foreign keys
  - Added composite indexes for jobs query optimization
  - See `database/migrations/add_foreign_key_indexes.sql`
- [ ] **Audit service role key usage**
  - Ensure not exposed in frontend
- [ ] **Enable 2FA for admin accounts**
  - Supabase Dashboard → Settings

---

## Production Credentials

When deploying to Vercel:

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add all required variables
3. Never commit production credentials to repo

---

## Reporting Security Issues

If you discover a vulnerability:
1. Do NOT create a public GitHub issue
2. Contact project admin directly
3. Provide details privately

---

## Credential Rotation Schedule

| Credential | Rotation | Last Rotated | Next Due |
|------------|----------|--------------|----------|
| Supabase anon key | On compromise | — | — |
| Test account passwords | Before go-live | — | Before ACWER |
| Gemini API key | Quarterly | — | — |

---

*Last Updated: January 7, 2026*

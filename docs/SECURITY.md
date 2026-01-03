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
- [x] **Enable leaked password protection** ✅ (2026-01-03)
  - Authentication → Settings → Enable Leaked Password Protection
- [x] **Fix RLS on all tables** ✅ (2026-01-03)
  - Enabled RLS + policies on: `quotations`, `service_intervals`, `scheduled_services`, `notifications`, `technician_kpi_snapshots`
  - See `database/migrations/security_fix_linter_issues.sql`
- [x] **Fix Security Definer views** ✅ (2026-01-03)
  - Converted 5 views to SECURITY INVOKER: `active_rentals_view`, `v_todays_leave`, `v_expiring_licenses`, `v_pending_leaves`, `v_expiring_permits`
  - See `database/migrations/fix_security_invoker_views.sql`
- [x] **Add search_path to functions** ✅ (2026-01-03)
  - Fixed 44 functions with `SET search_path = public`
  - See `database/migrations/fix_function_search_paths.sql`
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

*Last Updated: January 3, 2026*

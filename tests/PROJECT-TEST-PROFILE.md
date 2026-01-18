# Project Test Profile: FieldPro

> Last Updated: 2026-01-16
> Updated By: Claude Code

---

## Stack

| Property | Value |
|----------|-------|
| Name | FieldPro (fieldpro-prototype) |
| Framework | React 19 + Vite 6 |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email/password) |
| Test Runner | Playwright |

---

## Features Present

| Feature | Status | Details |
|---------|--------|---------|
| Authentication | ✅ Yes | Supabase Auth |
| Multiple User Roles | ✅ Yes | Admin, Admin Service, Admin Store, Supervisor, Technician, Accountant |
| Payments | ❌ No | - |
| Real-time | ✅ Yes | Supabase subscriptions (not WebSocket) |
| Internationalization | ❌ No | English only |
| PWA/Offline | ❌ No | - |
| File Uploads | ✅ Yes | Job photos via Supabase storage |
| API Routes | ❌ No | Direct Supabase client |
| PDF Generation | ✅ Yes | Service reports, invoices, quotations |
| Row Level Security | ✅ Yes | Role-based RLS policies |

---

## Pages (31 total)

**Public:**
- `/login` - Login page

**Protected (require auth):**
- `/` - Dashboard (role-based redirect)
- `/jobs` - Job board
- `/jobs/:id` - Job detail
- `/forklifts` - Asset list
- `/forklifts/:id` - Asset profile
- `/customers` - Customer management
- `/technicians` - Technician management
- `/job-types` - Job type configuration
- `/service-intervals` - Service interval settings
- `/invoices` - Invoice management
- `/van-stock` - Van stock management
- `/hourmeter-review` - Hourmeter amendments
- `/pending-confirmations` - Deferred acknowledgements
- `/kpi` - Technician KPI dashboard
- ...and more

---

## Test Accounts

⚠️ **Configure in `.env.test` or `.env.local`:**

```
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=your-password
TEST_SUPERVISOR_EMAIL=supervisor@test.com
TEST_SUPERVISOR_PASSWORD=your-password
TEST_TECHNICIAN_EMAIL=tech@test.com
TEST_TECHNICIAN_PASSWORD=your-password
```

---

## Relevant Test Utilities

Based on FieldPro's features:

**Use:**
- ✅ core/ - ErrorCapture, smokeTest, wait helpers
- ✅ auth/ - login, testProtectedRoute, testRoleAccess
- ✅ security/ - testAuthBypass, checkSensitiveDataExposure
- ✅ performance/ - measureCoreWebVitals (for dashboard)
- ✅ accessibility/ - runAxeAudit (tablet-friendly UI)

**Skip:**
- ❌ payments/ - No payment processing
- ❌ advanced/websocket - Uses Supabase subscriptions
- ❌ advanced/i18n - Single language
- ❌ advanced/pwa - Not a PWA

---

## Test Priority

| Priority | Area | Why Critical |
|----------|------|--------------|
| 🔴 P0 | Login/logout flow | Core authentication |
| 🔴 P0 | Protected route redirects | Security baseline |
| 🔴 P0 | Role-based access | 6 roles with different permissions |
| 🟠 P1 | Job creation workflow | Core business feature |
| 🟠 P1 | Dashboard data loading | Main user interface |
| 🟡 P2 | Form validation | Data integrity |
| 🟢 P3 | PDF generation | Business documents |

---

## Special Notes

- **Dev Mode**: FT has a built-in dev mode with role impersonation (`/hooks/useDevMode.ts`)
- **Supabase Dependency**: Tests require Supabase connection or mock
- **RLS Policies**: Tests should verify role-based data access
- **Large Service File**: `supabaseService.ts` is 6,200+ lines

---

## Test History

| Date | What Tested | Result | Tested By |
|------|-------------|--------|-----------|
| 2026-01-16 | Initial setup | Framework configured | Claude Code |

# FieldPro Security & Code Quality Audit

**Date:** 2026-01-31  
**Auditor:** Phoenix (Clawdbot Subagent)  
**Project:** FieldPro v0.0.0 (fieldpro-prototype)  
**Location:** `/home/jay/FT`  
**Files Analyzed:** 204 TypeScript/TSX files

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟠 High Priority | 6 |
| 🟡 Medium Priority | 8 |
| ℹ️ Informational | 5 |

**Overall Assessment:** The codebase demonstrates good security practices in several areas (RLS policies, parameterized queries, no dangerouslySetInnerHTML usage), but has some critical issues that need immediate attention before production deployment.

---

## 🔴 Critical Issues

### Issue 1: Hardcoded Demo Credentials in UI

- **Location:** `pages/LoginPage.tsx:92-95`
- **Risk:** Demo credentials (`admin@example.com / admin123`) are displayed in the login page UI. While the actual test accounts use different credentials, this suggests poor security hygiene and could mislead users about security posture.
- **Code:**
  ```tsx
  <div className="inline-block bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs text-slate-500 font-mono">
    admin@example.com / admin123
  </div>
  ```
- **Solution:** Remove demo credentials display entirely, or gate it behind `import.meta.env.DEV` check
- **Effort:** Easy

### Issue 2: Sensitive Data in .env.local Exposed

- **Location:** `.env.local`
- **Risk:** While `.env.local` is gitignored, the file contains actual Supabase production credentials and test account passwords that could be exposed via process memory or debugging tools. The anon key is particularly sensitive.
- **Details Found:**
  - Production Supabase URL and anon key
  - Test account emails and passwords in plaintext
  - VAPID keys for push notifications
- **Solution:** 
  1. Rotate all credentials before production
  2. Use secrets manager for sensitive values
  3. Remove test passwords from env file (use separate test config)
- **Effort:** Medium

### Issue 3: Gemini API Key Exposed to Client Bundle

- **Location:** `vite.config.ts:14-17`, `services/geminiService.ts:8`
- **Risk:** The Gemini API key is injected into the client-side JavaScript bundle via Vite's `define` config. Anyone with browser devtools can extract this key.
- **Code:**
  ```ts
  define: {
    'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
  }
  ```
- **Solution:** Move AI features to a server-side API route or Edge Function. The API key should never reach the client.
- **Effort:** Medium-Hard

---

## 🟠 High Priority Issues

### Issue 4: Dev Mode Can Bypass Permission Checks in Strict Mode

- **Location:** `hooks/useDevMode.ts:85-88`
- **Risk:** Dev mode allows users with dev emails to impersonate any role with full permission override in "strict" mode. If `VITE_DEV_EMAILS` is misconfigured or email spoofing occurs, unauthorized users could gain admin access.
- **Details:**
  - Hardcoded dev email: `dev@test.com`
  - `permissionRole` uses impersonated role in strict mode
  - Permission overrides bypass role defaults entirely
- **Solution:** 
  1. Add server-side validation of dev mode
  2. Require additional auth factor for strict mode
  3. Log all dev mode activations
- **Effort:** Medium

### Issue 5: Frontend-Only Role Checks Without Backend Enforcement

- **Location:** Multiple components (e.g., `pages/PendingConfirmations.tsx:47-49`, `pages/AutoCountExport.tsx:79-80`)
- **Risk:** Role checks are performed only on the frontend. While RLS provides backend protection, inconsistent frontend/backend checks could lead to UI bypass or data leakage.
- **Examples:**
  ```tsx
  const isAdminService = currentUser.role === UserRole.ADMIN_SERVICE || currentUser.role === UserRole.ADMIN;
  const isAdminStore = currentUser.role === UserRole.ADMIN_STORE || currentUser.role === UserRole.ADMIN;
  ```
- **Solution:** Ensure all sensitive operations verify roles server-side via RLS/RPC functions
- **Effort:** Medium

### Issue 6: Two-Step User Creation Could Be Abused

- **Location:** `services/userService.ts:77-104`
- **Risk:** The `prepare_user_creation` → `complete_user_creation` flow relies on the pending ID staying valid. Race conditions or replay attacks could potentially create unauthorized users.
- **Solution:** 
  1. Add expiration to pending user creation requests
  2. Verify caller's permissions in `complete_user_creation` RPC
  3. Log all user creation attempts
- **Effort:** Medium

### Issue 7: Missing Input Sanitization on `.or()` Query

- **Location:** `services/leaveService.ts:363`
- **Risk:** User-controlled date values are interpolated into the `.or()` filter without explicit sanitization. While Supabase parameterizes these, the pattern is risky.
- **Code:**
  ```ts
  .or(`start_date.lte.${endOfMonth},end_date.gte.${startOfMonth}`)
  ```
- **Solution:** Use separate `.gte()` and `.lte()` calls instead of string interpolation
- **Effort:** Easy

### Issue 8: Large Console Logging in Production

- **Location:** Multiple files in `services/` (16 instances)
- **Risk:** While gated by `isDev`, some console.log/warn/error calls may leak sensitive information in development mode, and the check pattern is inconsistent.
- **Files affected:**
  - `forkliftService.ts` (6 instances)
  - `jobService.ts` (6 instances)
  - `jobInvoiceService.ts` (3 instances)
  - `supabaseClient.ts` (2 instances)
- **Solution:** 
  1. Remove all console statements for production
  2. Use error tracking service (Sentry) exclusively
  3. Ensure no sensitive data (passwords, tokens) in log messages
- **Effort:** Easy

### Issue 9: localStorage Used for Sensitive State

- **Location:** `hooks/useDevMode.ts`, `contexts/FeatureFlagContext.tsx`
- **Risk:** Dev mode state and feature flags stored in localStorage persist across sessions and could be manipulated by malicious scripts (XSS vector).
- **Keys exposed:**
  - `fieldpro_dev_mode`
  - `fieldpro_permission_overrides`
  - `fieldpro_feature_flags`
  - `fieldpro-theme`
- **Solution:** 
  1. Validate localStorage data before use
  2. Consider sessionStorage for sensitive state
  3. Add integrity checks for critical settings
- **Effort:** Easy-Medium

---

## 🟡 Medium Priority Issues

### Issue 10: Large Files Need Refactoring (26 files > 500 lines)

- **Location:** Multiple files
- **Risk:** Large files are harder to audit, test, and maintain. They often contain complex logic with higher bug probability.
- **Top offenders:**
  | File | Lines |
  |------|-------|
  | `pages/JobBoard.tsx` | 1,081 |
  | `pages/JobDetail/JobDetailPage.tsx` | 1,047 |
  | `pages/ForkliftProfile.tsx` | 988 |
  | `pages/MyLeaveRequests.tsx` | 823 |
  | `components/dashboards/DashboardPreviewV4.tsx` | 773 |
  | `pages/InventoryPage.tsx` | 724 |
  | `services/jobService.ts` | 719 |
  | `types/job.types.ts` | 670 |
- **Solution:** Continue splitting into smaller components/modules (work already started with JobDetail components)
- **Effort:** Hard

### Issue 11: Only 1 `any` Type Found, But Return Types Missing

- **Location:** `tests/utilities/performance/index.ts:39`
- **Risk:** While only one explicit `any` was found (in tests), many async functions lack explicit return types. TypeScript inference works, but explicit types improve maintainability.
- **Solution:** Add explicit return types to all exported functions
- **Effort:** Medium

### Issue 12: No Rate Limiting Implemented

- **Location:** Application-wide
- **Risk:** No client-side or explicit server-side rate limiting found. Supabase provides some protection, but brute-force attacks on login or API abuse are possible.
- **Evidence:** Only mention is playwright config comment: `workers: 1, // Sequential to avoid Supabase auth rate limiting`
- **Solution:** 
  1. Implement client-side rate limiting for sensitive operations
  2. Configure Supabase rate limits
  3. Add login attempt tracking
- **Effort:** Medium

### Issue 13: Missing CORS Configuration

- **Location:** N/A (relies on Supabase defaults)
- **Risk:** No explicit CORS configuration found in the codebase. Supabase handles this, but custom API endpoints would need configuration.
- **Solution:** Document reliance on Supabase CORS; add explicit config if custom endpoints are added
- **Effort:** Easy

### Issue 14: Error Boundary Only at Root Level

- **Location:** `index.tsx:22-24`, `components/ChunkErrorBoundary.tsx`
- **Risk:** Only one error boundary exists at the app root. Errors in sub-components could crash the entire app instead of gracefully degrading.
- **Solution:** Add error boundaries around major page sections
- **Effort:** Medium

### Issue 15: JSON.parse Without Try-Catch in Some Paths

- **Location:** `contexts/FeatureFlagContext.tsx:66`, `hooks/useDevMode.ts:54,66`
- **Risk:** While currently wrapped in try-catch, the pattern of parsing localStorage data needs consistent error handling.
- **Solution:** Create a utility function `safeJsonParse` for consistent handling
- **Effort:** Easy

### Issue 16: Insufficient useMemo/useCallback Usage

- **Location:** Application-wide (83 usages found)
- **Risk:** While 83 instances exist, large components like JobBoard (1081 lines) and JobDetailPage (1047 lines) could benefit from more aggressive memoization to prevent unnecessary re-renders.
- **Solution:** Audit render performance with React DevTools Profiler
- **Effort:** Medium

### Issue 17: window.location.reload() Used Directly

- **Location:** 4 files (`ChunkErrorBoundary.tsx`, `pushNotificationService.ts`, `QuickActions.tsx`, `useRealtimeNotifications.ts`)
- **Risk:** Direct page reloads lose application state. While sometimes necessary, should be minimized.
- **Solution:** Use React Router navigation where possible; save state before reload
- **Effort:** Easy

---

## 🟢 Good Practices Found

### ✅ No dangerouslySetInnerHTML Usage
The codebase has zero instances of `dangerouslySetInnerHTML`, eliminating a major XSS vector.

### ✅ No Service Role Key in Frontend
No evidence of `service_role` key exposure in client-side code. All queries use the anon key.

### ✅ Comprehensive RLS Policies
The `database/historical/rls_redesign/` directory contains well-structured RLS policies:
- Role-based access for Admin, Supervisor, Accountant, Technician
- Helper functions (`has_role()`, `has_any_role()`, `is_admin_or_supervisor()`)
- Locking mechanisms for invoiced records
- Status-based update restrictions

### ✅ Parameterized Queries Throughout
All Supabase queries use the SDK's parameterized query builder (`.eq()`, `.select()`, `.insert()`). No raw SQL string interpolation found in application code.

### ✅ Proper Environment Variable Handling
Environment variables use Vite's `import.meta.env` pattern correctly, with `.env.example` providing templates and `.env.local` properly gitignored.

### ✅ Error Tracking Integration
Sentry is properly integrated with:
- Production-only error capturing
- Filtered noisy errors
- User context setting
- Chunk error handling

### ✅ Secure User Creation Flow
The two-step user creation (`prepare_user_creation` → `complete_user_creation`) prevents direct RLS bypass for user creation.

### ✅ TypeScript Strict Mode
The project uses TypeScript with minimal `any` types (only 1 found, in tests).

---

## Database Review

### RLS Status (per existing SECURITY.md)
- ✅ All main tables have RLS enabled
- ✅ Policies cover SELECT, INSERT, UPDATE, DELETE for all roles
- ✅ Backup tables have restrictive `USING (false)` policies
- ✅ Job parts/media policies fixed (2026-01-05)
- ✅ Notification realtime policies fixed (2026-01-07)

### Missing/Recommended Indexes
The `docs/DATABASE_OPTIMIZATION_REPORT.md` indicates 48 foreign key indexes were added. Current schema appears well-indexed.

### RPC Functions Security
- ✅ `search_path` added to all functions
- ✅ `SECURITY DEFINER` used appropriately
- ✅ Views converted to `SECURITY INVOKER`

---

## Recommendations Summary

### Immediate (Before Production)

1. **Remove demo credentials from LoginPage UI**
2. **Move Gemini API calls to server-side**
3. **Rotate all credentials in .env.local**
4. **Enable email confirmation in Supabase** (flagged in SECURITY.md)
5. **Enable leaked password protection** (flagged as disabled)

### Short-Term (Sprint Priority)

6. **Add rate limiting for login attempts**
7. **Implement server-side dev mode validation**
8. **Replace `.or()` string interpolation with explicit filters**
9. **Add error boundaries to major page sections**
10. **Audit and remove unnecessary console logging**

### Medium-Term (Tech Debt)

11. **Continue breaking down large files (>500 lines)**
12. **Add explicit return types to all service functions**
13. **Implement comprehensive input validation layer**
14. **Add security headers via Vercel config**
15. **Set up automated security scanning in CI**

---

## Appendix: Files Reviewed

### Services (30 files)
All files in `/services/` directory were reviewed for SQL injection, auth bypass, and data exposure.

### Pages (50+ files)
All page components reviewed for XSS, auth checks, and sensitive data handling.

### Hooks & Contexts (8 files)
Reviewed for state management security and localStorage handling.

### Types (10 files)
Reviewed for sensitive field exposure and role definitions.

### Database Migrations (2 directories)
Reviewed RLS policies and function security.

---

*This audit was performed on 2026-01-31. Security is an ongoing concern; re-audit recommended after significant changes or before major deployments.*

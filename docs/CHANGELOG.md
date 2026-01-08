# FieldPro Changelog

All notable changes, decisions, and client requirements for this project.

---

## Status Legend

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Requirements Confirmed | Client approved, ready to START building |
| 🔨 | In Development | Currently being built |
| ✔️ | Completed | Implemented and tested |
| ⏳ | Pending Confirmation | Awaiting client response |
| ❌ | Not Started | Requirements confirmed but build not begun |

---

## [Unreleased] - ACWER Workflow Implementation

### Client
**ACWER Industrial Equipment Sdn Bhd** (Malaysia)
- ~2,000 forklifts across Johor and Penang branches
- ~60 service jobs/day
- Uses AutoCount 2.2 for accounting

### Current Phase
📋 **Requirements Confirmed** — Ready to begin implementation

---

### 🔧 Notification & Service Records RLS Fix v4 (2026-01-08)
- **Updated:** 2026-01-08 (author: Claude)
- **Status:** 🔨 Migration Ready - Run in Supabase SQL Editor
- **Issues Fixed:**
  1. **403 on notification INSERT** - Technicians couldn't create notifications
  2. **406 on job_service_records** - Missing RLS policies blocking reads

#### Root Cause:
- Notification policies used subqueries on `users` table, which is itself RLS-protected
- The subquery `SELECT user_id FROM users WHERE auth_id = auth.uid()` fails when RLS blocks access
- Solution: Use `SECURITY DEFINER` functions to bypass RLS for user lookup

#### Key Changes:
1. **Created `get_my_user_id()` function** - SECURITY DEFINER, bypasses users RLS
2. **Created `is_admin_or_supervisor()` function** - For admin check with SECURITY DEFINER
3. **Recreated all notification policies** using these secure functions
4. **Added job_service_records policies** - Permissive for all authenticated users

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
database/migrations/fix_notification_and_service_records_rls.sql
```

#### After Migration - Verify:
```sql
-- Check notification policies (should see 7 policies)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'notifications';

-- Check service records policies (should see 3 policies)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'job_service_records';

-- Test helper function
SELECT get_my_user_id() as my_user_id;
```

---

### 🚨 Notification RLS v3 - Bulletproof Fix (2026-01-08)
- **Updated:** 2026-01-08 (author: Claude)
- **Status:** 🔨 Migration Ready - Awaiting Deployment
- **Issue:** Technicians still getting 403 on notification SELECT after v2 cleanup

#### Problem:
The v2 cleanup used `get_user_id_from_auth()` helper function which either:
1. Doesn't exist in Supabase (migration not run)
2. Returns NULL due to missing GRANT or auth_id mismatch
3. Has SECURITY DEFINER but still fails permission check

#### Solution:
New migration `fix_notification_rls_v3.sql` that:
1. **Creates the helper function** (ensures it exists)
2. **Uses direct subqueries** instead of helper functions for reliability
3. **Handles role case sensitivity** (`'admin'` AND `'Admin'`)

#### Key Change:
```sql
-- Before (unreliable - depends on function):
USING (user_id = get_user_id_from_auth())

-- After (reliable - direct subquery):
USING (user_id IN (
    SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()
))
```

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
database/migrations/fix_notification_rls_v3.sql
```

#### Diagnostic Queries (run after migration):
```sql
-- 1. Verify policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'notifications';

-- 2. Test auth mapping (run as authenticated user)
SELECT get_user_id_from_auth() as my_user_id;

-- 3. Verify user has auth_id set
SELECT user_id, auth_id, name, role FROM users WHERE role = 'technician';
```

---

### 🚨 Notification RLS Policy Cleanup (2026-01-08)
- **Updated:** 2026-01-08 (author: Claude)
- **Status:** 🔨 Migration Ready - Awaiting Deployment
- **Issue Source:** Smoke test failure - 403 errors on notification insert/select

#### Problem:
Notification smoke test failed with RLS violations:
- `new row violates row-level security policy for table "notifications"`
- `GET /rest/v1/notifications?select=* → 403`

#### Root Cause:
**Two migration files created conflicting policies on the same table:**

| Migration | Policy Name | INSERT Allows |
|-----------|-------------|---------------|
| `fix_notification_realtime.sql` | `authenticated_insert_notifications` | ✅ All authenticated |
| `fix_rls_performance.sql` | `notifications_insert_policy` | ❌ Admin/Supervisor only |

The `fix_notification_realtime.sql` drops policies like `admin_all_notifications` but **doesn't drop** legacy `notifications_*_policy` policies (different naming convention).

Result: **10 policies** on one table with conflicting rules.

#### Policy Dump (Before Fix):
```
authenticated_insert_notifications  INSERT  WITH CHECK (true)           ← Should work
notifications_insert_policy         INSERT  WITH CHECK (Admin/Supervisor) ← Blocks technicians
```

#### Solution:
New migration `fix_notification_rls_cleanup.sql` that:
1. Drops ALL 10+ existing policies (both naming conventions)
2. Creates 7 clean, non-conflicting policies
3. Handles role case sensitivity (`'admin'` and `'Admin'`)
4. Uses direct `EXISTS` subqueries instead of helper functions

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
database/migrations/fix_notification_rls_cleanup.sql
```

#### New Policy Set:
| Policy | Operation | Who |
|--------|-----------|-----|
| `notif_select_own` | SELECT | Own notifications |
| `notif_select_admin` | SELECT | Admin/Supervisor: all |
| `notif_insert_any` | INSERT | Any authenticated user |
| `notif_update_own` | UPDATE | Own notifications |
| `notif_update_admin` | UPDATE | Admin/Supervisor: all |
| `notif_delete_own` | DELETE | Own notifications |
| `notif_delete_admin` | DELETE | Admin/Supervisor: all |

#### Testing After Migration:
- [ ] Technician can submit helper request (notification created)
- [ ] Admin receives notification for request
- [ ] Admin approves → Technician receives notification
- [ ] No 403 errors on notification operations

---

### 🔔 Real-Time Notification System Fix v2 (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✔️ Completed
- **Issue Source:** ACWER customer feedback (06/01/2025 troubleshooting report)

#### Issues Addressed (from Customer Report):
1. **Dashboard Notifications** - Notifications only on bell icon, not dashboard
2. **Request Alerts** - No sound/notification for helper/spare part requests  
3. **Job Assignment** - Technician B doesn't see assigned jobs immediately
4. **Real-Time Inconsistency** - Sometimes works, sometimes nothing

#### Root Cause Analysis:
The previous fix added `notifications` and `job_requests` to realtime publication, but **missed the `jobs` table**. This meant:
- Job assignment changes were never broadcast via WebSocket
- Technicians couldn't see new jobs in real-time
- Only notification records worked, not actual job data

Additionally, `NotificationBell` component was polling every 30 seconds instead of using the real-time hook, causing:
- Inconsistent state between bell icon and dashboard panel
- Unnecessary database queries
- Up to 30-second delay in bell updates

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
database/migrations/fix_jobs_realtime.sql
```

#### Fixes Applied:

**1. New Migration `fix_jobs_realtime.sql`:**
- Adds `jobs` table to `supabase_realtime` publication
- Sets `REPLICA IDENTITY FULL` for complete row data on changes
- Idempotent - safe to run multiple times

**2. Refactored `NotificationBell.tsx`:**
- Removed 30-second polling mechanism
- Now consumes `NotificationProvider` context (shared real-time state)
- Single source of truth for notification state
- Added connection status indicator (Live/Offline)
- Added dark mode support for dropdown

**3. Added `NotificationProvider` context:**
- Centralized real-time subscription in `contexts/NotificationContext.tsx`
- Shared state across bell + dashboard (no duplicate sounds/toasts)
- Dashboard refreshes on job update tick from provider

#### Architecture After Fix:
```
┌─────────────────────────────────────────────────────┐
│                    Supabase                         │
│  ┌─────────────────────────────────────────────┐   │
│  │         supabase_realtime publication        │   │
│  │  • notifications ✓                           │   │
│  │  • job_requests ✓                            │   │
│  │  • jobs ✓ (NEW)                              │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         │
                         │ WebSocket
                         ▼
┌─────────────────────────────────────────────────────┐
│              NotificationProvider                   │
│  • Uses useRealtimeNotifications                    │
│  • Subscribes to notifications (INSERT)             │
│  • Subscribes to jobs (INSERT/UPDATE)               │
│  • Subscribes to job_requests (INSERT/UPDATE)       │
│  • Plays sound, shows browser notification          │
│  • Vibrates on mobile                               │
└─────────────────────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
    ┌───────────────┐         ┌───────────────┐
    │NotificationBell│         │NotificationPanel│
    │  (Header)      │         │  (Dashboard)   │
    │  Real-time ✓   │         │  Real-time ✓   │
    └───────────────┘         └───────────────┘
```

#### Testing Checklist:
- [x] Run migration `fix_jobs_realtime.sql` on Supabase
- [ ] Admin assigns job → Technician receives notification + sound
- [ ] Technician requests helper → Admin receives notification + sound
- [ ] Admin approves request → Technician receives notification + sound
- [ ] Job reassignment → New technician sees job immediately
- [ ] Bell icon and Dashboard panel show same count
- [ ] Connection indicator shows "Live" when connected

---

### 🔧 Technician Licenses & Permits Tab Fix (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed
- **Issue:** Licenses and Permits tabs not showing for technicians in Employee Profile

#### Root Cause:
- After merging `employees` table into `users`, the `Employee` type became an alias for `User`
- Code in `EmployeeProfile.tsx` was checking `employee.user?.role` (nested property)
- This property no longer exists since `Employee = User` directly
- `isTechnician` was always evaluating to `false`

#### Fix Applied:
```tsx
// Before (broken):
const isTechnician = employee.user?.role === UserRole.TECHNICIAN;

// After (fixed):
const isTechnician = employee.role === UserRole.TECHNICIAN;
```

#### Impact:
- Technicians can now see and manage their **Licenses** tab
- Technicians can now see and manage their **Permits** tab
- Admin/Supervisors can add/view licenses and permits for technicians

#### Related Tables:
- `employee_licenses` - Stores technician driving licenses with expiry tracking
- `employee_permits` - Stores special permits (forklift operator, etc.) with expiry tracking

---

### 🐛 URL-State Desync Fix (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed
- **Issue:** Filter state not resetting when URL params are removed (back/forward navigation)

#### Root Cause:
- Effects in `EmployeesTab` and `LeaveTab` only updated state when param was truthy
- `if (initialStatus && ...)` evaluated to false when param was removed
- UI disagreed with URL after back/forward navigation

#### Fix Applied:
- Changed to use default fallback: `const newStatus = initialStatus || 'all'`
- Now resets to default when URL param is removed

---

### 🛠️ ES Module Import Fix (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed
- **Issue:** App.tsx failing to load (Vite 500 error)

#### Root Cause:
- Import statements were placed after executable code (`lazy()` calls)
- ES modules require all imports at the top level before any executable code
- Missing React imports: `useState`, `useEffect`, `lazy`, `Suspense`

#### Fix Applied:
- Moved all imports to top of `App.tsx` before `lazy()` calls
- Added missing React imports
- Removed duplicate import line

---

### 🔔 Real-Time Notification System Fix (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed
- **Issue Source:** ACWER customer feedback (06/01/2025 troubleshooting report)

#### Issues Addressed:
1. **Dashboard Notifications** - Notifications only on bell icon (dashboard panel exists)
2. **Request Alerts** - No sound/notification for helper/spare part requests
3. **Job Assignment** - Technician B doesn't see assigned jobs immediately
4. **Real-Time Inconsistency** - Sometimes works, sometimes nothing (CRITICAL)

#### Root Cause Analysis:
- **Channel naming with `Date.now()`** was creating orphaned WebSocket connections
- Every component re-render created a new channel with different name
- Race conditions between cleanup and new subscriptions
- RLS policies missing INSERT for system notifications

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
database/migrations/fix_notification_realtime.sql
```
- Migration is **idempotent** - safe to run multiple times
- Drops ALL existing notification policies before recreating
- Enables REPLICA IDENTITY FULL for realtime subscriptions
- Adds notifications and job_requests to supabase_realtime publication

#### Fixes Applied:

**1. `utils/useRealtimeNotifications.ts` - Major Rewrite:**
- Removed `Date.now()` from channel name → stable `fieldpro-notifications-{userId}`
- Added `mountedRef` to prevent state updates after unmount
- Added duplicate notification prevention in state updates
- Added device vibration support for mobile alerts
- Enhanced browser notification with unique tags
- Added listeners for:
  - New job assignments (INSERT on jobs table)
  - Job request status changes (for technicians)
  - New job requests (for admins/supervisors)
- Improved connection status logging and error handling
- Better cleanup on component unmount

**2. `database/migrations/fix_notification_realtime.sql` - New Migration:**
- Added `authenticated_insert_notifications` policy (allows system notifications)
- Enabled REPLICA IDENTITY FULL for notifications table
- Added notifications to supabase_realtime publication
- Added job_requests to realtime publication
- Added DELETE policy for notification cleanup

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
# database/migrations/fix_notification_realtime.sql
```

#### Testing Checklist:
- [ ] Admin assigns job → Technician receives notification + sound
- [ ] Technician requests helper → Admin receives notification + sound
- [ ] Admin approves request → Technician receives notification + sound
- [ ] Job reassignment → New technician sees job immediately
- [ ] Multiple rapid notifications → No duplicates, all received
- [ ] Page refresh → Subscription reconnects properly
- [ ] Mobile → Vibration works on notification

---

### UI/UX: People Overview - Clickable Stats & Expand (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Implemented

#### Features Added:
1. **Clickable Stat Cards** - All 4 cards now navigate with URL params:
   - Total Employees → `?tab=employees`
   - Active → `?tab=employees&status=active`
   - On Leave Today → `?tab=leave&filter=today`
   - Pending Leaves → `?tab=leave&filter=pending`

2. **New "Today" Filter** - Leave tab now has 3 filters:
   - Pending (existing)
   - On Leave Today (new - shows approved leaves active today)
   - All Requests (existing)

3. **Expand In-Place for Expiring Items**:
   - "View all" / "Show less" toggle in section headers
   - Expands from 5 items to full list within the card
   - Max height increases from 48 to 96 for scrolling

4. **URL Param Sync**:
   - Employees tab reads `?status=` param on mount
   - Leave tab reads `?filter=` param on mount
   - Clicking stat cards updates URL for bookmarkable links

#### Technical:
- Added `LeaveFilterType = 'pending' | 'today' | 'all'`
- `onNavigate` callback replaces `onTabChange` for param support
- `initialStatus` and `initialFilter` props for child tabs
- Added ChevronDown/ChevronUp icons for expand toggle

---

### Bug Fixes: People Page & HR Service (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed

#### Issues Fixed:
1. **High - Legacy Route Redirect**: `/hr/employees/:id` was using literal `:id` in Navigate
   - Fix: Route directly to `EmployeeProfile` component instead of broken redirect
   
2. **Medium - User Name Display**: `getPendingLeaves` only selected `full_name` but UI used `user?.name`
   - Fix: Added `name` to all user selects, UI now checks `full_name` first then `name` fallback

3. **FK Ambiguity Prevention**: `employee_licenses` and `employee_permits` have 3 FKs to users
   - Added explicit FK hints: `users!employee_licenses_user_id_fkey` and `users!employee_permits_user_id_fkey`
   - Prevents PGRST201 ambiguity errors when Overview tab loads

---

### UI/UX: People Page - Overview Tab Added (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Implemented

#### Changes Made:
- Added **Overview** as first tab in People page (Option 4 layout)
- Overview tab includes:
  - Stats cards: Total Employees, Active, On Leave Today, Pending Leaves
  - Expiring Licenses panel (with days until expiry badges)
  - Expiring Permits panel (with days until expiry badges)
  - Today's Attendance (Available vs On Leave)
  - Pending Leave Requests with quick approve action
- Tab order: Overview | Users | Employees | Leave
- Default tab changed from 'users' to 'overview'
- Clicking employee in expiring items navigates to `/people/employees/:id`
- "Pending Leaves" stat card links to Leave tab

---

### UI/UX: Sidebar Consolidation (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Implemented

#### Changes Made:
1. **New Tabbed Pages**
   - `ForkliftsTabs.tsx`: Combines Fleet list + Service Intervals + Service Due into one page with tabs
   - `People.tsx`: Combines Users + Employees + Leave management into one page with tabs (+ Overview)

2. **Sidebar Simplification**
   - Reduced from nested collapsible sections to flat 6-8 top-level items
   - Removed bullet points and heavy visual boxing
   - Cleaner, workflow-oriented navigation:
     - Dashboard, Jobs, Forklifts, Customers, Inventory
     - Service Records, Invoices (with divider)
     - Reports, People (with divider)
     - My Leave, My Profile, Sign Out (footer)

3. **Route Updates**
   - `/forklifts` now uses tabbed page (Fleet | Service Intervals | Service Due)
   - `/people` now uses tabbed page (Users | Employees | Leave)
   - `/reports` now points to Technician KPI page
   - Legacy routes redirect: `/users` → `/people?tab=users`, `/hr` → `/people?tab=employees`, etc.

4. **Design Improvements**
   - Narrower sidebar width (260px → 240px)
   - More compact header/logo section
   - Subtle dividers instead of collapsible sections
   - Tab-based navigation inside pages for related features

---

### Stability & Error-Handling Hardening (2026-01-07)
- **Updated:** 2026-01-07 (author: Codex)
- **Status:** ✅ Implemented

#### Changes Made:
1. **Page-level data loading guards**
   - Added try/catch + user feedback for Create Job, Job Board, Job Detail, User Management
   - Ensures backend failures surface as toasts instead of uncaught console errors
2. **Dashboard escalation actions**
   - Hardened acknowledge/save notes/overtime actions with error handling
3. **Service intervals reliability**
   - Wrapped create/update/delete actions with error handling to avoid failed saves
4. **Forklifts fallback safety**
   - Added guarded fallback load for forklift list to prevent unhandled errors
5. **Employees query handling**
   - Supabase user lookup now checks query errors explicitly
6. **Job Detail dependency cleanup**
   - Photo category refresh now tracks `started_at` (removes stale field)
7. **HR profile embed disambiguation**
   - `users → employee_leaves` join now specifies FK to avoid PGRST201 errors
8. **HR leave tab data load**
   - `People` leave tab now uses `getLeaves()` to avoid missing API calls
9. **Service interval payload alignment**
   - Removed unsupported `is_active` field from Forklifts tab create interval flow
10. **Tailwind CDN retained**
   - Restored CDN usage and removed PostCSS build config for demo stability
11. **Recharts container guards**
   - Added min dimensions to chart containers to prevent width/height -1 warnings
12. **Job fetch resilience**
   - Added retry on network errors and gated debug logs to DEV
13. **Forklift customer embed**
   - Disambiguated `forklifts → customers` join to avoid PGRST201 errors

### Real-Time Notification System (2026-01-06)
- **Updated:** 2026-01-06 (author: Claude)
- **Source:** ACWER Customer Feedback Implementation
- **Status:** ✅ Implemented

#### Changes Made:
1. **New Files Created:**
   - `utils/useRealtimeNotifications.ts` - Real-time hook with Supabase subscriptions, sound alerts, browser notifications
   - `components/NotificationPanel.tsx` - Dashboard notification panel component

2. **Dashboard Notifications Panel:**
   - ✅ Added NotificationPanel to Dashboard (Row 4, 3-column grid)
   - ✅ Shows real-time connection status (Live/Offline indicator)
   - ✅ Displays notifications with mark-as-read functionality
   - ✅ Auto-refreshes when new notifications arrive

3. **Sound & Browser Notifications:**
   - ✅ Audio notification sound on new alerts
   - ✅ Browser notification permission request
   - ✅ Desktop notifications with click-to-navigate

4. **Real-Time Subscriptions (Supabase Realtime):**
   - ✅ Subscribe to `notifications` table for user-specific alerts
   - ✅ Subscribe to `jobs` table for technician job assignments
   - ✅ Subscribe to `job_requests` table for request status changes
   - ✅ Admin/Supervisor: notified of new requests from technicians
   - ✅ Technician: notified when assigned, request approved/rejected

5. **Notification Service Updates:**
   - ✅ `approveAssistanceRequest` now notifies both requester AND helper technician
   - ✅ All request types (helper, spare part, skillful tech) trigger admin notifications
   - ✅ All approval/rejection actions trigger technician notifications

6. **New Notification Types Added:**
   - `HELPER_REQUEST`, `SPARE_PART_REQUEST`, `SKILLFUL_TECH_REQUEST`
   - `REQUEST_APPROVED`, `REQUEST_REJECTED`, `JOB_REASSIGNED`
   - Updated NotificationPanel & NotificationBell with new icons

#### Bug Fixes:
- ✔️ Fixed login/runtime crash caused by importing the `Notification` interface as a runtime export (ESM can’t import TS interfaces at runtime)
  - Switched to `import type` in:
    - `utils/useRealtimeNotifications.ts`
    - `components/NotificationPanel.tsx`
    - `components/NotificationBell.tsx`
    - `services/supabaseService.ts`
- ✔️ Prevented duplicate sound/toast alerts by treating `jobs`/`job_requests` realtime subscriptions as UI refresh only
  - User-facing alerts now come from the `notifications` table subscription (single source of truth)

#### UX/RLS Guardrails (2026-01-06) (author: Codex)
- ✔️ **Create Job permissions** - `pages/CreateJob.tsx` is now Admin/Supervisor-only (prevents “violates row level security policy” for Technician/Accountant)
- ✔️ **Customer → Create Job deep-link** - `pages/CustomerProfile.tsx` now routes to `/jobs/new?customer_id=...` and only shows the button for Admin/Supervisor
- ✔️ **Inventory stock updates** - `services/supabaseService.ts` only updates `parts.stock_quantity` for Admin/Technician; other roles can still add/remove job parts without triggering RLS failures
- ✔️ **Parts UI permission alignment** - `pages/JobDetail.tsx` now hides Add/Edit/Remove part actions for Supervisor (avoids job_parts RLS violations); technicians can edit in-progress, admins/accountants can amend at finalization
- ✔️ **Fix `canCreateJobs` crash** - Defined `canCreateJobs` in `App.tsx` to prevent `ReferenceError: canCreateJobs is not defined`
- ✔️ **Create Job insert response hardening** - `services/supabaseService.ts:createJob()` no longer embeds `job_parts` / `job_media` / `extra_charges` in the insert response (avoids Supervisor embed-RLS failures); defaults `parts_used`, `media`, `extra_charges` to `[]`
- ✔️ **Favicon for web + notifications** - Added `public/favicon.svg`, linked from `index.html`, and used for browser notifications (`utils/useRealtimeNotifications.ts`)
- ⚠️ **Tailwind note** - Tailwind utilities are currently loaded via `cdn.tailwindcss.com` in `index.html` for demo reliability; move to compiled Tailwind when ready to ship

### TypeScript Fixes (2026-01-06) - Type Safety (author: Claude)
- ✔️ **Added JobStatus.CANCELLED** - Missing enum value added to `types_with_invoice_tracking.ts`
- ✔️ **Fixed actual_start_time → started_at** - `JobDetail.tsx` was referencing non-existent field
- ✔️ **Fixed addMedia signature** - Removed extra `helperAssignmentId` argument from call
- ✔️ **Fixed forklift ID types** - Explicit `string[]` typing for `Array.from()` in `CustomerProfile.tsx`
- ✔️ **Fixed Object.entries typing** - Cast to `[string, number][]` in `Dashboard.tsx`
- ✔️ **Fixed LeaveCard props** - Used `React.FC<>` type for component in `EmployeeProfile.tsx`
- ✔️ **Fixed employee → user** - `hrService.ts` was accessing wrong relation field
- ✔️ **Fixed asyncToast return** - Return original promise instead of toast result in `toastService.ts`

### Performance Improvements (2026-01-06) - Bundle Optimization (author: Claude)
- ✔️ **Route-level lazy loading** - All pages now use `React.lazy()` with Suspense, reducing initial bundle from ~1.5MB to ~290KB
- ✔️ **Vendor chunking** - Split into vendor-react (49KB), vendor-supabase (171KB), vendor-charts (359KB), vendor-ui (75KB)
- ✔️ **Removed ineffective dynamic import** - `EmployeesPage.tsx` was dynamically importing supabaseService which was already in main bundle
- ✔️ **Added typecheck script** - `npm run typecheck` and `npm run lint` for catching type errors
- ✔️ **PageLoader component** - Loading spinner shown during lazy chunk loading

### UI Improvements (2026-01-06) - Dashboard 3-Panel Redesign (author: Claude)
- ✔️ **Service Automation Widget** - Cleaner layout with gradient header icon, row-based stats with hover arrows, improved button styling
- ✔️ **Recent Jobs Panel** - Compact list view with status dots, hover states, cleaner typography, gradient header icon
- ✔️ **Notifications Panel** - Icon backgrounds by type, compact items with dividers, smaller timestamps, unread dot indicator
- ✔️ **Consistent Design Language** - All 3 panels now share: header structure with gradient icons, divide-y lists, footer with "View all" links, 480px fixed height

### Bugfixes (2026-01-06) - Dashboard Stability (author: Claude)
- ✔️ **Null safety for parts_used** - Dashboard revenue calculations now handle null/undefined `parts_used` arrays
- ✔️ **Better debug logging** - `loadDashboardData` now logs user info and job count for debugging
- ✔️ **Fixed realtime subscription loop** - `useRealtimeNotifications` was re-subscribing on every render due to callback dependencies; now uses refs for callbacks
- ✔️ **Fixed chart dimension errors** - Changed chart containers from Tailwind classes to inline styles with explicit pixel dimensions to prevent Recharts width/height -1 errors

### Bugfixes (2026-01-06) - Realtime + Embed Disambiguation (author: Codex)
- ✔️ **Realtime notification import** - `utils/useRealtimeNotifications.ts` now inlines `AppNotification` type to avoid runtime import error
- ✔️ **Jobs ↔ forklifts embed ambiguity** - Explicit FK added to all `forklift:forklifts(...)` embeds in `services/supabaseService.ts`
  - Affected: getRecentlyDeletedJobs, getCustomerJobsWithCancelled, getPendingRequests, getEscalatedJobs, getJobsAwaitingAck
- ✔️ **Helper assignment fetch** - `services/supabaseService.ts:getJobById()` uses `maybeSingle()` to avoid 406 when no helper assignment exists
- ✔️ **Chart containers** - `pages/Dashboard.tsx` chart wrappers now include `min-h` + `w-full` to prevent Recharts width/height -1 warnings

### Customer Feedback Report (2026-01-05)
- **Source:** ACWER User Testing
- **Status:** ✅ Implemented (see above)

#### 1. Dashboard Notifications
| Current | Expected |
|---------|----------|
| Notifications only appear on bell icon at top | All notifications should be listed on dashboard for easy visibility |

#### 2. Notification Alerts for Requests
- **Issue 1:** No sound or visible notification triggered for Admin when Technician requests helper or spare part; same issue vice versa when Admin accepts/rejects
- **Issue 2:** When Admin assigns a request to Technician B, there is no notification and job does not appear in Technician B's app

#### 3. Real-Time Updates on Technician App
| Current | Expected |
|---------|----------|
| No immediate update visible in technician's app once Admin approves a request | Technician's app should display on-the-spot updates reflecting Admin's actions |

**Technical Requirements:**
- Implement Supabase Realtime subscriptions for `notifications`, `jobs`, `job_requests` tables
- Add browser/push notification support with sound
- Dashboard notification panel (not just bell icon)
- Ensure RLS policies allow realtime subscriptions

### Critical RLS Fix (2026-01-05)
- **Updated:** 2026-01-05 (author: Claude)
- 🔨 **Bug Fix: Role Case Mismatch Breaking All Write Operations**
  - **Issue:** Database stores roles as lowercase (`'admin'`, `'supervisor'`) but RLS policies compare against Title case (`'Admin'`, `'Supervisor'`)
  - **Additional Issue:** `get_current_user_role()` used `user_id = auth.uid()` but should use `auth_id = auth.uid()`
  - **Symptom:** Creating jobs, adding parts, updating stock all failed with "violates row level security policy" error
  - **Root Cause:** `fix_rls_performance.sql` policies check `get_my_role() = 'Admin'` but function returns `'admin'`
  - **Fix:** Updated role helper functions to use `initcap()` and correct column reference:
    - `get_my_role()` → returns `'Admin'` instead of `'admin'`
    - `get_current_user_role()` → fixed to use `auth_id` column + `initcap()`
    - `has_role()` → compares using `initcap()` on input
  - **File:** `database/migrations/fix_role_case_mismatch.sql`
- 🔨 **Bug Fix: Missing RLS Policies on job_parts and job_media tables**
  - **Issue:** RLS redesign dropped old policies and enabled RLS but never created new policies
  - **Fix:** Created role-based policies for Admin, Supervisor, Accountant, Technician
  - **Workflow Clarification:** Per WORKFLOW_SPECIFICATION.md:
    - **Technicians** can only REQUEST parts (via spare_part_requests)
    - **Admin/Supervisor** actually SELECT and ADD parts to jobs
    - Technicians get SELECT only on job_parts (not INSERT)
  - **File:** `database/migrations/fix_missing_rls_policies.sql`

### Dashboard Premium UI Polish (2026-01-05)
- **Updated:** 2026-01-05 11:38:37 CST (author: Codex)
- ✔️ **Border consistency fix** - Replaced hardcoded `#e2e8f0` with theme tokens `var(--border)`, `var(--border-subtle)`, `var(--border-strong)`
- ✔️ **Complete status coverage** - Added `STATUS_CONFIG` and `CHART_COLORS` for all 10 job statuses; chart shows all statuses with values > 0
- ✔️ **Action Required count fix** - KPI now includes: escalated + disputed + awaiting ack (was missing awaiting ack)
- ✔️ **Inline style cleanup** - Replaced inline styles with `.card-premium`, `.btn-premium`, `.input-premium` classes
- ✔️ **Notes discoverability** - Added `StickyNote` icon in collapsed Action Required rows; highlighted if notes exist
- ✔️ **Premium theme enabled** - `index.tsx` imports `./index.css` so premium tokens/classes actually apply at runtime
- ✔️ **Surface hierarchy tuning** - Adjusted `--bg`, `--bg-subtle`, and border tokens in `index.css` so cards “lift” off the page (less white-on-white)
- ✔️ **Chart empty states** - Job Status + Revenue Trend cards collapse to compact empty states when there’s no data (no giant blank slabs)
- ✔️ **Recent Jobs scanability** - Switched to row-card list (status rail + chevron + keyboard support) and removed inner-scroll “table” feel
- ✔️ **Service Automation layout** - Widget uses a fixed-height layout with pinned action footer (prevents awkward blank space and keeps the row balanced)
- ✔️ **Contrast improvements**:
  - Action Required header: added `bg-[var(--bg-subtle)]` tint for visual anchor
  - Recent Jobs: row-card hover states + clearer separation (without heavy boxing)
  - Service Automation inner tiles: already have light tint via `bg-[var(--bg-subtle)]`
- ✔️ **Notifications hierarchy fix** - Removed duplicate `NotificationPanel` render and kept notifications compact in the rightmost column (prevents notifications from dominating the dashboard)
- ✔️ **Row 4 height alignment** - Service Automation / Recent Jobs / Notifications now share a fixed height on desktop with internal scroll areas (more balanced, less “floating cards”)
- ✔️ **Notifications visual cleanup** - Reduced noisy tinted backgrounds; notifications are now white cards with semantic left rails + clearer header/connection pill

### Job Detail Premium UI Polish (2026-01-05)
- **Updated:** 2026-01-05 15:09:41 CST (author: Codex)
- ✔️ **Hero card contrast** - Scan anchors use semantic accent rails (Equipment/Repair Time/Summary) instead of large gradients
- ✔️ **Right-rail hierarchy** - Summary → Timeline → Signatures → AI (better scan path, less “where do I look?”)
- ✔️ **Right-rail cohesion** - Timeline/Signatures/AI use the same header pattern (icon tile + title); AI uses semantic info rail (no gradients)
- ✔️ **Header action hierarchy** - Primary action uses brand accent; exception actions are outline; Delete is ghost-danger; Finalize Invoice uses primary accent
- ✔️ **Assignment actions** - Reassign / Add Helper / Remove Helper use high-signal chip buttons + mini-panels (more discoverable, less “hidden text”)
- ✔️ **RM input prefix fix** - Added `.input-premium-prefix` and updated currency inputs so “RM” never overlaps placeholder/value
- ✔️ **Photos upload hierarchy** - Category dropdown lives in Photos header; empty state is a full-size dropzone (drag & drop + click) with a single Upload CTA (no duplicates)
- ✔️ **Reduced “everything tinted” noise** - Signatures + Checklist category tiles use white surfaces + border; tints reserved for callouts
- ✔️ **Label/subtitle contrast** - Added `.label-premium` / `.value-premium` helpers and removed low-contrast `--text-subtle` labels/empties in Job Detail
- ✔️ **Secondary button clarity** - `.btn-premium-secondary` now uses `--border-strong` + subtle shadow so outline actions read as clickable
- ✔️ **Theme tuning** - Neutralized `--bg` / `--bg-subtle` in `index.css` (less blue cast)
- ✔️ **New theme classes** - `.card-tint-*` now render as accent rails (not gradients)

### UI Consistency Updates (2026-01-05) - #7/#8 Status Integration Across Pages
- ✔️ **JobBoard.tsx** - Added new statuses to filters, counts, and badges
  - Status filter dropdown includes: Incomplete - Continuing, Incomplete - Reassigned, Completed Awaiting Acknowledgement, Disputed
  - Badge colors for all new statuses in job cards
  - "Unfinished" date filter excludes Completed and Completed Awaiting Ack (work done)
  - getStatusBadge() and getStatusBadgeClass() handle all new statuses
- ✔️ **Dashboard.tsx** - Status counts and alert sections
  - Status summary counts include new statuses in appropriate categories
  - Separate alert sections for "Awaiting Acknowledgement" and "Disputed" jobs
  - Admins see jobs needing attention while main totals treat them as completed
  - Donut chart includes new status colors
- ✔️ **CustomerProfile.tsx** - Open vs Completed classification
  - Completed statuses include: Completed, Awaiting Finalization, Completed Awaiting Acknowledgement, Disputed
  - Work done = counted as completed for totals
- ✔️ **ForkliftProfile.tsx** - Badge colors and completed services count
  - getJobStatusBadge() includes all new status colors
  - Completed services calculation updated
- ✔️ **disputeJob() response_method fix**
  - Function now accepts optional `method` parameter: 'portal' | 'email' | 'phone' (default: 'portal')
  - JobDetail.tsx dispute button prompts for communication method before recording
  - Consistent with acknowledgeJob() behavior

### Feature: Enhanced Escalation Management (2026-01-05)
Dashboard escalation panel upgraded with industry-standard workflow:
- ✔️ **Acknowledge ownership** - Admin can "Ack" to take ownership of escalated job
- ✔️ **Days overdue** - Shows "2d overdue" instead of raw dates (color-coded severity)
- ✔️ **Expand/collapse rows** - Click to see full details without leaving Dashboard
- ✔️ **Contact info** - Customer & technician phone numbers with click-to-call
- ✔️ **Escalation notes** - Add/edit notes explaining delay or action taken
- ✔️ **Quick actions** - Reassign, Mark Overtime, View Job buttons inline
- ✔️ **Acknowledged state** - Acknowledged jobs show dimmed with green badge

Database additions:
- `jobs.escalation_acknowledged_at` - When admin acknowledged
- `jobs.escalation_acknowledged_by` - Which admin acknowledged
- `jobs.escalation_notes` - Notes about the escalation

Files:
- `database/migrations/add_escalation_acknowledgement.sql`
- `services/supabaseService.ts` - acknowledgeEscalation(), updateEscalationNotes()
- `pages/Dashboard.tsx` - Enhanced escalation panel

### Bugfixes (2026-01-05) - #8 Deferred Completion Critical Fixes
- ✔️ **High: Deferred completion missing hourmeter check**
  - Added `deferredHourmeter` state to JobDetail.tsx
  - Deferred Completion modal now requires hourmeter input with validation (>= start hourmeter)
  - Hourmeter passed to `deferJobCompletion()` and stored in `end_hourmeter`
  - Forklift hourmeter updated on deferred completion
- ✔️ **High: Missing completion timestamps in deferJobCompletion()**
  - `deferJobCompletion()` now sets: `completed_at`, `completion_time`, `repair_end_time`, `completed_by_user_id`, `completed_by_name`
  - Function signature updated to accept optional `endHourmeter` parameter
  - Ensures reporting/invoicing works correctly for deferred jobs
- ✔️ **Medium: KPI pages excluded Completed Awaiting Acknowledgement**
  - Updated `TechnicianKPIPage.tsx` and `TechnicianKPIPageV2.tsx`
  - `completedJobs` filter now includes: Completed, Awaiting Finalization, Completed Awaiting Acknowledgement, Disputed
  - All "work done" statuses now count toward technician KPIs

### Data Cleanup (2026-01-05) - Duplicate Service Intervals
- ✔️ **Duplicate records in service_intervals table**
  - Same service type appeared multiple times per forklift type
  - Cleaned up duplicates (keeping oldest record by created_at)
  - Added unique partial index to prevent future duplicates
  - Index: `idx_service_intervals_unique_active` on (forklift_type, service_type, hourmeter_interval) WHERE is_active = true
  - File: `database/migrations/fix_duplicate_service_intervals.sql`

### Security Fixes (2026-01-05) - Supabase Linter Warnings
- ✔️ **SECURITY DEFINER views** - 4 HR views flagged as security risk
  - Views: `v_pending_leaves`, `v_expiring_permits`, `v_todays_leave`, `v_expiring_licenses`
  - Recreated with explicit `WITH (security_invoker = true)`
  - Views now respect RLS policies of the querying user
  - Updated original migration to prevent issue on fresh deployments
  - File: `database/migrations/fix_security_linter_warnings.sql`
- ✔️ **Backup tables without RLS** - Migration backup tables exposed
  - Tables: `_backup_users_before_merge`, `_backup_employees_before_merge`
  - Enabled RLS with restrictive policy (`USING (false)`)
  - Only service_role can access backup data now
  - File: `database/migrations/fix_security_linter_warnings.sql`
- ✔️ **Function search_path mutable** - 3 trigger functions missing search_path
  - Functions: `update_job_assignments_updated_at`, `update_user_timestamp`, `update_job_requests_updated_at`
  - Added `SET search_path = public` to all 3 functions
  - Updated original migration files to prevent issue on fresh deployments
  - File: `database/migrations/fix_function_search_paths_v2.sql`
- ⚠️ **Leaked Password Protection** - Dashboard setting (manual action required)
  - Go to Supabase Dashboard → Authentication → Settings
  - Enable "Leaked Password Protection"

### Bugfixes (2026-01-05) - HR Dashboard & Migration Fixes
- ✔️ **Migration Fix: EXTRACT on integer** - `EXTRACT(DAY FROM date - date)` fails because date subtraction returns integer, not interval
  - Changed `EXTRACT(DAY FROM ...)` to just `(date - date)` in v_expiring_licenses and v_expiring_permits views
  - File: `database/migration_merge_employees_into_users.sql`
- ✔️ **HR Dashboard Fix: Multiple FK error** - "Could not embed because more than one relationship was found for employee_leaves and users"
  - `employee_leaves` has 4 FKs to users: user_id, requested_by_user_id, approved_by_user_id, rejected_by_user_id
  - Supabase can't auto-resolve which FK to use for embeds
  - Added explicit `!employee_leaves_user_id_fkey` to all 9 user:users embeds in hrService.ts
  - File: `services/hrService.ts`
- ✔️ **Migration Fix: employees table conditional** - Migration failed if `employees` table doesn't exist
  - Wrapped backup, data migration, DROP POLICY/TRIGGER in `IF EXISTS` checks
  - Migration now works whether employees table exists or not
  - File: `database/migration_merge_employees_into_users.sql`

### Bugfixes (2026-01-05) - #8 Deferred Acknowledgement Hardening
- ✔️ **Migration Fix: NOW() in index** - `idx_customer_ack_token` used `WHERE token_expires_at > NOW()` but NOW() isn't IMMUTABLE
  - Removed WHERE clause, expiry check done in application layer
  - File: `database/migrations/add_deferred_acknowledgement.sql`
- ✔️ **Migration Fix: Non-existent column** - `idx_jobs_disputed` referenced `updated_at` which doesn't exist on jobs table
  - Changed to `disputed_at` (added in same migration)
  - File: `database/migrations/add_deferred_acknowledgement.sql`
- ✔️ **Evidence Photo Enforcement** - Now requires minimum 1 photo for deferred completion
  - Handler validates `selectedEvidenceIds.length > 0`
  - Service layer returns error if array empty/null
  - Button disabled until 1+ photos selected
  - Label shows "Evidence Photos * (min. 1 required)"
- ✔️ **Admin Acknowledge on Behalf** - MVP for customer workflow
  - "Record Acknowledgement" button (phone/email confirmation)
  - "Record Dispute" button (record customer complaint)
  - Admin/Supervisor can complete the acknowledgement flow without customer portal
  - Full customer portal with access_token can be built later if needed

### ACWER Feature Implementation (2026-01-04)

#### #4 Hourmeter Prediction + Dashboard - ✔️ COMPLETED (Pre-existing)
- **Files (already existed):**
  - `pages/ServiceDue.tsx` - Full service due page with filtering
  - `components/ServiceAutomationWidget.tsx` - Dashboard widget
- **Features:**
  - Overdue/Due Soon/Jobs Created stats with color coding
  - "Run Service Check" button for auto-creating jobs
  - Widget on Dashboard for Admin/Supervisor
  - Clickable stats navigate to ServiceDue with filters
  - Uses `get_forklifts_due_for_service` RPC function
  - Integrated with service_intervals config from #5

#### #5 Service Intervals Config UI - ✔️ COMPLETED
- **Files created:**
  - `pages/ServiceIntervalsConfig.tsx` - Admin UI to view/edit service intervals
- **Files modified:**
  - `services/supabaseService.ts` - Added CRUD functions:
    - `getServiceIntervals()` - Fetch all intervals
    - `getServiceIntervalsByType(type)` - Filter by forklift type
    - `createServiceInterval(data)` - Add new interval
    - `updateServiceInterval(id, updates)` - Edit interval
    - `deleteServiceInterval(id)` - Soft delete (deactivate)
    - `hardDeleteServiceInterval(id)` - Permanent delete
  - `App.tsx` - Added route `/service-intervals` and sidebar link under Management
- **Features:**
  - View all service intervals grouped by forklift type
  - Filter tabs: All, Diesel, Electric, LPG
  - Inline editing in table
  - Add new interval via modal
  - ACWER defaults reference card (Electric: 3 months, Diesel: 500h, LPG: 350h)
  - Uses existing `service_intervals` table (no schema changes)
- **Access:** Admin only

#### #10 Photo Categorization + ZIP Download - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_job_media_category.sql` - DB migration (production-safe, idempotent)
- **Files modified:**
  - `types_with_invoice_tracking.ts` - Added `MediaCategory` type and `category` field to `JobMedia`
  - `pages/JobDetail.tsx`:
    - Added photo category filter tabs (All, Before, After, Spare Parts, Condition, Evidence, Other)
    - Added category selector dropdown when uploading photos
    - Added category badges on photo thumbnails
    - Added "Download ZIP" button with category-organized folders
    - Added `getDefaultPhotoCategory()` helper for status-linked defaults
    - Uses JSZip for client-side ZIP generation
  - `package.json` - Added `jszip` dependency
- **Features:**
  - 6 photo categories: `before`, `after`, `spare_part`, `condition`, `evidence`, `other`
  - Color-coded category badges on each photo
  - Filter photos by category with count indicators
  - **Status-linked default category (auto-suggest with user override):**
    - New / Assigned → `before` (pre-service documentation)
    - In Progress (first 30 min) → `before`
    - In Progress (after 30 min) → `other` (user picks)
    - Awaiting Finalization → `after` (post-service documentation)
  - Photo upload available for: New, Assigned, In Progress, Awaiting Finalization
  - Download all photos as ZIP with folders per category
  - Filtered downloads respect current category filter
- **DB Migration (production-safe):**
  - Adds column as nullable first, backfills, then sets NOT NULL DEFAULT 'other'
  - CHECK constraint for valid category values
  - Index on (job_id, category) for filtered queries
  - Run `add_job_media_category.sql` in Supabase SQL Editor before use
- **Access:** Technician, Admin, Supervisor

#### #1 Helper Technician Support - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_job_assignments.sql` - Job assignments table with RLS
- **Files modified:**
  - `types_with_invoice_tracking.ts` - Added `JobAssignment` interface
  - `services/supabaseService.ts`:
    - Added helper assignment functions: `assignHelperToJob`, `removeHelperFromJob`, `getJobHelperAssignment`
    - Updated `getJobs()` to include helper jobs for technicians
    - Photos tagged with `is_helper_photo` when uploaded by helper
  - `pages/JobDetail.tsx`:
    - Added Helper Technician section in sidebar showing assigned helper
    - Added "Add Helper" / "Remove Helper" buttons for Admin/Supervisor
    - Added "You are the helper on this job" notice for helpers
    - Added Assign Helper modal with technician selection
    - Added `isHelperOnly` permission flag with restrictions:
      - ❌ Start Job, Complete Job (status changes)
      - ❌ Hourmeter reading input
      - ❌ Add/edit spare parts
      - ❌ Technician/Customer signatures
      - ❌ Add notes
      - ❌ Edit Job Carried Out / Recommendation
      - ❌ Edit Condition Checklist
      - ❌ Edit prices / extra charges
      - ✅ Upload photos (tagged as helper photos)
      - ✅ View job details
  - `pages/JobBoard.tsx`:
    - Added "Helper" badge for jobs where user is assigned as helper
    - Helper jobs now appear in technician's job list
- **Features:**
  - Max 1 helper per job (enforced by unique index)
  - Same "Technician" role, different `assignment_type` (lead/assistant)
  - Helper can only upload photos - all other actions blocked
  - Photos uploaded by helper are tagged for audit trail
  - Helper sees job in their job list with "Helper" badge
- **DB Migration Required:** Run `add_job_assignments.sql` in Supabase SQL Editor
- **Access:** Technician (as helper), Admin/Supervisor (assign/remove)

#### #2 + #3 In-Job Request System + Spare Parts Approval - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_job_requests.sql` - Job requests table with RLS
- **Files modified:**
  - `types_with_invoice_tracking.ts` - Added `JobRequest`, `JobRequestType`, `JobRequestStatus` types
  - `services/supabaseService.ts`:
    - `createJobRequest()` - Create assistance/spare_part/skillful_technician request
    - `getJobRequests()` - Get all requests for a job with user/part details
    - `getPendingRequests()` - Get pending requests for admin dashboard
    - `approveSparePartRequest()` - Approve and add part to job's parts_used
    - `rejectRequest()` - Reject with reason
    - `approveAssistanceRequest()` - Approve and assign helper
    - `getRequestCounts()` - Get pending/total counts for badges
  - `pages/JobDetail.tsx`:
    - Added Requests section with 3 request buttons (visible during In Progress)
    - Request buttons: "Request Assistance", "Request Spare Part", "Request Skillful Tech"
    - Request list showing all requests with status badges
    - Request modal for creating new requests with description + optional photo
    - Color-coded request types and statuses
- **Features:**
  - 3 request types: assistance, spare_part, skillful_technician
  - Lead technician can create requests during In Progress status
  - Requests show pending count badge
  - Each request shows type, status, timestamp, description, photo (if any)
  - Approved spare parts auto-added to job's parts_used with `added_via_request` tracking
  - Admin response notes visible on resolved requests
- **DB Migration Required:** Run `add_job_requests.sql` in Supabase SQL Editor
- **Access:** Technician (create), Admin/Supervisor (approve/reject)

#### #7 Multi-Day Escalation - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_multiday_escalation.sql` - Schema + holidays + settings
  - `utils/businessDays.ts` - Business day calculation utilities
- **Files modified:**
  - `types_with_invoice_tracking.ts`:
    - Added new JobStatus values: `COMPLETED_AWAITING_ACK`, `INCOMPLETE_CONTINUING`, `INCOMPLETE_REASSIGNED`, `DISPUTED`
    - Added Job fields: `cutoff_time`, `is_overtime`, `escalation_triggered_at`
    - Added `PublicHoliday` and `AppSetting` interfaces
  - `services/supabaseService.ts`:
    - `getPublicHolidays()` - Fetch holidays for business day calc
    - `getAppSetting()` / `updateAppSetting()` - Config management
    - `markJobContinueTomorrow()` - Set cutoff and status
    - `resumeMultiDayJob()` - Resume continuing job
    - `getJobsNeedingEscalation()` - Find jobs to escalate
    - `triggerEscalation()` - Mark job as escalated
    - `markJobAsOvertime()` - Toggle overtime flag
    - `getEscalatedJobs()` - For admin dashboard
  - `pages/JobDetail.tsx`:
    - "Continue Tomorrow" button (In Progress → Incomplete - Continuing)
    - "Resume Job" button (Incomplete - Continuing → In Progress)
    - Multi-Day Controls panel (Admin/Supervisor): Overtime toggle, cutoff time, escalation info
    - Status badges: "Escalated" (red pulse), "OT Job" (purple), "Continuing" (amber)
    - Continue Tomorrow modal with reason input
- **Schema changes:**
  - `jobs` table: `cutoff_time`, `is_overtime`, `escalation_triggered_at`
  - `public_holidays` table: Malaysian holidays 2025-2026 (Sunday + holidays = non-working)
  - `app_settings` table: Configurable settings (SLA days, etc.)
  - Index: `idx_jobs_pending_escalation` for queue scans
- **Business rules:**
  - Working days: Monday-Saturday (Sunday only off)
  - Holidays: Skip Malaysian public holidays
  - Escalation: 8:00 AM next business day, notify Admin (no auto-reassign)
  - Overtime jobs: No escalation
  - SLA: Configurable, default 5 business days
- **DB Migration Required:** Run `add_multiday_escalation.sql` in Supabase SQL Editor
- **Access:** Technician (continue/resume), Admin/Supervisor (overtime toggle, view escalations)
- **Note:** Escalation check runs on Dashboard load (MVP). Upgrade to Edge Function cron with Supabase Pro for automatic 8 AM daily checks.

#### #8 Deferred Acknowledgement - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_deferred_acknowledgement.sql` - Schema + customer_acknowledgements table
- **Files modified:**
  - `types_with_invoice_tracking.ts`:
    - Added `CustomerAcknowledgement` interface
    - Added Job fields: `verification_type`, `deferred_reason`, `evidence_photo_ids`, `customer_notified_at`, `customer_response_deadline`, `auto_completed_at`, `dispute_notes`, `disputed_at`, `dispute_resolved_at`, `dispute_resolution`
  - `services/supabaseService.ts`:
    - `deferJobCompletion()` - Complete job without customer signature
    - `getJobAcknowledgement()` - Get ack record for job
    - `acknowledgeJob()` - Customer acknowledges via portal/phone/email
    - `disputeJob()` - Customer disputes completion
    - `resolveDispute()` - Admin resolves dispute
    - `checkAndAutoCompleteJobs()` - Auto-complete expired deferred jobs
    - `getJobsAwaitingAck()` - List jobs pending acknowledgement
    - `getDisputedJobs()` - List disputed jobs
  - `pages/JobDetail.tsx`:
    - "Customer Unavailable" button (In Progress → Completed Awaiting Acknowledgement)
    - Deferred Completion modal with reason + evidence photo selection
    - Acknowledgement Status panel showing deadline, reason, dispute info
    - Admin dispute resolution buttons (Accept & Complete / Reopen Job)
  - `pages/Dashboard.tsx`:
    - Auto-complete check runs on load (same as escalation check)
- **Schema changes:**
  - `jobs` table: verification_type, deferred_reason, evidence_photo_ids, customer_notified_at, customer_response_deadline, auto_completed_at, dispute_notes, disputed_at, dispute_resolved_at, dispute_resolution
  - `customer_acknowledgements` table: access_token for customer portal, signature, response tracking
  - Index for deferred jobs pending auto-completion
- **Business rules:**
  - SLA: Configurable business days (default 5) for customer response
  - Auto-complete: Jobs past deadline auto-complete with verification_type='auto_completed'
  - Disputes: Customer can dispute, Admin resolves by completing or reopening
  - Evidence: Photos selected from job's existing media as proof of work
- **Verification types:** signed_onsite, deferred, auto_completed, disputed
- **DB Migration Required:** Run `add_deferred_acknowledgement.sql` in Supabase SQL Editor
- **Access:** Technician (defer), Customer (acknowledge/dispute), Admin/Supervisor (resolve disputes)

### Bugfixes (2026-01-04) - Request System Schema & UI Fixes
- ✔️ **Fixed Spare Part Approval** - Was writing to non-existent `jobs.parts_used` column
  - Now correctly inserts into `job_parts` table
  - Also updates stock quantity in `parts` table
  - File: `services/supabaseService.ts:approveSparePartRequest()`
- ✔️ **Fixed Assistance Approval Call** - Was calling non-existent `assignHelperToJob()`
  - Changed to correct function `assignHelper()`
  - File: `services/supabaseService.ts:approveAssistanceRequest()`
- ✔️ **Fixed Part Column Name** - Was using `parts.name` instead of `parts.part_name`
  - Fixed in `getJobRequests()` query
  - Fixed in JobDetail.tsx display
  - Files: `services/supabaseService.ts`, `pages/JobDetail.tsx`
- ✔️ **Added Admin Approval UI** - Was missing UI for approve/reject actions
  - Added "Review & Approve" / "Reject" buttons on pending requests for Admin/Supervisor
  - Added approval modal with:
    - Part picker + quantity selector (for spare_part requests)
    - Technician picker (for assistance requests)
    - Info panel (for skillful_technician requests - requires separate reassignment)
    - Notes field
  - File: `pages/JobDetail.tsx`
- ✔️ **Added `acknowledgeSkillfulTechRequest()`** - Sets status to 'approved' (not 'rejected')
  - Skillful tech requests are now properly marked as approved/acknowledged
  - File: `services/supabaseService.ts`

### Bugfixes (2026-01-04) - Helper Technician RLS & Schema Fixes
- ✔️ **RLS Policy Fix** - Fixed `job_assignments` policies that would block production access
  - Changed `users.user_id = auth.uid()` → `users.auth_id = auth.uid()` (correct auth mapping)
  - Changed role check `'Admin', 'Supervisor'` → `'admin', 'supervisor'` (lowercase to match schema)
  - Technician policies now use subquery to map `auth.uid()` to `user_id`
  - File: `database/migrations/add_job_assignments.sql`
- ✔️ **Remove Invalid Column Reference** - Fixed `addMedia()` insert that referenced non-existent column
  - Removed `uploaded_by_assignment_id` from insert (column never added to `job_media`)
  - `uploaded_by` + `is_helper_photo` already provides sufficient audit trail
  - File: `services/supabaseService.ts`
- ✔️ **Fix Column Name** - Fixed `getUserAssignmentType()` using wrong column
  - Changed `assigned_to` → `assigned_technician_id` (correct column name)
  - File: `services/supabaseService.ts`
- **Deferred:**
  - Helper time logging UI (not requested by ACWER yet)
  - Lead assignment records in `job_assignments` (using `jobs.assigned_technician_id` + audit log instead)
  - `jobs.helper_technician_id` cleanup (unused denormalized field, can remove later)

### Documentation
- DB schema docs synced to current Supabase schema (2026-01-02 00:16:45 CST, author: Codex)

### UX Improvements (2026-01-03)
- ✔️ **Toast Notifications** - Added user-visible error/success notifications across all pages
  - Added `showToast.error()` to catch blocks that previously only used `console.error`
  - Pages fixed: `Invoices.tsx`, `CustomerProfile.tsx`, `EmployeeProfile.tsx`, `Forklifts.tsx`, `ServiceDue.tsx`, `ServiceRecords.tsx`, `TechnicianKPIPage.tsx`, `TechnicianKPIPageV2.tsx`
  - Uses existing `sonner` library + `toastService.ts` helper
- ✔️ **Employee Field Fixes** - Fixed field name mismatches after User-Employee merge
  - `EmployeesPage.tsx`: `employee.status` → `employee.employment_status` (3 places)
  - `EmployeesPage.tsx`: `employee.user?.role` → `employee.role`
  - `EmployeeProfile.tsx`: `employee.status` → `employee.employment_status` (3 places)
  - `EmployeeProfile.tsx`: `editData.status` → `editData.employment_status`
- ✔️ **Null Safety Guards** - Added fallbacks for `full_name` to prevent runtime crashes
  - Pattern: `employee.full_name || employee.name || ''`
  - Applied in: `EmployeesPage.tsx` (4 places), `EmployeeProfile.tsx` (4 places)

### Data Integrity Fixes (2026-01-03)
- ✔️ **Timestamp Guards in updateJobStatus** - Prevents timestamp overwrites on status re-submission
  - Forward transitions: Only set timestamps if not already set
  - Rollback `In Progress` → `Assigned`: Clears `arrival_time`, `started_at`
  - Rollback `Awaiting Finalization`/`Completed` → `In Progress`: Clears completion timestamps
  - File: `services/supabaseService.ts` - `updateJobStatus()` function
- ✔️ **Hourmeter Validation** - Prevents hourmeter readings less than forklift's current reading
  - Client-side: `JobDetail.tsx` - `handleSaveHourmeter()`, `handleStartJobWithCondition()`
  - Service-side: `supabaseService.ts` - `updateJobHourmeter()`, `startJobWithCondition()`
  - Shows clear error message with current forklift reading
- ✔️ **Required Fields Validation** - Enforces field requirements before status transitions
  - `Assigned` → `In Progress`: Requires `assigned_technician_id` and `forklift_id`
  - `In Progress` → `Awaiting Finalization`: Requires `hourmeter_reading` and both signatures
  - Service-side: `supabaseService.ts` - `updateJobStatus()` function
  - Uses correct DB columns: `technician_signature`, `customer_signature` (not `signatures` array)
  - Clear error messages tell user what's missing

### Status Enum Decision (2026-01-03)
- **Decision**: Keep `jobs.status` as TEXT with title-case values for now
- **Current values**: `New`, `Assigned`, `In Progress`, `Awaiting Finalization`, `Completed`
- **Rationale**: Matches ACWER workflow and existing RLS policies in `rls_redesign/`
- **Future Migration** (when workflow is locked):
  - Convert to `job_status_enum` with snake_case: `new`, `assigned`, `in_progress`, `awaiting_finalization`, `completed`
  - Update all RLS policies in `database/rls_redesign/`
  - Update `JobStatus` enum in `types.ts`
  - Update UI status displays and filters

### Security Fixes (2026-01-03)
- ✔️ Fixed 5 Security Definer views → converted to SECURITY INVOKER
  - `active_rentals_view`, `v_todays_leave`, `v_expiring_licenses`, `v_pending_leaves`, `v_expiring_permits`
- ✔️ Enabled RLS on 5 tables with role-based policies
  - `quotations`, `service_intervals`, `scheduled_services`, `notifications`, `technician_kpi_snapshots`
- ✔️ Added `SET search_path = public` to 44 functions (prevents search_path injection)
- ✔️ Enabled Leaked Password Protection (Supabase Auth setting)
- ✔️ Created helper functions with proper security: `get_current_user_role()`, `has_role()`, `get_user_id_from_auth()`

**Migration files:**
- `database/migrations/security_fix_linter_issues.sql`
- `database/migrations/fix_security_invoker_views.sql`
- `database/migrations/fix_function_search_paths.sql`

### RLS Performance Fixes (2026-01-03)
- ✔️ Fixed 25 Auth RLS InitPlan issues - wrapped `auth.uid()` with `(select auth.uid())` for caching
- ✔️ Consolidated 70+ multiple permissive policies into ~50 optimized single policies per role/action
- ✔️ Created `get_my_role()` helper function with proper caching

### User-Employee Merge Cleanup (2026-01-03)
- ✔️ **Database migration applied** - `employees` table merged into `users` table
  - Migration file: `database/migration_merge_employees_into_users.sql`
  - All HR columns now in `users` table
  - FK references updated (licenses, permits, leaves → users)
  - Views recreated to use `users` directly
  - `employees` table dropped
- ✔️ Removed final references to old `employees` table in codebase
  - `hrService.ts`: Changed HR alert join from `employee:employees(full_name, department)` to `user:users(name, department)`
  - `hrService.ts`: Updated `record.employee?.full_name` to `record.user?.name` in expiry alerts
  - `hrService.ts`: Updated `getAttendanceToday()` return type from `Employee[]` to `User[]`
  - `EmployeesPage.tsx`: Updated `loadAvailableUsers()` to query users with incomplete HR data instead of checking separate employees table
- ✔️ Updated TypeScript interfaces in `types_with_invoice_tracking.ts`
  - `EmployeeLicense.employee` → `EmployeeLicense.user`
  - `EmployeePermit.employee` → `EmployeePermit.user`
  - `EmployeeLeave.employee` → `EmployeeLeave.user`
  - `HRAlert.employee` → `HRAlert.user`
  - `AttendanceToday.available: Employee[]` → `User[]`
  - `AttendanceToday.onLeave: { employee: Employee }` → `{ user: User }`
  - Added backward compatibility: `export type Employee = User`
- ✔️ Single source of truth: All user/employee data now in `users` table

**Migration files:**
- `database/migrations/fix_rls_performance.sql`
- `database/migrations/fix_rls_performance_v2.sql` (fixed hr_alerts column name)

### Database Performance Indexes (2026-01-03)
- ✔️ Added 48 indexes for unindexed foreign keys (improves JOIN/DELETE performance)
- ✔️ Added composite index for jobs list query: `idx_jobs_active_created`
- ✔️ Added index for extra_charges: `idx_extra_charges_job_id`
- Tables indexed: employee_leaves, forklift_hourmeter_logs, forklift_rentals, forklifts, hr_alerts, job_audit_log, job_inventory_usage, job_invoice_extra_charges, job_invoices, job_media, job_parts, job_service_records, job_status_history, jobs, parts, quotations, scheduled_services, service_predictions

**Migration file:**
- `database/migrations/add_foreign_key_indexes.sql`

### Implementation Status

| # | Feature | Complexity | Requirements | Build Status |
|---|---------|------------|--------------|--------------|
| 1 | Helper Technician | Medium | ✅ Confirmed | ❌ Not started |
| 2 | In-Job Request System | High | ✅ Confirmed | ❌ Not started |
| 3 | Spare Parts Request/Approval | Medium | ✅ Confirmed | ❌ Not started |
| 4 | Hourmeter Reading + prediction | Medium | ✅ Confirmed | ✔️ Completed |
| 5 | Service Intervals | Low | ✅ Confirmed | ✔️ Completed |
| 6 | Job Reassignment + Items/KPI | High | ✅ Confirmed | ❌ Not started |
| 7 | Multi-Day Jobs + Escalation | Medium | ✅ Confirmed | ❌ Not started |
| 8 | Deferred Customer Acknowledgement | Medium | ✅ Confirmed | ❌ Not started |
| 9 | KPI Dashboard | Medium | ✅ Confirmed | ❌ Not started |
| 10 | Photo Categorization + ZIP | Low | ✅ Confirmed | ✔️ Completed |
| 11 | Partial Work Tracking | Low-Medium | ⏳ Pending | ❌ Not started |

**Summary:** 7 features ready to build, 1 awaiting client confirmation, 3 completed

---

### Confirmed Requirements (Jan 2026)

#### Job Reassignment
| Decision | Details |
|----------|---------|
| Frequency | Rarely |
| Reasons | Skill/expertise issue, Technician unavailable |
| Items handling | Admin controls cancel/transfer (existing process) |
| Multi-reassignment | Allowed (Tech A → B → C) |
| Partial work | Must record separately for billing *(detail level TBD)* |

#### Helper Technician
| Decision | Details |
|----------|---------|
| Max helpers per job | 1 at a time |
| Frequency needed | Sometimes |
| Implementation | Same Technician role, different `assignment_type` ('lead' vs 'assistant') |
| Permissions | Photos + start/end times only. No hourmeter, no spare parts, no signature |

#### Multi-Day Jobs & Escalation
| Decision | Details |
|----------|---------|
| Escalation trigger | 8:00 AM next business day |
| Monday-Friday | Standard job, counts toward day limit |
| Saturday (OT) | Marked "Overtime Job", escalation disabled, days counter paused |
| Sunday | TBD - assume no work |

#### Spare Parts Requests
| Decision | Details |
|----------|---------|
| Admin response time | Within hours |
| Batch requests | Yes, multiple parts at once |
| Technician input | Text description + optional photo |
| Admin action | Selects from inventory, approves/rejects |
| Post-job amendment | Admin can amend Items Used before finalizing |

#### Hourmeter & Service Prediction
| Decision | Details |
|----------|---------|
| Electric forklifts | Every 3 months from delivery date (calendar-based) |
| Diesel forklifts | Every 500 hours (hourmeter-based) |
| LPG forklifts | Every 350 hours (hourmeter-based) |
| Input by | Main Technician only |
| Monitoring | Admin dashboard for prediction |

#### Customer Signature — Deferred Acknowledgement
| Decision | Details |
|----------|---------|
| Standard flow | Customer signs on-site (mandatory for job completion) |
| Exception flow | "Customer Not Signed Onsite" option |
| Requirements | Mandatory reason + mandatory evidence (photos/hourmeter/work images) |
| Job status | "Completed – Awaiting Customer Acknowledgement" |
| Customer notification | Auto-send via email/portal/SMS |
| Customer options | Sign later, acknowledge without signature, raise dispute |
| Auto-complete | 3-5 working days no response → auto Completed, Admin notified |
| Audit | Full trail for billing, KPI, disputes |

---

### Pending Decisions

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Partial work detail level | ⏳ Awaiting client | Options: flag only, time+tasks, percentage |

---

### Technical Decisions Made

| Decision | Rationale |
|----------|-----------|
| Helper as `assignment_type`, not new role | Same person can be lead on one job, assistant on another. Simpler RLS. |
| Service prediction: start with SQL rules | Defer Python ML service until sufficient historical data |
| Spare parts: request/approve flow | Defer full inventory management; integrate AutoCount later |

---

## [1.0.1] - December 2024

### Added
- Job Type Classification (Service, Repair, Checking, Accident)
- Photo upload timestamps and uploader tracking
- Professional invoice format matching industry standards

---

## [1.0.0] - December 2024

### Initial Release
- Role-based permissions: Admin, Supervisor, Accountant, Technician
- Job lifecycle with audit trails
- Customer signature validation
- Condition checklist (48 items)
- PDF invoice and service report generation
- Forklift rental tracking
- Soft light/dark theme
- Multi-select bulk operations

---

## How to Update This Log

When making changes:
1. Add entry under `[Unreleased]` with date
2. Categorize: `Added`, `Changed`, `Fixed`, `Removed`, `Confirmed`, `Pending`
3. Reference client communication where applicable
4. Move to versioned section on release

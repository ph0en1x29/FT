# FieldPro Changelog

All notable changes to the FieldPro Field Service Management System.

---

## [2026-02-26] - February 26, 2026

### Features
- **Auto-generated job numbers** — DB trigger assigns `JOB-YYYYMMDD-XXXX` on insert; existing jobs backfilled; job number badge displayed on job cards and job detail header; searchable via global search
- **Technician mobile UX overhaul** — My Jobs / Other Jobs tab split; colored status borders on cards (green = completed, yellow = in-progress, red = open); larger tap targets throughout; collapsible sections on job detail page

### Bug Fixes
- **Sticky action bar** — Moved to top of job detail; hides automatically when modals are open to prevent overlap
- **Hourmeter validation** — Allow equal hourmeter reading on job complete (handles case where forklift was not operational during job)
- **Signature images** — Now use permanent public URLs instead of signed URLs (fixes 24-hour expiry issue)
- **Post-completion notes** — Technicians can now add notes after a job has been marked complete
- **Confirmation card** — Fixed mobile overflow on confirmation summary card
- **Checklist grid** — Single-column layout on mobile; overflow handling on long checklist labels
- **Call button** — Moved below customer name for better visual hierarchy
- **Combobox dropdown** — Flips upward when near viewport bottom to prevent clipping
- **CreateJob page** — Job type and priority fields now use Combobox component for consistency
- **Toast notifications** — Moved to top-center position; close button removed for cleaner mobile UX

---

## [2026-02-18/19] — Mobile Polish + Dark Mode + Theme Fixes

### Bug Fixes
- **Dark mode theming** — Replaced `bg-white` with `bg-[var(--surface)]` across 73 components — all pages now fully theme-aware
- **Bottom nav dark mode** — Dark background + light border in dark mode (was transparent)
- **FAB fixes** — Solid white backgrounds on menu items, blue glow on main button, closes on route change
- **FAB active label** — Solid accent background with white text (was transparent)
- **Technician FAB** — Replaced "New Job" (no permission) with Van Stock + My Jobs quick actions
- **KPI cards** — Fixed overflow on mobile — smaller padding/font/icons, tighter 3-col grid
- **Dashboard mobile** — Scrollable stat pills, stacking header on small screens
- **Low stock card** — Queries global `parts` table instead of `van_stock_items`; fixed race condition; excludes 0/0 items; scrollable list
- **Command palette** — Fixed transparent background on dark mode
- **Dashboard card overlap** — Fixed layout collision on mobile

---

## [2026-02-17] - Full Mobile Responsive + PWA + Role-Aware Mobile UX + UI Upgrade

### UI Upgrade — 9 Features
- **Command Palette** — `Cmd+K` / `Ctrl+K` or search button in header. Role-aware navigation + quick actions (New Job, New Customer). Arrow keys + Enter to select.
- **Pull-to-Refresh** — Wired into Jobs page. Pull down to reload the active tab.
- **Swipe Actions** — StoreQueue items: swipe right to approve/confirm, swipe left to reject. Green/red reveal.
- **Filter Bottom Sheets** — `MobileFilterSheet` component: slide-up sheet on mobile, inline on desktop.
- **Skeleton Loading** — `JobCardSkeleton`, `DashboardCardSkeleton`, `TableRowSkeleton`, `ListSkeleton` patterns.
- **Empty States** — Reusable `EmptyState` component with icon, title, description, optional CTA button.
- **Page Transitions** — CSS fade-in + slide-up animation on route changes.
- **Toast Position** — Moved to bottom-center on mobile (above bottom nav), unchanged on desktop.
- **View Toggle** — `ViewToggle` component for switching between table and card views.

### Mobile V2 — Role-Aware UX (Phase 4)
- **Role-aware bottom navigation** — Each role sees different quick-access icons:
  - Technician: Home, Jobs, Van Stock, More
  - Supervisor: Home, Jobs, Approvals, More
  - Accountant: Home, Jobs, Billing, More
  - Admin: Home, Jobs, Inventory, More
- **Notification badges** — Unread count badge on role-specific nav items
- **Floating Action Button (FAB)** — Role-specific quick actions:
  - Technicians: Add Photo, Request Part, Timer
  - Supervisors: Approvals, Assign Job
  - Admins: New Job, Approvals, Inventory
  - Accountants: Billing
- **Bottom Sheet modals** — `BottomSheet` + `BottomSheetOrModal` components (slide-up on mobile, centered on desktop)
- **Pull-to-refresh hook** — `usePullToRefresh` with arrow→spinner indicator
- **Swipeable rows** — `SwipeableRow` component for swipe-to-approve/reject on list items
- **Sticky action bar on JobDetail** — Status-based actions pinned to bottom on mobile (Start Job / Complete / Photo / Parts)

### Mobile Responsive + PWA (Phase 1-3)

### Mobile Responsive (Phase 1-3)
- **33 files modified** across all pages for mobile responsiveness
- **JobDetail** — Stacked single-column layout on mobile, touch-friendly 48px action buttons, responsive photo grid (2→3→4 cols), stackable equipment/financial cards
- **JobsTabs** — Scrollable tab bar, 44px tap targets, responsive "New Job" button with shorter label on mobile
- **CreateJob** — Full-width form inputs, responsive grid (1 col mobile → 2 col tablet), 48px buttons
- **Inventory** — Card view on mobile for parts table (hidden table, visible cards), stacked filters/stats, responsive header
- **StoreQueue** — Responsive approval cards, full-width approve/reject buttons on mobile
- **Customers** — Card layout on mobile, full-width search
- **Forklifts** — Responsive grid (1→2→3 columns)
- **People/Invoices** — Table overflow wrappers, card fallbacks on mobile
- **Login** — Centered card, max-w-sm, mobile-friendly button sizing

### PWA (Progressive Web App)
- **manifest.json** — App name, icons (192/512), standalone display, shortcuts (My Jobs, New Job)
- **Service Worker v2** — Offline caching with stale-while-revalidate for static assets, network-first for API (Supabase), offline fallback page
- **Apple meta tags** — apple-mobile-web-app-capable, status bar style, touch icon
- **Safe area support** — Bottom nav respects notched phones (env(safe-area-inset-bottom))

### Global Mobile CSS
- 44px minimum tap targets on all interactive elements
- 16px input font size (prevents iOS zoom on focus)
- Touch-optimized scrolling (-webkit-overflow-scrolling: touch)
- Reduced table cell padding on mobile
- Bottom nav clearance (pb-24 md:pb-8) on all pages

---

## [2026-02-16] - Van History, Decimal Quantities, Bug Fixes

### Approvals Tab (StoreQueue) — Grouped Accordion
- **Grouped by job** — requests for the same job now collapse into one accordion card
- **Collapsed by default** — header shows: job title, customer, technician, item count badge, time since oldest request
- **Expand to see details** — click card to reveal individual part requests with inline approve/reject
- **"Approve All" per job** — approves all part requests for a job in one click (only shows when all parts selected)
- **Sorted by latest** — groups sorted by most recent item, newest first
- **Batch-optimized** — Approve All skips per-item reload/toast, single summary toast + reload at end
- File: `StoreQueue/StoreQueuePage.tsx`

### Pending Confirmations Page (standalone) — Collapsed Cards
- **Collapsed cards by default** — job cards now show compact header only (title, customer, tech, time pending, parts count)
- **Expand/collapse accordion** — click card or chevron to see full details (parts list, SRN, completion date, confirmation status)
- **Sort by latest** — most recently completed jobs appear first (both Parts and Jobs tabs)
- **Always-visible actions** — Confirm/Reject buttons visible on collapsed view, no need to expand
- **Tab switch resets** — switching tabs collapses all cards and clears selections
- Files: `PendingConfirmations.tsx`, `JobCard.tsx`, `usePendingConfirmations.ts`

### Broken Notification Bell on V7.1 Dashboard
- **Fixed:** Bell button next to V7.1 badge navigated to `/notifications` — route doesn't exist (blank page)
- **Removed** duplicate bell from dashboard — global header already has `NotificationBell` with working dropdown
- **Cleaned up** unused `Bell` import, `useNotifications` fetch, and `unreadCount` variable (saves an unnecessary API call)
- File: `components/dashboards/DashboardPreviewV4/components/AdminDashboardV7_1.tsx`

### "Failed to mark out of stock" Bug Fix
- **Fixed:** Inline "Out of Stock" button on pending requests passed empty string as partId (no part selected yet → invalid UUID → update fails)
- **Removed** the broken inline OOS shortcut from `JobRequestsSection.tsx`
- **OOS flow still works** via the Approve Request modal where admin selects a part first, then can mark OOS
- File: `pages/JobDetail/components/JobRequestsSection.tsx`

### Part Request Auto-Refresh Fix
- **Fixed:** Technician submits a part request → job doesn't refresh, request invisible until manual reload
- **Fixed:** Same issue when editing an existing request
- **Root cause:** `handleCreateRequest` and `handleUpdateRequest` were missing `loadJob()` call after success (every other handler had it)
- **Also fixed:** React dependency arrays updated to include `loadJob`
- File: `pages/JobDetail/hooks/useJobRequestActions.ts`

### Parts Inventory Bug Fix
- **Fixed:** Parts dropdown in job detail showed "Stock: undefined" — `getPartsForList()` wasn't fetching `stock_quantity`
- **Fixed:** Admin was blocked from adding out-of-stock parts — now only technicians are restricted
- **Fixed:** Stock could go negative when adding parts — clamped to `Math.max(0, ...)`
- **Added:** Visual stock indicators in parts dropdown: ⛔ OOS (zero), ⚠️ low stock (≤5), normal count otherwise
- Files: `partsService.ts`, `jobInvoiceService.ts`, `JobDetailPage.tsx`

### Van History Tab
- **History tab** in van detail modal — shows full parts deduction log with technician, job, quantity, and timestamp
- **Technician summary** sub-tab — which technicians used a van, how many jobs/parts, date ranges
- Paginated log (20 per page) with part codes, units, and customer names
- New service: `vanHistoryService.ts` with `getVanUsageHistory()` and `getVanTechnicianSummary()`

### Decimal Quantity Input
- **Manual quantity entry** replaces the "+" button for van stock parts — technicians can type exact amounts (e.g., 1.5L)
- Supports decimal values for liquid/bulk items (hydraulic oil, lubricant, etc.)
- Shows available quantity with unit in the van stock selector dropdown
- Validates: must be > 0, cannot exceed available stock
- `unit` field added to Part type (pcs, L, kg, m, etc.)
- DB migration: quantity columns altered from INTEGER to DECIMAL(10,2) across van_stock_items, van_stock_usage, job_parts, replenishment_items

### Bulk Part Request Approval
- Already existed! "Approve All" button appears when 2+ requests are pending
- Auto-matches request descriptions to parts inventory with fuzzy keyword matching
- Admin can review, adjust parts/quantities, skip individual items, then approve all at once

### Migration
- `20260216_van_history_and_decimal_quantities.sql`

---

## [2026-02-12] - Van Fleet Management

### Fleet Management System
- **Fleet Overview panel** — Admin/Supervisor collapsible panel at top of Van Stock tab showing all vans with status, plate number, tech, item count, and temp assignments
- **Van status tracking** — Toggle vans between Active / In Service / Decommissioned with one click
- **Temp tech assignment** — Assign/remove temporary technicians to vans (e.g., when their van is in service)
- **Tech van requests** — Technicians can request access to available vans with reason; supervisors approve/reject
- **Auto-assignment on approval** — Approving a request automatically assigns the temp tech to the van
- **Audit trail** — Full timeline of all status changes, temp assignments, and requests per van
- **Van identification** — Edit plate numbers and van codes inline from fleet overview
- **Smart van resolution** — `getVanStockByTechnician` now checks temp assignments first, falls back to own van
- DB tables: `van_access_requests`, `van_audit_log`
- DB columns: `van_status`, `van_plate`, `temporary_tech_id/name`, `temp_assigned_at` on `van_stocks`
- Migration: `20260212_van_fleet_management.sql`

---

## [2026-02-12] - Van Selection for Job Parts

### Van Stock Hardening (Codex Review Findings)
- **Fix: Stale quantity race condition** — Restock now uses atomic SQL `quantity = quantity + N` via `increment_van_stock_quantity()` RPC instead of read-then-write
- **Fix: Van lock enforced server-side** — DB trigger `prevent_van_change_after_parts` blocks van change if `from_van_stock` parts exist on job. No longer UI-only.
- **Fix: Lightweight van dropdown** — New `getActiveVansList()` returns only van metadata (no items) for technician dropdown. Reduces data leakage + payload size.
- DB migration: `20260212_van_stock_hardening.sql`

### Van Stock Bug Fixes (4 issues)
- **Fix: "Unknown" van cards** — `technician_name` wasn't mapped from joined `technician` object in `getAllVanStocks`, `getVanStockById`, and `getVanStockByTechnician`
- **Fix: Replenishment blocked for existing items** — Parts with qty 0 / "Out" status can now be restocked via Add Item (increments qty instead of blocking)
- **Fix: Edit Van Details save** — Changed empty notes from `undefined` to empty string to prevent Supabase rejection
- **Fix: Data mapping consistency** — All van stock fetch functions now consistently resolve `technician_name` from the joined user relation

### Van Selection Feature
- **New:** Technicians can select which van they're using at the start of each job
- Parts list filters to show only parts available in the selected van
- Parts deductions go to the correct van's inventory
- Pre-selects technician's default assigned van (no extra clicks for normal flow)
- Van selection locks after first part is used from van stock (prevents inventory inconsistency)
- No impact on warehouse stock flow

### Files Changed
- `types/job-core.types.ts` — Added `job_van_stock_id` field to Job type
- `pages/JobDetail/hooks/useJobData.ts` — Fetch van stock by job's selected van
- `pages/JobDetail/hooks/useJobDetailState.ts` — Added `availableVans` state
- `pages/JobDetail/hooks/useJobPartsHandlers.ts` — Added `handleSelectJobVan` handler
- `pages/JobDetail/components/PartsSection.tsx` — Van selector dropdown UI
- `pages/JobDetail/JobDetailPage.tsx` — Wired new props
- `database/migrations/20260212_job_van_selection.sql` — DB migration

---

## [2026-02-07] - Security Fixes & Code Cleanup

### ESLint Zero Warnings (Phase 3 Complete)
- **353 → 0 warnings** — Full lint cleanup achieved
- **Unused catch variables** (~140) — Renamed to `_error`/`_e` convention
- **Empty blocks** (33) — Added explicit `/* Silently ignore */` comments
- **useEffect deps** (31) — Added eslint-disable for intentional mount-only hooks
- **max-lines** (29 files) — File-level disables pending proper splitting
- **ESLint config** — Added `varsIgnorePattern`, `caughtErrorsIgnorePattern`, `destructuredArrayIgnorePattern`
- **Ignored directories** — tests/, public/, scripts/ excluded from linting

### File Modularization (Phase 4)
Successfully split large files for better maintainability:

| Original File | New Files | Reduction |
|---------------|-----------|-----------|
| `types/job.types.ts` (678 lines) | 5 files: job-core, job-hourmeter, job-quotation, job-request, job-validation | -91% (59 lines) |
| `services/jobAssignmentService.ts` (453 lines) | 3 files: jobAssignmentCrudService, jobAssignmentBulkService + facade | -94% (27 lines) |
| `utils/useRealtimeNotifications.ts` (477 lines) | 3 files: notificationHandlers, realtimeChannels + hook | -49% (244 lines) |
| `services/hourmeterService.ts` (678 lines) | servicePredictionService.ts | -61% (262 lines) |
| `pages/JobDetail/components/JobDetailModals.tsx` (666 lines) | JobDetailModalsSecondary.tsx | -38% (411 lines) |
| `services/jobRequestService.ts` (452 lines) | jobRequestApprovalService.ts | -62% (171 lines) |
| `pages/JobDetail/hooks/useJobActions.ts` (870 lines) | useJobPartsHandlers.ts | -8% (798 lines) |

**25 large files remain** with `eslint-disable max-lines` — these are mostly:
- PDF generators (template-heavy, hard to split)
- Dashboard previews (prototype components)
- Complex hooks (need careful refactoring)

### Code Cleanup (Phase 1 & 2)
- **Import organization** — Removed unused imports across 372 files
- **ESLint fixes** — Reduced issues from 450 to 385 (65 fixed)
- **Type safety** — Fixed `var` to `let/const`, prefixed unused params with `_`
- **Service modularization** — Split `jobService.ts` into focused modules:
  - `jobStatusService.ts` — Status transitions, multi-day job flow
  - `jobCrudService.ts` — Delete/restore operations
  - `jobAutoCountService.ts` — AutoCount export stubs

## [2026-02-07] - Security Fixes: XSS & Storage Hardening

### Security Fixes
- **XSS protection in PDF generators** — All user-controlled content now sanitized before injection
- **Signed URLs for signatures** — `uploadToStorage()` now returns file path instead of public URL
- **Time-limited access** — Signature URLs now expire after 24 hours (vs permanent public URLs)
- **New helper** — `getSignedStorageUrl()` for generating signed URLs on demand

### Technical Details

**XSS Prevention:**
- New `services/sanitizeService.ts` — HTML entity encoder for user content
- Fixed all 5 PDF generators using `document.write()`:
  - `components/InvoicePDF.tsx`
  - `components/QuotationPDF.tsx`
  - `components/ServiceReportPDF.tsx`
  - `pages/Invoices/components/generateInvoicePDF.ts`
  - `pages/ServiceRecords/ServiceReportPDF.ts`

**Storage Hardening:**
- `services/storageService.ts` — Returns `data.path` instead of `getPublicUrl()`
- `services/supabaseClient.ts` — Same change + added `getSignedStorageUrl()` helper
- `services/jobMediaService.ts` — Updated `signJob()` to generate signed URL after upload

### Why This Matters
Public URLs are permanent and shareable — if leaked via browser history, email, or logs, anyone can access the document forever. Signed URLs expire, limiting exposure window.

---

## [2026-02-06] - UX Improvements & Workflow Enhancements

### UI/UX Improvements
- **Dynamic Quick Stats colors** — Colors now respond to data (green=0, red/purple=needs attention)
- **Check All/Uncheck All** — Buttons in Start Job modal for condition checklist
- **Last recorded hourmeter** — Displayed in Start Job modal for reference
- **Loading skeletons** — New Skeleton component library for better perceived performance
- **Toast with undo** — `showUndoToast` and `showDestructiveToast` in toastService
- **Mobile components** — PullToRefresh, SwipeableCard, OfflineIndicator

### Developer Experience
- **AGENTS.md enhanced** — Self-improvement rules, quality prompts, lessons learned table
- **Pre-commit hooks** — TypeScript + build verification before every commit
- **Query audit** — Documented N+1 patterns, missing indexes, optimization opportunities

### Testing
- **Service Due E2E tests** — 5 tests covering table, columns, priority badges

### Bug Fixes
- Fixed dev mode for dev@test.com account
- Fixed 71→15 TypeScript errors (build now passes)

---

## [2026-02-05] - Hourmeter Service Tracking Enhancement ✅

### Customer Feedback Implementation

Enhanced hourmeter service tracking with service upgrade prompts, stale data detection, and improved fleet overview.

#### Bug Fixes (Same Day)
- Fixed `vercel.json` missing for SPA client-side routing (404 on direct navigation)
- Fixed `toLocaleString` null check in ServiceDueTab causing crash
- Fixed `get_forklift_daily_usage` RPC using wrong column name (`reading` not `hourmeter`)

#### New Features
1. **Two Hourmeter Fields** — `last_serviced_hourmeter` and `next_target_service_hour`
2. **Service Intervals by Type** — Diesel (500 hrs), LPG (350 hrs), Electric (90 days)
3. **Service Upgrade Prompt** — When starting Minor Service on overdue unit, prompts to upgrade to Full Service
4. **Stale Data Detection** — Flags units with no hourmeter update in 60+ days
5. **Daily Usage Tracking** — Calculates avg daily hours and trend (increasing/decreasing/stable)

#### Database Changes
- `forklifts` table: Added `last_serviced_hourmeter`, `next_target_service_hour`, `last_hourmeter_update`
- New `service_intervals` table with defaults per forklift type
- New `service_upgrade_logs` table for audit trail
- New `fleet_service_overview` view with computed fields
- `get_forklift_daily_usage()` function for usage calculation
- `complete_full_service()` function for baseline reset
- Auto-calculate trigger on forklift INSERT/UPDATE

#### New Files
- `services/serviceTrackingService.ts` — Fleet overview, upgrade logic, stale detection
- `components/ServiceUpgradeModal.tsx` — Upgrade prompt UI component
- `docs/features/HOURMETER_SERVICE_TRACKING.md` — Feature specification

#### Implementation Complete ✅
- [x] Database migration with triggers, views, functions
- [x] Service tracking service with fleet overview, upgrade logic, stale detection
- [x] ServiceUpgradeModal component for Minor→Full upgrade prompt
- [x] JobDetail integration (check on job start, handle upgrade/decline)
- [x] Fleet Dashboard new columns (Last Serviced, Next Target, Daily Usage)
- [x] Stale data filter and banner for admin/supervisor
- [x] Notification system for stale data alerts

#### Testing Needed
- [ ] End-to-end testing with real data
- [ ] Migration deployment to production

---

## [2026-02-04] - Hourmeter Service Prediction System

### New Feature: Engine Hour-Based Service Prediction

Predicts next service date for Diesel, LPG, and Petrol forklifts based on hourmeter usage patterns.

#### How It Works
1. **Collects Data:** Last service hourmeter, current hourmeter, service interval
2. **Calculates Average Usage:** Hours used ÷ days since last reading = avg hrs/day
3. **Predicts Service Date:** Hours until service ÷ avg hrs/day = days remaining
4. **Auto-Resets:** After service completion, cycle restarts automatically
5. **Updates Dynamically:** Every new reading recalculates the prediction

#### Database Changes
- `forklifts` table: Added `last_service_hourmeter`, `service_interval_hours` columns
- New `hourmeter_readings` table: Tracks all hourmeter readings with timestamps
- `calculate_predicted_service_date()` function: Server-side prediction calculation
- `complete_forklift_service()` function: Resets tracking after service
- `v_forklift_service_predictions` view: Dashboard-ready predictions with urgency

#### New Files
- `services/hourmeterService.ts` — Extended with service prediction functions
- `components/hourmeter/HourmeterReadingForm.tsx` — Record hourmeter readings
- `components/hourmeter/ServicePredictionCard.tsx` — Display prediction info
- `components/hourmeter/ServicePredictionDashboard.tsx` — Dashboard widget
- `database/migrations/20260204_hourmeter_service_prediction.sql` — Full migration

#### Types Added
- `HourmeterReading` — Individual reading record
- `ServicePrediction` — Calculation result
- `ForkliftWithPrediction` — Forklift with prediction data
- `ServicePredictionDashboard` — Dashboard widget data
- `ServiceUrgency` — Urgency levels (overdue, due_soon, upcoming, ok)

#### Service Functions
- `recordHourmeterReading()` — Log a new reading
- `getHourmeterReadings()` — Fetch reading history
- `getServicePrediction()` — Get prediction for one forklift
- `getForkliftServicePredictions()` — Get all predictions
- `getServicePredictionDashboard()` — Dashboard data grouped by urgency
- `completeForkliftService()` — Reset after service
- `updateServiceInterval()` — Change service interval

#### Helpers
- `requiresHourmeterTracking()` — Check if forklift type needs tracking
- `formatDaysRemaining()` — Human-readable countdown
- `getUrgencyColor()` — CSS classes for urgency display

### Migration Required
Run `20260204_hourmeter_service_prediction.sql` on Supabase to enable the feature.

### Update (Same Day) - Client Feedback

#### Split Service Job Types
- `Full Service` — PM with oil change, resets hourmeter cycle
- `Minor Service` — PM without oil change, tracks work but no reset
- Legacy `Service` type still works (treated as Full Service)

#### Auto Service Intervals by Forklift Type
- Diesel → 500 hours
- LPG/Petrol → 350 hours
- Trigger `trg_set_service_interval` auto-applies on forklift create/update

#### Automation Triggers
- `on_service_job_completed()` — Auto-resets hourmeter when Full Service job completed
- `set_service_interval_by_type()` — Auto-sets interval based on forklift type

---

## [2026-02-03] - Security Fixes (Codex Review)

### Critical Fixes

#### 1. Race Condition in Spare Parts Approval — FULLY FIXED
- **Issue:** Separate stock check and update allowed overselling
- **Fix (v1):** Atomic update with WHERE clause
- **Fix (v2):** New SQL function `reserve_part_stock()` with row-level locking
- **Files:** `services/jobRequestService.ts`, `supabase/migrations/20260203_atomic_stock_reserve.sql`
- **Rollback:** `rollback_part_stock()` function for failure recovery

#### 2. Assistance Approval Bug  
- **Issue:** Request marked approved before helper assignment, causing false positives
- **Fix:** Assign helper FIRST, only mark approved if successful
- **File:** `services/jobRequestService.ts`

#### 3. Telegram Token Security
- **Issue:** Base64 JSON token allowed potential forgery
- **Fix:** Added expiry timestamp (5 min), nonce for replay protection
- **File:** `components/TelegramConnect.tsx`
- **Note:** Server-side validation required in webhook

### Security Improvements

#### Dev Mode Protection
- **Issue:** Hardcoded `dev@test.com` could be exploited
- **Fix:** Removed hardcoded email, dev mode only works in dev environment
- **File:** `hooks/useDevMode.ts`

#### Signed URLs for HR Documents
- **Issue:** HR documents (permits, licenses, profile photos) used public URLs
- **Fix:** Implemented signed URLs with 1-hour expiry
- **Files:** `permitService.ts`, `licenseService.ts`, `hrService.ts`, `leaveService.ts`
- **New methods:** `getPermitDocumentUrl()`, `getLicenseImageUrl()`, `getProfilePhotoUrl()`, `getLeaveDocumentUrl()`

#### Gemini API Key Documentation
- Added security notes about client-side key exposure
- Documented mitigations and production recommendations
- **File:** `services/geminiService.ts`

### Database Changes
- `reserve_part_stock(UUID, INTEGER)` — Atomic stock reservation with row lock
- `rollback_part_stock(UUID, INTEGER)` — Undo stock reservation

---

## [2026-02-02] - Customer Feedback Bug Fixes

### Bug Fixes
- **Checklist validation** — Fixed "invalid input syntax for type boolean: 'ok'" error
  - Root cause: Trigger tried to cast string 'ok' to boolean
  - Fix: Now handles both old (true/false) and new ('ok'/'not_ok') formats
  
- **Job completion validation** — Fixed "Job was never started (started_at is null)" error
  - Root cause: Status dropdown path didn't sync `started_at` to service record
  - Fix: Now checks `jobs.started_at`, `repair_start_time`, and `arrival_time` as fallbacks
  - Added trigger to auto-sync job timestamps to service records

### Database Changes
- `validate_job_checklist()` — Handles string checklist states
- `validate_job_completion_requirements()` — Checks multiple timestamp sources
- `sync_job_started_to_service_record()` — New trigger for timestamp sync
- Backfill migration for existing service records

### Code Changes
- `jobService.ts` — `updateJobStatus` now syncs `started_at` to service records

### Tests Added
- `tests/customer-feedback-fixes.spec.ts` — Validates both fixes

### New: Error Tracking ("Desire Paths")
- `user_action_errors` table — Tracks failed user actions
- `errorTrackingService.ts` — Service to log and analyze errors
- Auto-tracking integrated into `toastService.ts`
- Helps identify what users try to do that fails → build those features

### Security: Hide Pricing from Technicians
- **Inventory Page** — Cost and Price columns hidden for technicians
- **Inventory Stats** — Inventory Value card hidden for technicians
- Uses existing `canViewPricing` permission from `ROLE_PERMISSIONS`
- Admins, Supervisors, Accountants still see all pricing

### Pre-Job Parts Allocation
- **Admins** can now add parts to jobs at ANY stage (New, Assigned, In Progress, Awaiting)
- **Supervisors** can add parts from Assigned onwards
- **Accountants** can only add at Awaiting Finalization (invoice adjustments)
- UI shows "(Pre-allocation)" label when adding parts to New/Assigned jobs
- Simplified and clarified `canAddParts` logic

### Request Edit Capability
- **Technicians** can now edit their own pending requests
- Edit button appears next to "Pending" requests they created
- Only works while request status is 'pending' (before admin review)
- Can modify: request type, description, photo URL
- Modal reused from create flow with edit mode support
- Service validates ownership + pending status before allowing update

### Dashboard Prototypes (All Roles)
- **Admin V5** — Option C style: full-width sections, top 5 items, "View all" links
- **Admin V6** — Full-featured prototype with:
  - Smart context-aware greeting ("5 jobs today, 2 techs available • ⚠️ 1 escalation")
  - Quick Actions row (Assign Jobs, Generate Invoices, Send Reminders)
  - 6 KPI cards including SLA metrics (On-Time %, Avg Response Time)
  - Today's Schedule timeline with visual job status
  - Notification filters (All/Jobs/Requests/System)
  - Outstanding Invoices card
  - Today's Progress bar
  - Team Status with grouped chips
- **Supervisor V5** — Team-focused with layout options (C: Top 5, D: Grouped)
- Toggle V4/V5/V6 via buttons in header (`dev@test.com` only)

### Performance: Egress Optimization
- Added `getUsersLightweight` (7 cols vs 30+)
- Dashboard now uses lightweight queries
- `getEmployees` no longer fetches nested data by default
- Estimated 70-80% reduction in egress for list views

---

## [2026-02-01] - Workflow Simplification & Bug Fixes

### Unified Admin Workflow
- **Removed Admin Service/Store split** — All admins now have full permissions
- **Auto-confirm parts** — Parts automatically confirmed when admin adds them
- **Parts visible to technicians** — Technicians see parts immediately (names only, no prices)
- **Removed "Pending Verification" block** — No longer blocks technicians from seeing parts

### Checklist Improvements
- **"Check All" button** — Marks all 48 checklist items as OK with one click
- **Auto-X on untick** — Click OK on already-checked item to mark as needs attention
- **Workflow:** Check All → Untick exceptions → Save

### Bug Fixes
- **Complete button** — Now shows warning modal for missing mandatory checklist items
- **Photo upload** — Fixed black screen / slowness with image compression (1920px max, 85% quality)
- **GPS timeout** — Reduced from 10s to 5s to prevent upload delays
- **Part request approval** — Now auto-confirms parts when admin approves request

### Restored Features (from refactor audit)
These features were accidentally removed during code modularization:
- Condition Checklist Card — view/edit with OK/Not OK buttons
- Parts Section — admin can add/edit/remove parts
- Job Details Card — Job Carried Out + Recommendation fields
- Confirmation Status Card — Parts and Job confirmation status
- Extra Charges Section — add/view/remove extra charges
- Helper Assignment — assign/remove helper technicians
- Deferred Completion Modal — complete without customer signature

### Part Request System (New)
- **Technicians can request parts** via "Request Part" button
- **Admins approve/reject** requests with part selection
- **Auto-adds to job** when approved

---

## [2026-01-31] - Code Quality & Architecture

### Modular Refactoring
Split large page components into maintainable modules:
- JobDetail (3262 → ~200 lines per component)
- TechnicianDashboard, AccountantDashboard
- CustomerProfile, EmployeeProfile, ForkliftsTabs
- MyVanStock, VanStockPage, CreateJob

### Performance
- **Bundle optimization** with lazy loading
- **Database query optimization** — eliminated N+1 queries
- **Infinite refetch fix** — resolved ERR_INSUFFICIENT_RESOURCES

### Security
- **RLS policies** fixed for all tables
- **Trigger fixes** for real-time updates
- **Supabase security linter** warnings resolved

---

## [2026-01-29] - Push Notifications & Real-Time

### Push Notifications
- Real browser push notifications (not just in-app)
- Background notification support
- Sound alerts for new jobs

### Real-Time Updates
- WebSocket connection health indicator
- Live job status updates
- Automatic sync on reconnect

### Job Response Timer
- 15-minute accept/reject requirement
- Auto-escalation if no response
- Visual countdown timer

---

## [2026-01-28] - Customer Feedback Implementation

### Phase 1-3 Features
- **Pricing hidden from technicians** — Only admins/accountants see prices
- **Binary checklist** — OK ✓ or Not OK ✗ only
- **Photo auto-start** — First photo starts job timer
- **Request editing** — Technicians can edit pending requests
- **Hourmeter persistence** — Preserved across reassignment
- **Dashboard notifications** — Recent notifications feed

---

## [2026-01] - January 2026 Summary

### Major Features Added
- Helper Technician System
- In-Job Request System (assistance, parts, skillful tech)
- Multi-Day Job Support with escalation
- Deferred Customer Acknowledgement
- Photo Categorization with ZIP download
- AutoCount Integration for invoices
- Fleet Dashboard with real-time status
- Photo Validation (GPS + timestamp)

### UI/UX Improvements
- Role-specific dashboards (Technician, Accountant)
- Dark mode support
- Mobile-optimized layouts
- Swipeable job cards

---

## [1.0.1] - December 2024

- Job types and categorization
- Photo tracking system
- Invoice format improvements

---

## [1.0.0] - December 2024

- Initial FieldPro release
- Core job management
- User authentication
- Basic reporting

---

## Archive

Detailed historical changelogs are available in `docs/archive/`.

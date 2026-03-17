# WORK_LOG.md — Multi-Agent Activity Log

Format: `[YYYY-MM-DD HH:MM] [Agent] Summary`

<!-- Entries before 2026-03-06 trimmed — see git history -->

## 2026-03-13

[2026-03-13 02:37] [Sonnet] Fix Performance tab KPI calculations - missing query fields: services/supabaseClient.ts, services/jobService.ts, services/supabaseService.ts, pages/TechnicianKPIPageV2/hooks/useKPIData.ts
  - services/supabaseClient.ts: Added JOB_SELECT.KPI query profile — includes job_id, status, job_type, priority, is_callback, assigned_technician_id, timestamps, labor_cost, parts_used:job_parts(quantity, sell_price_at_time), extra_charges:extra_charges(amount), scheduled_date — lighter than DETAIL but includes revenue fields for KPI calculations
  - services/jobService.ts: Created dedicated getJobsForKPI() function — uses JOB_SELECT.KPI instead of BOARD; includes retry logic for network errors; adds defensive defaults (parts_used || [], extra_charges || [], labor_cost || 0) to prevent crashes when fields are missing
  - services/supabaseService.ts: Exported getJobsForKPI from jobService; Added to SupabaseDb compatibility object
  - pages/TechnicianKPIPageV2/hooks/useKPIData.ts: Switched from MockDb.getJobs() to MockDb.getJobsForKPI(); Added defensive defaults to revenue calculation (parts_used || []) and total_parts_used calculation to prevent undefined array access
  - Root cause: Performance tab was calling getJobs() which used JOB_SELECT.BOARD that excluded labor_cost, parts_used, extra_charges; KPI calculations needed these fields for revenue metrics
  - Build: ✅ Pass (✓ 2450 modules transformed, ✓ built in 5.73s)

## 2026-03-11

[2026-03-11 19:47] [Sonnet] Fix missing logError import: services/jobStatusService.ts
  - Added logError to imports from supabaseClient to fix TypeScript errors in markJobContinueTomorrow and resumeMultiDayJob functions

[2026-03-11 19:47] [Sonnet] External forklift support with inline creation and billing type: types/forklift.types.ts, types/job-core.types.ts, services/forkliftService.ts, pages/CreateJob/CreateJobPage.tsx, pages/CreateJob/components/ExternalForkliftSection.tsx, pages/CreateJob/components/index.ts, pages/CreateJob/hooks/useCreateJobForm.ts, pages/CreateJob/types.ts, pages/CustomerProfile/components/RentalsSection.tsx
  - types/forklift.types.ts: Added ownership_type?: 'fleet' | 'external' to Forklift interface
  - types/job-core.types.ts: Added billing_type?: 'rental-inclusive' | 'chargeable' to Job interface
  - services/forkliftService.ts: Added ownership_type to FORKLIFT_SELECT and LEGACY_FORKLIFT_SELECT; Added .eq('ownership_type', 'fleet') filter to getForkliftsPage() main and legacy queries; Added ownership_type: forkliftData.ownership_type || 'fleet' to createForklift() payload
  - pages/CreateJob/types.ts: Added billing_type to CreateJobFormData interface
  - pages/CreateJob/hooks/useCreateJobForm.ts: Added billing_type: 'rental-inclusive' to initial form state; Auto-set billing_type to 'chargeable' when external forklift selected; Added handleCreateExternalForklift function; Include billing_type in job submission payload
  - pages/CreateJob/components/ExternalForkliftSection.tsx: New collapsible inline form for creating external forklifts — fields: serial_number (required), make, model, type (dropdown), hourmeter; On submit: creates forklift with ownership_type: 'external', current_customer_id, status: 'Active', auto-selects newly created forklift
  - pages/CreateJob/CreateJobPage.tsx: Added ExternalForkliftSection after ForkliftSelectionSection
  - pages/CustomerProfile/components/RentalsSection.tsx: Added "External" badge for forklifts with ownership_type === 'external'
  - Build: ✅ Pass (✓ 2448 modules transformed, ✓ built in 5.48s)

## 2026-03-10

[2026-03-10 15:30] [Sonnet] Job board performance optimization: jobService.ts, useJobData.ts, useJobFilters.ts, JobBoard.tsx, JobCard.tsx, JobListRow.tsx, QuickStats.tsx, useDebounce.ts
  - jobService.ts: Removed parts_used/media overfetch from board query; merged N+1 helper assignment queries into single !inner join
  - useJobData.ts: Stabilized realtime subscription with ref pattern to avoid channel churn; prepend new jobs on INSERT instead of full refetch
  - useJobFilters.ts: Added 250ms search debounce via useDebounce hook
  - JobBoard.tsx: Stabilized onNavigate with useCallback
  - JobCard.tsx, JobListRow.tsx, QuickStats.tsx: Wrapped in React.memo to skip unnecessary re-renders
  - hooks/useDebounce.ts: New generic debounce hook
  - Build: pending verification

[2026-03-10 02:01] [Sonnet] Compact job cards + list view toggle: JobCard.tsx, JobListRow.tsx, JobBoard.tsx, index.ts
  - JobCard.tsx: Redesigned to be ~40% shorter — Row 1: badges (job#, status, type, helper, emergency/SLA), Row 2: title + assigned tech, Row 3: customer · forklift · date; Removed description and address lines; Kept accept/reject, selection mode, hover effects
  - JobListRow.tsx (new): Horizontal list view component — Single row with status dot, job#, title, customer, forklift, tech, date, chevron; Accept/reject buttons inline for technicians; Same props interface as JobCard
  - JobBoard.tsx: Added viewMode state ('card' | 'list', default 'card' for technicians, 'list' for admin/supervisor); View toggle UI (LayoutGrid/List icons); Render logic for both card and list views in technician sections (My Jobs / Other Jobs) and admin view
  - index.ts: Exported JobListRow component
  - Build: ✅ Pass (✓ 2445 modules transformed, ✓ built in 3.70s)

[2026-03-10 00:07] [Sonnet] Admin forklift switching: EquipmentCard.tsx, useJobActions.ts, JobDetailPage.tsx — pre-start only, customer rentals
  - EquipmentCard.tsx: Added forklift switching UI — RefreshCw button (admin+pre-start only), inline Combobox dropdown, filter forklifts by current_customer_id === job.customer_id, onSwitchForklift callback prop
  - useJobActions.ts: Added handleSwitchForklift handler — updates jobs.forklift_id via supabase, refreshes job data, shows success toast
  - JobDetailPage.tsx: Wired onSwitchForklift={actions.handleSwitchForklift} to EquipmentCard
  - Access control: canSwitchForklift = isAdmin && (isNew || isAssigned) && !isInProgress && !isCompleted
  - UX flow: Click RefreshCw → Combobox shows customer's rented forklifts (getForkliftsForList filtered) → Select → Save immediately → Refresh
  - Build: ✅ Pass (✓ 2444 modules transformed, ✓ built in 4.21s)

## 2026-03-06

[2026-03-06 09:54] [Phoenix] Fix duplicate job route: /jobs/create → /jobs/new
[2026-03-06 10:05] [Sonnet] Reach Truck → Electric forklift type mapping
[2026-03-06 10:30] [Sonnet] Bulk site sign-off: SiteSignOffBanner, BulkSignOffModal
[2026-03-06 11:02] [Sonnet] Swipe-to-sign component replacing canvas signatures
[2026-03-06 14:19] [Phoenix] Admin role split: admin_service vs admin_store
[2026-03-06 19:53] [Codex] E2E stabilization + bug fixes
[2026-03-06 20:37] [Codex] UI clarity pass: dashboard, fleet, customer, job board
[2026-03-06 20:45] [Phoenix] Merge + re-apply critical bug fixes
[2026-03-06 20:54] [Sonnet] Customer delete FK cascade + themed confirm dialog
[2026-03-06 20:59] [Phoenix] UsersTab role badge crash fix
[2026-03-06 22:13] [Codex] Role-specific dashboards: ServiceAdminDashboard, StoreAdminDashboard
[2026-03-06 22:20] [Phoenix] Merge dashboard split + preserve bug fixes, clean WORK_LOG
[2026-03-09 11:24] [Codex] Pulled latest main and compared imported debtor customer data against /Users/jay/Downloads/DEBTORS.xls
[2026-03-09 12:21] [Codex] Implemented rental/hourmeter import-prep migration, dry-run parser/report CLI, and compatibility updates without importing live data
[2026-03-09 12:32] [Codex] Documented rental/hourmeter import-prep changes, re-verified build/lint/tests, and prepared scoped commit/push on main
[2026-03-09 23:58] [Sonnet] Batch delete jobs: JobBoard.tsx, JobCard.tsx, index.ts, ConfirmBatchDeleteModal.tsx — Selection mode, checkboxes, floating action bar, soft-delete handler
  - JobBoard.tsx: Added state for selectionMode, selectedJobs, showBatchDeleteModal, deletionReason; Select toggle button (admin/supervisor); Floating action bar showing count + delete button; Batch delete handler calling jobCrudService.deleteJob(); Modal integration
  - JobCard.tsx: Added selectionMode props, checkbox overlay, selection styling, handle card clicks in selection mode
  - ConfirmBatchDeleteModal.tsx (new): Modal for batch delete confirmation with optional reason
  - index.ts: Export ConfirmBatchDeleteModal
  - Build: ✅ Pass (✓ 2444 modules transformed, ✓ built in 4.20s)

## 2026-03-09 05:10 AM — Customer Fields UI Update [Sonnet]

**Task:** Add 5 new customer fields to FT UI (registration_no, tax_entity_id, credit_term, agent, phone_secondary)

**Files changed:**
- types/customer.types.ts — Added 5 optional fields to Customer interface
- services/customerService.ts — Updated getCustomers() select query
- pages/CustomerProfile/components/EditCustomerModal.tsx — Added fields to edit form
- pages/CustomerProfile/components/CustomerHeader.tsx — Account number badge, agent/credit_term pills
- pages/CustomerProfile/CustomerProfilePage.tsx — Added new fields to save payload
- pages/Customers/Customers.tsx — Extended search to include account_number and agent
- pages/Customers/components/CustomerCard.tsx — Account number and agent badges

**Build:** ✅ Pass
- [2026-03-09 05:13] [Sonnet] Updated customer.types.ts — added 5 new customer fields (registration_no, tax_entity_id, credit_term, agent, phone_secondary)
- [2026-03-09 05:13] [Sonnet] Updated customerService.ts — added 5 new customer fields (registration_no, tax_entity_id, credit_term, agent, phone_secondary)
- [2026-03-09 05:13] [Sonnet] Updated EditCustomerModal.tsx — added 5 new customer fields (registration_no, tax_entity_id, credit_term, agent, phone_secondary)
- [2026-03-09 05:13] [Sonnet] Updated CustomerHeader.tsx — added 5 new customer fields (registration_no, tax_entity_id, credit_term, agent, phone_secondary)
- [2026-03-09 05:13] [Sonnet] Updated CustomerProfilePage.tsx — added 5 new customer fields (registration_no, tax_entity_id, credit_term, agent, phone_secondary)
- [2026-03-09 05:13] [Sonnet] Updated Customers.tsx — added 5 new customer fields (registration_no, tax_entity_id, credit_term, agent, phone_secondary)
- [2026-03-09 05:13] [Sonnet] Updated CustomerCard.tsx — added 5 new customer fields (registration_no, tax_entity_id, credit_term, agent, phone_secondary)

- [2026-03-09 05:28] [Sonnet] Updated customerService.ts — paginated getCustomers() and getCustomersForList() to fetch all rows beyond Supabase 1000-row default limit

- [2026-03-09 05:32] [Sonnet] Updated Customers.tsx — null-safe search filter for address/email fields

- [2026-03-09 21:10] [Sonnet] Added getFleetStatusCounts() RPC function in forkliftService.ts to bypass PostgREST max_rows limit for dashboard header counts
- [2026-03-09 21:10] [Sonnet] Exported getFleetStatusCounts() through supabaseService.ts SupabaseDb object
- [2026-03-09 21:10] [Sonnet] Updated useAssetDashboard.ts to fetch fleet counts via RPC in parallel, override total/rented_out/available from RPC while keeping client-side in_service/service_due logic

- [2026-03-09 05:39] [Sonnet] Updated Customers.tsx — server-side pagination with debounced search (50/page)
- [2026-03-09 05:39] [Sonnet] Updated customerService.ts — added getCustomersPage() with .range() and count:'exact'
- [2026-03-09 05:39] [Sonnet] Updated supabaseService.ts — re-exported getCustomersPage

- [2026-03-09 05:42] [Sonnet] Updated Customers.tsx — moved pagination above grid
- [2026-03-09 05:42] [Sonnet] Updated customerService.ts — search across all customer fields (phone, reg no, tax ID, credit term, contact person, notes)

- [2026-03-09 14:52] [Sonnet] Updated services/forkliftService.ts — added getForkliftsPage() with server-side search/filters, .range() + count:exact, enrichWithRentals() helper, getForkliftUniqueMakes() lightweight query
- [2026-03-09 14:52] [Sonnet] Updated pages/ForkliftsTabs/components/useFleetManagement.ts — replaced bulk getForkliftsWithCustomers()+getCustomers() with useQuery paginated fleet (50/page), lazy customer loading on modal open, queryClient.invalidateQueries replacing all loadData() calls
- [2026-03-09 14:52] [Sonnet] Updated pages/ForkliftsTabs/components/FleetTab.tsx — added pagination controls (Prev/Next, page X of Y), debounced search spinner
- [2026-03-09 14:53] [Sonnet] Fix services/forkliftService.ts — renamed enrichWithRentals Map type to Record<string,any> to allow monthly_rental_rate (not on Forklift type)

## 2026-03-09

[2026-03-09 14:55] [Sonnet] Perf: server-side customer search + lightweight dashboard queries — searchCustomers(), getCustomerById(), getForkliftsLightweightForDashboard(), Combobox onSearch mode, drop getCustomers() from forklift/customer profile hooks, targeted open-jobs + metrics queries in useAssetDashboard

[2026-03-09 15:04] [Sonnet] Perf optimization - files modified: customerService.ts, supabaseService.ts, forkliftService.ts, Combobox.tsx, AssignForkliftModal.tsx, ForkliftProfilePage.tsx, useForkliftData.ts, useCustomerData.ts, useAssetDashboard.ts, ServiceAdminDashboard.tsx, useQueryHooks.ts

## 2026-03-09 15:12 [Sonnet] Create Job customer search optimization
- Switched customer Combobox from useCustomersForList (2,147 rows) to useSearchCustomers (server-side, 20 per keystroke)
- Added getCustomerById for sidebar display instead of full list scan
- Files: pages/CreateJob/CreateJobPage.tsx, pages/CreateJob/hooks/useCreateJobForm.ts


## 2026-03-09 15:16 [Sonnet] Combobox debounce optimization
- Added 250ms debounce to onSearch (was firing Supabase query on every keystroke)
- Wrapped client-side filter in useMemo (was recomputing on every render)
- Files: components/Combobox.tsx

## 2026-03-09 23:27 [Sonnet] Asset Dashboard: forklift_no search
- Added forklift_no to ForkliftDashboardRow interface and DB select
- Added forklift_no to ForkliftDbRow and ForkliftWithStatus types  
- Added forklift_no to search filter in useAssetDashboard
- Files: services/forkliftService.ts, components/AssetDashboard/types.ts, components/AssetDashboard/hooks/useAssetDashboard.ts

## 2026-03-10 00:12 [Sonnet] Forklift UI improvements

[2026-03-10 00:12] [Sonnet] Updated ForkliftCard.tsx — show forklift_no alongside serial_number (format: "A928 · 8FD45N-11009" when exists)
[2026-03-10 00:12] [Sonnet] Updated ForkliftInfoCard.tsx — added admin-only edit button (Edit2 icon, top-right positioned)
[2026-03-10 00:12] [Sonnet] Updated ForkliftProfilePage.tsx — integrated AddEditForkliftModal with pre-filled form state for editing existing forklift
[2026-03-10 03:01] [Codex] Pulled latest main, upgraded /jobs card + list views with URL-persisted view mode and richer job metadata, expanded job-board search fields/selects, verified build/lint, and visually checked desktop/mobile layouts in Playwright

[2026-03-10 03:19] [Sonnet] Compact job cards rewrite + view toggle polish: JobCard.tsx, JobListRow.tsx, JobBoard.tsx
  - JobCard.tsx: Compacted from 298 to ~190 lines — Removed nested grids, verbose section headers (Customer/Site/Equipment/Scheduled/Assignee), placeholder text (Unassigned, Equipment not linked, No site, Open details), description paragraph, parts/media count; 3-row layout: badges → title+tech → inline customer · forklift · date; Kept accept/reject buttons, selection mode, status border colors
  - JobListRow.tsx: Cleaned up verbose placeholder text — Show dash (—) for missing data instead of explanatory text; Removed "Equipment not linked", "Unassigned", "No site" text
  - JobBoard.tsx: Improved view toggle to cohesive pill/segmented control — Changed Card/List from rounded-2xl to rounded-full, tighter bg-[var(--bg-subtle)] pill wrapper, active state gets bg-[var(--surface)] shadow-sm font-medium; Select button matches same compact rounded-full style
  - Build: ✅ Pass (✓ 2446 modules transformed, ✓ built in 3.91s)
[2026-03-10T19:30:18Z] [Phoenix] Code quality cleanup: removed unused currentUser prop from JobListRow/JobListTable, extracted EMPTY_SET constant. Mechanical deletion — no logic changes. Files: JobListRow.tsx, JobListTable.tsx, JobBoard.tsx
[2026-03-12 00:41] [Sonnet] Remove report buttons from technician view
- JobHeader.tsx: removed isTechnician from Report button condition
- JobDetailPage.tsx: added !roleFlags.isTechnician to View Report in mobile sticky bar
[2026-03-12 00:41] [Sonnet] Hide report from technician: JobHeader.tsx, JobDetailPage.tsx
[2026-03-12 00:44] [Sonnet] Mobile sticky bar: replaced Signatures button with Edit Job Details — JobDetailPage.tsx
[2026-03-12 00:50] [Sonnet] Fix edit job details quick action: immediate edit + autoFocus — JobDetailPage.tsx, JobDetailsCard.tsx
[2026-03-12 01:04] [Sonnet] Multi-photo + video upload: JobPhotosSection.tsx — sequential multi-file upload with progress, video support up to 50MB, play icon overlay, poster frame extraction
[2026-03-13 00:00] [Sonnet] fix: separate photo/video file inputs for mobile camera capture (JobPhotosSection.tsx)
[2026-03-13 00:06] [Sonnet] feat: camera capture in part request form — replace URL input with live camera, compress+upload to Supabase (CreateRequestModal.tsx)
[2026-03-13 00:29] [Sonnet] fix: Chrome compat — remove invalid CSS opacity modifier on sticky bar (JobDetailPage.tsx)
[2026-03-13 00:57] [Sonnet] feat: parts reconciliation modal — Admin 2 reconciles actual usage, restocks returns, then confirms. Files: PartsReconciliationModal.tsx, jobService.ts, ConfirmationStatusCard.tsx, useJobPartsHandlers.ts, useJobDetailState.ts, JobDetailPage.tsx, inventory.types.ts, supabaseService.ts, index.ts
[2026-03-13 01:01] [Sonnet] feat: duplicate job warning modal — shows existing job details with Continue/Cancel instead of blocking. Files: useCreateJobForm.ts, CreateJobPage.tsx, DuplicateJobWarningModal.tsx, types.ts
[2026-03-16 20:17] [Sonnet] fix: optional chaining for parts_used crash — StoreAdminDashboard.tsx, ServiceAdminDashboard.tsx

[2026-03-16 20:22] [Sonnet] fix: defensive defaults for parts_used/extra_charges in getJobs() — jobService.ts

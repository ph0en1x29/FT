# WORK_LOG.md — Multi-Agent Activity Log

Format: `[YYYY-MM-DD HH:MM] [Agent] Summary`

<!-- Entries before 2026-03-06 trimmed — see git history -->

## 2026-03-10

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

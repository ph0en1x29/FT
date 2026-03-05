# WORK_LOG.md — Multi-Agent Activity Log

Format: `[YYYY-MM-DD HH:MM] [Agent] Summary`

<!-- Entries before 2026-03-01 trimmed — see git history -->

- inventoryService: select only required columns in getAllVanStocks
[2026-02-28 01:58] [Sonnet] Fix liquid display: VanStockDetailModal.tsx TransferItemsModal.tsx show total liters (container_qty × container_size + bulk_qty). inventoryService.ts getAllVanStocks optimized to select only required columns.
[2026-02-28 01:59] [Sonnet] Fix TS errors from narrowed select: VanStockDetailModal.tsx TransferItemsModal.tsx inventoryService.ts — use unknown casts, fix technician reference

[2026-02-28 02:55] [Sonnet] Implemented stocktake workflow and batch tracing for FT inventory:
- Created StocktakeTab.tsx: physical count form with system qty, physical input, variance coloring (green/amber/red), reason dropdown, submit to stocktakes table, approve flow with no self-approval, adjustment movement logging, bulk_quantity update
- Updated TabNavigation.tsx: added 'stocktake' to TabType union
- Updated InventoryPageMain.tsx: added Stocktake tab (admin-only), expiry warning banner querying purchase_batches within 30 days, wired StocktakeTab component
- Updated liquidInventoryService.ts: receiveLiquidStock now captures batch_id from insert and stores as purchase_batch_id in inventory_movements; added batchLabel and expiresAt params
- Updated ReceiveStockModal.tsx: added optional Batch Label and Expiry Date fields

## 2026-02-28

### [Sonnet] Cost variance alert + adjustment approval workflow
- ReceiveStockModal: cost variance banner (>10% diff from avg_cost_per_liter)
- AdjustStockModal: new modal with reason codes, pending approval flow
- PendingAdjustmentsTab: approve/reject UI with no self-approval
- InventoryPageMain: Stock Adjustment button + Pending Adjustments tab
- TabNavigation: added pending-adjustments TabType
- inventory.types.ts: avg_cost_per_liter on Part, adjustment fields on InventoryMovement

### [Sonnet] [2026-02-28 02:57] Cost variance alert + adjustment approval workflow
Files: ReceiveStockModal.tsx, AdjustStockModal.tsx, PendingAdjustmentsTab.tsx, InventoryPageMain.tsx, TabNavigation.tsx, inventory.types.ts
- Cost variance banner in ReceiveStockModal when >10% from avg_cost_per_liter
- AdjustStockModal with part selector, +/- type, reason codes, pending approval flow
- PendingAdjustmentsTab with approve/reject, no self-approval rule
- Admin-only Stock Adjustment button + Pending Adjustments tab in InventoryPageMain

### [Sonnet] [2026-02-28 02:57] Additional files - liquidInventoryService.ts StocktakeTab.tsx inventory.types.ts TabNavigation.tsx
Files: liquidInventoryService.ts, StocktakeTab.tsx, inventory.types.ts, TabNavigation.tsx
Minor updates to support cost variance and adjustment workflow.

### [Sonnet] [2026-02-28 03:30] Audit Trail Phase 2 — stocktake, cost alerts, adjustment approval, batch tracing
Files: InventoryPageMain.tsx, InventoryLedgerTab.tsx, StocktakeTab.tsx, TabNavigation.tsx, VanLedgerTab.tsx, inventory.types.ts
- Wired StocktakeTab into inventory page with tab entry and URL validation
- Added expiry warning banner querying purchase_batches.expires_at
- Fixed StocktakeTab: removed GENERATED column insert, changed location_type to warehouse
- Added reversal/stocktake/van_transfer/job_usage/special_sale to ACTION_LABELS in both ledgers
- Added purchase_batch_id and reversal_of to InventoryMovement TypeScript types
- Added pending-adjustments to TabType union

[Sonnet 2026-02-28 21:17] Generalized InventoryLedgerTab, StocktakeTab, PendingAdjustmentsTab to work for all parts (liquid + solid). Removed is_liquid filters, updated qty calculations, unit display (L/pcs), and approval logic to update bulk_quantity vs stock_quantity based on part type.
[Sonnet 2026-02-28 21:18] InventoryLedgerTab.tsx, StocktakeTab.tsx, PendingAdjustmentsTab.tsx — generalized all three tabs to support solid parts. Removed is_liquid filters from parts queries, updated qty calculations to use container_qty_change for solid parts, added L/pcs unit display, and updated approval logic.

## [Subagent] 2026-02-28 23:57 EST
**Task:** Remove redundant ReceiveStockModal and MovementHistoryModal from inventory
**Files:** pages/InventoryPage/InventoryPageMain.tsx, pages/InventoryPage/components/PartsTable.tsx
**Changes:** Deleted obsolete modal components, cleaned imports/state/props/JSX from host files

[2026-02-28 23:56] [Sonnet] Cleanup: removed ReceiveStockModal and MovementHistoryModal references from InventoryPageMain.tsx and PartsTable.tsx — deleted redundant modal files, stripped onReceiveStock prop, history state, and related buttons.

## 2026-03-01

### [Sonnet] VanLedgerTab + FlaggedMovementsTab fixes
- Removed `.eq('is_liquid', true)` filter from VanLedgerTab part loading query
- Added `is_liquid?: boolean` to PartInfo interface
- Updated loadLedger: solid parts use `container_qty_change` (pcs), liquid use `cQty*containerSize+bQty` (L)
- Unit display in change/balance columns: "L" for liquid, "pcs" for solid
- FlaggedMovementsTab: updated empty state message
- FlaggedMovementsTab: formatQty uses total liters for liquid, pcs for solid
- FlaggedMovementsTab: added is_liquid to parts join and FlaggedMovementRow interface

## [Sonnet] [2026-03-01 00:46] VanLedgerTab FlaggedMovementsTab fixes
- VanLedgerTab.tsx: removed is_liquid filter, added is_liquid to PartInfo, solid/liquid qty logic
- FlaggedMovementsTab.tsx: updated empty state, formatQty for liquid/solid, is_liquid from parts join

[Sonnet] [2026-03-01 00:47] Fixed VanLedgerTab.tsx: removed is_liquid filter, added is_liquid to PartInfo, solid/liquid qty logic, unit display
[Sonnet] [2026-03-01 00:47] Fixed FlaggedMovementsTab.tsx: empty state message, formatQty for liquid/solid, is_liquid from parts join

[2026-03-01 21:14] [Sonnet] Multi-part approval for spare part requests:
- ApproveRequestModal.tsx: replaced single part picker with dynamic multi-row form (items array state, add/remove rows, each row has Combobox + qty input). onApprove prop now takes items array.
- jobRequestApprovalService.ts: approveSparePartRequest now accepts items array, reserves stock atomically for all items with full rollback on failure, inserts multiple job_parts rows, backward-compat first item in admin_response_part_id/quantity.
- useJobRequestActions.ts: handleApproveRequest passes items array; handleBulkApproveRequests wraps single-part in array.
- StoreQueuePage.tsx: updated inline approveSparePartRequest call to items array format.
[2026-03-01 21:14] [Sonnet] Also updated PartRequestsPage.tsx: wrap single-part approveSparePartRequest call in items array

## 2026-03-03 16:24 [Sonnet] null-safe toFixed for prices
- Fixed PartsTable.tsx: sell_price/cost_price .toFixed() crash when NULL
- Fixed useInventoryData.ts: same null-safe pattern for CSV export
- sell_price shows '—' when NULL, cost_price defaults to 0




[Sonnet] [2026-03-03 19:09] Fixed InventoryFilters.tsx: cap dropdown lg:w-48, truncate, min-w-0 for 37 categories overflow
[Sonnet] [2026-03-03 19:09] Fixed searchService.ts: stacked query chain semicolon typo on line 115

[Sonnet] [2026-03-03 21:40] Redesigned AddEditForkliftModal.tsx: new fields (forklift_no, customer_forklift_no, site, brand dropdown, current_date, last_service_date), updated form layout per client wireframe
[Sonnet] [2026-03-03 21:40] Updated useFleetManagement.ts: new initialFormData fields, handleEdit populates new fields, location→site migration
[Sonnet] [2026-03-03 21:40] Updated forklift.types.ts: ForkliftType enum (Battery/Electrical, Reach Truck, Others), FORKLIFT_BRANDS constant, Forklift interface new fields
[Sonnet] [2026-03-03 21:40] Rewrote ImportPartsModal.tsx: ACWER CSV format support, proper CSV parsing, batch upserts, audit trail, format auto-detection
[Sonnet] [2026-03-03 21:40] Fixed ForkliftCard.tsx: updated ForkliftType enum refs (ELECTRIC→BATTERY_ELECTRICAL, PETROL→OTHERS, added REACH_TRUCK)
[Sonnet] [2026-03-03 22:24] Fixed ServiceDueTab.tsx: read current_hourmeter from prediction view with fallback to hourmeter
[Sonnet] [2026-03-03 22:24] Fixed types.ts: added current_hourmeter to ForkliftDue interface
[Sonnet] [2026-03-03 23:24] Fixed AddEditForkliftModal.tsx + useFleetManagement.ts: year field optional (number|null), empty default, placeholder
[Sonnet] [2026-03-03 23:24] Updated AssignForkliftModal.tsx: added optional last service hourmeter field with service reset logic
[Sonnet] [2026-03-03 23:24] Updated FleetTab.tsx: pass lastServiceHourmeter props to AssignForkliftModal
[Sonnet] [2026-03-03 23:54] Updated ForkliftProfile/AssignForkliftModal.tsx: added optional last service hourmeter field with service reset logic
[Sonnet] [2026-03-03 23:54] Updated FleetTab.tsx: pass lastServiceHourmeter props
[Sonnet] [2026-03-03 23:54] Updated useFleetManagement.ts: lastServiceHourmeter state and reset logic
[Sonnet] [2026-03-03 23:57] Fixed AssignForkliftModal.tsx: hide last service hourmeter on bulk rent (isBulk guard)
[Sonnet] [2026-03-04 00:07] Rewrote BatchReceiveStockModal.tsx: search-based item selection, invoice/receipt upload to Supabase storage, fixed liquid stock display (container×size+bulk), container context for liquids
[Sonnet] [2026-03-04 00:07] Updated InventoryPageMain.tsx: removed parts prop from BatchReceiveStockModal (now self-contained)
[Sonnet] [2026-03-04 00:07] Created BulkServiceResetModal.tsx: post-bulk-rent service reset table for individual forklift hourmeter updates
[Sonnet] [2026-03-04 00:07] Updated FleetTab.tsx: render BulkServiceResetModal
[Sonnet] [2026-03-04 00:07] Updated useFleetManagement.ts: bulk service reset state + trigger after successful bulk rent
[Sonnet] [2026-03-04 00:10] Fixed vite.config.ts: removed JS/CSS from CacheFirst strategy, keep fonts only — fixes stale service worker cache on deploys
[Sonnet] [2026-03-04 00:20] Updated InventoryLedgerTab.tsx: added Purchase History view with 3-way toggle, batch grouping by PO/date, collapsible cards, invoice signed URL links
[Sonnet] [2026-03-04 00:26] Fixed InventoryLedgerTab.tsx: $ → RM currency, added purchase history search filter
[Sonnet] [2026-03-04 00:26] Fixed ImportPartsModal.tsx: $ → RM currency in cost preview

[Sonnet] [2026-03-04 01:29] pages/JobDetail/JobDetailPage.tsx
[Sonnet] [2026-03-04 01:29] pages/JobDetail/components/JobDetailModals.tsx
[Sonnet] [2026-03-04 01:29] pages/JobDetail/hooks/useJobActions.ts
[Sonnet] [2026-03-04 01:29] pages/JobDetail/hooks/useJobDetailState.ts

## 2026-03-05 14:24 [Sonnet] — SITE vs LOCATION separation
- types/forklift.types.ts: added site to ForkliftRental
- pages/ForkliftsTabs/components/AddEditForkliftModal.tsx: Site → Location label
- pages/ForkliftsTabs/components/AssignForkliftModal.tsx: added SITE input
- pages/ForkliftsTabs/components/FleetTab.tsx: wired rentalSite props
- pages/ForkliftsTabs/components/useFleetManagement.ts: rentalSite state + submit
- pages/ForkliftProfile/components/AssignForkliftModal.tsx: added SITE input
- services/rentalService.ts: site param, customer name → forklifts.site

## [2026-03-05 14:24] [Sonnet] SITE vs LOCATION separation
- AddEditForkliftModal.tsx: Site → Location label
- AssignForkliftModal.tsx: added SITE free-text input (both fleet + profile)
- FleetTab.tsx: wired rentalSite props
- useFleetManagement.ts: rentalSite state + submit logic
- rentalService.ts: site param, customer name → forklifts.site
- forklift.types.ts: added site to ForkliftRental

## [2026-03-05 14:31] [Sonnet] SITE vs LOCATION separation (commit)
- AddEditForkliftModal.tsx: Site → Location label
- AssignForkliftModal.tsx: added SITE free-text input (both fleet + profile)  
- FleetTab.tsx: wired rentalSite props
- useFleetManagement.ts: rentalSite state + submit logic
- rentalService.ts: site param, customer name → forklifts.site
- forklift.types.ts: added site to ForkliftRental

[Sonnet] [2026-03-05 14:31] SITE/LOCATION separation: AddEditForkliftModal.tsx AssignForkliftModal.tsx FleetTab.tsx useFleetManagement.ts rentalService.ts forklift.types.ts — renamed Site→Location, added SITE field to rental modal, auto-capture customer name

[Sonnet] [2026-03-05 14:42] Modal overflow fix + Edit Customer modal + Site field reorder: AssignForkliftModal.tsx (fleet+profile) EditCustomerModal.tsx CustomerProfilePage.tsx index.ts

[Sonnet] [2026-03-05 14:46] Fix RM currency + overflow: AssignForkliftModal.tsx (fleet+profile)

[Sonnet] [2026-03-05 14:47] Fix modal top clipping: AssignForkliftModal.tsx (fleet+profile)

[Sonnet] [2026-03-05 14:48] Fix bottom cutoff: AssignForkliftModal.tsx (fleet+profile)

[Sonnet] [2026-03-05 14:53] Filter forklifts by customer on Create Job: CreateJobPage.tsx

[Sonnet] [2026-03-05 14:59] Rent Out + Return buttons on forklift cards: ForkliftCard.tsx ForkliftGrid.tsx FleetTab.tsx useFleetManagement.ts

[Sonnet] [2026-03-05 15:44] Fix modal top clipping on mobile: AssignForkliftModal.tsx (fleet+profile) ReturnForkliftModal.tsx

[Sonnet] [2026-03-05 15:44] Return modal + modal fixes: ReturnForkliftModal.tsx AssignForkliftModal.tsx FleetTab.tsx useFleetManagement.ts ForkliftCard.tsx ForkliftGrid.tsx

[Sonnet] [2026-03-05 15:46] Fix forklift filter on Create Job: forkliftService.ts — add current_customer_id to getForkliftsForList select

[Sonnet] [2026-03-05 15:49] Fix modal layout pattern — proper scroll container: AssignForkliftModal.tsx (fleet+profile) ReturnForkliftModal.tsx

[Sonnet] [2026-03-05 15:52] Replace select with Combobox search LOV: AssignForkliftModal.tsx (fleet+profile)

[Sonnet] [2026-03-05 15:57] Desktop-friendly Rent modal layout: AssignForkliftModal.tsx

[Sonnet] [2026-03-05 15:57] Desktop layout improvements: AssignForkliftModal.tsx CreateJobPage.tsx ForkliftSelectionSection.tsx

[Sonnet] [2026-03-05 16:01] Redesign Create Job page layout: CreateJobPage.tsx ForkliftSelectionSection.tsx — clean 2-col grid, no decorative boxes, max-w-5xl

[Sonnet] [2026-03-05 16:05] Desktop 2-col layout for profile Rent modal: AssignForkliftModal.tsx (profile version)

[Sonnet] [2026-03-05 16:07] Add visual polish to Create Job page: CreateJobPage.tsx ForkliftSelectionSection.tsx — section headers with icons+color, amber forklift card, blue wrench header icon

[Sonnet] [2026-03-05 16:11] Fix blank space under Customer: ForkliftSelectionSection.tsx — info card spans full width, hourmeter inline

[Sonnet] [2026-03-05 16:15] Add context sidebar to Create Job page: CreateJobPage.tsx — customer info + active rentals panel fills side blank space

[Sonnet] [2026-03-05 16:18] Soften sidebar banner colors: CreateJobPage.tsx — desaturated customer+rentals headers

[Sonnet] [2026-03-05 16:19] Desktop-friendly Schedule Service modal: ScheduleServiceModal.tsx — 2-col grid, searchable Combobox, proper modal pattern

[Sonnet] [2026-03-05 16:20] Increase section banner visibility: CreateJobPage.tsx — amber-50→100, blue-50→100

[Sonnet] [2026-03-05 16:23] Change section banners to sky-200 azzurro: CreateJobPage.tsx

[Sonnet] [2026-03-05 16:25] Restructure Job Details layout — full-width fields, 3-col row: CreateJobPage.tsx

[Sonnet] [2026-03-05 16:26] Revert form banners to original, premium sidebar banners: CreateJobPage.tsx

[Sonnet] [2026-03-05 16:27] Desktop-friendly Return modal with rounded design: ReturnForkliftModal.tsx — 2-col grid, rounded-2xl, Combobox condition, amber accent

[Sonnet] [2026-03-05 16:31] Widen Job Detail page layout: JobDetailPage.tsx — max-w-7xl, xl:grid-cols-4 for better space usage

[Sonnet] [2026-03-05 16:41] Remove redundant sticky Start Job bar on mobile: JobDetailPage.tsx — JobHeader already has Start Job button

[Sonnet] [2026-03-05 16:47] Desktop-friendly Edit Forklift modal: AddEditForkliftModal.tsx — rounded-2xl, 3 sections, 3-4 col grids

[Sonnet] [2026-03-05 16:47] Technician dashboard improvements: TechnicianDashboard.tsx — Quick Actions + Weekly Summary

[Sonnet] [2026-03-05 16:48] Mobile-friendly technician dashboard: TechnicianDashboard.tsx — fix overflow, compact layout

[Sonnet] [2026-03-05 16:54] Equipment card mobile compact: EquipmentCard.tsx — 2-col grid on mobile, tighter spacing

[Sonnet] [2026-03-05 16:54] Camera-only photos with timestamp+location: JobDetailModals.tsx — remove gallery, add geolocation

[Sonnet] [2026-03-05 16:58] Edit Forklift modal sticky footer + compact: AddEditForkliftModal.tsx

[Sonnet] [2026-03-05 17:01] Edit Forklift modal size bump: AddEditForkliftModal.tsx — half-step larger inputs/labels/spacing

[Sonnet] [2026-03-05 17:04] Fleet filter dropdowns to Combobox: ForkliftFilters.tsx — searchable LOV for Type/Status/Rental/Make

[Sonnet] [2026-03-05 17:06] Edit Customer modal desktop-friendly: EditCustomerModal.tsx — rounded-2xl, 2-col, sticky footer, sections

[Sonnet] [2026-03-05 17:08] Combobox compact mode + liquid glass filters: Combobox.tsx ForkliftFilters.tsx

[Sonnet] [2026-03-05 17:10] Compact Combobox visibility fix: Combobox.tsx — stronger border + opacity

[Sonnet] [2026-03-05 17:13] Compact Combobox dropdown min-width fix: Combobox.tsx — prevent text wrapping

[Sonnet] [2026-03-05 17:15] Inventory filters to compact Combobox: InventoryFilters.tsx — liquid glass dropdowns

[Sonnet] [2026-03-05 17:16] Filter overflow fix: ForkliftFilters.tsx InventoryFilters.tsx Combobox.tsx — grid layout + tighter dropdown

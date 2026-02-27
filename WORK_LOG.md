# WORK_LOG.md — Multi-Agent Activity Log

Format: `[YYYY-MM-DD HH:MM] [Agent] Summary`

---

[2026-02-16 11:30] [Phoenix] Initialized multi-agent workflow. Created SHARED_CONTEXT.md and WORK_LOG.md.

[2026-02-16 13:54] [Codex] Refactored StoreQueue approvals into job-grouped accordion cards (collapsed by default), added per-job Approve All sequencing, kept item-level approve/reject/confirm flows, and validated with npm run build.

[2026-02-17 22:11] [Codex] Implemented Feature #4 mobile bottom sheet modal primitives in `components/mobile/BottomSheet.tsx` (mobile sheet + desktop fallback modal) and verified with npm run build.

[2026-02-18 00:10] [Codex] Implemented Feature #3 standalone mobile filter wrapper in `components/mobile/FilterSheet.tsx` (mobile Filters button + active badge + BottomSheet, desktop inline children) and verified with npm run build.

[2026-02-18 00:52] [Codex] Fixed AdminDashboardV7_1 low-stock race by removing getGlobalLowStockCount call/import, kept low-stock list scroll container at max-h-[220px] overflow-y-auto, aligned getGlobalLowStockCount predicate to min > 0 && quantity < min, and verified with npm run build.

[2026-02-18 01:01] [Codex] Updated AdminDashboardV7_1 low-stock card to query parts (global inventory), align threshold/default handling to inventory semantics, include out-of-stock in low-stock totals/list, and validated with npm run build.

[2026-02-18 13:05] [Codex] Read SHARED_CONTEXT.md/WORK_LOG.md, checked git status, and confirmed multi-agent setup roles.

[2026-02-19 14:50] [Codex] Updated docs/PROJECT_STRUCTURE.md for Feb 2026 current state: refreshed Last Updated date, added components/mobile section + mobile component descriptions, updated hooks/contexts, and expanded pages directory table with missing entries.
[2026-02-19 14:50] [Codex] Updated `docs/USER_GUIDE.md` with Feb 17-18 features (Command Palette, mobile bottom navigation, FAB, pull-to-refresh, swipe actions, PWA install, dark mode), plus new TOC entry and What’s New additions.

[2026-02-19 15:50] [Codex] Added GitHub Actions CI workflow at .github/workflows/ci.yml (push/pull_request on main, Node 20, node_modules cache, npm ci, npm run build, Playwright chromium smoke step), replaced tests/smoke.spec.ts with minimal homepage title check against ft-kappa.vercel.app, and updated playwright.config.ts to skip local webServer when running that smoke spec.

[2026-02-19 23:38] [Codex] Restored missing Playwright critical-path specs/fixture from local git history and refactored 4 critical-path tests to use shared auth fixture functions (removed inline login/openRoute helpers and test.use baseURL, switched route navigation to direct HashRouter paths).

[2026-02-20 07:26] [Codex] Added a delegation guard to .husky/pre-commit that blocks Phoenix from committing staged .ts/.tsx/.css/.sql files, prints red violation warnings, and preserves existing typecheck/build checks.
[2026-02-23 03:19] [Codex] Fixed StoreQueue part-select Combobox layering by adding overflow/stacking classes in StoreQueuePage and raising Combobox dropdown z-index to z-[100], then verified with npm run build.
[2026-02-23 03:24] [Codex] Updated components/mobile/SwipeableRow.tsx root wrapper overflow classes to overflow-x-clip overflow-y-visible to prevent Combobox dropdown clipping while preserving horizontal swipe clipping, then verified with npm run build.

[2026-02-23 03:29] [Codex] Added overflow-visible to StoreQueue approvals group card, expanded items wrapper, and item card containers to stop Combobox dropdown clipping; verified with npm run build.
[2026-02-23 03:30] [Codex] Updated AGENTS.md Lessons Learned with Combobox ancestor-overflow clipping prevention rule after user correction.

[2026-02-23 03:34] [Codex] Rewrote components/Combobox.tsx dropdown to render via createPortal at document.body with fixed-position recalculation on open/scroll/resize, outside-click handling across input+portal refs, preserved search/add/select/subLabel behavior, and verified with npm run build.

[2026-02-23 10:41] [Codex] Updated start-job checklist toggle in pages/JobDetail/hooks/useJobActions.ts to tri-state cycle (true/ok -> not_ok -> true, with undefined/falsy -> true) so Check All unticks map to not_ok.

[2026-02-23 10:41] [Codex] Updated StartJobModal checklist rows in pages/JobDetail/components/JobDetailModals.tsx: replaced native checkbox inputs with tap-to-toggle state rows (green check/red X/muted dash), added red-highlighted styling for not_ok items, and updated helper text instructions.
[2026-02-23 10:49] [Codex] Added `addPartQuantity` state to `pages/JobDetail/hooks/useJobDetailState.ts` and exposed it in the returned state object immediately after selectedPartPrice.
[2026-02-23 10:49] [Codex] Updated pages/JobDetail/hooks/useJobPartsHandlers.ts handleAddPart to use parsed add-part quantity, block non-positive quantity with Invalid quantity toast, pass quantity to addPartToJob, and reset addPartQuantity to "1" after successful add.

[2026-02-23 10:50] [Codex] Updated `pages/JobDetail/components/PartsSection.tsx` to add Add Part quantity props/input (with decimal input mode), and added `inputMode="decimal"` to the van stock quantity input.
[2026-02-23 10:51] [Codex] Updated pages/JobDetail/JobDetailPage.tsx PartsSection call to pass addPartQuantity and onAddPartQuantityChange from state.
[2026-02-24 22:47] [Sonnet] Added dual-unit fields to Part and VanStockItem interfaces in types/inventory.types.ts
[2026-02-24 22:47] [Sonnet] Created database/migrations/20260225_dual_unit_inventory.sql - dual-unit columns, inventory_movements table, data migration
[2026-02-24 22:47] [Sonnet] Added InventoryMovement type, LIQUID_KEYWORDS, isLikelyLiquid() to types/inventory.types.ts
[2026-02-24 22:47] [HOOK] Emergency bypass used by Phoenix
[2026-02-24 22:55] [Sonnet] Created services/liquidInventoryService.ts - full dual-unit operations (purchase, break, sell external, use internal, van transfer/return/use, audit trail)
[2026-02-24 22:55] [Sonnet] Updated services/partsService.ts - added liquid fields to createPart, expanded getPartsForList select
[2026-02-24 22:55] [HOOK] Emergency bypass used by Phoenix
[2026-02-24 23:06] [Sonnet] Updated AddPartModal.tsx - liquid detection banner, liquid fields section (base unit, container type, container size, sealed qty, loose qty, price per unit summary)
[2026-02-24 23:06] [Sonnet] Updated useInventoryData.ts - liquid fields in form data, liquid-aware stats and filters
[2026-02-24 23:06] [Sonnet] Updated PartsTable.tsx - dual-unit stock display using formatStockDisplay()
[2026-02-24 23:06] [Sonnet] Updated VanStockDetailModal.tsx, TransferItemsModal.tsx, StockItemCard.tsx, VanStockPageMain.tsx - liquid-aware displays
[2026-02-24 23:06] [Sonnet] Updated InventoryPageMain.tsx - stock mismatch alert banner for liquid items
[2026-02-24 23:06] [HOOK] Emergency bypass used by Phoenix
[2026-02-24 23:10] [Sonnet] Updated jobInvoiceService.ts addPartToJob - liquid-aware stock deduction with useInternalBulk, fallback to legacy
[2026-02-24 23:10] [Sonnet] Updated useJobPartsHandlers.ts - liquid-aware van stock check and useVanBulk for liquid items
[2026-02-24 23:10] [HOOK] Emergency bypass used by Phoenix
[2026-02-25 00:51] [Sonnet] Added transfer/return buttons to VanStockDetailModal for liquid items
[2026-02-25 00:51] [Sonnet] Added sellSealed toggle to PartsSection + jobInvoiceService + useJobDetailState + useJobPartsHandlers
[2026-02-25 00:51] [Sonnet] Created MovementHistoryModal component + wired into PartsTable with History icon
[2026-02-25 00:51] [HOOK] Emergency bypass used by Phoenix
[2026-02-25 16:47] [HOOK] Emergency bypass used by Phoenix
[2026-02-25 17:00] [HOOK] Emergency bypass used by Phoenix
[2026-02-26 20:22] [Sonnet] Fixed hourmeter completion validation in useJobActions.ts — changed <= to < so equal readings allowed (forklift not used/broken). Error message updated to "Hourmeter reading cannot be lower than the start reading".
[2026-02-26 21:05] [Sonnet] Fixed sticky bar hiding when modals open (hasModalOpen flag), added pb-32 to modal scrollable content, modal action buttons no longer cramped against nav bar.
[2026-02-26 21:05] [Sonnet] Updated JobBoard.tsx, JobCard.tsx, JobDetailPage.tsx, ConditionChecklistCard.tsx, JobDetailModals.tsx — sticky bar hides on modal open, modal scroll padding fix.
[2026-02-26 21:10] [Sonnet] Moved mobile action bar from bottom-16 to top-16 in JobDetailPage.tsx, added pt-16 md:pt-0 to content container.
[2026-02-26 21:22] [Sonnet] Fixed Combobox dropdown flip-upward when near viewport bottom in Combobox.tsx. Moved Toaster position to top-center in AuthenticatedApp.tsx.
[2026-02-26 21:32] [Sonnet] Fixed ConfirmationStatusCard.tsx mobile overflow — stacked label/badge vertically, shrink-0 on status. Fixed ConditionChecklistCard.tsx checklist grid single-column mobile, break-words on labels. Fixed CreateJobPage.tsx job type/priority to use Combobox. Removed closeButton from Toaster in AuthenticatedApp.tsx.
[2026-02-26 21:39] [Sonnet] Fix: switch signatures from signed URLs to public URLs in jobMediaService.ts and supabaseClient.ts
[2026-02-26 21:42] [Sonnet] Fixed conditional pt-16 padding in JobDetailPage.tsx — only applies when action bar is visible, removing empty gap on awaiting_finalization status.

[2026-02-26 21:46] [Sonnet] Created CollapsibleCard.tsx accordion component with smooth height animation. Updated index.ts to export it. Fixed ConditionChecklistCard.tsx read-only grid overflow (grid-cols-1 sm:grid-cols-2 md:grid-cols-3, overflow-hidden, shrink-0, break-words). Updated JobDetailPage.tsx to wrap Confirmation/Notes/Checklist/Parts/Photos in CollapsibleCard with mobile/desktop defaultOpen logic.
[2026-02-26 21:48] [Sonnet] Removed redundant sticky status pill and blank gap in JobDetailPage.tsx — cleaned up conditional pt-16 padding.
[2026-02-26 21:50] [Sonnet] Fixed Call button alignment in CustomerAssignmentCard.tsx — moved below customer name as standalone pill, removed justify-between float.
[2026-02-26 21:57] [Sonnet] Fixed NotesSection.tsx and JobPhotosSection.tsx — technicians can now add notes and upload photos on completed jobs.
[2026-02-26 21:57] [Sonnet] Fixed missing isCompleted destructure in JobPhotosSection.tsx (TypeScript error from prior agent).
[2026-02-26 21:59] [Sonnet] Reverted photo upload on completed jobs in JobPhotosSection.tsx — only notes allowed after completion.
[2026-02-26 22:14] [Sonnet] Added job_number (JOB-YYYYMMDD-XXXX) — DB trigger, backfill, badge in JobCard.tsx and JobHeader.tsx, search in useJobFilters.ts and SearchFilterBar.tsx.
[2026-02-26 22:14] [Sonnet] Created database/migrations/add_job_number.sql — job_number column, generate_job_number() function, BEFORE INSERT trigger, backfill existing jobs.
[2026-02-26 22:16] [Sonnet] Added job_number to JOB_SELECT.LIST and JOB_SELECT.BOARD in supabaseClient.ts so job cards fetch and display the field.
[2026-02-26 22:18] [Sonnet] Made job_number badge prominent in JobCard.tsx — blue pill, text-xs, font-mono, top of card.
[2026-02-26 22:23] [Sonnet] Restyled job number badge in JobCard.tsx — subtle pill with accent text, light bg, thin border instead of heavy blue.
[2026-02-26 22:26] [Sonnet] Matched job number badge style on JobCard.tsx to JobHeader.tsx — blue-50 bg, blue-600 text, blue-200 border, consistent across card and detail views.
[2026-02-27 01:59] [Sonnet] Created DB tables: purchase_batches and added reference_number to inventory_movements via Supabase API.
[2026-02-27 01:59] [Sonnet] Added receiveLiquidStock() to services/liquidInventoryService.ts — inserts purchase_batches, updates parts.bulk_quantity + container_quantity, logs inventory_movements with movement_type='purchase'.
[2026-02-27 01:59] [Sonnet] Created pages/InventoryPage/components/ReceiveStockModal.tsx — modal with container qty, size, auto total liters, total price, auto cost/liter, PO ref, notes fields.
[2026-02-27 01:59] [Sonnet] Updated pages/InventoryPage/components/PartsTable.tsx — added onReceiveStock prop, PackagePlus button for liquid parts (desktop + mobile).
[2026-02-27 01:59] [Sonnet] Updated pages/InventoryPage/InventoryPageMain.tsx — wired ReceiveStockModal with receiveStockPart state and loadParts refresh on success.
[2026-02-27 01:59] [Sonnet] Updated pages/JobDetail/components/PartsSection.tsx — added selectedPartIsLiquid prop, conditional decimal input with 'L' label for liquid parts.
[2026-02-27 01:59] [Sonnet] Updated pages/JobDetail/JobDetailPage.tsx — compute selectedPartIsLiquid from parts array, pass to PartsSection.
[2026-02-27 01:59] [Sonnet] Added database/migrations/liquid_inventory_phase1.sql — migration file for liquid inventory phase 1.
[2026-02-27 01:59] [Sonnet] Created pages/InventoryPage/components/InventoryLedgerTab.tsx — ledger tab for inventory movements.
[2026-02-27 01:59] [Sonnet] Updated pages/InventoryPage/components/TabNavigation.tsx — tab navigation updates.
[2026-02-27 01:59] [Sonnet] Updated pages/JobDetail/hooks/useJobPartsHandlers.ts — parts handler hook updates.
[2026-02-27 01:59] [Sonnet] Updated pages/VanStockPage/VanStockPageMain.tsx — van stock page main updates.
[2026-02-27 01:59] [Sonnet] Created pages/VanStockPage/components/VanLedgerTab.tsx — van ledger tab component.
[2026-02-27 01:59] [Sonnet] Updated pages/VanStockPage/components/index.ts — component exports update.

[2026-02-27 01:55] [Sonnet] Built Phase 1 liquid inventory ledger views: InventoryLedgerTab (warehouse per-fluid running balance with purchase/transfer/usage/sale, green/red color coding), VanLedgerTab (per-van/part ledger with amber negative balance row highlight), added Ledger tab to InventoryPageMain and VanStockPageMain sub-tabs. Updated useVanBulk in liquidInventoryService to allow negative balance (returns balanceOverride flag instead of throwing). Job usage handler shows warning toast on negative van balance. Build verified.
[2026-02-27 02:52] [Sonnet] Phase 1 liquid inventory: purchase_batches schema extended, avg_cost_per_liter function, inventory_movements columns (reference_number, unit_cost_at_time, total_cost, forklift_id), parts columns (avg_cost_per_liter, last_purchase_cost_per_liter). ReceiveStockModal, InventoryLedgerTab, VanLedgerTab built. + buttons replaced with decimal inputs on liquid parts.
[2026-02-27 02:52] [Sonnet] Fixed liquid_inventory_phase1.sql migration — removed organization_id references, split enum additions to separate transactions.

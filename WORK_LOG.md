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

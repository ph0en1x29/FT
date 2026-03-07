# Inventory Load Investigation — 2026-03-07

## Scope

Investigated why the Inventory page felt slower than expected on first load and applied the lowest-risk performance improvements that do not change inventory behavior.

## Root Cause

The delay was coming from two separate layers:

### 1. Too much inactive UI code was bundled into the first Inventory render

`InventoryPageMain.tsx` was statically importing several large components even when the user opened only the default `Parts Catalog` tab.

The biggest eager-loaded modules were:

- `ImportPartsModal.tsx` — 784 lines
- `InventoryLedgerTab.tsx` — 660 lines
- `BatchReceiveStockModal.tsx` — 483 lines
- `StocktakeTab.tsx` — 449 lines
- `AddPartModal.tsx` — 360 lines
- `PendingAdjustmentsTab.tsx` — 278 lines

That meant the first inventory visit paid for:

- admin-only tools
- secondary tabs
- closed modals

even though none of them were visible yet.

### 2. The parts catalog still fetches the full parts dataset before the main list renders

`useInventoryData()` calls `SupabaseDb.getParts()`, which pages through the entire `parts` table in batches of 1000 rows until everything is loaded.

This is correct for completeness, but it means first-load time depends on:

- network speed
- total part count
- the size of the selected part payload

### 3. Some catalog-wide counts were recomputed repeatedly on render

The page was re-filtering the full parts list multiple times for low-stock and liquid-mismatch alerts, which added extra client-side work once the data arrived.

## Fixes Applied

### Dashboard route

- `DashboardPreviewV4.tsx` now lazy-loads each role dashboard so users only download the dashboard code for their own role.

### Inventory route

- Lazy-loaded these non-initial inventory tabs:
  - `VanStockPage`
  - `ReplenishmentsTab`
  - `InventoryLedgerTab`
  - `PendingAdjustmentsTab`
  - `StocktakeTab`
- Lazy-loaded these closed-by-default inventory modals:
  - `AddPartModal`
  - `ImportPartsModal`
  - `BatchReceiveStockModal`
  - `AdjustStockModal`
- Memoized:
  - low-stock count
  - liquid mismatch count
  - existing part code list for import modal
- Replaced the old `getParts()` first-load path on the default parts tab with:
  - paginated parts queries
  - cached React Query results
  - server-side search/category/out-of-stock filtering
  - on-demand full export queries only when the user explicitly exports

## Build Evidence

After the change, the build emits separate chunks for previously eager-loaded inventory/dashboard code, including:

- `AdminDashboard-*.js`
- `ServiceAdminDashboard-*.js`
- `StoreAdminDashboard-*.js`
- `TechnicianDashboard-*.js`
- `InventoryLedgerTab-*.js`
- `ImportPartsModal-*.js`
- `BatchReceiveStockModal-*.js`
- `StocktakeTab-*.js`
- `PendingAdjustmentsTab-*.js`

That confirms the route no longer downloads all of that code up front.

The parts tab also no longer depends on a full `parts` table fetch before it can render the first page.

## What This Improves

- Faster first dashboard load per role
- Faster first inventory load for the default `Parts Catalog`
- Less JS parsing/execution before the user can use the main inventory screen
- Better scaling as role dashboards and inventory admin tools continue to grow

## What Still Limits Inventory Speed

The main remaining bottleneck is now the metadata side, not the first-page catalog render.

What still scans the full parts table in lightweight form:

- category list building
- global inventory stats
- low-stock filtering, because the current low-stock rule depends on per-row `min_stock_level` and liquid quantity math

Those are much lighter than the old full detailed fetch, but they are still not ideal for very large datasets.

## Recommended Next Step

If inventory still feels slow after this pass, the next improvement should be data-path focused:

1. Add a database-side low-stock/search endpoint or RPC so low-stock filtering can be fully server-side
2. Add aggregated stats/category endpoints so metadata does not require client-side scans
3. Keep the current paginated/cached query model for the visible parts catalog

## Verification

- `npm run typecheck` passed
- `npm run build` passed
- `npm run lint` passed with existing repo warnings only

# FT Codifica Spec

## Project
FieldPro FSM — React + TypeScript + Vite + Supabase + Tailwind

## Key Constraints
- Build: `npm run build` must pass before any commit
- Supabase column names: always verify against actual DB schema (not assumptions)
- `van_stocks` has `van_status` NOT `status`, `technician_id` NOT `technician_name`
- Jobs use soft-delete (`deleted_at`): all list queries MUST filter `.is('deleted_at', null)`
- Inventory movements are immutable: DELETE trigger blocks removal, UPDATE only allows approval fields
- Liquid display: liters only (formatStockDisplay)
- inlineState format: arrays of `[{partId, quantity}]` not single objects

## File Ownership
- `services/` — backend logic, Supabase queries
- `pages/` — UI components, hooks
- `types/` — shared TypeScript interfaces

## Active Decisions
- Van plate = required, van code = optional
- Multi-part approval: admin adds multiple items per request
- Ledger: searchable LOV + recent activity default view

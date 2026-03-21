# AGENTS.md — FieldPro Agent Config

## Pre-Work

1. Read `codifica-spec.md` if it exists — column gotchas, soft-delete rules, state formats.
2. `grep -ri "keyword" .learnings/` for related past issues.
3. Check DB schema before assuming column names.

## Code Rules

- **Build must pass** before commit: `npm run build`
- **Conventional commits**: `fix:`, `feat:`, `chore:`, `docs:`
- **After code changes**: CHANGELOG.md → USER_GUIDE.md (if user-facing) → commit → push
- **Migrations**: `database/migrations/YYYYMMDD_description.sql`, use IF NOT EXISTS, include RLS policies
- **RPC functions**: SECURITY DEFINER with explicit `search_path = public`
- **No raw DELETEs**: Soft delete with `is_active = false`

## DB Access

```bash
source ~/clawd/.credentials/supabase-ft.env && curl -s -X POST \
  "https://api.supabase.com/v1/projects/dljiubrbatmrskrzaazt/database/query" \
  -H "Authorization: Bearer $SUPABASE_MANAGEMENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR SQL HERE"}'
```

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | dev@test.com | Dev123! |
| Supervisor | super1234@gmail.com | Super123! |
| Technician | tech1@example.com | Tech123! |
| Accountant | accountant1@example.com | Account123! |

## Key Tables

- `customers` — client companies
- `customer_sites` — site addresses (geocoding planned: latitude/longitude columns)
- `customer_contacts` — PICs per customer
- `forklifts` — equipment records, `forklift_no` unique constraint
- `jobs` — service jobs, linked to customer + site + forklift + technician
- `job_parts` — parts used per job, `sell_price_at_time` NOT NULL
- `parts` — inventory, `sell_price` often null (use `cost_price` fallback)
- `van_stocks` / `van_stock_items` — technician van inventory
- `inventory_movements` — immutable audit trail, reversal-only
- `purchase_batches` — cost tracking, expiry, batch labels
- `users` — all roles, `is_active` flag

## Known Gotchas

- `van_stocks` has NO `technician_name` column — join via `technician_id → users.full_name`
- `customer_forklift_no` is on the forklift record, not the customer
- `sell_price` is null for 97% of parts — always use `sell_price ?? cost_price ?? 0`
- Empty string dates crash Postgres — sanitize `''` → `null` for timestamptz columns
- TypeScript types ≠ Supabase schema — verify actual DB columns before coding
- Pre-commit hook requires WORK_LOG.md entry with `[Codex]` or `[Sonnet]` tag (bypass with `--no-verify` if running as agent)

## Live Site

- **URL**: ft-kappa.vercel.app
- **Deploy**: `git push` → Vercel auto-deploys. Do NOT run `npx vercel --prod`.

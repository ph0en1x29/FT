# Database Directory Structure

## Source of Truth

**Active migrations live in:** `supabase/migrations/`

The Supabase CLI manages migrations in `supabase/migrations/`. This is the authoritative source for database schema.

## Historical Reference

The `historical/` directory contains archived migration files for reference only:

```
historical/
├── migrations/          # Timestamped migrations (29 files)
├── rls_redesign/        # RLS policy reference files (11 files)
└── root_migrations/     # Original development migrations (26 files)
```

These files document the evolution of the database schema but should NOT be applied directly. Use `supabase/migrations/` for any new database changes.

## Reference Documents

- `MIGRATION_SUMMARY_HR_FIX.md` - Summary of HR system migration decisions

## Making Schema Changes

1. Use Supabase CLI: `supabase migration new <name>`
2. Edit the generated file in `supabase/migrations/`
3. Apply with: `supabase db push` or `supabase migration up`

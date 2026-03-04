# Contributing to FieldPro

## Before You Start

> **Before starting any changes, have a thorough discussion and confirm the client needs. Recheck before making new changes so things run smoothly.**

Read these first:
1. [Development Process](./docs/DEVELOPMENT_PROCESS.md) — Golden rules and checklists
2. [Changelog](./docs/CHANGELOG.md) — Current status and recent decisions
3. [Workflow Specification](./docs/WORKFLOW_SPECIFICATION.md) — ACWER implementation spec

## Development Setup

```bash
git clone https://github.com/ph0en1x29/FT.git
cd FT
npm install
cp .env.example .env.local   # Fill in Supabase credentials
npm run dev
```

## Code Standards

- **TypeScript** — Strict mode, no `any` types without justification
- **Tailwind CSS** — Utility-first, no custom CSS files for components
- **Supabase queries** — Select specific columns (no `select('*')`), use `.limit()`, parallelize with `Promise.all()`
- **Components** — Functional components with hooks, co-located types
- **Naming** — PascalCase components, camelCase functions/variables, snake_case DB columns

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add purchase history view
fix: currency $ → RM in inventory
docs: update CHANGELOG for v1.4.0
chore: bump dependencies
```

## Pre-Commit Checks

A Husky pre-commit hook runs automatically:
- TypeScript build check (`npm run build`)
- Delegation verification (code changes must have WORK_LOG entry)

## Pull Request Process

1. Create a feature branch from `main`
2. Make changes, ensure `npm run build` passes
3. Update CHANGELOG.md if user-facing
4. Update USER_GUIDE.md if workflow changes
5. Open PR with clear description of changes

## Architecture Notes

- **Single-tenant** — One Supabase project per client deployment
- **RLS** — All tables have Row Level Security; policies use `auth.uid() IS NOT NULL`
- **Role enforcement** — App layer checks `users.role` for page/action access
- **Inventory** — Dual-unit system: parts (discrete) + liquids (volume in liters)
- **Audit trail** — All inventory movements are immutable (DB trigger blocks UPDATE/DELETE)

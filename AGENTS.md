# AGENTS.md - FieldPro Agent Guidelines

This file guides AI agents working on this codebase.

## Quick Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build (MUST pass before commit)
npm run typecheck    # TypeScript check only
npm run lint         # TypeScript + ESLint
npm test             # Run all Playwright tests
npm run test:smoke   # Quick smoke tests only
```

## Before Every Commit

1. `npm run build` must pass
2. `npm run lint` must pass
3. Update `docs/CHANGELOG.md` with changes
4. Update `docs/USER_GUIDE.md` if user-facing
5. Update `docs/PROJECT_STRUCTURE.md` if architecture changed

## Project Structure

- `/src/components/` - React components
- `/src/pages/` - Page-level components
- `/src/hooks/` - Custom React hooks
- `/src/lib/` - Utilities, Supabase client, types
- `/src/lib/types.ts` - TypeScript types
- `/tests/` - Playwright E2E tests
- `/docs/` - Documentation

## Database

- **Supabase** hosted PostgreSQL
- Types in `/src/lib/types.ts`
- Client in `/src/lib/supabase.ts`
- **DO NOT** use raw SQL in components - use typed queries
- RPC functions defined in Supabase dashboard

## Common Mistakes to Avoid

1. **Don't skip build verification** - Always run `npm run build` after changes
2. **Don't forget RLS policies** - Every table needs policies when RLS enabled
3. **Don't use `any` type** - Use proper TypeScript types
4. **Don't create duplicate utilities** - Check `/src/lib/` first
5. **Don't hardcode IDs** - Use constants or fetch from DB
6. **Don't modify DB schema without migration docs** - Update `docs/DB_SCHEMA.md`

## Key Files for Context

- `docs/CHANGELOG.md` - Recent changes
- `docs/USER_GUIDE.md` - Feature documentation
- `docs/DB_SCHEMA.md` - Database structure
- `docs/PROJECT_STRUCTURE.md` - Architecture overview

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | dev@test.com | Dev123! |
| Supervisor | super1234@gmail.com | Super123! |
| Technician | tech1@example.com | Tech123! |
| Accountant | accountant1@example.com | Account123! |

## Running Specific Tests

```bash
npx playwright test tests/smoke.spec.ts           # Smoke tests
npx playwright test tests/hourmeter-amendment.spec.ts  # Hourmeter tests
npx playwright test --headed                      # Visual mode
npx playwright show-report                        # View last results
```

## Code Style

- Functional components with hooks
- TanStack Query for data fetching
- Tailwind CSS for styling
- Keep components under 300 lines when possible
- Extract reusable logic to hooks

## When Stuck

1. Check existing similar components for patterns
2. Read the TypeScript types in `/src/lib/types.ts`
3. Look at test files for expected behavior
4. Check `docs/` for business logic documentation

---

## Self-Improvement Rule (Boris Cherny Pattern)

**After ANY correction from Jay or a failed build:**

1. Fix the issue
2. End with: "Updating AGENTS.md so I don't make this mistake again."
3. Add a new entry to "Common Mistakes to Avoid" or "Lessons Learned"

Claude is good at writing rules for itself. Keep this file evolving.

## Lessons Learned

*(Add entries here after mistakes - date + what went wrong + prevention)*

| Date | Mistake | Prevention |
|------|---------|------------|
| 2026-02-06 | Initial setup | Follow pre-commit hooks |

## Quality Prompts (Use These)

Before committing:
- "Grill me on these changes. Don't commit until I pass your review."
- "Prove to me this works. Show me test output or diff main vs this branch."

When output is mediocre:
- "This is not good enough. Give me a better solution."
- "What would a staff engineer change about this?"

For complex tasks:
- Start with: "Let's plan this first before writing code."
- Use subagents: Append "use subagents" to throw more compute at the problem.

## End-of-Session Checklist

Run before ending any session:
1. `/techdebt` - Check for duplicated code, dead code, TODOs
2. `npm run build` - Verify everything compiles
3. `git status` - No uncommitted changes
4. Update CHANGELOG.md if changes made

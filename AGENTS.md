# AGENTS.md - FieldPro Agent Guidelines

**⚠️ READ `SHARED_CONTEXT.md` FIRST** — Multi-agent coordination rules.
**⚠️ CHECK `WORK_LOG.md`** — See what other agents did recently.
**⚠️ CHECK `git status`** — Before touching any files.

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

**No `src/` directory — everything at project root!**

- `/pages/` — Page-level components (each feature = subfolder)
- `/components/` — Shared React components
- `/services/` — Supabase service layer (inventoryService.ts, jobService.ts, etc.)
- `/types/` — TypeScript types (job-core.types.ts, user.types.ts, etc.)
- `/hooks/` — Shared custom React hooks
- `/utils/` — Utility functions
- `/tests/` — Playwright E2E tests
- `/docs/` — Documentation
- `/database/migrations/` — SQL migration files
- `/.claude/skills/` — Claude Code skills (/ft-review, /ft-deploy, /ft-test)
- `/.claude/agents/` — Claude Code subagents (ft-reviewer, ft-planner)

## Database

- **Supabase** hosted PostgreSQL
- Types in `/types/*.types.ts`
- Client in `/services/supabaseClient.ts`
- **DO NOT** use raw SQL in components - use typed queries
- RPC functions defined in Supabase dashboard

## Common Mistakes to Avoid

1. **Don't skip build verification** - Always run `npm run build` after changes
2. **Don't forget RLS policies** - Every table needs policies when RLS enabled
3. **Don't use `any` type** - Use proper TypeScript types
4. **Don't create duplicate utilities** - Check `/utils/` and `/services/` first
5. **Don't hardcode IDs** - Use constants or fetch from DB
6. **Don't modify DB schema without migration docs** - Update `docs/DB_SCHEMA.md`

## Key Files for Context

- `docs/CHANGELOG.md` - Recent changes
- `docs/USER_GUIDE.md` - Feature documentation
- `docs/DB_SCHEMA.md` - Database structure
- `docs/PROJECT_STRUCTURE.md` - Architecture overview

## UI Patterns

- **Theme classes:** `text-theme`, `bg-theme-card`, `border-theme`, `text-theme-muted`, `bg-theme-surface-2`
- **Dark mode:** Always use theme classes, never hardcode colors
- **Toasts:** `showToast.success(title, message)`, `showToast.error(title, message)`
- **Icons:** Lucide React (`lucide-react`)
- **Modals:** Fixed inset-0 with bg-black/50 backdrop
- **Loading states:** Always reset in `finally` block
- **Error handling:** try/catch/finally on ALL async Supabase calls

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
| 2026-02-07 | Applied a security/storage return-path fix in one service but missed the parallel permit service implementation | When changing shared service patterns, grep sibling `*Service.ts` files for matching upload/read flows and patch all applicable paths in one pass |
| 2026-02-23 | Fixed Combobox clipping in one layer but missed additional clipping ancestors in the same render chain | When debugging dropdown clipping, trace every ancestor from trigger to page card and apply `overflow-visible` to each potential clipping container |

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

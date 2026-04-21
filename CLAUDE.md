# FieldPro (FT) — Project Context

Auto-loaded for any Claude session inside `/home/jay/FT`. Encodes everything you'd otherwise have to ask about: scripts, doc conventions, pre-commit rules, architecture landmarks. **If you find yourself about to ask "what's FT's convention for X" — the answer is probably here.**

---

## Tech stack (one-line refs)

- **Frontend:** React 19 + Vite + TypeScript, react-router-dom v7, @tanstack/react-query, leaflet/react-leaflet, recharts, lucide-react, sonner (toasts)
- **Backend:** Supabase (PostgREST + Realtime + Auth + Storage). No custom server — all server logic lives in Postgres functions/triggers + RLS
- **Tests:** Playwright (e2e only — no unit suite)
- **Errors:** Sentry (`@sentry/react`)
- **Linting:** ESLint 9 + typescript-eslint
- **Hooks:** Husky pre-commit + commit-msg

## Scripts (use these — don't reinvent)

| Command | What | When |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit` (~3-5s) | After every code edit. PostToolUse hook runs this automatically. |
| `npm run lint` | `tsc --noEmit && eslint .` (~15-30s) | Before `/ft-doc` as a final gate |
| `npm run build` | `vite build` | Pre-commit hook runs this — make sure it passes before ending session |
| `npm test` | Playwright e2e (slow) | Don't run as a routine guardrail. Reserved for pre-release verification |
| `npm run dev` | `vite` dev server | User runs this; you don't |

## Documentation conventions (CRITICAL — pre-commit will reject without these)

### `WORK_LOG.md` — required per code change

**Format:** `[YYYY-MM-DD HH:MM] [<Author>] <one-line summary listing every changed file>`, then indented bullets.

**Authors accepted by pre-commit hook:** `[Codex]`, `[Sonnet]`, `[Opus]`, `[Phoenix]`. Use the model tag for the current session.

**Enforcement:** the pre-commit hook (`.husky/pre-commit`) runs only when `git config user.name = "Phoenix"`. When it runs, it requires that **every staged code file** (`.ts|.tsx|.css|.sql|.js`) appear in a WORK_LOG.md entry **within the last 15 minutes** under one of the accepted author tags. The basename of each file must literally appear in the entry text.

**Entry shape (mirror this exactly):**
```
[2026-04-08 14:32] [Opus] fix: <terse problem statement> — <comma-separated changed files>
  - Client report / context: <what the user reported>
  - Root cause: <what was actually broken and why>
  - Fix: <what was changed and why this approach>
  - Scope notes: <what was deliberately not touched, and why>
  - Verification: <typecheck/lint/manual test results>
```

### `docs/CHANGELOG.md` — narrative changelog

**Format:** `## [YYYY-MM-DD] — <Title>` then `### Fixes` / `### Added` / `### Changed` sections with **prose bullets**, not one-liners. The existing tone is detailed and explanatory: client report → root cause → fix → scope. Read the last 2-3 entries before drafting a new one to mirror style.

### `docs/DB_SCHEMA.md` and `docs/USER_GUIDE.md`

Update when:
- **DB_SCHEMA.md:** any new column, table, trigger, or function. Mark new items `**(NEW YYYY-MM-DD)**`.
- **USER_GUIDE.md:** any user-visible flow change.

Don't backfill columns/functions that pre-existed but were undocumented — that's out of scope and creates noisy diffs.

## Auto-commit / session-end behavior

A Stop hook commits and pushes FT changes at session end. Implications:

1. **You don't need to commit manually** — and you shouldn't, since the Stop hook will try again and create duplicate commits.
2. **You MUST update WORK_LOG.md before the session ends** for every changed code file, or the auto-commit's pre-commit hook will reject it.
3. **`npm run typecheck` and `npm run build` must pass** — pre-commit runs both. If either fails, the auto-commit dies and your work doesn't ship.
4. The PostToolUse hook in `~/.claude/settings.json` runs `npm run typecheck` after every Edit/Write inside `/home/jay/FT` to catch type errors early.

## Architecture landmarks

Most "where does X live" questions are answered by these:

- **`services/`** — all Supabase data access. Split by domain: `jobService.ts` (CRUD core + re-exports), `jobAssignmentService.ts`, `jobChecklistService.ts`, `jobInvoiceService.ts`, `jobMediaService.ts`, `jobRequestService.ts`, `jobStatusService.ts`, `jobLockingService.ts`, `jobCrudService.ts`, `jobAutoCountService.ts`, `jobStarService.ts`. `jobService.ts` re-exports everything for backward compatibility.
- **`services/supabaseClient.ts`** — shared Supabase client + `JOB_SELECT` constants (LIST/BOARD/KPI/DETAIL select shapes) + network/retry helpers. Don't create a new client.
- **`pages/JobDetail/`** — the technician/admin job page. State and side effects are split across hooks in `pages/JobDetail/hooks/`:
  - `useJobDetailState.ts` — single source of state for the page
  - `useJobData.ts` — load + realtime subscription wiring
  - `useJobRealtime.ts` — Supabase postgres_changes listeners (jobs + job_requests)
  - `useJobActions.ts` — every mutation handler (save carried out, save description, add part, etc.)
  - Pattern: handlers `await` a service call, take the returned row, and apply it via `setJob({...updated})`. **No reload after mutation** — the row is the source of truth.
- **`utils/circuit-breaker.ts`** — wraps hot read paths with consecutive-failure tripping
- **`supabase/migrations/`** — SQL migrations, dated `YYYYMMDD_<slug>.sql`. Apply directly to live DB inside `BEGIN ... COMMIT` with a post-apply sanity check (see existing migrations for the pattern)

## Realtime gotcha (read this before touching mutations)

Supabase realtime echoes your own writes back as `postgres_changes` events. If a realtime callback calls `loadJob()`, it will race the in-flight mutation's PostgREST response and trip the AbortSignal — surfacing as `"signal is aborted without reason"` and a `"Could not save"` toast (even though the DB write succeeded).

**Resolved by:** `lastSeenUpdatedAtRef` in `useJobDetailState.ts`. Every locally-applied job row updates the ref; `useJobRealtime.ts` short-circuits when an incoming `payload.new.updated_at` matches it. **Don't add reloads in mutation handlers** — apply the returned row directly and let the dedupe handle the echo.

## Job-type validation layering (read before editing any completion/start gate)

Per-job-type policies (hourmeter, checklist, signatures, parts) live at **three layers** and drift between them caused the FTS completion bug (3 sessions to pin down). The layering contract:

| Layer | Owns | Example |
|---|---|---|
| UI (`useJobActions`, `JobDetailPage`, `JobHeader`, `MobileTechnicianWorkflowCard`, `JobDetailModals`) | Friendly early-reject, per-job-type branching | `isHourmeterExemptJob(job.job_type)` |
| Service (`services/jobStatusService.ts` etc.) | Generic CRUD only — **no job-type branches** | just passes the row through |
| DB trigger (`validate_job_completion_requirements`) | Authoritative contract | `IF NEW.job_type NOT IN ('Repair','Field Technical Services') THEN ...` |

**Grep markers** for cross-layer exemptions:
- `HOURMETER_EXEMPT_JOB_TYPES` — single source in `pages/JobDetail/utils.ts:isHourmeterExemptJob`. Every hourmeter gate in UI consumes it. When adding a new exempt type, grep this marker to find all call sites.

**Rule:** when adding or changing a per-job-type gate, touch **all three layers in one PR**: the UI helper, the service (usually just a comment update — don't add throws there), and the DB trigger. Verify with `grep -rn HOURMETER_EXEMPT_JOB_TYPES` or the relevant marker before shipping.

## Available tooling for FT work

| Tool | Type | Use for |
|---|---|---|
| `/ft-bugfix <description>` | Skill | Encoded workflow: explore → diagnose → option analysis → wait for approval → implement → typecheck → doc |
| `/ft-doc` | Skill | Generates WORK_LOG.md + CHANGELOG.md entries from current `git diff`, in FT's exact format |
| `ft-expert` | Agent (`subagent_type: ft-expert`) | FT-aware deep diagnosis, code review with FT idioms, architecture questions |
| `ft-review`, `ft-security`, `ft-perf` | Skills | Existing FT-specific review/audit skills |

## Things that look wrong but aren't

- `services/jobService.ts` is mostly re-exports — that's intentional backward compatibility from a service split
- `JOB_SELECT.BOARD` etc. look duplicative but each is tuned for a different read path's payload size
- Many services use `media:job_media!job_id(*)` instead of `media:job_media(*)` — the `!job_id` hint is **required** because of the second FK from `jobs.technician_rejection_photo_id`. Don't "simplify" it
- The pre-commit hook only enforces WORK_LOG when author = Phoenix. Other authors skip layer 2 but typecheck+build still run

## Memory architecture

FT has a two-layer memory system wired into the existing clawd Phoenix Dream consolidation pipeline:

### Layer 1 — canonical living memory (tracked, consolidated)
**`/home/jay/clawd/memory/projects/fieldpro.md`** — the source of truth for "what has FT learned." Durable knowledge: conventions, landmines, architecture decisions, historical incidents, recent discoveries. Read this whenever you need context beyond what's in this `CLAUDE.md`. Phoenix Dream (`/home/jay/clawd/tools/dream.md`) consolidates daily logs into this file, prunes stale entries, handles dedup and contradictions.

**Appending durable observations:** do not edit `fieldpro.md` directly. Write to a daily log:
```
/home/jay/clawd/memory/YYYY-MM-DD-ft-<topic>.md
```
Phoenix Dream mines these on the next consolidation run and promotes durable signals into `fieldpro.md`. The `ft-expert` agent does this automatically when it learns something worth keeping.

**Caveat:** Phoenix Dream cron is not currently scheduled (as of 2026-04-08). Invoke `/dream` manually when you want consolidation.

### Layer 2 — gitignored scratch (personal, tentative)
**`/home/jay/FT/.claude/memory/`** — mid-session personal notes, working hypotheses, grep output you want to reference later, half-formed thoughts. Gitignored. See `.claude/memory/README.md` for usage. Graduate durable items to a daily log (layer 1); let the rest age.

### Agent memory access
**`ft-expert` agent** (at `/home/jay/FT/.claude/agents/ft-expert.md`) reads both `CLAUDE.md` and `fieldpro.md` on every invocation, and appends observations to daily logs when it learns something non-obvious. Invoke via `Agent` tool with `subagent_type: ft-expert`.

## User-level memory pointers

`~/.claude/projects/-home-jay/memory/`:
- `project_ft_commit_workflow.md` — the auto-commit / pre-commit details
- `reference_ft_db_credentials.md` — Supabase pooler connection string for direct DB introspection
- `reference_ft_tooling.md` — pointer to the FT tooling stack (this doc, skills, agent, hook)
- `feedback_assess_before_execute.md` — Jay wants discussion before execution; the `/ft-bugfix` skill enforces this

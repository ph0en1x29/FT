# Development Workflow

1. **Read first** — Think through the problem, read relevant files before responding. Never speculate about unopened code.

2. **Check in before major changes** — Present the plan, wait for approval.

3. **Explain as you go** — High-level summary after each step.

4. **Keep it simple** — Minimal changes, smallest blast radius. No complex rewrites.

5. **Maintain architecture docs** — Keep documentation current with how the app works.

6. **No hallucination** — If referencing a file, read it first. No claims without investigation.

7. **Update docs after every code change** — After completing any code modification, update ALL relevant documentation:
   - **CHANGELOG.md** — Log what changed, why, files affected
   - **USER_GUIDE.md** — If UI/workflow changed, update user instructions
   - **DB_SCHEMA.md** — If database schema changed
   - **WORKFLOW_SPECIFICATION.md** — If business logic changed
   - **docs/README.md** — Add entry to "Recent Documentation Updates"

   This ensures continuity when resuming work later. Never skip this step.

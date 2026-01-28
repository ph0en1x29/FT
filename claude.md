# Development Workflow

1. **Read first** — Think through the problem, read relevant files before responding. Never speculate about unopened code.

2. **Check in before major changes** — Present the plan, wait for approval.

3. **Explain as you go** — High-level summary after each step.

4. **Keep it simple** — Minimal changes, smallest blast radius. No complex rewrites.

5. **Maintain architecture docs** — Keep documentation current with how the app works.

6. **No hallucination** — If referencing a file, read it first. No claims without investigation.

7. **Verify and simplify after every code change** — After writing/modifying code:
   - Run build: `npm run build`
   - Run tests (if applicable): `npm test`
   - If build passes → automatically simplify the modified code using the code-simplifier skill
   - Re-verify after simplification to ensure nothing broke
   - This step is MANDATORY. Never skip verification or simplification.

8. **Update docs after every code change** — MANDATORY, NOT OPTIONAL.

   ⚠️ **STOP** — Do NOT proceed to the next task batch until documentation is updated.

   ### 📋 Post-Build Checklist
   After EVERY successful build, complete this checklist:
   
   - [ ] **CHANGELOG.md** — Log what changed, why, files affected
   - [ ] **USER_GUIDE.md** — If UI/workflow changed
   - [ ] **DB_SCHEMA.md** — If database schema changed
   - [ ] **WORKFLOW_SPECIFICATION.md** — If business logic changed
   - [ ] **docs/README.md** — Add entry to "Recent Documentation Updates"
   
   Skip items only if genuinely not applicable. When in doubt, update.

   **TodoWrite Requirement:** When creating task lists, ALWAYS include "Update documentation" as an explicit task after every 3-5 code tasks. Example:
   ```
   - Task 1: Implement feature A
   - Task 2: Implement feature B
   - Task 3: Implement feature C
   - Task 4: Update documentation (CHANGELOG, relevant docs)  ← REQUIRED
   - Task 5: Implement feature D
   - ...
   ```

   This ensures continuity when resuming work later. Never skip this step.

---

## For Multi-Session Debugging

When a bug spans multiple sessions, create `docs/findings/<issue-name>.md`:
- What was tried and failed
- What was discovered (root causes, workarounds)
- Current hypothesis
- Key code locations involved

Delete after resolved (findings become CHANGELOG entry).

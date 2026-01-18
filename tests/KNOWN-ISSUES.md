# Known Issues - FieldPro

Track bugs and issues discovered during testing.

---

## Open Issues

_No open issues._

---

## Resolved Issues

### Playwright tests don't run in WSL2 - 2026-01-16

- **Severity:** Medium
- **Status:** ✅ Resolved
- **Found By:** Claude Code
- **Description:** Playwright headless tests fail in WSL2 due to missing Chromium dependencies (`libnspr4.so`, etc.)
- **Error:** `error while loading shared libraries: libnspr4.so: cannot open shared object file`
- **Fix:** Installed system dependencies via apt-get:
  ```bash
  sudo apt-get install -y libnspr4 libnss3 libgbm1 libxshmfence1 libglu1-mesa
  ```
- **Fixed Date:** 2026-01-16

---

## Issue Template

When adding new issues, use this format:

```markdown
### [Issue Title] - [Date Found]

- **Severity:** Critical / High / Medium / Low
- **Status:** Open / In Progress / Fixed
- **Found By:** [Name/Agent]
- **Reproduction:**
  1. Step 1
  2. Step 2
  3. Expected: [what should happen]
  4. Actual: [what actually happens]
- **Root Cause:** [if known]
- **Workaround:** [if any]
- **Fix:** [description of fix]
- **Fixed Date:** [date]
```

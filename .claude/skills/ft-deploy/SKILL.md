---
name: ft-deploy
description: Build, verify, document, commit and push FieldPro changes
disable-model-invocation: true
allowed-tools: Read, Bash, Write, Edit
---

# FT Deploy Pipeline

Run the full deploy pipeline. Never skip steps.

## Steps

1. **Build check**
   ```bash
   npm run build
   ```
   If build fails, fix errors before continuing.

2. **Update documentation**
   - `docs/CHANGELOG.md` — what changed (date, description)
   - `docs/USER_GUIDE.md` — if any user-facing changes
   - `docs/PROJECT_STRUCTURE.md` — if architecture changed

3. **Git commit and push**
   ```bash
   git add -A
   git diff --cached --stat
   git commit -m "type: description"
   git push
   ```

4. **Report** — Show commit hash, files changed, build status

## Commit Types
- `feat:` new feature
- `fix:` bug fix
- `refactor:` code restructuring
- `docs:` documentation only
- `chore:` maintenance

# SHARED_CONTEXT.md — Multi-Agent Coordination

**All agents working on this repo MUST read this file first.**

## The Team

| Agent | Role | Model | What I Do |
|-------|------|-------|-----------|
| **Phoenix** (OpenClaw) | Orchestrator | Opus 4.6 | Delegates tasks, reviews output, approves commits. Does NOT write code. |
| **Codex** | Builder | GPT-5.3-Codex | Writes code, implements features, fixes bugs. Has internal sub-agents. |
| **Claude Code** | Reviewer/Architect | Opus 4.6 | Reviews code, designs architecture, catches bugs Codex missed. |

## Codex Sub-Agents (NEW)

Codex now has built-in multi-agent support. It can spawn specialized sub-agents:

| Role | Purpose | Mode |
|------|---------|------|
| `worker` | Implements code changes | Read-write |
| `reviewer` | Reviews code for bugs/security | Read-only |
| `explorer` | Explores codebase, traces imports | Read-only |

Codex auto-decides when to spawn sub-agents, or you can ask explicitly:
"Spawn one agent per file, implement in parallel, then summarize."

## Rules

1. **One agent writes, another reviews.** Never self-review.
2. **Always run `npm run build` before claiming "done."**
3. **Log what you did** — append to `WORK_LOG.md` with timestamp, agent name, and summary.
4. **Don't undo another agent's work** without explanation in the work log.
5. **If you see a conflict** (uncommitted changes, git lock), STOP and report — don't force through.
6. **Use theme variables** — `bg-[var(--surface)]`, never `bg-white`. See index.html for all CSS vars.

## Workflow

```
Jay requests feature/fix
  → Phoenix breaks it into tasks + writes spec
    → Codex implements (parallel sub-agents for multi-file work)
      → Claude Code reviews (or Codex reviewer sub-agent for quick checks)
        → Phoenix verifies build + approves + commits
```

### Parallel Work Pattern
For multi-file changes, Phoenix defines a shared spec, then:
```bash
# Option A: Codex internal multi-agent (preferred)
codex exec "Implement [spec]. Spawn one worker per file, run in parallel."

# Option B: External parallel (for cross-model validation)
codex exec "Implement [feature] in [file1]" &
codex exec "Implement [feature] in [file2]" &
claude -p "Review the changes in [file1] and [file2]"
```

### Git Worktrees (for isolated parallel work)
When agents need full isolation (different branches, conflicting changes):
```bash
git worktree add ../FT-codex feature/codex-task
git worktree add ../FT-claude feature/claude-review
# Each agent works in its own directory, merge when done
git worktree remove ../FT-codex
```

## Current State

Check `WORK_LOG.md` for what was last done and by whom.
Check `git log --oneline -5` for recent commits.
Check `git status` for uncommitted changes before starting work.

## Git Rules

- **Don't commit directly** — Phoenix handles commits after review.
- **Don't switch branches** without Phoenix's approval.
- **Always check `git status` first** — if there are uncommitted changes, report them before doing anything.

## File Conventions

- No `src/` directory — pages/components/services/types at project root
- Theme: CSS variables in index.html (`--surface`, `--text`, `--border`, `--bg`, etc.)
- Dark mode: `data-theme="dark"` on html element, CSS vars auto-switch
- Toast: `showToast.success()`, `showToast.error()`
- Supabase: always check `.error` before `.data`, try/catch/finally, loading in finally

# SHARED_CONTEXT.md — Multi-Agent Coordination

**All agents working on this repo MUST read this file first.**

## The Team

| Agent | Role | What I Do |
|-------|------|-----------|
| **Phoenix** (OpenClaw/Opus) | Orchestrator | Delegates tasks, reviews output, approves commits. Does NOT write code. |
| **Codex** (GPT-5.3) | Builder | Writes code, implements features, fixes bugs. Fast, parallel-capable. |
| **Claude Code** (Opus 4.6) | Reviewer/Architect | Reviews code, designs architecture, catches bugs Codex missed. |

## Rules

1. **One agent writes, another reviews.** Never self-review.
2. **Always run `npm run build` before claiming "done."**
3. **Log what you did** — append to `WORK_LOG.md` with timestamp, agent name, and summary.
4. **Don't undo another agent's work** without explanation in the work log.
5. **If you see a conflict** (uncommitted changes, git lock), STOP and report — don't force through.

## Workflow

```
Jay requests feature/fix
  → Phoenix breaks it into tasks
    → Codex implements (codex exec in /home/jay/FT)
      → Claude Code reviews (claude -p in /home/jay/FT)
        → Phoenix approves + commits
```

## Current State

Check `WORK_LOG.md` for what was last done and by whom.
Check `git log --oneline -5` for recent commits.
Check `git status` for uncommitted changes before starting work.

## Git Rules

- **Don't commit directly** — Phoenix handles commits after review.
- **Don't switch branches** without Phoenix's approval.
- **Always check `git status` first** — if there are uncommitted changes, report them before doing anything.

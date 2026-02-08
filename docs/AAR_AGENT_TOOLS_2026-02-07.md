# After Action Review: Agent Tools Failures
**Date:** 2026-02-07  
**Subject:** Claude Code and Codex failures during file splitting tasks

---

## What Happened

During the file modularization effort, we attempted to use Claude Code and Codex as worker agents to split large files. Both agents experienced significant failures:

### Claude Code Issues
1. **Timeout on large files** — Agents consistently timed out (~3 min) when processing files over 500 lines
2. **Incomplete integrations** — Created split files but didn't wire them up to the original
3. **Orphaned files** — Generated files that were never imported anywhere
4. **Different implementations** — New code didn't match original logic (different method names, missing edge cases)

### Codex Issues
1. **Stalls on deletions** — Would stall indefinitely when asked to delete large code blocks
2. **Best for creation** — Works well for creating new files, poorly for modifying existing
3. **Context limitations** — Struggled to understand full file context for complex refactors

---

## Root Cause Analysis

### 1. Task Complexity Mismatch
File splitting is NOT a simple task. It requires:
- Understanding the full dependency graph
- Knowing which functions call which
- Preserving import/export relationships
- Maintaining backward compatibility

**Agents see files in isolation** — they don't have the full project context that makes safe refactoring possible.

### 2. Time Constraints
- Claude Code agents have ~3 minute windows
- Complex refactors need 10-15 minutes of analysis
- Agents rush to produce output, sacrificing quality

### 3. Verification Gap
Agents don't verify their work:
- No build check after changes
- No lint check
- No "does this actually work?" validation

I (Phoenix) must be the final barrier — running build, lint, and manual verification after every agent output.

---

## What Worked vs. What Didn't

### ✅ Agents ARE Good For:
| Task | Why It Works |
|------|--------------|
| Creating new files from scratch | No existing context to break |
| Simple find-replace operations | Mechanical, no judgment needed |
| Generating boilerplate | Pattern-based, low risk |
| Code review (reading) | Analysis without modification |
| Quick fixes (<50 lines) | Small blast radius |

### ❌ Agents ARE NOT Good For:
| Task | Why It Fails |
|------|--------------|
| Complex refactoring | Needs full project understanding |
| File splitting | Requires dependency analysis |
| Large deletions | Stalls or times out |
| Integration work | Doesn't verify connections |
| Multi-file changes | Loses context across files |

---

## Recommendations

### 1. Use Agents for Cross-Validation, Not Primary Work
```
GOOD: "Codex, review this code I wrote for bugs"
BAD:  "Codex, refactor this 800-line file"
```

### 2. Break Tasks into Atomic Operations
Instead of: "Split hourmeterService.ts"
Do:
1. "Create servicePredictionService.ts with these functions: [list]"
2. Manually copy the functions
3. "Add re-exports to hourmeterService.ts"
4. Manually verify build

### 3. Phoenix Stays Primary for Complex Work
| Task Type | Owner |
|-----------|-------|
| Simple edits | Phoenix directly |
| File creation | Phoenix or Agents |
| Complex refactoring | Phoenix only |
| Code review | Both (cross-validation) |
| Integration | Phoenix only |

### 4. Keep Using Agents for:
- **Parallel batch operations** — Multiple independent tasks
- **Second opinions** — Cross-model validation catches more bugs
- **Boilerplate generation** — Agents are fast at templates
- **Research/analysis** — Reading code, finding patterns

---

## Decision: Continue Using Agents?

**YES, but with constraints:**

| Use Case | Verdict |
|----------|---------|
| Primary development tool | ❌ No |
| Cross-validation | ✅ Yes |
| Simple/isolated tasks | ✅ Yes |
| Complex refactoring | ❌ No |
| File creation | ✅ Yes |
| File modification | ⚠️ Only simple changes |

### Updated Workflow

```
1. Phoenix analyzes task
2. If simple → do directly or delegate to agent
3. If complex → do manually
4. Always verify: build + lint + test
5. For critical changes → cross-validate with second agent
```

---

## Key Takeaway

> **Agents are tools, not replacements for careful engineering.**
> 
> They excel at parallelization and cross-checking.
> They fail at complex, context-dependent work.
> 
> The solution isn't to stop using them — it's to use them correctly.

---

*AAR completed: 2026-02-07 22:55 EST*

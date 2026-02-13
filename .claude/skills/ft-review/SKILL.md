---
name: ft-review
description: Review FieldPro code changes for bugs, security, edge cases, and consistency with project patterns
context: fork
allowed-tools: Read, Grep, Glob, Bash
---

# FT Code Review

Review the specified file(s) or last commit for issues.

## Checklist

1. **Type safety** — No `any` types, proper null checks, correct TypeScript generics
2. **Error handling** — All async calls wrapped in try/catch/finally, loading states reset on error
3. **Race conditions** — Check for stale closures, concurrent mutation, double-submit
4. **Security** — No credential exposure, proper RLS awareness, input sanitization
5. **Supabase patterns** — Check `.error` before using `.data`, proper `.select()` usage
6. **UI consistency** — Theme classes (`text-theme`, `bg-theme-card`), dark mode support, responsive
7. **State management** — No stale state in callbacks, proper cleanup in useEffect
8. **Performance** — No unnecessary re-renders, proper memo usage, efficient queries

## Output Format

For each issue found:
```
[CRITICAL/HIGH/MEDIUM/LOW] filename:line — description
  → Fix: suggested fix
```

Summary at end: X critical, Y high, Z medium, W low.

## Project Context
- React + TypeScript + Vite + Supabase
- Tailwind CSS with custom theme classes
- Toast notifications via `showToast` service
- No `src/` directory — pages/services/types at root

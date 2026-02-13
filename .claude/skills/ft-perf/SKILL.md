---
name: ft-perf
description: Performance review for FieldPro — re-renders, N+1 queries, bundle size, memo usage
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob
---

# FT Performance Review

Analyze the specified file(s) for performance issues.

## Checklist

1. **Unnecessary re-renders** — Components re-rendering on every parent render without memo
2. **Missing useMemo/useCallback** — Expensive computations or callbacks recreated each render
3. **N+1 queries** — Multiple sequential Supabase calls that could be batched
4. **Large component trees** — Components doing too much; should be split for lazy loading
5. **Unoptimized lists** — Large lists without virtualization or pagination
6. **Effect dependencies** — useEffect with missing or excessive dependencies causing loops
7. **Bundle impact** — Heavy imports that could be lazy-loaded or tree-shaken
8. **State placement** — State lifted too high causing cascade re-renders
9. **Supabase query efficiency** — Select only needed columns, use proper indexes
10. **Image/asset loading** — Missing lazy loading, unoptimized sizes

## Output
```
[HIGH/MEDIUM/LOW] filename:line — description
  → Fix: optimization suggestion
  → Impact: estimated improvement
```

---
name: ft-test
description: Run FieldPro tests and verify functionality
disable-model-invocation: true
allowed-tools: Read, Bash, Glob
---

# FT Test Runner

## Quick Test
```bash
npm run build
```
Build passing is the minimum bar. TypeScript errors = test failure.

## Playwright E2E (when available)
```bash
npx playwright test
npx playwright test tests/specific-test.spec.ts
npx playwright show-report
```

## Manual Verification Checklist
For UI changes, verify:
- [ ] Component renders without errors
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] Loading/error/empty states handled
- [ ] Toast notifications fire correctly

## Supabase Function Testing
For DB/service changes:
- [ ] Query returns expected data shape
- [ ] Error paths return gracefully (not crash)
- [ ] RLS policies allow intended access
- [ ] No N+1 query patterns

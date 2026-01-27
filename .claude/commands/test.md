# Testing Skill

Run automated testing using the Athena testing framework.

## Skill Usage

Invoke with `/test` followed by optional parameters:
- `/test` - Full assessment and smoke test
- `/test scan` - Run project scanner only
- `/test smoke` - Run smoke tests
- `/test security` - Run security audit
- `/test auth` - Run authentication tests
- `/test full` - Run comprehensive test suite

## Framework Location

Athena utilities are located at: `/mnt/x/Personal/Athena/final-testing-skill/`

## Instructions

When this skill is invoked, follow the Athena 4-phase methodology:

### Phase 1: ASSESS (Always Do First)

1. **Check if PROJECT-TEST-PROFILE.md exists** in the current project's `tests/` folder
2. **If not, run the scanner:**
   ```bash
   node /mnt/x/Personal/Athena/final-testing-skill/tools/scan-project.js
   ```
3. **Read the generated profile** to understand what features exist

### Phase 2: PLAN

Based on the profile, determine which tests are relevant:

| Project Feature | Test Utilities Needed |
|-----------------|----------------------|
| Any web app | core/ (smoke, errors) |
| Has authentication | auth/ (login, roles) |
| Has forms | security/ (XSS, injection) |
| Has protected routes | security/ (auth bypass) |
| Public-facing | performance/, accessibility/ |
| Has payments | payments/ (Stripe tests) |

### Phase 3: TEST

1. **Ensure Playwright is configured** - create `playwright.config.ts` if missing
2. **Run appropriate tests** based on scope:
   - `smoke`: Load all pages, check for errors
   - `auth`: Login/logout, protected routes
   - `security`: XSS, auth bypass, sensitive data
   - `performance`: Core Web Vitals
   - `accessibility`: WCAG audit

3. **Use the utilities** from Athena when writing tests:
   ```typescript
   import { ErrorCapture, smokeTest } from './utilities/core';
   import { login, testProtectedRoute } from './utilities/auth';
   import { testAuthBypass, checkSensitiveDataExposure } from './utilities/security';
   ```

### Phase 4: DOCUMENT

After testing, always update:
1. `tests/TEST-HISTORY.md` - Log what was tested and results
2. `tests/KNOWN-ISSUES.md` - Document any bugs found

## Quick Reference

**First time on a project:**
```bash
# 1. Run scanner
node /mnt/x/Personal/Athena/final-testing-skill/tools/scan-project.js

# 2. Read profile
cat tests/PROJECT-TEST-PROFILE.md

# 3. Copy needed utilities to tests/utilities/
# 4. Configure Playwright if needed
```

**Test commands:**
```bash
npx playwright test                  # Run all tests
npx playwright test --headed         # Run with visible browser
npx playwright test --ui             # Run with Playwright UI
npx playwright test tests/smoke.spec.ts  # Run specific test
```

## Utility Locations

All utilities are at `/mnt/x/Personal/Athena/final-testing-skill/utilities/`:
- `core/index.ts` - ErrorCapture, smokeTest, wait helpers
- `auth/index.ts` - login, logout, testProtectedRoute, testRoleAccess
- `security/index.ts` - testXSS, testAuthBypass, checkSensitiveDataExposure
- `performance/index.ts` - measureCoreWebVitals, assertPerformanceBudgets
- `accessibility/index.ts` - runAxeAudit, testKeyboardNavigation

## Golden Rule

> Better to have tools and not need them than need them and not have them.
> But NEVER run tests blindly - always assess first.

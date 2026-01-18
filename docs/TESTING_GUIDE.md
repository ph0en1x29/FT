# FieldPro Testing Guide

> Using the Athena Testing Framework with Claude Code

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run test` | Run all tests (headless) |
| `npm run test:headed` | Run tests with visible browser |
| `npm run test:ui` | Run with Playwright interactive UI |
| `npm run test:smoke` | Run smoke tests only |
| `/test` | Invoke Athena skill in Claude Code |

---

## How It Works

### Architecture

```
~/.claude/commands/test.md          # Claude Code skill (reusable)
         │
         ▼
/mnt/x/Personal/Athena/             # Athena framework source
├── final-testing-skill/
│   ├── tools/scan-project.js       # Project scanner
│   ├── utilities/                  # Test utility library
│   └── SKILL.md                    # Methodology guide
         │
         ▼
/mnt/x/Personal/Project/FT/         # FieldPro project
├── playwright.config.ts            # Playwright configuration
├── tests/
│   ├── smoke.spec.ts               # Smoke tests (8 tests)
│   ├── PROJECT-TEST-PROFILE.md     # What to test in FT
│   ├── TEST-HISTORY.md             # Test session log
│   ├── KNOWN-ISSUES.md             # Bug tracking
│   └── utilities/                  # Copied test utilities
│       ├── core/                   # Error capture, smoke tests
│       ├── auth/                   # Login, role testing
│       ├── security/              # XSS, auth bypass
│       ├── performance/           # Core Web Vitals
│       └── accessibility/         # WCAG audit
```

---

## Running Tests

### 1. Start Dev Server (if not auto-started)

```bash
npm run dev
```

### 2. Run Tests

```bash
# Headless (CI mode)
npm run test

# With visible browser (recommended for debugging)
npm run test:headed

# Interactive UI (best for development)
npm run test:ui
```

### 3. View Results

- **Terminal**: Pass/fail summary
- **HTML Report**: `playwright-report/index.html` (auto-generated)
- **Screenshots**: Captured on failure in `test-results/`

---

## Test Accounts

Configured in `.env.local`:

| Role | Email | Purpose |
|------|-------|---------|
| Admin | `dev@test.com` | Full access testing |
| Supervisor | `super1234@gmail.com` | Supervisor workflows |
| Technician | `tech1@example.com` | Technician workflows |
| Accountant | `accountant1@example.com` | Invoice/financial testing |

---

## Current Test Coverage

### Smoke Tests (`smoke.spec.ts`)

| Test | Description |
|------|-------------|
| Login page loads | Verifies `/login` renders without errors |
| Form elements present | Checks email, password, submit button exist |
| Protected routes redirect | Verifies unauthenticated users go to login |
| Invalid credentials error | Checks error handling for bad login |
| Mobile viewport | Tests responsive design at 375px width |
| Valid login | Tests successful authentication (needs credentials) |
| Dashboard loads | Verifies post-login navigation |
| Health check | Quick smoke test on public pages |

---

## Athena 4-Phase Methodology

### Phase 1: ASSESS
Before testing, understand what exists:
```bash
# Run the scanner
node /mnt/x/Personal/Athena/final-testing-skill/tools/scan-project.js

# Or read the existing profile
cat tests/PROJECT-TEST-PROFILE.md
```

### Phase 2: PLAN
Based on assessment, select relevant tests:
- ✅ Always run: smoke, security, performance, accessibility
- ✅ If auth exists: auth tests
- ❌ Skip if not applicable: payments, i18n, PWA

### Phase 3: TEST
Run the appropriate tests:
```bash
npm run test:headed
```

### Phase 4: DOCUMENT
After testing, update:
- `tests/TEST-HISTORY.md` - Log what was tested
- `tests/KNOWN-ISSUES.md` - Track any bugs found

---

## Using the Claude Code Skill

From any project, invoke `/test`:

```
/test         → Full assessment + smoke tests
/test scan    → Run project scanner only
/test smoke   → Run smoke tests
/test auth    → Run authentication tests
/test security → Run security audit
```

The skill guides you through the Athena methodology.

---

## Test Utilities Reference

### Core (`utilities/core/`)
```typescript
import { ErrorCapture, smokeTest, wait } from './utilities/core';

// Capture console errors during test
const errors = new ErrorCapture(page);
errors.assertNoErrors();

// Quick smoke test multiple pages
const results = await smokeTest(page, ['/login', '/']);

// Wait helpers
await wait.forNetworkIdle(page);
await wait.forElement(page, '#submit');
```

### Auth (`utilities/auth/`)
```typescript
import { login, testProtectedRoute, testRoleAccess } from './utilities/auth';

// Login helper
await login(page, email, password);

// Test protected route redirects
await testProtectedRoute(page, '/dashboard');

// Test role-based access
const results = await testRoleAccess(page, routes, 'ADMIN');
```

### Security (`utilities/security/`)
```typescript
import { testAuthBypass, testXSS, checkSensitiveDataExposure } from './utilities/security';

// Check if protected URLs can be accessed without auth
const bypasses = await testAuthBypass(page, ['/dashboard', '/jobs']);

// Test for XSS vulnerabilities
const xss = await testXSS(page, 'input[name="search"]', 'button[type="submit"]');

// Check for exposed sensitive data
const exposure = await checkSensitiveDataExposure(page);
```

### Performance (`utilities/performance/`)
```typescript
import { measureCoreWebVitals, assertPerformanceBudgets } from './utilities/performance';

// Measure Core Web Vitals
const vitals = await measureCoreWebVitals(page);

// Check against budgets
const check = assertPerformanceBudgets(metrics);
```

### Accessibility (`utilities/accessibility/`)
```typescript
import { runAxeAudit, testKeyboardNavigation } from './utilities/accessibility';

// Run WCAG audit
const audit = await runAxeAudit(page);

// Test keyboard navigation
const keyboard = await testKeyboardNavigation(page);
```

---

## Adding New Tests

1. Create a new `.spec.ts` file in `tests/`
2. Import utilities as needed
3. Follow the pattern:

```typescript
import { test, expect } from '@playwright/test';
import { ErrorCapture } from './utilities/core';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    const errors = new ErrorCapture(page);

    await page.goto('/your-page');

    // Your assertions
    await expect(page.locator('h1')).toBeVisible();

    errors.assertNoErrors();
  });
});
```

---

## Troubleshooting

### Tests fail to start
```bash
# Ensure Playwright browsers are installed
npx playwright install chromium
```

### Dev server doesn't auto-start
```bash
# Start manually first
npm run dev

# Then run tests
npm run test:headed
```

### Authentication tests skip
- Check `.env.local` has test credentials filled in
- Ensure test accounts exist in Supabase

### Timeout errors
- Increase timeout in `playwright.config.ts`
- Check if Supabase is accessible

---

## File Locations

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright configuration |
| `tests/smoke.spec.ts` | Smoke test suite |
| `tests/PROJECT-TEST-PROFILE.md` | What to test in FT |
| `tests/TEST-HISTORY.md` | Test session log |
| `tests/KNOWN-ISSUES.md` | Bug tracking |
| `tests/utilities/` | Test helper functions |
| `.env.local` | Test account credentials |

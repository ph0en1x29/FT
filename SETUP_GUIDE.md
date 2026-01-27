# FieldPro VM Setup Guide

> **For the next developer**: Copy the "Quick Setup Script" section below and paste it to Claude Code. It will set up everything automatically.

---

## Quick Setup Script

Paste this entire block to Claude Code:

```
Please set up this FieldPro project for me. Run these steps:

1. Create .env.local with these exact contents:
VITE_SUPABASE_URL=https://dljiubrbatmrskrzaazt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsaml1YnJiYXRtcnNrcnphYXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMzQ1OTQsImV4cCI6MjA4MDkxMDU5NH0.YOY4ueelHVxdTkenmvxxwO-SNE4jmqhN_gkDF0nLXWo
VITE_DEV_EMAILS=dev@test.com
TEST_ADMIN_EMAIL=dev@test.com
TEST_ADMIN_PASSWORD=Dev123!
TEST_SUPERVISOR_EMAIL=super1234@gmail.com
TEST_SUPERVISOR_PASSWORD=Super123!
TEST_TECHNICIAN_EMAIL=tech1@example.com
TEST_TECHNICIAN_PASSWORD=Tech123!
TEST_ACCOUNTANT_EMAIL=accountant1@example.com
TEST_ACCOUNTANT_PASSWORD=Account123!

2. Create .claude/settings.local.json with pre-approved permissions:
{
  "permissions": {
    "allow": [
      "Bash(npm run dev)",
      "Bash(npm run build:*)",
      "Bash(npm run test:*)",
      "Bash(npm install:*)",
      "Bash(npx playwright install:*)",
      "Bash(npx playwright test:*)",
      "Bash(npx tsc:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(supabase db:*)"
    ]
  }
}

3. Run: npm install
4. Run: npx playwright install
5. Run: npm run build (verify it passes)
6. Run: npm run dev (start the dev server on port 3000)
```

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| **Admin** | dev@test.com | Dev123! |
| **Supervisor** | super1234@gmail.com | Super123! |
| **Technician** | tech1@example.com | Tech123! |
| **Accountant** | accountant1@example.com | Account123! |

---

## URLs

- **Local Dev**: http://localhost:3000
- **Production**: https://ft-kappa.vercel.app/
- **Supabase Dashboard**: https://supabase.com/dashboard/project/dljiubrbatmrskrzaazt

---

## Features Needing Testing

These features were recently added but **not fully verified**:

### Priority 1 - Core Dev Tools
- [ ] **Permission Modal** - Login as dev@test.com, click "Permissions" in dev banner
- [ ] **Dev Mode Role Switching** - Use dropdown in header to switch roles
- [ ] **Dashboard Notifications Card** - Check each role's dashboard

### Priority 2 - Role Dashboards
- [ ] **Admin Dashboard** - KPIs, charts, recent activity
- [ ] **Supervisor Dashboard** - Team overview, job assignments
- [ ] **Technician Dashboard** - Van stock alerts, today's jobs
- [ ] **Accountant Dashboard** - Revenue trends, invoice queue

### Priority 3 - New Features
- [ ] **Customer Feedback System** - DB migration applied, needs UI testing
- [ ] **Feature Flags** - Enable/disable features via context

---

## Running Tests

```bash
# All tests
npm test

# Specific test suites
npm test tests/smoke.spec.ts                    # Quick smoke test
npm test tests/access-control.spec.ts           # Role permissions
npm test tests/customer-feedback.spec.ts        # NEW - needs testing
npm test tests/interactive/                     # All interactive tests

# With browser visible
npm run test:headed

# View test report after running
npx playwright show-report
```

---

## Project Documentation

- `docs/USER_GUIDE.md` - Complete user guide
- `docs/CHANGELOG.md` - All changes and decisions
- `docs/WORKFLOW_SPECIFICATION.md` - Business logic
- `docs/DB_SCHEMA.md` - Database schema
- `CLAUDE.md` - AI/Developer instructions

---

## Troubleshooting

**Build fails**: Check Node.js version is 18+ (`node --version`)

**Tests fail with auth errors**: Verify .env.local has correct credentials

**Playwright fails**: Run `npx playwright install-deps` on Linux

**Port 3000 in use**: `npm run dev -- --port 3001`

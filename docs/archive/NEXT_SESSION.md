# Next Session Handoff

> Last Updated: 2026-01-17
> Status: Ready for Testing

---

## Priority 1: Run Automated Tests

The Athena testing framework is now set up. Start with automated smoke tests:

```bash
# Start dev server
npm run dev

# In another terminal, run tests with visible browser
npm run test:headed

# Or use interactive UI
npm run test:ui
```

**Expected Results:**
- 8 smoke tests should run
- Login page tests should pass
- Protected route redirect tests should pass
- Auth tests will use credentials from `.env.local`

---

## Priority 2: Manual Feature Testing

### Test 1: Hourmeter Amendment Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as Technician (`tech1@example.com`) | Dashboard loads |
| 2 | Open a job with a forklift attached | Job detail page |
| 3 | Enter hourmeter LOWER than current | Should flag as suspicious |
| 4 | Submit amendment with reason | Modal closes, request saved |
| 5 | Login as Admin (`dev@test.com`) | Dashboard loads |
| 6 | Go to Fleet → Hourmeter Review tab | See pending amendments |
| 7 | Approve or reject amendment | Status updates |
| 8 | Check ForkliftProfile → Hourmeter History | Shows the change |

### Test 2: Van Stock Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as Admin (`dev@test.com`) | Dashboard loads |
| 2 | Go to Inventory → Van Stock tab | Van stock list |
| 3 | Create Van Stock for a technician | Success message |
| 4 | Add parts/items to Van Stock | Items appear in list |
| 5 | Login as Technician (`tech1@example.com`) | Dashboard loads |
| 6 | Go to `/my-van-stock` | See assigned items |
| 7 | Submit replenishment request | Request saved |
| 8 | Login as Admin (`dev@test.com`) | Dashboard loads |
| 9 | Approve and fulfill request | Status updates |
| 10 | Login as Technician | Dashboard loads |
| 11 | Go to Inventory → Confirmations tab | See pending confirmation |
| 12 | Confirm receipt | Confirmation saved |

### Test 3: Access Control

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as Technician | Dashboard loads |
| 2 | Go to Fleet page | NO Edit/Delete/Add buttons, NO Hourmeter Review tab |
| 3 | Verify Inventory page | NO Van Stock or Confirmations tabs |
| 4 | Login as Supervisor | Dashboard loads |
| 5 | Go to Fleet → Hourmeter Review tab | Can see/approve amendments |

---

## Priority 3: Implement Notifications

After testing passes, add notifications:

### Hourmeter Amendment Notifications

```typescript
// When technician submits amendment → notify Admin (Service) + Supervisor
// File: components/HourmeterAmendmentModal.tsx

// When admin approves/rejects → notify requesting Technician
// File: pages/HourmeterReview.tsx
```

### Van Stock Notifications

```typescript
// When technician requests replenishment → notify Admin (Store)
// File: components/ReplenishmentRequestModal.tsx

// When admin fulfills request → notify Technician
// File: pages/VanStockPage.tsx
```

---

## Priority 4: Remaining ACWER Items

### Phase 1 (High Priority)

| Item | Description | Estimate | Files |
|------|-------------|----------|-------|
| Conditional Field Visibility | Show/hide fields by job type | 2-3 hrs | JobDetail.tsx |
| Hide pricing from Tech | Technicians shouldn't see invoice data | 1-2 hrs | JobDetail.tsx, InvoicePDF.tsx |
| Edit pending requests | Allow techs to edit their requests | 2 hrs | JobDetail.tsx |
| Hourmeter locking | First tech locks hourmeter for job | 2 hrs | supabaseService.ts |

### Phase 2 (Medium Priority)

| Item | Description | Estimate | Files |
|------|-------------|----------|-------|
| Photo-Based Job Start | Auto-start job when photo uploaded | 4 hrs | JobDetail.tsx |
| POD Flow | Proof of Delivery for Courier jobs | 4 hrs | New component |

---

## Quick Reference

### Test Accounts (in `.env.local`)

| Role | Email | Password |
|------|-------|----------|
| Admin | dev@test.com | Dev123! |
| Supervisor | super1234@gmail.com | Super123! |
| Technician | tech1@example.com | Tech123! |
| Accountant | accountant1@example.com | Account123! |

### Key Commands

```bash
npm run dev          # Start dev server
npm run test:headed  # Run Playwright tests with browser
npm run test:ui      # Interactive test UI
npm run typecheck    # Type check
npm run build        # Production build
```

### Key Files

| File | Purpose |
|------|---------|
| `types/index.ts` | All TypeScript types (moved from root) |
| `pages/JobsTabs.tsx` | Jobs with Service History tab |
| `pages/ForkliftsTabs.tsx` | Fleet with Hourmeter Review tab |
| `pages/InventoryPage.tsx` | Inventory with Van Stock + Confirmations tabs |
| `pages/Invoices.tsx` | Billing with AutoCount Export tab |
| `pages/People.tsx` | Team with Performance (KPI) tab |
| `pages/HourmeterReview.tsx` | Admin reviews amendments (embedded in Fleet) |
| `pages/MyVanStock.tsx` | Technician van stock view |
| `pages/VanStockPage.tsx` | Admin van stock management (embedded in Inventory) |
| `pages/PendingConfirmations.tsx` | Technician confirmations (embedded in Inventory) |
| `pages/PrototypeDashboards.tsx` | V4 dashboard prototype with role switcher (dev-only) |
| `components/dashboards/DashboardPreviewV4.tsx` | V4 "Calm Focus" dashboard design |
| `components/HourmeterAmendmentModal.tsx` | Submit amendments |
| `components/ReplenishmentRequestModal.tsx` | Request replenishment |
| `services/supabaseService.ts` | All database operations |
| `database/README.md` | Database structure documentation |
| `supabase/migrations/` | Source of truth for DB migrations |

### Testing Framework

| File | Purpose |
|------|---------|
| `tests/smoke.spec.ts` | 8 smoke tests |
| `tests/PROJECT-TEST-PROFILE.md` | What to test |
| `tests/TEST-HISTORY.md` | Log test sessions |
| `tests/KNOWN-ISSUES.md` | Track bugs |
| `docs/TESTING_GUIDE.md` | Full testing documentation |

---

## Session Checklist

```
□ Run automated smoke tests (npm run test:headed)
□ Test Hourmeter Amendment flow manually
□ Test Van Stock flow manually
□ Test Access Control manually
□ Document any issues in tests/KNOWN-ISSUES.md
□ Update tests/TEST-HISTORY.md with results
□ If all tests pass → implement notifications
□ If issues found → fix before notifications
```

---

## Notes

- **Dev Mode**: FT has built-in role switching for testing (`useDevMode` hook)
- **Supabase Required**: All tests need Supabase connection
- **RLS Active**: Row Level Security enforces permissions at DB level
- **Audit Trail**: Hourmeter changes are logged in `hourmeter_history`

### Navigation Changes (2026-01-16)

The sidebar has been simplified from 14+ items to 7 items:

| Before | After | Notes |
|--------|-------|-------|
| Dashboard | Dashboard | - |
| Jobs | Jobs | + Service History tab |
| Forklifts | Fleet | + Hourmeter Review tab |
| Customers | Customers | - |
| Inventory, Van Stock, Confirmations | Inventory | Combined as tabs |
| Service Records | - | Now Jobs → Service History tab |
| Invoices, AutoCount | Billing | Combined as tabs |
| Reports (KPI) | - | Now Team → Performance tab |
| People | Team | + Performance tab |

Legacy URLs automatically redirect to new tab locations.

### Dashboard Prototype Changes (2026-01-17)

The prototype dashboard page (`/#/prototype/dashboards`) has been simplified:

- **V2/V3 Removed**: Only V4 "Calm Focus" design remains
- **V4 Header Cleanup**: Removed redundant Fleet/Team chips
- **File Cleanup**: `DashboardPreviewV3.tsx` deleted, `PrototypeDashboards.tsx` reduced from ~1,500 to ~345 lines
- **Role Switcher**: Still available to test different role views

### Dark Mode Pattern (2026-01-17)

**CRITICAL:** Do NOT use Tailwind `dark:` classes in this project.

The app uses `[data-theme="dark"]` for theme switching, but Tailwind's `dark:` prefix responds to OS-level `prefers-color-scheme`. This causes visual inconsistencies.

**Correct approach:**
```jsx
// ✅ DO: Use standard Tailwind classes - index.html overrides handle dark mode
<div className="bg-green-50 text-green-600">...</div>

// ✅ DO: Use CSS variables
<div className="bg-theme-surface text-theme">...</div>

// ❌ DON'T: Use dark: prefix
<div className="bg-green-50 dark:bg-green-500/10">...</div>
```

The `index.html` file contains `html[data-theme="dark"]` overrides that remap colors like `bg-green-50`, `bg-red-50`, etc. to appropriate dark mode values.

### Project Cleanup (2026-01-17)

Major restructuring completed:

- **Types moved**: `types_with_invoice_tracking.ts` → `types/index.ts`
- **Migrations archived**: Historical migrations in `database/historical/`
- **Source of truth**: Active migrations in `supabase/migrations/`
- **Deleted pages**: EmployeesPage, Forklifts, HRDashboard, RecordsPage, ReportsPage, UserManagement (all superseded by consolidated pages)

# FieldPro Test Fix Report

Date: March 6, 2026

Scope: local-only changes to stabilize the latest GitHub version for role-based testing. Nothing has been pushed.

## Why changes were needed

After updating the workspace to the latest `origin/main`, the project had three classes of issues:

1. Local environment drift
   `node_modules` was behind the current `package-lock.json`, so typecheck/build initially failed on missing packages.

2. Real code regressions
   A few current-source TypeScript errors blocked any reliable test run.

3. Test/app mismatch
   The current app uses `HashRouter`, modular dashboards, clickable cards, and modal components without consistent dialog semantics. A large part of the existing role E2E suite was still targeting older route behavior or brittle selectors.

## Code changes made

### Application fixes

- `index.tsx`
  Added deep-link normalization from `/path` to `/#/path` so direct entry to routes like `/jobs` or `/forklifts` lands on the correct screen under `HashRouter`.

- `pages/JobBoard/components/BulkSignOffModal.tsx`
  Fixed incorrect toast usage and cleaned up selected job ID typing so `typecheck` passes.

- `pages/JobDetail/hooks/useJobActions.ts`
  Switched swipe-sign actions to call the current `swipeSignJob` export directly instead of the legacy compatibility object.

- `pages/JobBoard/components/JobCard.tsx`
  Added keyboard/button semantics and a stable `data-testid`.
  Reason: job cards were clickable `div`s with no accessible interaction model and no stable automation hook.

- `pages/Customers/components/CustomerCard.tsx`
  Added keyboard/button semantics, a stable `data-testid`, and a labeled view action.
  Reason: same accessibility and testability problem as the job cards.

- `pages/ForkliftsTabs/components/ForkliftCard.tsx`
  Added a stable `data-testid` on each fleet card plus explicit labels/test IDs for edit/delete actions.

- `pages/CustomerProfile/components/CustomerHeader.tsx`
  Added an explicit label/title to the delete-customer action.

- `pages/JobDetail/components/JobHeader.tsx`
  Fixed an admin permission mismatch so the full `admin` role can actually see the job delete action, and added a stable label/title to that control.

- `services/jobCrudService.ts`
  Fixed `hardDeleteJob()` to remove related `hourmeter_history` rows before deleting the job.
  Reason: cleanup and true hard-delete flows could fail on the `hourmeter_history_job_id_fkey` foreign key.

- Modal accessibility updates:
  Added `role="dialog"` and `aria-modal="true"` semantics to:
  - `pages/ForkliftsTabs/components/AddEditForkliftModal.tsx`
  - `pages/ForkliftsTabs/components/AssignForkliftModal.tsx`
  - `pages/ForkliftsTabs/components/ReturnForkliftModal.tsx`
  - `pages/ForkliftsTabs/components/BulkEndRentalModal.tsx`
  - `pages/ForkliftsTabs/components/BulkServiceResetModal.tsx`
  - `pages/ForkliftsTabs/components/ResultModal.tsx`
  - `pages/CustomerProfile/components/EditCustomerModal.tsx`

  Reason: several modals rendered visually but exposed no dialog semantics, which is both an accessibility bug and a testing problem.

### Test harness and E2E updates

- `tests/fixtures/auth.fixture.ts`
  Added shared hash-route navigation helpers for the current router setup.

- `tests/e2e/admin.spec.ts`
  Updated route navigation, hardened selectors, corrected fleet-tab expectations, aligned assertions with the current UI labels, and added seeded admin flows for:
  - rent out
  - return
  - delete job
  - delete forklift
  - delete customer

- `tests/e2e/supervisor.spec.ts`
  Updated route handling and selectors to the current hash-route/fleet-tab behavior.

- `tests/e2e/technician.spec.ts`
  Updated route handling, switched job-detail navigation to stable job-card selectors, and replaced dataset-dependent skips with seeded technician-job coverage plus cleanup.

## Verification performed

- `npm ci`
- `npm run typecheck`
- `npm run build`
- Multiple Playwright reruns against the current local app:
  - full role matrix attempts
  - focused admin reruns for faster iteration
  - focused technician reruns for data-dependent empty-state coverage

## Current status

- Build: passing
- Typecheck: passing
- Role-based Playwright coverage: passing

Final consolidated role-suite result:

- Command:
  `npx playwright test tests/e2e/admin.spec.ts tests/e2e/supervisor.spec.ts tests/e2e/technician.spec.ts tests/e2e/accountant.spec.ts`
- Result:
  `75 passed, 0 skipped, 0 failed`

What changed vs the earlier skipped run:

- Admin rent-out and return coverage now seed temporary customer/forklift records through the authenticated local app session, exercise the flow, and clean those records back out.
- Technician job-dependent coverage now seeds an assigned technician job through an authenticated admin session, verifies the technician can see/open it, and then hard-cleans it.
- An additional seeded admin delete-workflow test now verifies delete behavior for:
  - job
  - forklift
  - customer

All seeded records are created and cleaned up locally only. Nothing was pushed.

## Files changed

- `index.tsx`
- `pages/CustomerProfile/components/EditCustomerModal.tsx`
- `pages/Customers/components/CustomerCard.tsx`
- `pages/CustomerProfile/components/CustomerHeader.tsx`
- `pages/ForkliftsTabs/components/AddEditForkliftModal.tsx`
- `pages/ForkliftsTabs/components/AssignForkliftModal.tsx`
- `pages/ForkliftsTabs/components/BulkEndRentalModal.tsx`
- `pages/ForkliftsTabs/components/BulkServiceResetModal.tsx`
- `pages/ForkliftsTabs/components/ForkliftCard.tsx`
- `pages/ForkliftsTabs/components/ResultModal.tsx`
- `pages/ForkliftsTabs/components/ReturnForkliftModal.tsx`
- `pages/JobBoard/components/BulkSignOffModal.tsx`
- `pages/JobBoard/components/JobCard.tsx`
- `pages/JobDetail/components/JobHeader.tsx`
- `pages/JobDetail/hooks/useJobActions.ts`
- `services/jobCrudService.ts`
- `tests/e2e/admin.spec.ts`
- `tests/e2e/supervisor.spec.ts`
- `tests/e2e/technician.spec.ts`
- `tests/fixtures/auth.fixture.ts`

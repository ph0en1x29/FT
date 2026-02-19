# FieldPro Project Structure

> **Last Updated:** 2026-02-19  
> **Author:** Phoenix (Clawdbot)

This document describes the codebase architecture and folder patterns used in FieldPro.

---

## Overview

```
FT/
├── components/           # Shared UI components
├── contexts/             # React context providers
├── hooks/                # Shared custom hooks
├── pages/                # Page components (route-level)
├── services/             # API/database services
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
├── tests/                # Playwright E2E tests
├── database/             # SQL migrations
├── docs/                 # Documentation
└── public/               # Static assets
```

---

## Current Frontend Structure (February 2026)

### Components Directory (`components/`)

```
components/
├── AssetDashboard.tsx
├── ChunkErrorBoundary.tsx
├── Combobox.tsx
├── CommandPalette.tsx            # Cmd+K command palette (NEW)
├── DashboardNotificationCard.tsx
├── HourmeterAmendmentModal.tsx
├── InvoicePDF.tsx
├── NotificationBell.tsx
├── NotificationPanel.tsx
├── NotificationSettings.tsx
├── OfflineIndicator.tsx
├── PullToRefresh.tsx             # Pull-to-refresh wrapper (NEW)
├── QuotationPDF.tsx
├── ReplenishmentRequestModal.tsx
├── ServiceAutomationWidget.tsx
├── ServiceReportPDF.tsx
├── ServiceUpgradeModal.tsx
├── SignaturePad.tsx
├── Skeleton.tsx                  # Skeleton loading patterns (NEW)
├── SlotInSLABadge.tsx
├── StaleDataBanner.tsx
├── SwipeableCard.tsx             # Swipe card interactions (NEW)
├── TeamStatusTab.tsx
├── TechnicianJobsTab.tsx
├── TelegramConnect.tsx
├── TelegramTeamStatus.tsx
├── VanStockWidget.tsx
├── layout/
│   ├── AuthenticatedApp.tsx
│   └── NavigationComponents.tsx
├── mobile/                       # Mobile-first interaction primitives (NEW)
│   ├── BottomSheet.tsx
│   ├── FilterSheet.tsx
│   ├── FloatingActionButton.tsx
│   └── SwipeableRow.tsx
├── ui/                           # Existing shared UI primitives
├── dashboards/                   # Existing dashboard-specific components
├── hourmeter/                    # Existing hourmeter component set
└── ... (additional domain folders/files)
```

### Mobile Components (`components/mobile/`)

| Component | Purpose |
|-----------|---------|
| `BottomSheet.tsx` | Slide-up modal on mobile; centered modal behavior on desktop. |
| `FilterSheet.tsx` | Filter panel that renders as a bottom sheet on mobile and inline on desktop. |
| `FloatingActionButton.tsx` | Role-aware FAB exposing quick actions on mobile. |
| `SwipeableRow.tsx` | Swipe-to-action row interactions (e.g., approve/reject). |

### Shared Hooks (`hooks/`)

| Hook | Purpose |
|------|---------|
| `useDevMode.ts` | Development-mode state/helpers. |
| `useFeatureFlags.ts` | Feature flag consumption logic (NEW). |
| `usePullToRefresh.tsx` | Pull-to-refresh gesture handling (NEW). |
| `useQueryHooks.ts` | Shared TanStack Query wrappers/helpers. |

### Context Providers (`contexts/`)

| Context | Purpose |
|---------|---------|
| `DevModeContext.tsx` | Dev mode provider/state. |
| `FeatureFlagContext.tsx` | Feature flag provider and lookup API (NEW). |
| `NotificationContext.tsx` | Notification state/provider. |
| `QueryProvider.tsx` | App-level React Query provider setup. |

### Pages Directory (`pages/`)

| Page Entry | Type | Notes |
|------------|------|-------|
| `AutoCountExport/` | Folder module | AutoCount export flows. |
| `CreateJob/` | Folder module | Modular Create Job implementation. |
| `CreateJob.tsx` | Wrapper file | Route-level wrapper/compatibility entry. |
| `CustomerProfile/` | Folder module | Modular customer detail page. |
| `Customers/` | Folder module | Modular customers listing flows. |
| `Customers.tsx` | Wrapper file | Route-level customers entry. |
| `EmployeeProfile/` | Folder module | Modular employee profile flows. |
| `ForkliftProfile/` | Folder module | Forklift profile detail page. |
| `ForkliftsTabs/` | Folder module | Forklift dashboard tabbed module. |
| `HourmeterReview/` | Folder module | Hourmeter review/approval workflows. |
| `InventoryPage/` | Folder module | Inventory management views. |
| `Invoices/` | Folder module | Invoice management pages. |
| `JobBoard/` | Folder module | Job board feature module. |
| `JobDetail/` | Folder module | Main job detail/workflow module. |
| `JobsTabs.tsx` | Wrapper file | Wrapper/entry for jobs tab views. |
| `LoginPage.tsx` | Route file | Authentication page. |
| `MyLeaveRequests/` | Folder module | Leave request self-service pages. |
| `MyVanStock/` | Folder module | Modular My Van Stock page implementation. |
| `MyVanStock.tsx` | Wrapper file | Route-level My Van Stock entry. |
| `PartRequests/` | Folder module | Part requests feature module. |
| `PendingConfirmations/` | Folder module | Pending confirmations workflows. |
| `People/` | Folder module | People/user management flows. |
| `PrototypeDashboards.tsx` | Route file | Dashboard prototype route. |
| `ServiceDue/` | Folder module | Service due module. |
| `ServiceDue.tsx` | Wrapper file | Route-level service due entry. |
| `ServiceIntervalsConfig/` | Folder module | Service interval configuration module. |
| `ServiceIntervalsConfig.tsx` | Wrapper file | Route-level config entry. |
| `ServiceRecords/` | Folder module | Service records module. |
| `ServiceRecords.tsx` | Wrapper file | Route-level service records entry. |
| `StoreManager/` | Folder module | Store manager views/workflows. |
| `StoreQueue/` | Folder module | Store queue approvals and processing. |
| `TechnicianKPIPageV2/` | Folder module | Technician KPI page module. |
| `VanStockPage/` | Folder module | Modular van stock workflows. |

---

## Modular Page Pattern

Large pages (500+ lines) are split into folder modules. This is the standard pattern:

```
pages/
└── [PageName]/
    ├── index.tsx              # Re-export for backward compatibility
    ├── [PageName]Page.tsx     # Main container component
    ├── types.ts               # TypeScript interfaces for this page
    ├── utils.ts               # Helper functions (optional)
    ├── constants.ts           # Constants/config (optional)
    ├── components/
    │   ├── index.ts           # Barrel export
    │   ├── [Component].tsx    # UI components
    │   └── modals/            # Modal components (if many)
    │       └── [Modal].tsx
    └── hooks/
        └── use[Feature].ts    # Custom hooks for data/logic
```

### Pages Using This Pattern

| Page | Pattern | Notes |
|------|---------|-------|
| JobDetail | Folder module + re-export | Job management with real-time behavior |
| EmployeeProfile | Folder module + re-export | HR with licenses/permits/leaves |
| ForkliftsTabs | Folder module + re-export | Multi-tab fleet management |
| CustomerProfile | Folder module + re-export | Customer with rentals/history |
| VanStockPage | Folder module + re-export | Inventory with modal-driven workflows |

### How It Works

**index.tsx** — Simple re-export for backward compatibility:
```tsx
export { default } from './CustomerProfilePage';
```

**components/index.ts** — Barrel export for clean imports:
```tsx
export { CustomerHeader } from './CustomerHeader';
export { RentalsSection } from './RentalsSection';
// ... etc
```

**Main page** imports from local folders:
```tsx
import { CustomerHeader, RentalsSection } from './components';
import { useCustomerData } from './hooks/useCustomerData';
import type { CustomerPageProps } from './types';
```

---

## Services Architecture

Services are split by domain, with a barrel export for backward compatibility:

```
services/
├── supabaseClient.ts         # Client initialization & helpers
├── authService.ts            # Authentication (login, logout, session)
├── userService.ts            # User CRUD operations
├── customerService.ts        # Customer operations
│
├── # Job services (split from jobService.ts)
├── jobService.ts             # Core job CRUD + re-exports
├── jobAssignmentService.ts   # Assignment, reassignment, helper tech
├── jobRequestService.ts      # In-job requests (spare parts, helpers)
├── jobChecklistService.ts    # Condition checklist operations
├── jobInvoiceService.ts      # Invoice/billing, parts, extra charges
├── jobMediaService.ts        # Photos, signatures
├── jobLockingService.ts      # Concurrent edit prevention
│
├── # Forklift services (split from forkliftService.ts)
├── forkliftService.ts        # Core forklift CRUD + re-exports
├── rentalService.ts          # Rental operations (assign, end, extend)
├── hourmeterService.ts       # Hourmeter readings, amendments (facade)
├── servicePredictionService.ts # Service prediction & automation
├── jobRequestApprovalService.ts # Request approval/rejection logic
├── serviceScheduleService.ts # Service due, intervals, predictions
│
├── # HR services (split from hrService.ts)
├── hrService.ts              # Employee ops + re-exports
├── leaveService.ts           # Leave requests, balances, approvals
├── licenseService.ts         # Driving licenses CRUD
├── permitService.ts          # Special permits CRUD
├── hrAlertService.ts         # HR alerts and expiry notifications
│
├── inventoryService.ts       # Parts, van stock
├── notificationService.ts    # Notifications
├── storageService.ts         # File uploads
└── supabaseService.ts        # ⚠️ Legacy barrel (re-exports all)
```

### Usage

**Preferred** — Import from specific service:
```tsx
import { getCustomer, updateCustomer } from '@/services/customerService';
```

**Still works** — Import from barrel (backward compatible):
```tsx
import { getCustomer, updateCustomer } from '@/services/supabaseService';
```

---

## Types Architecture

Types are split by domain with barrel export:

```
types/
├── index.ts              # Re-exports everything
├── common.types.ts       # Shared utilities (ChecklistItemState, etc.)
├── user.types.ts         # User, UserRole, RolePermissions
├── customer.types.ts     # Customer, CustomerAcknowledgement
├── forklift.types.ts     # Forklift, ForkliftRental, ServiceInterval
├── inventory.types.ts    # Part, VanStock, VanStockItem
├── job.types.ts          # Job, JobStatus, JobMedia, KPI
├── notification.types.ts # NotificationType, Notification
├── hr.types.ts           # Leave, License, Permit
└── integration.types.ts  # AutoCount types
```

### Usage

Both work:
```tsx
// From barrel (existing code)
import { Job, Customer, User } from '@/types';

// From specific file (preferred for new code)
import { Job, JobStatus } from '@/types/job.types';
```

---

## Component Guidelines

### When to Split

Split a component when:
- **Over 500 lines** — Hard to navigate
- **Multiple concerns** — Doing too many things
- **Repeated patterns** — Cards, modals, sections

### Component Size Targets

| Type | Target Lines | Max Lines |
|------|--------------|-----------|
| Main page container | 300-500 | 800 |
| Section component | 100-200 | 400 |
| Card component | 50-150 | 200 |
| Modal component | 100-200 | 350 |
| Custom hook | 50-150 | 250 |

### Naming Conventions

```
# Pages
[Domain]Page.tsx           → CustomerProfilePage.tsx
[Domain]Tab.tsx            → FleetTab.tsx

# Components  
[Domain][Type].tsx         → CustomerHeader.tsx
[Domain][Feature].tsx      → RentalsSection.tsx

# Modals
[Action][Domain]Modal.tsx  → EditRentalModal.tsx
[Domain][Action]Modal.tsx  → VanStockDetailModal.tsx

# Hooks
use[Domain]Data.ts         → useCustomerData.ts
use[Feature].ts            → useJobRealtime.ts
```

---

## Database Migrations

```
database/
└── migrations/
    └── YYYYMMDD_description.sql

supabase/
└── migrations/
    └── YYYYMMDD_description.sql
```

Migrations are applied via:
1. **Supabase Dashboard** — SQL Editor
2. **Management API** — Via curl with token
3. **Supabase CLI** — `supabase db push`

---

## Testing Structure

```
tests/
├── smoke.spec.ts                  # Basic smoke tests
├── customer-feedback.spec.ts      # Feature tests
├── mutations/
│   └── form-validation.spec.ts    # Form tests
└── interactive/
    └── [feature].spec.ts          # Interactive tests
```

Run tests:
```bash
npm test                           # All tests
npm test tests/smoke.spec.ts       # Specific test
npx playwright show-report         # View report
```

---

## Quick Reference

### Adding a New Page

1. Create folder: `pages/[PageName]/`
2. Create files: `index.tsx`, `[PageName]Page.tsx`, `types.ts`
3. Extract components to `components/`
4. Extract data logic to `hooks/`
5. Add route in `App.tsx`

### Adding a New Service Function

1. Find the right domain service (e.g., `customerService.ts`)
2. Add the function
3. Export it from the file
4. Re-export from `supabaseService.ts` if needed for compatibility

### Adding a New Type

1. Find the right domain file (e.g., `job.types.ts`)
2. Add the type/interface
3. Export it from the file
4. Verify `types/index.ts` re-exports it

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Modular page folders | Large files (1000+ lines) are unmaintainable |
| Barrel exports | Backward compatibility with existing imports |
| Domain-split services | Easier to find functions, smaller files |
| Domain-split types | Faster IDE, clearer ownership |
| hooks/ inside pages | Colocation > global hooks folder for page-specific logic |

---

## See Also

- [DEVELOPMENT_PROCESS.md](./DEVELOPMENT_PROCESS.md) — How to implement changes
- [DB_SCHEMA.md](./DB_SCHEMA.md) — Database structure
- [CHANGELOG.md](./CHANGELOG.md) — What's been built

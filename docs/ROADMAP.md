# FieldPro Roadmap

**Last Updated:** January 18, 2026

---

## ✅ Recently Completed

### January 18, 2026
- [x] **Bug Fixes**
  - Fixed `getLowStockItems` function in supabaseService (broken query with unresolved Promise and non-existent RPC)
  - Fixed missing CSS theme utility classes (`bg-theme-accent-subtle`, `text-theme-accent`, `hover:bg-theme-surface-2`)
- [x] **Documentation Audit & Update**
  - Updated DB_SCHEMA.md with 6 new tables (AutoCount integration, duration alerts)
  - Added 20+ new columns to jobs and job_media tables
  - Documented 11 new views and 10 new functions
  - Updated user_role_enum with admin_service and admin_store roles
  - Updated USER_GUIDE.md with new admin roles and features

### January 17, 2026
- [x] **Project Cleanup & Restructuring**
  - Deleted 3 deprecated files (old migration, manual, KPI v1)
  - Updated .gitignore for test artifacts and Supabase temp files
  - Moved `types_with_invoice_tracking.ts` → `types/index.ts` (updated 55 imports)
  - Archived 67 database migration files to `database/historical/`
  - Deleted 6 orphaned pages (EmployeesPage, Forklifts, HRDashboard, RecordsPage, ReportsPage, UserManagement)
  - Created `database/README.md` documenting structure

- [x] **Dashboard Prototype Cleanup**
  - Removed redundant Fleet/Team chips from V4 Admin dashboard header
  - Deleted deprecated V3 prototype (`DashboardPreviewV3.tsx`)
  - Consolidated PrototypeDashboards.tsx from ~1,500 to ~345 lines
  - Removed V2 "Apple-style" components and role-specific dashboards
  - Prototype page now shows V4-only with role switcher

### January 16, 2026
- [x] **UI Simplification - Apple-Inspired Navigation Redesign**
  - Reduced sidebar from 14+ items to 7 items for admin/supervisor
  - Consolidated pages into tabbed interfaces:
    - Jobs (+ Service History tab)
    - Fleet (+ Hourmeter Review tab) - renamed from Forklifts
    - Inventory (+ Van Stock, Confirmations tabs)
    - Billing (+ AutoCount Export tab) - renamed from Invoices
    - Team (+ Performance/KPI tab) - renamed from People
  - Created `JobsTabs.tsx` wrapper page
  - Added `hideHeader` props for embedded components
  - Legacy URL redirects for backwards compatibility
  - Mobile drawer navigation simplified

### January 14-15, 2026
- [x] **Van Stock System (Phase 4 Partial)**
  - Van Stock CRUD management
  - Van Stock Items (add/remove parts from van)
  - Van Stock Usage tracking on jobs
  - Replenishment Request flow (technician → Admin Store → fulfill)
  - Pending Confirmations page for technician acknowledgment
  - Auto-replenishment trigger on Slot-In job completion
  - Database tables: `van_stocks`, `van_stock_items`, `van_stock_usage`, `van_stock_replenishments`
- [x] **Hourmeter Amendment Workflow (Phase 2)**
  - Technician enters hourmeter on jobs
  - Suspicious readings flagged (lower than previous, excessive jump)
  - Technician submits amendment with reason
  - Admin (Service)/Supervisor reviews and approves/rejects
  - Hourmeter Review page (`/hourmeter-review`)
  - Hourmeter History section on ForkliftProfile page
  - Full audit trail in `hourmeter_history` table
  - Database triggers for validation and auto-update
- [x] **Admin Role Split**
  - Admin 1 (Service) - `admin_service` role: Job operations, hourmeter approval
  - Admin 2 (Store) - `admin_store` role: Inventory, Van Stock replenishment
  - Both maintain full admin access as fallback
- [x] **Check All Button for Checklist**
  - "Check All" button with confirmation modal
  - Confirmation required before proceeding
  - Mandatory checklist validation on job completion

### January 11, 2026
- [x] **Security Fixes (Code Review P1)**
  - Fixed RPC privilege escalation vulnerability
  - Two-step user creation: prepare → signUp → complete
  - Session-bound verification via `pending_user_creations` table
  - Gated prototype data fetch behind dev check
- [x] **Dev Mode Fixes (Code Review P2)**
  - Fixed UI Only vs Strict mode (now properly differentiated)
  - Fixed persistence after page reload
  - Added `displayRole` and `permissionRole` separation
- [x] **Dev Mode Infrastructure** - Developer tools for prototyping
  - useDevMode hook with email allowlist
  - Role impersonation (UI Only / Strict Mode)
  - DevBanner warning component
  - RoleSwitcher dropdown
- [x] **Prototype Dashboards** - Role-specific dashboard layouts (V4 "Calm Focus" design)
  - Technician: My Jobs Today focus
  - Supervisor: Action queue + team status
  - Admin: Full KPI overview with streamlined header
  - Accountant: Financial pipeline
  - Route: `/#/prototype/dashboards`
  - Dev-only access via VITE_DEV_EMAILS
  - V2/V3 prototypes removed (2026-01-17)

### January 10, 2026
- [x] **Asset Overview Dashboard** - Fleet status at a glance
  - 5 status cards: Rented Out, In Service, Service Due, Available, Out of Service
  - Status precedence logic for accurate counts
  - Secondary badges (e.g., rented + due)
  - Metrics bar: Jobs (30d), Avg duration
  - Filterable table with search
  - Collapsed by default (5 items), expandable
  - Create Job quick action with prefilled data
  - Role-based access: Admin + Supervisor only
- [x] **NotificationBell theme fix** - CSS variables instead of Tailwind dark: classes
- [x] **Tab fallback fix** - Non-admin users now default to Fleet tab
- [x] **Admin User Creation Fix** - RLS violation on user creation
  - Problem: signUp() switches session to new user, causing RLS block
  - Solution: RPC function with SECURITY DEFINER + admin ID verification
  - New migration: `20260110_admin_create_user_rpc.sql`

### January 7, 2026
- [x] **Stability & Error-Handling Hardening**
  - Page-level data loading guards (Create Job, Job Board, Job Detail, User Management)
  - Dashboard escalation actions hardened (acknowledge/save notes/overtime)
  - Service intervals reliability (create/update/delete wrapped)
  - Forklifts fallback safety (guarded fallback load)
  - Employees query handling (explicit error checks)
  - Job Detail dependency cleanup (photo category → started_at)

### January 6, 2026

#### Bundle Optimization
- [x] Route-level lazy loading with React.lazy + Suspense
- [x] Vendor chunking (react, supabase, charts, ui)
- [x] Initial bundle reduced from ~1.5MB to ~290KB
- [x] Added `npm run typecheck` script

### Dashboard 3-Panel Redesign
- [x] Service Automation Widget - cleaner layout with gradient icons
- [x] Recent Jobs Panel - compact list with status dots
- [x] Notifications Panel - icon backgrounds, unread dots

### Real-time Notification System
- [x] Dashboard notification panel
- [x] Supabase Realtime subscriptions
- [x] Sound alerts + browser notifications
- [x] Fixed subscription loop bug

---

## 🎯 Current Sprint: UI Redesign

### Priority: High

#### 1. Dashboard Redesign
- [x] Reorganize layout for better information hierarchy (KPI grid, Action Required queue, charts, automation + recent jobs)
- [x] Escalation management improvements (acknowledge, notes, quick actions, expand/collapse)
- [x] Better visual grouping of alerts (combined "Action Required" queue with tabs)
- [ ] Stats cards - review what metrics matter most
- [ ] Charts - consider if both pie and bar are needed
- [ ] Mobile responsiveness check

#### 2. Job Detail Page Redesign
- [x] Hero card contrast + surface hierarchy (Equipment/Repair Time/Summary tints)
- [x] Media gallery improvements (empty-state dropzone + drag/drop)
- [x] Right-rail card consistency (Summary/Signatures/Timeline/AI header patterns)
- [x] Header button hierarchy (single primary + outline exceptions)
- [x] Typography contrast (labels/subtitles) + clearer secondary buttons
- [x] Assignment mini-panels + action chips (Reassign/Add Helper)
- [ ] Information architecture review
- [ ] Better visual flow for job lifecycle
- [ ] Action buttons placement
- [ ] Timeline/activity log presentation (full audit/event stream)
- [ ] Mobile-first layout

#### 3. User/HR/Employee Page Consolidation ✅ COMPLETED 2026-01-16
- [x] Merge User Management + HR into single page (People/Team)
- [x] Tab-based navigation: Overview | Users | Employees | Leave | Performance
- [x] Cleaner role/permission display
- [x] Better employee profile view
- [x] KPI/Performance tab added

#### 4. Service Intervals Relocation ✅ COMPLETED 2026-01-16
- [x] Moved under Fleet (Forklifts) page as tab
- [x] Combined with Service Due as additional tab
- [x] Reduced navigation clutter (sidebar simplified)
- [x] Admin-only access maintained

#### 5. Navigation Simplification ✅ COMPLETED 2026-01-16
- [x] Reduced sidebar from 14+ items to 7 items
- [x] Consolidated related pages into tabs
- [x] Renamed pages: Forklifts→Fleet, Invoices→Billing, People→Team
- [x] Legacy URL redirects for backwards compatibility

---

## 🚧 Next Up: ACWER Requirements (Awaiting Client Feedback)

**Reference:** `docs/ACWER_REQUIREMENTS_REVIEW.md`
**Questionnaire:** `docs/ACWER_CLIENT_QUESTIONNAIRE.md`

Waiting for client responses before proceeding with Phase 1 Quick Wins.

### Phase 1: Quick Wins (~16 hours)
- [x] Job Types Update - Add Slot-In, Courier/Collection ✅ COMPLETED
- [ ] Conditional Field Visibility by job type
- [x] "Check All" button for condition checklist ✅ COMPLETED 2026-01-15
- [ ] Hide pricing from Tech App views
- [ ] Edit button for pending requests
- [ ] Hourmeter locking (first tech records, persists on reassignment)

### Phase 2: Asset Dashboard + Photo Flow (~32 hours)
- [x] **Asset Overview Dashboard** - Fleet status at a glance ✅ COMPLETED 2026-01-10
  - Total fleet count
  - Rented Out / In Service / Service Due / Available / Out of Service
  - Click-to-filter status cards
  - Collapsed table with expand/show all
- [ ] Photo-Based Job Start/End (auto-start on forklift photo)
- [x] **Hourmeter amendment flow with audit trail** ✅ COMPLETED 2026-01-15
  - Technician submits amendment requests
  - Admin (Service)/Supervisor approval workflow
  - Hourmeter Review page
  - Hourmeter History on ForkliftProfile
  - Full audit trail in `hourmeter_history` table
- [ ] POD (Proof of Delivery) flow for Courier jobs

### Phase 3: Workflow Enhancements (~28 hours)
- [ ] Dual Admin Approval Flow (Admin 2 confirms parts → Admin 1 closes)
- [ ] Parts Confirmation step in job completion
- [ ] Request edit history/audit trail

### Phase 4: Inventory System (~60 hours)
- [ ] Inventory Module Foundation (locations, items, stock, transactions)
- [x] **Van Stock System** ✅ COMPLETED 2026-01-15
  - Van Stock per technician with configurable max items
  - Van Stock Items management (add/remove parts)
  - Usage tracking when parts used on jobs
  - Replenishment Request workflow
  - Pending Confirmations for technician acknowledgment
  - Admin Store approval process
- [x] **Auto-Requisition System for Slot-In job replenishment** ✅ COMPLETED 2026-01-15
  - Trigger on Slot-In job completion
  - Auto-creates replenishment request for low stock items
- [ ] Dual-Path Parts Flow (Store Request vs Van Stock) - Partially done

### Phase 5: Advanced Features (Future)
- [ ] Offline Mode (PWA) - significant undertaking, post-MVP
- [ ] Contract Management - link forklifts to rental agreements
- [ ] Preventive Maintenance Automation

---

## 📋 Backlog

### 🔔 Notification System (Customer Feedback - ✅ COMPLETED)
- [x] **Dashboard notification panel** - Show notifications on dashboard, not just bell icon
- [x] **Real-time updates** - Supabase Realtime subscriptions for instant updates
  - [x] Subscribe to `notifications` table changes
  - [x] Subscribe to `jobs` table for assignment changes
  - [x] Subscribe to `job_requests` table for request status changes
- [x] **Sound/visual alerts** - Browser notifications with sound for:
  - [x] Technician → Admin: Helper request, spare part request
  - [x] Admin → Technician: Request approved/rejected, job assigned
- [x] **Job appears immediately** - When Admin assigns job, it shows in Technician's app instantly
- [ ] **Push notifications** - Mobile push support (future)

### Features
- [ ] AutoCount API integration
- [ ] Job reassignment UI (from escalation panel)
- [ ] Rental amount management
- [ ] Advanced reporting/analytics
- [ ] Customer portal for acknowledgements
- [ ] Hourmeter amendment notification system (notify admin when request submitted)
- [ ] Van Stock audit scheduling (quarterly audits)
- [ ] Van Stock discrepancy resolution workflow

### Technical Debt
- [ ] Code splitting for bundle size
- [ ] Component library documentation
- [ ] Test coverage

### Nice-to-Have
- [x] Dark mode refinements - Fixed `dark:` utilities conflict (2026-01-17); remaining: scan for any other `dark:` usage
- [ ] Keyboard shortcuts
- [ ] Bulk operations (jobs, forklifts)
- [ ] Export to Excel/PDF

---

## ✅ Completed (Recent)

### January 6, 2026
- [x] **Real-Time Notification System** (Customer Feedback Implementation)
  - Dashboard notification panel with live connection status
  - Supabase Realtime subscriptions for notifications, jobs, requests
  - Sound alerts and browser notifications
  - Request workflow notifications (tech→admin, admin→tech)

### January 5, 2026
- [x] **Critical RLS Fix:** Role case mismatch (`'admin'` vs `'Admin'`)
- [x] **Critical RLS Fix:** Missing policies on `job_parts`, `job_media`, `extra_charges`
- [x] Enhanced escalation management (acknowledge, notes, actions)
- [x] Job Detail premium polish (hero tints, photo dropzone, right-rail headers)
- [x] Duplicate service intervals cleanup + unique constraint
- [x] Security linter fixes (views, functions, RLS)
- [x] #7/#8 status UI consistency across all pages
- [x] Deferred completion hourmeter validation
- [x] KPI pages include all completed statuses

### January 4, 2026
- [x] Multi-day job escalation (#7)
- [x] Deferred acknowledgement flow (#8)
- [x] Malaysian public holidays table

### January 3, 2026
- [x] User-Employee merge
- [x] Comprehensive RLS security
- [x] Foreign key indexes (48 added)

---

## 📝 Notes

### Dashboard Redesign Ideas
```
Current:
┌─────────────────────────────────────────┐
│ Stats (4 cards)                         │
│ Charts (Pie + Bar)                      │
│ Escalated Jobs Alert                    │
│ Awaiting Ack Alert                      │
│ Disputed Alert                          │
│ Service Widget + Recent Jobs            │
└─────────────────────────────────────────┘

Proposed:
┌─────────────────────────────────────────┐
│ Key Stats (simplified)                  │
├─────────────────────────────────────────┤
│ ⚠️ Action Required (combined alerts)    │
│   - Escalated (X)                       │
│   - Awaiting Ack (X)                    │
│   - Disputed (X)                        │
├─────────────────────────────────────────┤
│ Today's Work | Service Due | Analytics  │
└─────────────────────────────────────────┘
```

### Job Detail Redesign Ideas
- Header: Job title, status badge, quick actions
- Left column: Details, customer, forklift
- Right column: Activity timeline
- Bottom: Media gallery, signature, invoice

### Navigation Simplification ✅ IMPLEMENTED 2026-01-16
```
Before (14+ items):              After (7 items):
- Dashboard                      - Dashboard
- Jobs                          - Jobs (+ Service History tab)
- Forklifts                     - Fleet (+ Hourmeter Review tab)
- Customers                     - Customers
- Inventory                     - Inventory (+ Van Stock, Confirmations tabs)
- Van Stock                     - Billing (+ AutoCount Export tab)
- Confirmations                 - Team (+ Performance tab)
- Hourmeter Review
- Service Records               Footer:
- Invoices                      - My Leave
- AutoCount                     - My Van Stock (technician only)
- Reports (KPI)                 - My Profile
- People                        - Sign Out
```

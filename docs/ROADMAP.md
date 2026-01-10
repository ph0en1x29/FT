# FieldPro Roadmap

**Last Updated:** January 10, 2026

---

## ✅ Recently Completed

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
- [x] Better visual grouping of alerts (combined “Action Required” queue with tabs)
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

#### 3. User/HR/Employee Page Consolidation
- [ ] Merge User Management + HR into single page
- [ ] Tab-based navigation: Users | Leave | Licenses | Permits
- [ ] Cleaner role/permission display
- [ ] Better employee profile view

#### 4. Service Intervals Relocation
- [ ] Option A: Move under Forklifts page as tab
- [ ] Option B: Combine with Service Due page
- [ ] Reduce navigation clutter
- [ ] Keep Admin-only access

---

## 🚧 Next Up: ACWER Requirements (Awaiting Client Feedback)

**Reference:** `docs/ACWER_REQUIREMENTS_REVIEW.md`
**Questionnaire:** `docs/ACWER_CLIENT_QUESTIONNAIRE.md`

Waiting for client responses before proceeding with Phase 1 Quick Wins.

### Phase 1: Quick Wins (~16 hours)
- [ ] Job Types Update - Add Slot-In, Courier/Collection
- [ ] Conditional Field Visibility by job type
- [ ] "Check All" button for condition checklist
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
- [ ] Hourmeter amendment flow with audit trail
- [ ] POD (Proof of Delivery) flow for Courier jobs

### Phase 3: Workflow Enhancements (~28 hours)
- [ ] Dual Admin Approval Flow (Admin 2 confirms parts → Admin 1 closes)
- [ ] Parts Confirmation step in job completion
- [ ] Request edit history/audit trail

### Phase 4: Inventory System (~60 hours)
- [ ] Inventory Module Foundation (locations, items, stock, transactions)
- [ ] Van Stock (Virtual Warehouse per technician with 50 SKUs)
- [ ] Auto-Requisition System for Slot-In job replenishment
- [ ] Dual-Path Parts Flow (Store Request vs Van Stock)

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

### Technical Debt
- [ ] Code splitting for bundle size
- [ ] Component library documentation
- [ ] Test coverage

### Nice-to-Have
- [ ] Dark mode refinements
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

### Navigation Simplification
```
Current sidebar:
- Dashboard
- Jobs
- Forklifts  
- Customers
- Inventory
- Service Due
- Service Intervals  ← merge into Forklifts?
- Invoices
- User Management    ← merge with HR?
- HR Dashboard
- KPI

Proposed:
- Dashboard
- Jobs
- Assets (Forklifts + Service Intervals)
- Customers
- Inventory
- Service Due
- Invoices
- Team (Users + HR + KPI)
- Settings
```

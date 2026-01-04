# FieldPro Changelog

All notable changes, decisions, and client requirements for this project.

---

## Status Legend

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Requirements Confirmed | Client approved, ready to START building |
| 🔨 | In Development | Currently being built |
| ✔️ | Completed | Implemented and tested |
| ⏳ | Pending Confirmation | Awaiting client response |
| ❌ | Not Started | Requirements confirmed but build not begun |

---

## [Unreleased] - ACWER Workflow Implementation

### Client
**ACWER Industrial Equipment Sdn Bhd** (Malaysia)
- ~2,000 forklifts across Johor and Penang branches
- ~60 service jobs/day
- Uses AutoCount 2.2 for accounting

### Current Phase
📋 **Requirements Confirmed** — Ready to begin implementation

### ACWER Feature Implementation (2026-01-04)

#### #4 Hourmeter Prediction + Dashboard - ✔️ COMPLETED (Pre-existing)
- **Files (already existed):**
  - `pages/ServiceDue.tsx` - Full service due page with filtering
  - `components/ServiceAutomationWidget.tsx` - Dashboard widget
- **Features:**
  - Overdue/Due Soon/Jobs Created stats with color coding
  - "Run Service Check" button for auto-creating jobs
  - Widget on Dashboard for Admin/Supervisor
  - Clickable stats navigate to ServiceDue with filters
  - Uses `get_forklifts_due_for_service` RPC function
  - Integrated with service_intervals config from #5

#### #5 Service Intervals Config UI - ✔️ COMPLETED
- **Files created:**
  - `pages/ServiceIntervalsConfig.tsx` - Admin UI to view/edit service intervals
- **Files modified:**
  - `services/supabaseService.ts` - Added CRUD functions:
    - `getServiceIntervals()` - Fetch all intervals
    - `getServiceIntervalsByType(type)` - Filter by forklift type
    - `createServiceInterval(data)` - Add new interval
    - `updateServiceInterval(id, updates)` - Edit interval
    - `deleteServiceInterval(id)` - Soft delete (deactivate)
    - `hardDeleteServiceInterval(id)` - Permanent delete
  - `App.tsx` - Added route `/service-intervals` and sidebar link under Management
- **Features:**
  - View all service intervals grouped by forklift type
  - Filter tabs: All, Diesel, Electric, LPG
  - Inline editing in table
  - Add new interval via modal
  - ACWER defaults reference card (Electric: 3 months, Diesel: 500h, LPG: 350h)
  - Uses existing `service_intervals` table (no schema changes)
- **Access:** Admin only

#### #10 Photo Categorization + ZIP Download - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_job_media_category.sql` - DB migration to add category column
- **Files modified:**
  - `types_with_invoice_tracking.ts` - Added `MediaCategory` type and `category` field to `JobMedia`
  - `pages/JobDetail.tsx`:
    - Added photo category filter tabs (All, Before, After, Spare Parts, Condition, Evidence, Other)
    - Added category selector dropdown when uploading photos
    - Added category badges on photo thumbnails
    - Added "Download ZIP" button with category-organized folders
    - Uses JSZip for client-side ZIP generation
  - `package.json` - Added `jszip` dependency
- **Features:**
  - 6 photo categories: `before`, `after`, `spare_part`, `condition`, `evidence`, `other`
  - Color-coded category badges on each photo
  - Filter photos by category with count indicators
  - Category selector when uploading (visible during In Progress status)
  - Download all photos as ZIP with folders per category
  - Filtered downloads respect current category filter
- **DB Migration Required:** Run `add_job_media_category.sql` before use
- **Access:** Technician, Admin, Supervisor

### Documentation
- DB schema docs synced to current Supabase schema (2026-01-02 00:16:45 CST, author: Codex)

### UX Improvements (2026-01-03)
- ✔️ **Toast Notifications** - Added user-visible error/success notifications across all pages
  - Added `showToast.error()` to catch blocks that previously only used `console.error`
  - Pages fixed: `Invoices.tsx`, `CustomerProfile.tsx`, `EmployeeProfile.tsx`, `Forklifts.tsx`, `ServiceDue.tsx`, `ServiceRecords.tsx`, `TechnicianKPIPage.tsx`, `TechnicianKPIPageV2.tsx`
  - Uses existing `sonner` library + `toastService.ts` helper
- ✔️ **Employee Field Fixes** - Fixed field name mismatches after User-Employee merge
  - `EmployeesPage.tsx`: `employee.status` → `employee.employment_status` (3 places)
  - `EmployeesPage.tsx`: `employee.user?.role` → `employee.role`
  - `EmployeeProfile.tsx`: `employee.status` → `employee.employment_status` (3 places)
  - `EmployeeProfile.tsx`: `editData.status` → `editData.employment_status`
- ✔️ **Null Safety Guards** - Added fallbacks for `full_name` to prevent runtime crashes
  - Pattern: `employee.full_name || employee.name || ''`
  - Applied in: `EmployeesPage.tsx` (4 places), `EmployeeProfile.tsx` (4 places)

### Data Integrity Fixes (2026-01-03)
- ✔️ **Timestamp Guards in updateJobStatus** - Prevents timestamp overwrites on status re-submission
  - Forward transitions: Only set timestamps if not already set
  - Rollback `In Progress` → `Assigned`: Clears `arrival_time`, `started_at`
  - Rollback `Awaiting Finalization`/`Completed` → `In Progress`: Clears completion timestamps
  - File: `services/supabaseService.ts` - `updateJobStatus()` function
- ✔️ **Hourmeter Validation** - Prevents hourmeter readings less than forklift's current reading
  - Client-side: `JobDetail.tsx` - `handleSaveHourmeter()`, `handleStartJobWithCondition()`
  - Service-side: `supabaseService.ts` - `updateJobHourmeter()`, `startJobWithCondition()`
  - Shows clear error message with current forklift reading
- ✔️ **Required Fields Validation** - Enforces field requirements before status transitions
  - `Assigned` → `In Progress`: Requires `assigned_technician_id` and `forklift_id`
  - `In Progress` → `Awaiting Finalization`: Requires `hourmeter_reading` and both signatures
  - Service-side: `supabaseService.ts` - `updateJobStatus()` function
  - Uses correct DB columns: `technician_signature`, `customer_signature` (not `signatures` array)
  - Clear error messages tell user what's missing

### Status Enum Decision (2026-01-03)
- **Decision**: Keep `jobs.status` as TEXT with title-case values for now
- **Current values**: `New`, `Assigned`, `In Progress`, `Awaiting Finalization`, `Completed`
- **Rationale**: Matches ACWER workflow and existing RLS policies in `rls_redesign/`
- **Future Migration** (when workflow is locked):
  - Convert to `job_status_enum` with snake_case: `new`, `assigned`, `in_progress`, `awaiting_finalization`, `completed`
  - Update all RLS policies in `database/rls_redesign/`
  - Update `JobStatus` enum in `types.ts`
  - Update UI status displays and filters

### Security Fixes (2026-01-03)
- ✔️ Fixed 5 Security Definer views → converted to SECURITY INVOKER
  - `active_rentals_view`, `v_todays_leave`, `v_expiring_licenses`, `v_pending_leaves`, `v_expiring_permits`
- ✔️ Enabled RLS on 5 tables with role-based policies
  - `quotations`, `service_intervals`, `scheduled_services`, `notifications`, `technician_kpi_snapshots`
- ✔️ Added `SET search_path = public` to 44 functions (prevents search_path injection)
- ✔️ Enabled Leaked Password Protection (Supabase Auth setting)
- ✔️ Created helper functions with proper security: `get_current_user_role()`, `has_role()`, `get_user_id_from_auth()`

**Migration files:**
- `database/migrations/security_fix_linter_issues.sql`
- `database/migrations/fix_security_invoker_views.sql`
- `database/migrations/fix_function_search_paths.sql`

### RLS Performance Fixes (2026-01-03)
- ✔️ Fixed 25 Auth RLS InitPlan issues - wrapped `auth.uid()` with `(select auth.uid())` for caching
- ✔️ Consolidated 70+ multiple permissive policies into ~50 optimized single policies per role/action
- ✔️ Created `get_my_role()` helper function with proper caching

### User-Employee Merge Cleanup (2026-01-03)
- ✔️ **Database migration applied** - `employees` table merged into `users` table
  - Migration file: `database/migration_merge_employees_into_users.sql`
  - All HR columns now in `users` table
  - FK references updated (licenses, permits, leaves → users)
  - Views recreated to use `users` directly
  - `employees` table dropped
- ✔️ Removed final references to old `employees` table in codebase
  - `hrService.ts`: Changed HR alert join from `employee:employees(full_name, department)` to `user:users(name, department)`
  - `hrService.ts`: Updated `record.employee?.full_name` to `record.user?.name` in expiry alerts
  - `hrService.ts`: Updated `getAttendanceToday()` return type from `Employee[]` to `User[]`
  - `EmployeesPage.tsx`: Updated `loadAvailableUsers()` to query users with incomplete HR data instead of checking separate employees table
- ✔️ Updated TypeScript interfaces in `types_with_invoice_tracking.ts`
  - `EmployeeLicense.employee` → `EmployeeLicense.user`
  - `EmployeePermit.employee` → `EmployeePermit.user`
  - `EmployeeLeave.employee` → `EmployeeLeave.user`
  - `HRAlert.employee` → `HRAlert.user`
  - `AttendanceToday.available: Employee[]` → `User[]`
  - `AttendanceToday.onLeave: { employee: Employee }` → `{ user: User }`
  - Added backward compatibility: `export type Employee = User`
- ✔️ Single source of truth: All user/employee data now in `users` table

**Migration files:**
- `database/migrations/fix_rls_performance.sql`
- `database/migrations/fix_rls_performance_v2.sql` (fixed hr_alerts column name)

### Database Performance Indexes (2026-01-03)
- ✔️ Added 48 indexes for unindexed foreign keys (improves JOIN/DELETE performance)
- ✔️ Added composite index for jobs list query: `idx_jobs_active_created`
- ✔️ Added index for extra_charges: `idx_extra_charges_job_id`
- Tables indexed: employee_leaves, forklift_hourmeter_logs, forklift_rentals, forklifts, hr_alerts, job_audit_log, job_inventory_usage, job_invoice_extra_charges, job_invoices, job_media, job_parts, job_service_records, job_status_history, jobs, parts, quotations, scheduled_services, service_predictions

**Migration file:**
- `database/migrations/add_foreign_key_indexes.sql`

### Implementation Status

| # | Feature | Complexity | Requirements | Build Status |
|---|---------|------------|--------------|--------------|
| 1 | Helper Technician | Medium | ✅ Confirmed | ❌ Not started |
| 2 | In-Job Request System | High | ✅ Confirmed | ❌ Not started |
| 3 | Spare Parts Request/Approval | Medium | ✅ Confirmed | ❌ Not started |
| 4 | Hourmeter Reading + prediction | Medium | ✅ Confirmed | ✔️ Completed |
| 5 | Service Intervals | Low | ✅ Confirmed | ✔️ Completed |
| 6 | Job Reassignment + Items/KPI | High | ✅ Confirmed | ❌ Not started |
| 7 | Multi-Day Jobs + Escalation | Medium | ✅ Confirmed | ❌ Not started |
| 8 | Deferred Customer Acknowledgement | Medium | ✅ Confirmed | ❌ Not started |
| 9 | KPI Dashboard | Medium | ✅ Confirmed | ❌ Not started |
| 10 | Photo Categorization + ZIP | Low | ✅ Confirmed | ✔️ Completed |
| 11 | Partial Work Tracking | Low-Medium | ⏳ Pending | ❌ Not started |

**Summary:** 7 features ready to build, 1 awaiting client confirmation, 3 completed

---

### Confirmed Requirements (Jan 2026)

#### Job Reassignment
| Decision | Details |
|----------|---------|
| Frequency | Rarely |
| Reasons | Skill/expertise issue, Technician unavailable |
| Items handling | Admin controls cancel/transfer (existing process) |
| Multi-reassignment | Allowed (Tech A → B → C) |
| Partial work | Must record separately for billing *(detail level TBD)* |

#### Helper Technician
| Decision | Details |
|----------|---------|
| Max helpers per job | 1 at a time |
| Frequency needed | Sometimes |
| Implementation | Same Technician role, different `assignment_type` ('lead' vs 'assistant') |
| Permissions | Photos + start/end times only. No hourmeter, no spare parts, no signature |

#### Multi-Day Jobs & Escalation
| Decision | Details |
|----------|---------|
| Escalation trigger | 8:00 AM next business day |
| Monday-Friday | Standard job, counts toward day limit |
| Saturday (OT) | Marked "Overtime Job", escalation disabled, days counter paused |
| Sunday | TBD - assume no work |

#### Spare Parts Requests
| Decision | Details |
|----------|---------|
| Admin response time | Within hours |
| Batch requests | Yes, multiple parts at once |
| Technician input | Text description + optional photo |
| Admin action | Selects from inventory, approves/rejects |
| Post-job amendment | Admin can amend Items Used before finalizing |

#### Hourmeter & Service Prediction
| Decision | Details |
|----------|---------|
| Electric forklifts | Every 3 months from delivery date (calendar-based) |
| Diesel forklifts | Every 500 hours (hourmeter-based) |
| LPG forklifts | Every 350 hours (hourmeter-based) |
| Input by | Main Technician only |
| Monitoring | Admin dashboard for prediction |

#### Customer Signature — Deferred Acknowledgement
| Decision | Details |
|----------|---------|
| Standard flow | Customer signs on-site (mandatory for job completion) |
| Exception flow | "Customer Not Signed Onsite" option |
| Requirements | Mandatory reason + mandatory evidence (photos/hourmeter/work images) |
| Job status | "Completed – Awaiting Customer Acknowledgement" |
| Customer notification | Auto-send via email/portal/SMS |
| Customer options | Sign later, acknowledge without signature, raise dispute |
| Auto-complete | 3-5 working days no response → auto Completed, Admin notified |
| Audit | Full trail for billing, KPI, disputes |

---

### Pending Decisions

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Partial work detail level | ⏳ Awaiting client | Options: flag only, time+tasks, percentage |

---

### Technical Decisions Made

| Decision | Rationale |
|----------|-----------|
| Helper as `assignment_type`, not new role | Same person can be lead on one job, assistant on another. Simpler RLS. |
| Service prediction: start with SQL rules | Defer Python ML service until sufficient historical data |
| Spare parts: request/approve flow | Defer full inventory management; integrate AutoCount later |

---

## [1.0.1] - December 2024

### Added
- Job Type Classification (Service, Repair, Checking, Accident)
- Photo upload timestamps and uploader tracking
- Professional invoice format matching industry standards

---

## [1.0.0] - December 2024

### Initial Release
- Role-based permissions: Admin, Supervisor, Accountant, Technician
- Job lifecycle with audit trails
- Customer signature validation
- Condition checklist (48 items)
- PDF invoice and service report generation
- Forklift rental tracking
- Soft light/dark theme
- Multi-select bulk operations

---

## How to Update This Log

When making changes:
1. Add entry under `[Unreleased]` with date
2. Categorize: `Added`, `Changed`, `Fixed`, `Removed`, `Confirmed`, `Pending`
3. Reference client communication where applicable
4. Move to versioned section on release

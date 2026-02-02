# FieldPro Changelog

All notable changes to the FieldPro Field Service Management System.

---

## [2026-02-02] - Customer Feedback Bug Fixes

### Bug Fixes
- **Checklist validation** — Fixed "invalid input syntax for type boolean: 'ok'" error
  - Root cause: Trigger tried to cast string 'ok' to boolean
  - Fix: Now handles both old (true/false) and new ('ok'/'not_ok') formats
  
- **Job completion validation** — Fixed "Job was never started (started_at is null)" error
  - Root cause: Status dropdown path didn't sync `started_at` to service record
  - Fix: Now checks `jobs.started_at`, `repair_start_time`, and `arrival_time` as fallbacks
  - Added trigger to auto-sync job timestamps to service records

### Database Changes
- `validate_job_checklist()` — Handles string checklist states
- `validate_job_completion_requirements()` — Checks multiple timestamp sources
- `sync_job_started_to_service_record()` — New trigger for timestamp sync
- Backfill migration for existing service records

### Code Changes
- `jobService.ts` — `updateJobStatus` now syncs `started_at` to service records

### Tests Added
- `tests/customer-feedback-fixes.spec.ts` — Validates both fixes

### New: Error Tracking ("Desire Paths")
- `user_action_errors` table — Tracks failed user actions
- `errorTrackingService.ts` — Service to log and analyze errors
- Auto-tracking integrated into `toastService.ts`
- Helps identify what users try to do that fails → build those features

---

## [2026-02-01] - Workflow Simplification & Bug Fixes

### Unified Admin Workflow
- **Removed Admin Service/Store split** — All admins now have full permissions
- **Auto-confirm parts** — Parts automatically confirmed when admin adds them
- **Parts visible to technicians** — Technicians see parts immediately (names only, no prices)
- **Removed "Pending Verification" block** — No longer blocks technicians from seeing parts

### Checklist Improvements
- **"Check All" button** — Marks all 48 checklist items as OK with one click
- **Auto-X on untick** — Click OK on already-checked item to mark as needs attention
- **Workflow:** Check All → Untick exceptions → Save

### Bug Fixes
- **Complete button** — Now shows warning modal for missing mandatory checklist items
- **Photo upload** — Fixed black screen / slowness with image compression (1920px max, 85% quality)
- **GPS timeout** — Reduced from 10s to 5s to prevent upload delays
- **Part request approval** — Now auto-confirms parts when admin approves request

### Restored Features (from refactor audit)
These features were accidentally removed during code modularization:
- Condition Checklist Card — view/edit with OK/Not OK buttons
- Parts Section — admin can add/edit/remove parts
- Job Details Card — Job Carried Out + Recommendation fields
- Confirmation Status Card — Parts and Job confirmation status
- Extra Charges Section — add/view/remove extra charges
- Helper Assignment — assign/remove helper technicians
- Deferred Completion Modal — complete without customer signature

### Part Request System (New)
- **Technicians can request parts** via "Request Part" button
- **Admins approve/reject** requests with part selection
- **Auto-adds to job** when approved

---

## [2026-01-31] - Code Quality & Architecture

### Modular Refactoring
Split large page components into maintainable modules:
- JobDetail (3262 → ~200 lines per component)
- TechnicianDashboard, AccountantDashboard
- CustomerProfile, EmployeeProfile, ForkliftsTabs
- MyVanStock, VanStockPage, CreateJob

### Performance
- **Bundle optimization** with lazy loading
- **Database query optimization** — eliminated N+1 queries
- **Infinite refetch fix** — resolved ERR_INSUFFICIENT_RESOURCES

### Security
- **RLS policies** fixed for all tables
- **Trigger fixes** for real-time updates
- **Supabase security linter** warnings resolved

---

## [2026-01-29] - Push Notifications & Real-Time

### Push Notifications
- Real browser push notifications (not just in-app)
- Background notification support
- Sound alerts for new jobs

### Real-Time Updates
- WebSocket connection health indicator
- Live job status updates
- Automatic sync on reconnect

### Job Response Timer
- 15-minute accept/reject requirement
- Auto-escalation if no response
- Visual countdown timer

---

## [2026-01-28] - Customer Feedback Implementation

### Phase 1-3 Features
- **Pricing hidden from technicians** — Only admins/accountants see prices
- **Binary checklist** — OK ✓ or Not OK ✗ only
- **Photo auto-start** — First photo starts job timer
- **Request editing** — Technicians can edit pending requests
- **Hourmeter persistence** — Preserved across reassignment
- **Dashboard notifications** — Recent notifications feed

---

## [2026-01] - January 2026 Summary

### Major Features Added
- Helper Technician System
- In-Job Request System (assistance, parts, skillful tech)
- Multi-Day Job Support with escalation
- Deferred Customer Acknowledgement
- Photo Categorization with ZIP download
- AutoCount Integration for invoices
- Fleet Dashboard with real-time status
- Photo Validation (GPS + timestamp)

### UI/UX Improvements
- Role-specific dashboards (Technician, Accountant)
- Dark mode support
- Mobile-optimized layouts
- Swipeable job cards

---

## [1.0.1] - December 2024

- Job types and categorization
- Photo tracking system
- Invoice format improvements

---

## [1.0.0] - December 2024

- Initial FieldPro release
- Core job management
- User authentication
- Basic reporting

---

## Archive

Detailed historical changelogs are available in `docs/archive/`.

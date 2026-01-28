# FieldPro Changelog

All notable changes, decisions, and client requirements for this project.

---

## 📋 Planned / Upcoming

### Supabase Edge Functions
- **Added:** 2026-01-28 (noted by Jay)
- **Status:** ❌ Not Started
- **Priority:** TBD

Implement Supabase Edge Functions for the project. Details to be defined.

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

## [2026-01-28] - Customer Feedback Implementation Phase 3

### 🔧 Tech Job Summary Parts Filter (2026-01-28)
- **Updated:** 2026-01-28 (author: Phoenix/Clawdbot)
- **Status:** ✔️ Completed
- **Customer Feedback:** Filter parts visibility for technicians by confirmation status

#### Problem
Technicians could see all parts immediately, even before Admin 2 (Store) verified them.

#### Changes Made

**1. Parts Visibility Filter for Technicians**
- Before Admin 2 confirmation: Shows "Parts Pending Verification" message
- Displays count of pending parts without showing details
- After confirmation: Shows all parts (without pricing)
- Includes verification timestamp and verifier name

**2. UI Changes**
- Amber warning box for pending verification
- Green checkmark with verification details for confirmed parts
- Clear messaging about who verified and when

#### Display Rules
| Role | Before Confirmation | After Confirmation |
|------|--------------------|--------------------|
| Technician | "Pending Verification" message | All parts (no prices) |
| Admin/Supervisor | All parts with prices | All parts with prices |
| Accountant | All parts with prices | All parts with prices |

#### Files Modified
- `pages/JobDetail.tsx` — Added parts visibility filter for technicians

---

### 🔔 Enhanced Dashboard Notifications (2026-01-28)
- **Updated:** 2026-01-28 (author: Phoenix/Clawdbot)
- **Status:** ✔️ Completed
- **Customer Feedback:** Expand notification display beyond bell icon

#### Problem
Dashboard only showed a bell icon with count. Users wanted to see full notification list directly on dashboard.

#### Changes Made

**1. Enhanced DashboardNotificationCard**
- Added toggle between Unread and All notifications
- Added expand/collapse functionality for full feed
- Shows up to 20 notifications when expanded (scrollable)
- Added priority-based visual indicators (border colors)
- More comprehensive notification type icons
- Read notifications displayed with reduced opacity

**2. New Features**
- `showReadNotifications` toggle to view read items
- `expandable` prop for dashboards that need full feed
- "Show more" button with remaining count
- "View all notifications" link to full page
- Visual unread indicator (blue dot) on unread items

**3. Notification Types Support**
- Job assigned, completed, pending
- Request approved/rejected
- Helper requests, spare part requests
- Service due, rental ending
- Leave requests, escalations

#### Files Modified
- `components/DashboardNotificationCard.tsx` — Complete enhancement

---

### ✅ Condition Checklist - Binary States (2026-01-28)
- **Updated:** 2026-01-28 (author: Phoenix/Clawdbot)
- **Status:** ✔️ Completed
- **Customer Feedback:** Enforce binary states in condition checklist

#### Problem
Checklist items could be left in undefined/neutral state, and buttons allowed toggling back to undefined.

#### Changes Made

**1. Binary State Enforcement**
- OK and Not OK buttons no longer toggle off (no neutral state)
- Clicking OK always sets to OK, clicking Not OK always sets to Not OK
- Can only switch between states, never back to undefined

**2. "Check All" Button**
- Confirmation modal before checking all items
- Sets all items to OK with audit logging
- Reminder to physically verify each item

**3. Auto-Set Unchecked to Not OK**
- On save, any unchecked items automatically marked as "Not OK"
- Implements "Unticked = automatic Cross" requirement
- Toast notification confirms unchecked items marked as Not OK

**4. Mandatory Validation**
- Job completion blocked if mandatory items not checked
- Warning modal shows missing items with option to go back and fix
- All mandatory items marked with red asterisk (*)

#### Files Modified
- `pages/JobDetail.tsx` — Binary state buttons, auto-set unchecked, validation

---

### 📡 Enhanced Real-Time Updates (2026-01-28)
- **Updated:** 2026-01-28 (author: Phoenix/Clawdbot)
- **Status:** ✔️ Completed
- **Customer Feedback:** Expand real-time updates beyond job deletions

#### Problem
Real-time subscriptions were limited to job deletions only. Users needed manual refresh to see job status changes, request approvals/rejections, and job assignments.

#### Changes Made

**1. JobBoard.tsx - Comprehensive Real-Time Subscriptions**
- Added subscription for ALL job updates (not just deletions)
- Job status changes now update in place with toast notifications
- Job assignments trigger notifications
- New job creation triggers list refresh for admins/supervisors
- Added WebSocket connection state tracking (`isRealtimeConnected`)

**2. JobDetail.tsx - Real-Time Job & Request Updates**
- Status changes update automatically with toast notifications
- Reassignment notifications (for current user and others)
- Job request approvals/rejections trigger live updates
- New requests on the job trigger notifications
- Visual connection indicator (green dot) in header

**3. Connection Health Monitoring**
- Both pages track WebSocket connection status
- Visual indicator shows live/offline state
- Console logging for debugging connection issues

#### Subscriptions Added
| Event | Target | Notification |
|-------|--------|--------------|
| Job status change | JobBoard, JobDetail | "Status changed to X" |
| Job assignment | JobBoard, JobDetail | "Job assigned to X" |
| Job deletion | JobBoard, JobDetail | "Job removed" + redirect |
| New job created | JobBoard | "New job created" |
| Request approved | JobDetail | "Request approved" |
| Request rejected | JobDetail | "Request rejected" |
| New request | JobDetail | "New request submitted" |

#### Files Modified
- `pages/JobBoard.tsx` — Expanded real-time subscription, added connection state
- `pages/JobDetail.tsx` — Added job & request subscriptions, connection indicator

---

## [2026-01-28] - Customer Feedback Implementation Phase 2

### 🔄 Real-Time Job Deletion Sync (2026-01-28)
- **Updated:** 2026-01-28 (author: Phoenix/Clawdbot)
- **Status:** ✔️ Completed
- **Customer Feedback:** Deleted jobs remain active in Technician App

#### Problem
When Admin deleted a job, technicians viewing that job or their job list would not see the update until they manually refreshed. This caused confusion and potential work on cancelled jobs.

#### Changes Made

**1. JobBoard.tsx - Real-Time Subscription**
- Added Supabase real-time subscription for job deletions
- When a job is soft-deleted (deleted_at set), it's automatically removed from the technician's list
- Toast notification: "Job removed - A job has been cancelled or deleted by admin"
- Also refreshes deleted jobs list for admin/supervisor

**2. JobDetail.tsx - Redirect on Deletion**
- Added real-time subscription for the specific job being viewed
- If job is deleted while viewing, user is redirected to /jobs with warning toast
- Prevents technicians from working on cancelled jobs

#### Files Modified
- `pages/JobBoard.tsx` — Added real-time subscription for job deletions
- `pages/JobDetail.tsx` — Added redirect when viewed job is deleted

#### Impact
| Scenario | Before | After |
|----------|--------|-------|
| Job deleted while tech viewing list | No update, stale data | Job disappears immediately |
| Job deleted while tech viewing detail | No update, can continue working | Redirect to job list with warning |
| Admin deletes job | Only visible after page refresh | Real-time sync for all users |

---

### 💰 Pricing Hidden from Technicians (2026-01-28)
- **Updated:** 2026-01-28 (author: Phoenix/Clawdbot)
- **Status:** ✔️ Verified Complete
- **Customer Feedback:** Remove pricing visibility from technician view

#### Implementation Verified
The following pricing elements are hidden from technicians via `canViewPricing` check (Admin, Accountant, Supervisor only):

| Element | Location | Status |
|---------|----------|--------|
| **Financial Summary Card** | Right sidebar | ✅ Hidden |
| **Extra Charges Section** | Main content | ✅ Hidden |
| **Part Prices in List** | Parts Used section | ✅ Hidden (shows qty × name only) |
| **Price Input for Parts** | Add part form | ✅ Hidden |
| **Price in Dropdown** | Part selector | ✅ Shows stock only, no RM price |
| **Van Stock Price** | Van Stock selector | ✅ Shows quantity only, no RM price |
| **Labor Cost** | Financial summary | ✅ Hidden |
| **Total Cost** | Financial summary | ✅ Hidden |

#### canViewPricing Definition
```typescript
const canViewPricing = isAdmin || isAccountant || isSupervisor;
```

#### What Technicians See
- Parts Used: `2× Hydraulic Filter` (no price)
- Part Selector: `Stock: 15 | Hydraulic` (no RM price)
- No Financial Summary card
- No Extra Charges section
- Info hint to use Spare Part Request workflow

#### Files Verified
- `pages/JobDetail.tsx` — All pricing conditionally rendered via `canViewPricing`

---

### 🔧 Parts Entry Admin Only (2026-01-28)
- **Updated:** 2026-01-28 (author: Phoenix/Clawdbot)
- **Status:** ✔️ Verified Complete
- **Customer Feedback:** Remove parts entry from technician app - Admin only

#### Implementation Verified
Technicians cannot directly add parts to jobs. They must use the Spare Part Request workflow:

| Action | Technician | Admin/Supervisor | Accountant |
|--------|-----------|------------------|------------|
| Add parts directly | ❌ No | ✅ Yes | ✅ Yes (awaiting finalization) |
| Request spare parts | ✅ Yes | ✅ Yes | N/A |
| Approve requests | ❌ No | ✅ Yes | N/A |
| Pre-job parts | ❌ No | ✅ Admin Store only | N/A |

#### canAddParts Definition
```typescript
const canAddParts =
  !isHelperOnly &&
  !isTechnician &&  // <-- Technicians excluded
  (((isAssigned || isInProgress) && (isAdmin || isSupervisor)) ||
    (isAwaitingFinalization && (isAdmin || isAccountant || isSupervisor)) ||
    ((isNew || isAssigned) && isAdminStore));
```

#### Technician Workflow
1. Technician clicks "Spare Part" button in In-Job Requests section
2. Describes the part needed + optional photo
3. Request status: "Pending"
4. Admin reviews request
5. Admin selects actual part from inventory
6. Admin approves → Part added to job automatically
7. Technician can edit pending requests they created

#### UI Changes for Technicians
- "Add Part" section hidden
- Info hint displayed: "Need additional parts? Use **Spare Part Request** in the In-Job Requests section below."
- "Spare Part" request button prominently shown
- Pending/approved/rejected requests visible with status

#### Files Verified
- `pages/JobDetail.tsx` — `canAddParts` excludes technicians; hint shown instead

---

## [2026-01-27] - Documentation & Claude Code Setup Updates

### 📚 Documentation Updates
- **Updated:** 2026-01-27 (author: Phoenix/Clawdbot)
- **Status:** ✔️ Completed

#### Changes Made

**1. SETUP_GUIDE.md Overhauled**
- Added complete VM setup instructions for next developer
- Included all test account credentials
- Added Claude Code environment setup section
- Removed incorrect "superpowers@claude-plugins-official" reference
- Added correct superpowers installation instructions (obra/superpowers-marketplace)

**2. Superpowers Plugin Installed**
- Marketplace: `obra/superpowers-marketplace`
- Plugin: `superpowers@superpowers-marketplace` v4.1.1
- Commands: `/superpowers:brainstorm`, `/superpowers:write-plan`, `/superpowers:execute-plan`

**3. Customer Feedback Tests Committed**
- `tests/customer-feedback.spec.ts` - 12 passing, 2 skipped
- `docs/CUSTOMER_FEEDBACK_REQUIREMENTS.md` - Requirements documentation
- `playwright.config.ts` - Test configuration updates

**4. Claude Code Global Setup**
- `~/.claude/statusline-command.sh` - Custom statusline
- `~/.claude/settings.json` - Global settings

#### Commits
- `3f153ea` docs: Add correct superpowers plugin installation instructions
- `a727013` feat: Customer feedback tests and requirements documentation
- `752a53b` docs: Remove fake superpowers plugin, clarify project-local skills
- `27dce9a` feat: Add complete Claude Code environment setup
- `6cc33c9` docs: Add VM setup guide for next developer

---

### 🔧 Spare Parts Before Job Start (2026-01-28)
- **Updated:** 2026-01-28 (author: Phoenix/Clawdbot)
- **Status:** ✔️ Completed
- **Customer Feedback:** Allow spare parts recording before job starts

#### Problem
Technicians and Admins could only add/request spare parts after a job was started ("in progress"). This limited preparation flexibility — techs couldn't list needed parts while the job was still "assigned".

#### Changes Made

**1. Updated `canAddParts` logic (line 1152)**
- BEFORE: Admin/Supervisor could only add parts when job "in progress"
- AFTER: Admin/Supervisor can add parts when job is "assigned" OR "in progress"

**2. Updated Notes input visibility (line 2145)**
- BEFORE: Only visible when "in progress"
- AFTER: Visible when "assigned" OR "in progress"

**3. Updated Requests section visibility (line 2155)**
- BEFORE: Only visible when "in progress"  
- AFTER: Visible when "assigned" OR "in progress"

#### Result
| Role | Assigned | In Progress |
|------|----------|-------------|
| Technician | ✅ Request parts | ✅ Request parts |
| Admin | ✅ Direct add + approve | ✅ Direct add + approve |
| Supervisor | ✅ Direct add + approve | ✅ Direct add + approve |

#### Files Modified
- `pages/JobDetail.tsx` — 3 condition changes

---

## [Unreleased] - ACWER Workflow Implementation

### 🎨 Permission Modal UI Improvement (2026-01-20)
- **Updated:** 2026-01-20 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Replaced cramped inline permission panel in DevBanner with a clean centered modal; fixed permission overrides to work app-wide

#### Problem
The existing permission panel in DevBanner was:
1. Cramped inline display that expanded the banner awkwardly
2. Read-only - couldn't toggle permissions directly
3. Poor UX on smaller screens
4. Permission overrides didn't affect navigation (Sidebar, MobileNav, MobileDrawer used local function instead of context)

#### Changes Made

**1. Created PermissionModal Component (`components/dev/PermissionModal.tsx`)**
- Centered modal with dark backdrop overlay
- Theme-aware styling using CSS variables (`bg-theme-surface`, `text-theme`, etc.) - works in both light and dark themes
- All 27 permissions organized into 7 logical groups
- Toggle switches using Lucide ToggleLeft/ToggleRight icons
- Visual indicators:
  - Enabled: Green toggle (indigo if overridden)
  - Disabled: Gray toggle
  - Overridden (differs from role default): Amber highlight with reset button
- Search/filter input to quickly find permissions
- "Reset All" button to clear all overrides
- Close via X button, Escape key, or click-outside

**2. Updated DevBanner (`components/dev/DevBanner.tsx`)**
- Replaced `showPermissions` state with `showModal` state
- Removed inline collapsible permission panel entirely
- Changed button from "Show/Hide Permissions" to "Permissions" with Shield icon
- Added amber badge showing override count when > 0
- Renders PermissionModal component when open

**3. Fixed Permission Overrides in App.tsx**
- Sidebar, MobileNav, MobileDrawer, and AppLayout now use `useDevModeContext().hasPermission()` instead of local `hasPermission()` function
- This ensures permission overrides set in PermissionModal affect navigation/routing
- Renamed unused local function to `hasPermissionLocal` with note to use context's version

#### Permission Groups
- Dashboard & General (3): View Dashboard, View KPI, View Own Profile
- Jobs (6): View/Create/Assign/Reassign/Edit/Delete Jobs
- Customers (3): View/Edit/Delete Customers
- Forklifts & Service (4): View/Edit Forklifts, View Service Records, Schedule Maintenance
- Inventory & Rentals (4): Manage/Edit Inventory, Manage Rentals, Edit Rental Rates
- Finance (3): Finalize Invoices, View Pricing, View Job Costs
- HR & Users (4): View HR, Manage Employees, Approve Leave, Manage Users

#### Files Modified
- `components/dev/PermissionModal.tsx` — New file (theme-aware centered modal with permission toggles)
- `components/dev/DevBanner.tsx` — Simplified to button + modal, removed inline panel
- `App.tsx` — Updated Sidebar, MobileNav, MobileDrawer, AppLayout to use context's hasPermission

---

### 🔧 Dev Mode UI Refactoring (2026-01-20)
- **Updated:** 2026-01-20 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Fixed dev mode impersonation UI - moved controls from page content to header, fixed dual state bug

#### Problem
1. RoleSwitcher component was rendering in the middle of page content (PrototypeDashboards.tsx)
2. Hard-coded dark theme colors not following global theme system
3. Dual devMode state instances: App.tsx used `useDevMode()` directly while DevModeSelector used context, causing state desync

#### Changes Made

**1. Refactored App.tsx Architecture**
- Created `AppLayout` inner component that uses `useDevModeContext()`
- Moved all layout/navigation logic inside AppLayout
- Single source of truth for devMode state shared by DevModeSelector, DevBanner, and navigation
- Import changed from `useDevMode` to `useDevModeContext`

**2. Cleaned Up PrototypeDashboards.tsx**
- Removed RoleSwitcher import and rendering from page content
- Removed local DevBanner (handled globally by App.tsx)
- Changed from `useDevMode()` to `useDevModeContext()` for shared state

**3. DevModeSelector (Already Theme-Aware)**
- Compact dropdown in header with role selection, mode toggle (UI Only/Strict), and Exit button
- Uses CSS variable classes (`bg-theme-surface`, `text-theme`, etc.)
- Only visible to dev users

**4. Fixed DevBanner Visibility**
- TopHeader now moves to `top-10` when dev mode is active (was `top-0`, blocking banner)
- Main content area gets `pt-14` padding when dev mode active
- DevBanner now clearly visible without overlapping header

#### Files Modified
- `App.tsx` — Refactored to AppLayout pattern, single devMode context
- `pages/PrototypeDashboards.tsx` — Removed RoleSwitcher and local DevBanner
- `components/dev/DevModeSelector.tsx` — (Previously created) Theme-aware header dropdown

---

### 🛠️ Development Process: Multi-Session Debugging Practice (2026-01-19)
- **Updated:** 2026-01-19 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Added lightweight findings practice for debugging that spans multiple sessions

#### Changes Made

**1. Updated CLAUDE.md**
- Added "For Multi-Session Debugging" section
- Documents when/how to create `docs/findings/<issue-name>.md` files
- Captures: what was tried, root causes found, current hypothesis, key code locations

**2. Created docs/findings/ Directory**
- Empty directory ready for future debugging session notes
- Added `.gitkeep` to preserve in version control

#### Rationale
Based on analysis of project history (e.g., Notification RLS saga spanning Jan 7-8), bugs that span multiple sessions often involve re-discovering the same problems. Findings files capture institutional knowledge during investigation, then get summarized into CHANGELOG entries once resolved.

#### Files Modified
- `CLAUDE.md` — Added multi-session debugging section
- `docs/findings/.gitkeep` — New file

---

### 📋 Customer Feedback Implementation - Phase 1-3 Complete (2026-01-19)
- **Updated:** 2026-01-19 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Full implementation of customer feedback requirements across notification systems, admin workflows, and technician features

#### Phase 1: Critical Business Logic

**1. Parts Confirmation Verification Dependency**
- Admin 1 (Service) cannot finalize jobs until Admin 2 (Store) confirms parts
- Added validation in `PendingConfirmations.tsx:handleConfirmJob`
- Database trigger enforces at SQL level (`check_parts_confirmed_before_job_complete`)
- Error message: "Store Verification Pending: Admin 2 must approve parts before final service closure"

**2. Pricing Hidden from Technicians**
- Technicians cannot see: Part prices, labor costs, financial summary, extra charges
- Added `canViewPricing` permission check (`isAdmin || isAccountant || isSupervisor`)
- Parts display shows "Qty × Part Name" only for technicians

**3. Parts Entry Removed from Technicians**
- Technicians can no longer directly add parts to jobs
- Modified `canAddParts` logic to exclude technicians entirely
- Technicians use "Spare Part Request" workflow instead
- UI shows hint: "Use Spare Part Request to request additional parts"

#### Phase 2: Technician UX Enhancements

**4. Binary Checklist States (OK / Not OK)**
- Changed checklist from boolean to three-state: `'ok' | 'not_ok' | undefined`
- Two buttons per item: green ✓ (OK), red ✗ (Not OK)
- Added `ChecklistItemState` type and `normalizeChecklistState` helper
- Backward compatible with existing boolean values
- Job completion blocked if any mandatory items undefined

**5. Photo-Based Auto-Start Job Timer**
- First photo upload automatically starts job timer
- Sets `repair_start_time`, `started_at`, and status to "In Progress"
- Toast notification: "Job timer started automatically with first photo"

**6. Request Edit Capability**
- Technicians can edit their own pending requests (status = 'pending')
- Edit button appears only for pending requests created by current user
- Added `updateJobRequest()` function in supabaseService
- RLS policy enforces ownership and status check

**7. Hourmeter Persistence on Reassignment**
- First technician's hourmeter reading is preserved through reassignment
- Added `first_hourmeter_recorded_by_id/name/at` fields
- Subsequent technicians see read-only with "Recorded by [Name]" note
- Amendment button available for corrections (requires approval)

#### Phase 3: Admin & Notification Features

**8. Dashboard Notification Display**
- Created `DashboardNotificationCard.tsx` component
- Shows 5 recent unread notifications
- Added to TechnicianDashboard, AccountantDashboard
- Uses `useNotifications()` from NotificationContext
- Click navigates to relevant page (job detail, pending confirmations)

**9. Multi-Admin Conflict Handling (Job Locking)**
- In-memory lock system for job confirmation actions
- `acquireJobLock()`, `releaseJobLock()`, `checkJobLock()` functions
- 5-minute automatic lock timeout
- Warning displayed if job locked by another admin
- Prevents simultaneous edits by multiple admins

**10. Pre-Job Spare Parts Amendment for Admin 2**
- Admin 2 (Store) can add parts for jobs in New/Assigned status
- Expanded `canAddParts` to include `isAdminStore` for pre-job states
- Parts can be allocated before technician starts work

#### Files Changed

| File | Changes |
|------|---------|
| `pages/JobDetail.tsx` | Pricing visibility, parts entry removal, checklist binary states, photo auto-timer, hourmeter display, request edit |
| `pages/PendingConfirmations.tsx` | Parts confirmation dependency, job locking |
| `services/supabaseService.ts` | updateJobRequest, job locking functions, modified hourmeter logic |
| `types/index.ts` | ChecklistItemState type, first_hourmeter fields |
| `components/DashboardNotificationCard.tsx` | New component |
| `components/dashboards/TechnicianDashboard.tsx` | Added notification card |
| `components/dashboards/AccountantDashboard.tsx` | Added notification card |

#### Database Migration

New migration: `supabase/migrations/20260119000001_customer_feedback_implementation.sql`
- Hourmeter persistence columns
- Parts confirmation enforcement trigger
- RLS policy for request edits
- Notification indexes for performance

---

### 🔧 Dev UI Control Panel - Slide-out Panel for Developers (2026-01-19)
- **Updated:** 2026-01-19 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Comprehensive developer control panel with role simulation, permission overrides, feature flags, and quick actions

#### Features:

**1. Slide-out Dev Panel**
- Floating gear button in bottom-right corner (only visible to dev users)
- Keyboard shortcut: `Ctrl+Shift+D` to toggle panel
- Non-intrusive design that doesn't block app content
- Persists settings across page reloads

**2. Role Simulation (Enhanced)**
- Role dropdown to switch between any role (Admin, Technician, etc.)
- UI Only mode: See UI as role, keep real permissions
- Strict mode: Full role simulation with enforced permissions

**3. Permission Overrides (New)**
- Toggle ANY of the 27 permissions on/off individually
- Override the role's default permissions for testing edge cases
- Example: "What if Technician COULD create jobs?"
- Visual indicator for overridden vs role default
- "Reset to Role Defaults" button

**4. Feature Flags (New)**
- Toggle experimental features on/off:
  - `realtimeNotifications` - Enable/disable real-time notifications
  - `experimentalUI` - Enable experimental UI components
  - `dashboardV5` - Future dashboard version toggle (placeholder)
  - `debugMode` - Show extra debug info in console
  - `aiSummary` - AI summary generation for jobs
  - `darkModeBeta` - Dark mode beta features
- Persisted to localStorage

**5. Quick Actions (New)**
- Copy State as JSON - Export current dev settings
- Reset All Dev - Clear all dev mode settings
- Test Toasts - Trigger sample notifications
- Clear Dev Storage - Clear only dev-related localStorage
- Clear All Storage - Full localStorage reset

#### Architecture:

**New Files:**
```
/contexts/FeatureFlagContext.tsx     — Feature flag state management
/hooks/useFeatureFlags.ts            — Feature flag hook
/components/dev/
  ├── DevPanel.tsx                   — Main slide-out panel
  ├── DevPanelToggle.tsx             — Floating button + keyboard shortcut
  ├── RoleSwitcher.tsx               — Enhanced role switcher (updated)
  ├── PermissionOverrides.tsx        — Permission toggle grid
  ├── FeatureFlags.tsx               — Feature flag toggles
  └── QuickActions.tsx               — Utility action buttons
```

**Updated Files:**
- `hooks/useDevMode.ts` — Added permission override support
- `contexts/DevModeContext.tsx` — Added `setPermissionOverride()`, `clearPermissionOverrides()`, enhanced `hasPermission()` to check overrides first
- `App.tsx` — Added `FeatureFlagProvider`, `DevPanelToggle`

**localStorage Keys:**
```
fieldpro_dev_mode              — Role simulation settings
fieldpro_permission_overrides  — Individual permission overrides
fieldpro_feature_flags         — Feature flag states
```

#### Usage:
1. Login as `dev@test.com`
2. See floating gear button in corner
3. Click to open Dev Panel (or press `Ctrl+Shift+D`)
4. Switch to any role
5. Toggle individual permissions on/off
6. Enable/disable feature flags
7. Use quick actions for testing
8. Settings persist across page reloads

---

### 🛠️ Dev Mode Complete Role Simulator - Context Provider (2026-01-19)
- **Updated:** 2026-01-19 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Full role simulation in dev mode using React Context - page content now reflects the simulated role

#### Problem Solved:
Previously, only route guards and sidebar navigation respected dev mode. Page content (buttons, tabs, data filtering) still used the real user's role. Now the entire app simulates the selected role experience.

#### Architecture:

**New Context Provider:**
```
App.tsx
  └── DevModeProvider (wraps authenticated app)
        └── Routes
              └── Any page can call useDevModeContext()
```

**What the context provides:**
- `displayRole` - Role to show in UI (always impersonated when active)
- `permissionRole` - Role for permission checks (impersonated only in STRICT mode)
- `hasPermission(permission)` - Helper that uses correct role automatically
- `currentUser` - The actual logged-in user

#### Changes:

| Layer | Before | After |
|-------|--------|-------|
| Route guards | ✅ Used `navRole` | ✅ Same |
| Sidebar/Navigation | ✅ Used `navRole` | ✅ Same |
| Page content (buttons, tabs) | ❌ Used `currentUser.role` | ✅ Uses `useDevModeContext()` |
| Nested components | ❌ No access to dev mode | ✅ Can call `useDevModeContext()` |

#### Files Added:
- `contexts/DevModeContext.tsx` — Context provider with `hasPermission()` helper

#### Files Modified (12 pages):
- `App.tsx` — Wrap with `<DevModeProvider>`
- `pages/JobsTabs.tsx` — Use context for "New Job" button visibility
- `pages/JobBoard.tsx` — Use context for deleted jobs, "My Jobs" header
- `pages/JobDetail.tsx` — Use context for action permissions
- `pages/ForkliftsTabs.tsx` — Use context for tab visibility (FleetTab, ServiceDueTab)
- `pages/People.tsx` — Use context for tab visibility (OverviewTab, LeaveTab)
- `pages/CreateJob.tsx` — Use context for technician assignment
- `pages/InventoryPage.tsx` — Use context for Van Stock/Confirmations tabs
- `pages/ForkliftProfile.tsx` — Use context for rental/maintenance actions
- `pages/EmployeeProfile.tsx` — Use context for leave approval

#### Usage Pattern:
```tsx
// In any component inside the app:
const { displayRole, hasPermission } = useDevModeContext();

// Check permission
if (hasPermission('canCreateJobs')) {
  // Show create button
}

// Role-based UI
const title = displayRole === UserRole.TECHNICIAN ? 'My Jobs' : 'All Jobs';
```

#### Verification:
1. Login as `dev@test.com`
2. Switch to Technician + Strict mode
3. Go to `/jobs` → Header says "My Jobs", no "New Job" button
4. Go to `/forklifts` → Only Fleet and Service Due tabs visible
5. Go to `/people` (blocked by route guard) → Redirects to `/`
6. Click "Show Permissions" in banner → See all 27 permissions with ✅/❌
3. Try direct URL `/invoices` → Should redirect to `/`
4. Try direct URL `/forklifts` → Should work (Technician can view)
5. Click "Show Permissions" in banner → See all 27 permissions color-coded
6. Switch to UI Only mode → `/invoices` now accessible

---

### 🔒 Dev Mode Strict Navigation Permissions (2026-01-19)
- **Updated:** 2026-01-19 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Restrict sidebar/navigation to only show tabs the impersonated role can access when dev mode is in "Strict" mode

#### Behavior Change:
| Mode | Dashboard | Navigation (Before) | Navigation (After) |
|------|-----------|---------------------|-------------------|
| UI Only | Impersonated role | Real permissions | Real permissions |
| Strict | Impersonated role | Real permissions ❌ | Impersonated role's permissions ✅ |

#### Implementation:
| Component | Change |
|-----------|--------|
| App.tsx | Added `useDevMode` hook, created `navRole` from `permissionRole` |
| Sidebar | Uses `navRole` prop for all permission checks |
| MobileNav | Uses `navRole` prop for all permission checks |
| MobileDrawer | Uses `navRole` prop for all permission checks |

#### Files Modified:
- `App.tsx` — Import useDevMode, add navRole, pass to Sidebar/MobileNav/MobileDrawer, update permission checks

#### Verification:
1. Login as `dev@test.com`
2. Use RoleSwitcher to impersonate "Technician"
3. Set mode to "Strict"
4. Sidebar should hide Billing, Team tabs (Technician can't access these)
5. Switch to "UI Only" mode → All original tabs should reappear

---

### 📊 Dashboard Task-Focus Redesign (2026-01-19)
- **Updated:** 2026-01-19 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Redesign Accountant & Technician dashboards to show users what to do first

#### Accountant Dashboard Changes:
| Change | Description |
|--------|-------------|
| Layout reorder | Finalization Queue moved up as PRIMARY section (before KPIs/Charts) |
| FIFO sorting | Queue now shows oldest jobs first (longest waiting at top) |
| Days waiting badge | Each job shows "X days" badge with urgency color |
| Urgency highlighting | 0-2 days: normal, 3-4: yellow warning, 5-6: orange urgent, 7+: red critical |
| Enhanced alert banner | Shows urgent count + total queue value |
| Extended list | Shows 10 items (was 6) |

#### Technician Dashboard Changes:
| Change | Description |
|--------|-------------|
| Today's Schedule Carousel | New PRIMARY section with horizontal swipeable cards |
| Chronological sort | Jobs sorted by scheduled time |
| Rich cards | Show job type, title, customer, time, forklift info, status |
| Urgency indicators | Slot-In unacknowledged: red, Overdue: orange |
| Section rename | "My Jobs" → "All Active Jobs" |

#### Files Modified:
- `components/dashboards/AccountantDashboard.tsx` — Layout reorder, urgency logic, queue redesign
- `components/dashboards/TechnicianDashboard.tsx` — Carousel section, layout reorder
- `index.css` — Carousel CSS classes (`.schedule-carousel`, `.schedule-card`)

---

### 🔒 Route Guard Fix: /my-van-stock (2026-01-18)
- **Updated:** 2026-01-18 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Add missing authorization guard to `/my-van-stock` route

#### Issue:
The `/my-van-stock` route lacked a role guard, allowing any authenticated user (including Accountant) to access the technician-focused Van Stock view by directly navigating to the URL.

| Route | Before | After |
|-------|--------|-------|
| `/my-van-stock` | No guard (any user) | Role-restricted |

#### Fix Applied:
Added role-based guard in `App.tsx:465-469`:

```typescript
<Route path="/my-van-stock" element={
  [UserRole.TECHNICIAN, UserRole.ADMIN, UserRole.ADMIN_SERVICE, UserRole.ADMIN_STORE, UserRole.SUPERVISOR].includes(currentUser.role)
    ? <MyVanStock currentUser={currentUser} />
    : <Navigate to="/" />
} />
```

#### Access Matrix:
| Role | Access |
|------|--------|
| Technician | ✅ Yes |
| Admin / Admin Service / Admin Store | ✅ Yes |
| Supervisor | ✅ Yes |
| Accountant | ❌ Redirects to `/` |

---

### 🐛 Low Stock Query Bug Fix (2026-01-18)
- **Updated:** 2026-01-18 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Remove broken database query in `getLowStockItems` function

#### Root Cause:
`supabaseService.ts:getLowStockItems()` contained a fundamentally broken query that always failed:

```typescript
// BROKEN - three critical issues:
.lte('quantity', supabase.rpc('get_min_quantity', { item_id: 'item_id' }))
```

| Issue | Problem |
|-------|---------|
| Unresolved Promise | `supabase.rpc()` returns a Promise, but `.lte()` received `[object Promise]` |
| Placeholder Argument | `item_id: 'item_id'` is a literal string, not an actual UUID |
| Non-existent RPC | `get_min_quantity` function doesn't exist in the database |

The `data` and `error` from this query were never used - the code always fell through to a working fallback query.

#### Symptoms:
- Two database queries made per call (broken + fallback) instead of one
- PostgREST errors in console from invalid RPC call
- Confusing dead code for maintainers

#### Fix Applied:
Removed the broken query entirely, keeping only the working fallback logic:

```typescript
const { data: vanStock } = await supabase
  .from('van_stocks')
  .select(`items:van_stock_items(*, part:parts(*))`)
  .eq('technician_id', technicianId)
  .eq('is_active', true)
  .single();

return vanStock.items.filter((item: any) => item.quantity <= item.min_quantity);
```

#### Files Modified:
| File | Changes |
|------|---------|
| `services/supabaseService.ts` | Removed broken query (lines 5546-5554), kept working fallback |

#### Impact:
| Aspect | Before | After |
|--------|--------|-------|
| Database queries per call | 2 | 1 |
| Console errors | Yes | None |
| Functionality | Works (via fallback) | Works (direct) |

---

### 🐛 Theme Utility Classes Bug Fix (2026-01-18)
- **Updated:** 2026-01-18 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Add missing CSS utility classes for theme-aware accent colors and hover states

#### Root Cause:
`TechnicianJobsTab.tsx` referenced theme utility classes that didn't exist in `index.css`:
- `bg-theme-accent-subtle` - for "Assigned" and "Completed Awaiting Ack" badge backgrounds
- `text-theme-accent` - for accent-colored text
- `hover:bg-theme-surface-2` - for job list row hover states

The CSS variables (`--accent`, `--accent-subtle`, `--surface-2`) were properly defined, but the utility classes mapping to them were missing.

#### Symptoms:
- "Assigned" badges rendered with transparent backgrounds and default text color
- Job list rows had no hover highlight effect

#### Fix Applied:
Added three utility class definitions to `index.css`:

```css
.bg-theme-accent-subtle { background-color: var(--accent-subtle); }
.text-theme-accent { color: var(--accent); }
.hover\:bg-theme-surface-2:hover { background-color: var(--surface-2); }
```

#### Files Modified:
| File | Changes |
|------|---------|
| `index.css` | Added 3 theme utility class definitions (lines 131, 137, 140) |

---

### 🎨 Team Dashboard Theme Token Cleanup (2026-01-17)
- **Updated:** 2026-01-17 (author: Codex)
- **Status:** ✔️ Completed
- **Scope:** Remove hard-coded palette usage in Team dashboard + Team jobs view

#### Changes:
- Replaced status chips/icons/borders with semantic CSS variable tones (`--success`, `--warning`, `--error`).
- Converted Team jobs filters, lists, and badges to theme-aware classes (`bg-theme-*`, `text-theme-*`).
- Removed inline hex badge styling in Team jobs to follow the app's theme tokens.

#### Files Modified:
| File | Changes |
|------|---------|
| `components/TeamStatusTab.tsx` | Status chips, hover states, and actions now use theme tokens |
| `components/TechnicianJobsTab.tsx` | Summary cards, filters, list styling, and badges use theme tokens |

---

### 🎨 TeamStatusTab Card UI Polish & Dark Mode Fix (2026-01-17)
- **Updated:** 2026-01-17 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Refine technician card design and fix dark mode inconsistencies

#### UI Polish Changes:
| Change | Before | After |
|--------|--------|-------|
| **Card padding** | `p-4` | `p-5` (more breathing room) |
| **Name styling** | Basic | Explicit `text-base` for headline hierarchy |
| **Chips spacing** | `mt-1` | `mt-2` (better visual separation) |
| **Job count** | Plain text | Chip with icon (`bg-slate-100 text-slate-600`) |
| **Status chip** | Inline styles | Tailwind classes (`bg-green-50 text-green-600`) |
| **Chevron hover** | None | `group-hover:bg-slate-100` with transition |
| **Accessibility** | Color only | Added `title` attributes for tooltips |

#### Dark Mode Fix - Root Cause:
Tailwind's `dark:` prefix uses OS-level `prefers-color-scheme` by default, but the app uses `[data-theme="dark"]` for its toggle. This caused `dark:` utilities to respond to OS settings instead of the app's theme toggle, creating visual inconsistencies.

#### Solution Applied:
Removed all `dark:` utilities and rely on `index.html`'s existing `[data-theme="dark"]` CSS overrides which remap classes like `bg-green-50`, `bg-red-50`, `text-green-600` to appropriate dark colors.

#### Files Modified:
| File | Changes |
|------|---------|
| `components/TeamStatusTab.tsx` | Converted status colors to Tailwind classes, removed `dark:` variants |
| `components/TechnicianJobsTab.tsx` | Removed `dark:` from stat cards, filters, job list |
| `components/NotificationPanel.tsx` | Removed `dark:` from notification icon backgrounds |
| `components/ServiceAutomationWidget.tsx` | Removed `dark:` from stat icon backgrounds |
| `pages/People.tsx` | Removed `dark:` from attendance stats |
| `index.html` | Added `group-hover:bg-slate-100/50` overrides for dark mode |

#### Developer Guidance:
**DO NOT** use Tailwind `dark:` classes in this project. Instead:
- Use CSS variables: `var(--bg)`, `var(--surface)`, `var(--text)`, etc.
- Use theme-aware classes: `.text-theme`, `.bg-theme-surface`, `.card-theme`
- Use standard Tailwind color classes (e.g., `bg-green-50`) - `index.html` overrides handle dark mode

---

### 🎯 Role-Specific Dashboards & KPI Navigation Fix (2026-01-17)
- **Updated:** 2026-01-17 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Create unique dashboard experiences per role, fix KPI page visibility, enable dashboard-to-jobs filtering

#### Role-Specific Dashboards:
Each role now sees a tailored dashboard optimized for their workflow:

| Role | Dashboard | Key Features |
|------|-----------|--------------|
| **Admin** | AdminSupervisorDashboard | Full KPIs, escalation banner, work queue, team status, job stats |
| **Supervisor** | AdminSupervisorDashboard | Same as Admin (shared management view) |
| **Technician** | TechnicianDashboard | My Jobs Today, In Progress count, Van Stock alerts, active jobs list |
| **Accountant** | AccountantDashboard | Revenue metrics, finalization queue, invoice status chart |
| **Admin Service/Store** | AdminSupervisorDashboard | Management view with appropriate permissions |

#### Dashboard V4 Header Improvements:
- Moved Quick Actions chips from ROW 4 to header (always visible without scrolling)
- Added Notifications bell icon with badge in header
- Removed ROW 4 section (Quick Actions + Notifications relocated)

#### KPI Card Click-Through Filtering:
- Clicking dashboard KPI cards (Overdue, Unassigned, Escalated, Awaiting Ack) now navigates to `/jobs?filter=<type>`
- JobBoard reads URL filter parameter and applies special filtering:
  - `?filter=overdue` → Shows only overdue jobs
  - `?filter=unassigned` → Shows only unassigned jobs
  - `?filter=escalated` → Shows only escalated jobs
  - `?filter=awaiting-ack` → Shows only jobs awaiting acknowledgement
- Visual banner displays active filter with clear button

#### Permission Fix - KPI Page Visibility:
- **Bug:** KPI/Performance tab was hidden for all users
- **Cause:** Code referenced non-existent `canViewReports` permission
- **Fix:** Changed to correct `canViewKPI` permission
- **Result:** Performance tab now visible for Admin, Admin_Service, Admin_Store, Supervisor

#### Files Created:
- `components/dashboards/TechnicianDashboard.tsx` - Technician-specific dashboard
- `components/dashboards/AccountantDashboard.tsx` - Accountant-specific dashboard

#### Files Modified:
- `pages/Dashboard.tsx` - Role-based routing to appropriate dashboard component
- `pages/JobBoard.tsx` - URL filter support, special filter state, filter banner
- `pages/People.tsx` - Changed `canViewReports` → `canViewKPI` (3 occurrences)
- `App.tsx` - Changed `canViewReports` → `canViewKPI` (3 occurrences), updated dashboard route
- `components/dashboards/DashboardPreviewV4.tsx` - Quick Actions moved to header, ROW 4 removed

---

### 🧹 Dashboard Prototype Cleanup (2026-01-17)
- **Updated:** 2026-01-17 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Streamline V4 dashboard and remove deprecated V2/V3 prototypes

#### V4 Header Cleanup:
- Removed redundant "Fleet" and "Team" quick chips from Admin dashboard header
- These duplicated sidebar navigation without providing contextual value
- Header now contains only actionable/contextual items:
  - Assign chip (conditional, with count)
  - Finalize chip (conditional, with count)
  - Bell (notification dropdown)
  - Refresh button
  - New Job button

#### Prototype Consolidation:
- **Deleted:** `components/dashboards/DashboardPreviewV3.tsx`
- **Simplified:** `pages/PrototypeDashboards.tsx` (1,500 → 345 lines)
  - Removed V2/V3 version toggle
  - Removed all V2 "Apple-style" components (StatCard, QuickAction, ActivityItem, TeamMember, AlertCard)
  - Removed V2 role-specific dashboards (AdminPremiumDashboard, SupervisorPremiumDashboard, TechnicianPremiumDashboard, AccountantPremiumDashboard)
  - Removed unused DashboardProps interface and format utilities
  - Cleaned up ~20 unused lucide-react imports
- Prototype page now shows only V4 "Calm Focus" dashboard with role switcher

#### Files Modified:
- `components/dashboards/DashboardPreviewV4.tsx` - Removed Fleet/Team chips, removed unused Truck import
- `pages/PrototypeDashboards.tsx` - Removed V2/V3 support, simplified to V4-only

#### Files Deleted:
- `components/dashboards/DashboardPreviewV3.tsx`

---

### 🧹 Project Cleanup & Restructuring (2026-01-17)
- **Updated:** 2026-01-17 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Remove obsolete files, reorganize project structure, improve maintainability

#### Phase 1 - Deleted Deprecated Files:
- `database/_deprecated_migration_forklift_rentals_v1.sql` - Explicitly marked deprecated
- `docs/User_Manual_v1.1.md` - Outdated (Dec 2024), info in CHANGELOG
- `pages/TechnicianKPIPage.tsx` - Superseded by V2

#### Phase 2 - Updated .gitignore:
- Added `playwright-report/` and `test-results/` (test artifacts)
- Added `supabase/.temp/` (CLI temp files)

#### Phase 3 - Types Reorganization:
- Moved `types_with_invoice_tracking.ts` → `types/index.ts`
- Updated 55 file imports to use new `types/` directory

#### Phase 4 - Database Migration Archival:
- Created `database/historical/` directory structure
- Moved 27 root SQL files → `database/historical/root_migrations/`
- Moved `database/migrations/` (29 files) → `database/historical/migrations/`
- Moved `database/rls_redesign/` (11 files) → `database/historical/rls_redesign/`
- Created `database/README.md` explaining structure
- **Source of truth:** `supabase/migrations/` (unchanged)

#### Phase 5 - Deleted Orphaned Pages (no code imports):
- `pages/EmployeesPage.tsx` - Superseded by People.tsx
- `pages/Forklifts.tsx` - Superseded by ForkliftsTabs.tsx
- `pages/HRDashboard.tsx` - Functionality in People.tsx
- `pages/RecordsPage.tsx` - Superseded by ServiceRecords.tsx
- `pages/ReportsPage.tsx` - Functionality in TechnicianKPIPageV2.tsx
- `pages/UserManagement.tsx` - Superseded by People.tsx

#### Summary:
| Change | Files Affected |
|--------|----------------|
| Deprecated files deleted | 3 |
| .gitignore updated | 1 (+3 entries) |
| Types reorganized | 1 moved, 55 imports updated |
| Migrations archived | 67 files moved to historical/ |
| Orphaned pages deleted | 6 |

---

### 🎨 UI Simplification - Apple-Inspired Navigation Redesign (2026-01-16)
- **Updated:** 2026-01-16 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Reduce sidebar navigation from 14+ items to 7 items for admin/supervisor by consolidating related pages into tabs

#### Navigation Changes:
| Before (14+ items) | After (7 items) |
|-------------------|-----------------|
| Dashboard | Dashboard |
| Jobs | Jobs (+ Service History tab) |
| Forklifts | Fleet (+ Hourmeter Review tab) |
| Customers | Customers |
| Inventory, Van Stock, Confirmations | Inventory (+ Van Stock, Confirmations tabs) |
| Service Records | → Jobs (Service History tab) |
| Invoices, AutoCount | Billing (+ AutoCount Export tab) |
| Reports (KPI) | → Team (Performance tab) |
| People | Team (+ Performance tab) |
| Hourmeter Review | → Fleet (tab) |

#### Page Consolidations:
- **Jobs** (`JobsTabs.tsx`): Active Jobs | Service History
- **Fleet** (`ForkliftsTabs.tsx`): Overview | Fleet | Service Intervals | Service Due | Hourmeter Review
- **Inventory** (`InventoryPage.tsx`): Parts Catalog | Van Stock | Confirmations
- **Billing** (`Invoices.tsx`): Pending | History | AutoCount Export
- **Team** (`People.tsx`): Overview | Users | Employees | Leave | Performance

#### Files Created:
- `pages/JobsTabs.tsx` - New tabbed wrapper for Jobs with Service History

#### Files Modified:
- `pages/TechnicianKPIPageV2.tsx` - Added `hideHeader` prop for embedding
- `pages/People.tsx` - Added Performance tab with KPI component
- `pages/ServiceRecords.tsx` - Added `hideHeader` prop for embedding
- `pages/JobBoard.tsx` - Added `hideHeader` prop for embedding
- `App.tsx` - Simplified sidebar navigation, updated routes, added legacy redirects

#### Legacy URL Redirects:
- `/service-records` → `/jobs?tab=history`
- `/van-stock` → `/inventory?tab=vanstock`
- `/confirmations` → `/inventory?tab=confirmations`
- `/hourmeter-review` → `/forklifts?tab=hourmeter`
- `/autocount-export` → `/invoices?tab=autocount`
- `/reports` → `/people?tab=performance`
- `/technician-kpi` → `/people?tab=performance`

---

### 🔧 Hourmeter Amendment & Audit Trail System (2026-01-15)
- **Updated:** 2026-01-15 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Complete hourmeter management with role-based access, amendment workflow, and audit trail

#### Workflow Summary:
| Role | Direct Forklift Edit | Via Job/Service | Amendment Approval |
|------|---------------------|-----------------|-------------------|
| Technician | ❌ No | ✅ Yes | ❌ Submits only |
| Admin/Supervisor | ✅ Yes | ✅ Yes | ✅ Yes |

#### Features Implemented:
- **Technician Hourmeter Entry**: Technicians can only update hourmeter through jobs (services)
- **Validation System**: Automatic flagging for suspicious readings (lower than previous, excessive jumps)
- **Amendment Workflow**: Technicians submit amendment requests for flagged readings
- **Hourmeter Review Page**: Admin/Supervisor reviews and approves/rejects amendments
- **Access Control**: Hourmeter Review restricted to Admin, Admin_Service, Admin_Store, Supervisor roles
- **Audit Trail**: All hourmeter changes recorded in `hourmeter_history` table
- **Hourmeter History UI**: Collapsible timeline on ForkliftProfile showing all changes with source badges

#### Files Created:
- `pages/HourmeterReview.tsx` - Admin review page for pending amendments
- `components/HourmeterAmendmentModal.tsx` - Technician amendment request form
- `database/migration_hourmeter_checklist.sql` - Tables and triggers
- `database/migration_hourmeter_amendments_rls.sql` - RLS policies
- `database/migration_hourmeter_audit_direct.sql` - Audit trigger for direct edits
- `database/migration_fix_rls_role_case.sql` - Case-insensitive role checks

#### Files Modified:
- `services/supabaseService.ts` - Added `updateForklift()` audit trail, `getForkliftHourmeterHistory()`
- `pages/ForkliftProfile.tsx` - Added Hourmeter History section
- `pages/ForkliftsTabs.tsx` - Restricted Edit/Delete/Add to admin roles
- `App.tsx` - Added `isAdminRole` check for Hourmeter Review route

#### Database Tables:
- `hourmeter_amendments` - Amendment requests with approval workflow
- `hourmeter_history` - Complete audit log of all hourmeter changes
- `hourmeter_validation_configs` - Configurable thresholds

---

### 📦 Van Stock Management System (2026-01-15)
- **Updated:** 2026-01-15 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Complete van stock inventory management for technicians

#### Features Implemented:
- **Admin Van Stock Page**: View all van stocks, assign to technicians
- **Assign Van Stock**: Create van stock with van code (license plate), max items, notes
- **Edit Van Stock**: Change technician assignment, van code, max items, notes
- **Delete/Deactivate**: Soft delete van stock (sets `is_active = false`)
- **Transfer Items**: Move items between van stocks
- **Technician View Filter**: Technicians can only see their own van stock
- **Add Items**: Add parts to van stock from inventory

#### Files Created:
- `pages/VanStockPage.tsx` - Admin van stock management page
- `pages/MyVanStock.tsx` - Technician personal van stock view
- `components/VanStockWidget.tsx` - Dashboard widget
- `components/ReplenishmentRequestModal.tsx` - Request replenishment form
- `database/migration_van_stock_system.sql` - Tables and RLS policies

#### Files Modified:
- `services/supabaseService.ts` - Van stock CRUD functions
- `types_with_invoice_tracking.ts` - Added `van_code`, `notes` to VanStock type
- `App.tsx` - Added Van Stock routes

#### Database Tables:
- `van_stocks` - Van stock assignments (technician, van code, max items)
- `van_stock_items` - Parts in each van stock
- `van_stock_usage` - Usage tracking per job
- `van_stock_replenishments` - Replenishment requests

---

### 🔒 Role-Based Access Control Fixes (2026-01-15)
- **Updated:** 2026-01-15 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Fix case-sensitive role checks and restrict features to appropriate roles

#### Fixes:
- **ForkliftsTabs.tsx**: Added `UserRole` import, fixed role checks to use `UserRole.ADMIN` instead of `'admin'`
- **ForkliftsTabs.tsx**: Restricted Edit/Delete/Add buttons to admin roles via `canEditForklifts`
- **App.tsx**: Added `isAdminRole` for Hourmeter Review route protection
- **RLS Policies**: Fixed case-insensitive role checks in `has_role()` function

#### Admin Roles Defined:
- `UserRole.ADMIN`
- `UserRole.ADMIN_SERVICE`
- `UserRole.ADMIN_STORE`
- `UserRole.SUPERVISOR`

---

### 🎨 Dashboard Preview V3 - Layout Mockup (2026-01-12)
- **Updated:** 2026-01-12 (author: Claude)
- **Status:** ✔️ Completed (Preview Only)
- **Scope:** Visual preview of improved dashboard layout based on UX feedback

#### New Layout (12-col grid):
- **Row 1:** 4 equal KPI cards with deltas (Overdue, Unassigned, In Progress, Revenue)
- **Row 2:** Work Queue (8 cols) + Team Status (4 cols) - operational center of gravity
- **Row 3:** Charts (6+6) - Job Status + Revenue Trend
- **Row 4:** Smart Actions as horizontal chips + Notifications

#### Key Improvements:
- Eliminated "big empty left side" problem with balanced grid
- Work Queue with tabs (Action Required / Due Today / Unassigned) as main focus
- Quick Actions moved to header as compact horizontal chips
- Team Status shows availability + overloaded warnings
- KPIs have delta context (vs yesterday/last week)
- Consistent card purposes: Metrics (compact), Lists (taller), Navigation (button-like)
- "Overdue" KPI has alert ring to draw immediate attention

#### Files Created:
- `components/dashboards/DashboardPreviewV3.tsx` - Static mockup component (411 lines)

#### Files Modified:
- `pages/PrototypeDashboards.tsx` - Added V2/V3 version toggle

#### Access:
- Navigate to /prototype-dashboard
- Use V2/V3 toggle in header to switch views
- V3 shows static mockup data for layout validation

---

### 🐛 Supervisor Dashboard: Awaiting Ack Fix (2026-01-11)
- **Updated:** 2026-01-11 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Fix missing awaiting acknowledgment jobs in Supervisor dashboard

#### Bug:
- Supervisor dashboard computed `totalActionRequired` without including `awaitingAck` jobs
- Jobs in "Completed Awaiting Ack" status were not displayed in the Action Queue
- This left supervisors unaware of pending customer acknowledgments

#### Fix:
- Added `awaitingAck.length` to `totalActionRequired` calculation
- Added rendering block for awaiting ack jobs in Action Queue (Timer icon, purple accent)
- Updated KPI sublabel to dynamically show all non-zero categories (escalated, disputed, awaiting ack, to finalize)

#### Files Modified:
- `pages/PrototypeDashboards.tsx` - Lines 633, 676-685, 774-794

---


### Client
**ACWER Industrial Equipment Sdn Bhd** (Malaysia)
- ~2,000 forklifts across Johor and Penang branches
- ~60 service jobs/day
- Uses AutoCount 2.2 for accounting

### Current Phase
📋 **Requirements Review** — Analyzing new client requests (Jan 7, 2025)

---

### 🎨 Premium Dashboard Redesign v2 (2026-01-11)
- **Updated:** 2026-01-11 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Complete prototype dashboard redesign with Apple-inspired premium aesthetics

#### Design Philosophy:
Based on Apple Human Interface Guidelines and modern FSM dashboard best practices:
- **Clean minimalism** with generous whitespace
- **Subtle glassmorphism** effects with soft gradients
- **Strong visual hierarchy** through spacing, not decoration
- **Premium typography** with tight letter-spacing
- **Smooth micro-interactions** on hover/click
- **Content-first design** - UI supports but doesn't dominate

#### Key FSM Metrics Displayed:
- Today's snapshot (scheduled, in progress, completed)
- First-time fix rate (FTFR) - critical quality metric
- Average response time (arrival time)
- Action items requiring attention (escalated, disputed, awaiting ack)
- Team status with real-time availability
- Quick navigation links for common actions
- Recent activity feed with status indicators

#### Role-Specific Dashboards:
1. **Admin Dashboard** - Full system overview with KPIs, action queue, team status, quick actions
2. **Supervisor Dashboard** - Team management focus with action queue and technician status
3. **Technician Dashboard** - Personal job queue with current job banner and daily stats
4. **Accountant Dashboard** - Financial focus with pending invoices and revenue metrics

#### UI Components Added:
- `StatCard` - Premium stat display with accent colors, trends, glassmorphism overlay
- `QuickAction` - Styled navigation buttons with icons
- `ActivityItem` - Compact job list items with status badges
- `TeamMember` - Technician status row with availability indicator
- `AlertCard` - Urgent action item cards (escalated/disputed/awaiting)

#### Files Modified:
- `pages/PrototypeDashboards.tsx` - Complete rewrite with premium components

#### Visual Features:
- Subtle gradient overlays on stat cards
- Soft shadows with layered depth
- Rounded corners (border-radius: 16px for cards)
- Color-coded status indicators
- Smooth scale transitions on interactive elements
- Responsive grid layouts (mobile-first)

---

### 🔒 P1 Security Patch: Caller Identity Binding (2026-01-11)
- **Updated:** 2026-01-11 (author: Claude)
- **Status:** ✔️ Completed (deployed)
- **Scope:** Fix privilege escalation in complete_user_creation RPC
- **Severity:** P1 - Critical security vulnerability

#### Vulnerability (v3):
- `complete_user_creation()` verified the STORED `admin_auth_id` was still an active admin
- But never checked that the CURRENT CALLER (`auth.uid()`) matched that admin
- **Attack:** Any authenticated user who learned a valid `pending_id` could hijack the flow

#### Fix (v4):
- Added explicit check: `auth.uid()` MUST equal `v_pending.admin_auth_id`
- Only the admin who initiated `prepare_user_creation()` can call `complete_user_creation()`
- Added null check for `auth.uid()` before comparison

#### Files Added:
- `database/migrations/20260111_secure_user_creation_v4_caller_binding.sql`

#### Migration Required:
Run `20260111_secure_user_creation_v4_caller_binding.sql` in Supabase SQL Editor
- **URGENT if v3 is deployed** - This is a live security issue
- **Idempotent** - Safe to run whether v3 is deployed or not

---

### 🔒 Security & Dev Mode Fixes (2026-01-11)
- **Updated:** 2026-01-11 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Fix security vulnerabilities and dev mode bugs from code review

#### Security Fixes (P1):
- **RPC Privilege Escalation Fix** (`database/migrations/20260111_secure_user_creation_v3.sql`):
  - Old: RPC trusted caller-supplied admin_user_id (any user could escalate)
  - New: Two-step process with session-bound verification
  - `prepare_user_creation()` - ties intent to actual auth.uid()
  - `complete_user_creation()` - verifies pending request exists
  - Pending requests expire after 10 minutes
  - Added `pending_user_creations` table for secure handoff

- **Data Fetch Gate** (`pages/PrototypeDashboards.tsx`):
  - Fixed: Data was fetched BEFORE dev access check
  - Now: Data only fetched if `devMode.isDev` is true

#### Functionality Fixes (P2):
- **UI Only vs Strict Mode** (`hooks/useDevMode.ts`):
  - Fixed: Both modes behaved identically
  - Now: `displayRole` (for UI) vs `permissionRole` (for access checks)
  - UI Only: Shows impersonated dashboard, keeps real permissions
  - Strict: Both UI and permissions use impersonated role

- **Dev Mode Persistence** (`hooks/useDevMode.ts`):
  - Fixed: Refresh cleared impersonation because email loads after mount
  - Now: localStorage loaded unconditionally, validated once email arrives

#### Files Added:
- `database/migrations/20260111_secure_user_creation_v3.sql`

#### Files Modified:
- `services/supabaseService.ts` - Updated to use new RPC functions
- `hooks/useDevMode.ts` - Fixed persistence and displayRole/permissionRole
- `pages/PrototypeDashboards.tsx` - Gated data fetch behind dev check

#### Migration Required:
Run `20260111_secure_user_creation_v3.sql` in Supabase SQL Editor

---

### 🧪 Dev Mode & Prototype Dashboards (2026-01-11)
- **Updated:** 2026-01-11 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Developer infrastructure for role-based dashboard prototyping

#### Features:
- **Dev Mode Hook** (`hooks/useDevMode.ts`):
  - Email allowlist via `VITE_DEV_EMAILS` env variable
  - Role impersonation with localStorage persistence
  - UI Only mode (see dashboard, keep real permissions)
  - Strict mode (actually limit to role's permissions)

- **Dev Banner** (`components/dev/DevBanner.tsx`):
  - Fixed warning banner when impersonating
  - Shows impersonated role vs actual role
  - Exit Dev Mode button

- **Role Switcher** (`components/dev/RoleSwitcher.tsx`):
  - Dropdown to switch between all 4 roles
  - Toggle between UI Only and Strict mode
  - Visual indicators for active role/mode

- **Prototype Dashboards** (`pages/PrototypeDashboards.tsx`):
  - 4 role-specific dashboard layouts:
    - **Technician:** My Jobs Today, current job highlight, personal stats
    - **Supervisor:** Action queue (filterable), team status grid, escalations
    - **Admin:** KPI header with trends, full system overview, quick actions
    - **Accountant:** Financial pipeline, jobs ready for invoicing, revenue stats
  - Theme-integrated using CSS variables
  - Real data from Supabase

#### Access:
- Route: `/#/prototype/dashboards`
- Restricted to emails in `VITE_DEV_EMAILS`
- Current dev email: `dev@test.com`

#### Files Added:
- `hooks/useDevMode.ts`
- `components/dev/DevBanner.tsx`
- `components/dev/RoleSwitcher.tsx`
- `pages/PrototypeDashboards.tsx`

#### Files Modified:
- `App.tsx` - Added prototype route
- `.env.example` - Added `VITE_DEV_EMAILS` documentation
- `.env.local` - Added dev email

---

### 🔧 Admin User Creation Fix (2026-01-10)
- **Updated:** 2026-01-10 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Fix RLS violation when admin creates new users

#### Problem:
When admin created a new user via User Management page:
1. `supabase.auth.signUp()` creates auth user
2. Supabase automatically switches session context to the NEW user
3. Subsequent INSERT into `users` table runs as new user (who has no role)
4. RLS policy blocks insert → "new row violates row-level security policy"

#### Solution:
Created `admin_create_user` RPC function with SECURITY DEFINER:
1. Frontend captures admin's `user_id` BEFORE calling `signUp()`
2. After `signUp()`, calls RPC with admin's ID as proof of authorization
3. RPC verifies the passed `user_id` belongs to an active admin
4. RPC inserts new user with elevated permissions (bypasses RLS)

#### Files Changed:
- `services/supabaseService.ts`: Updated `createUser()` to capture admin ID first
- `database/migrations/20260110_admin_create_user_rpc.sql`: New migration file

#### SQL Function:
```sql
admin_create_user(
  p_admin_user_id UUID,  -- Admin's user_id (captured before signUp)
  p_auth_id UUID,        -- New user's auth_id from signUp
  p_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_is_active BOOLEAN
) RETURNS UUID
```

---

### 🚛 Asset Overview Dashboard (2026-01-10)
- **Updated:** 2026-01-10 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Fleet overview dashboard for Admin/Supervisor

#### Features:
- **Status Cards:** 5 operational statuses with click-to-filter
  - Rented Out (with active rental)
  - In Service (has open job)
  - Service Due (within 7 days OR 50 hours)
  - Available (active, not rented, not in service)
  - Out of Service (inactive units)
- **Status Precedence:** Out of Service > Rented Out > In Service > Service Due > Available
- **Secondary Badges:** Shows additional status (e.g., "Due" badge on rented unit)
- **Metrics Bar:** Jobs completed (30d), Average job duration (90d)
- **Filterable Table:** Search by S/N, make, model, customer
- **Quick Actions:** Create Job button with prefilled forklift_id and customer_id
- **Collapsed by default:** Shows 5 items, expandable with "Show more (+20)" or "Show all"

#### Technical:
- New component: `components/AssetDashboard.tsx`
- Integrated as "Overview" tab on ForkliftsTabs page
- Role-based access: Admin + Supervisor only
- Real-time rental status from `forklift_rentals` table
- Open job detection excludes: Completed, Cancelled, Completed Awaiting Ack
- Default tab fallback: Technicians/Accountants default to "Fleet" tab

#### Bug Fixes (same day):
- Fixed: `getJobs` requires currentUser parameter
- Fixed: Status card icons now always show colored (not grey when inactive)
- Fixed: NotificationBell using Tailwind `dark:` classes instead of CSS variables
- Fixed: Non-admin users seeing blank page (default tab was inaccessible)

---

### 📝 Documentation Sync (2026-01-09)
- **Updated:** 2026-01-09 (author: Claude)
- **Status:** ✔️ Completed
- **Scope:** Comprehensive documentation audit and synchronization

#### Files Updated:
1. **`docs/DB_SCHEMA.md`:**
   - Added `job_assignments` table documentation (Helper Technician feature)
   - Added `job_requests` table documentation (In-Job Request System)
   - Added missing `jobs` columns: `helper_technician_id`, `escalation_acknowledged_at`, `escalation_acknowledged_by`, `escalation_notes`
   - Added missing `job_media` columns: `category`, `is_helper_photo`
   - Updated last modified date

2. **`docs/WORKFLOW_SPECIFICATION.md`:**
   - Updated implementation status table - was showing "Not started" for completed features
   - Added feature implementation summary showing 9/11 features completed

3. **`docs/CHANGELOG.md`:**
   - Fixed implementation status table at bottom - was outdated
   - Features #1, #2, #3, #7, #8, #9 now correctly marked as completed

4. **`docs/ROADMAP.md`:**
   - Updated last modified date

5. **`docs/SECURITY.md`:**
   - Emphasized email confirmation requirement as CRITICAL before production
   - Updated last modified date

#### Reason for Update:
Deep review revealed documentation had not been updated after feature implementations (Jan 4-8). The CHANGELOG had detailed entries for completed features, but summary tables and other docs still showed "Not started" status.

---

### 📋 ACWER Requirements Review Document (2026-01-08)
- **Updated:** 2026-01-08 (author: Claude)
- **Status:** 🟡 Under Discussion
- **Document:** `docs/ACWER_REQUIREMENTS_REVIEW.md`

#### New Client Requests Analyzed:
1. **Job Types Expansion** - Add Slot-In (Emergency) and Courier/Collection types
2. **Dual-Path Inventory** - Warehouse vs Van Stock (50 standby units per tech)
3. **Parts Usage Control** - Admin-only parts entry, hide from tech app
4. **Hourmeter Locking** - First tech records, persists on reassignment
5. **Dual Admin Approval** - Admin 2 confirms parts → Admin 1 closes job
6. **Offline Mode** - PWA with local storage (deferred to Phase 4)
7. **Checklist "Check All"** - Bulk selection button
8. **Photo-Based Job Tracking** - Auto-start on photo, live camera only
9. **Request Edit Button** - Allow amendments to pending requests
10. **Hide Pricing** - Remove costs from tech-facing views

#### Implementation Phases Defined:
- Phase 1: Quick Wins (~16 hours)
- Phase 2: Asset Dashboard + Photo Flow (~32 hours)
- Phase 3: Workflow Enhancements (~28 hours)
- Phase 4: Inventory System (~60 hours)
- Phase 5: Advanced Features (Future)

#### Next Steps:
- [ ] Review questions with client
- [ ] Get confirmation on critical decisions
- [ ] Begin Phase 1 implementation

---

### 🔧 Notification & Service Records RLS Fix v4 (2026-01-08)
- **Updated:** 2026-01-08 (author: Claude)
- **Status:** ✔️ Completed
- **Issues Fixed:**
  1. **403 on notification INSERT** - Technicians couldn't create notifications for admins
  2. **406 on job_service_records** - PostgREST error on missing records

#### Root Cause Analysis:
1. **Notification INSERT 403**: The `createNotification` function used `.select().single()` after INSERT. When tech creates notification for admin, INSERT succeeds (allowed by `notif_insert_any` policy), but the SELECT to return the row fails because tech can't read admin's notifications. PostgREST combines these into atomic operation → 403.

2. **job_service_records 406**: Using `.single()` on a query that returns 0 rows throws PostgREST 406 error.

#### Final Fixes Applied:
1. **`createNotification`** - Removed `.select().single()`, now just does INSERT without returning the row
2. **`getJobServiceRecord`** - Changed from `.single()` to `.limit(1)` with `data?.[0] ?? null`

### 🔧 createNotification Return Type Fix (2026-01-08)
- **Updated:** 2026-01-08 (author: Claude)
- **Status:** ✔️ Completed
- **Issue:** `createNotification` returned `Promise<Notification | null>` but fabricated a partial Notification object without server-generated fields (`notification_id`, `created_at`). This could cause runtime errors if callers depended on those fields.

#### Fix Applied:
- Changed return type from `Promise<Notification | null>` to `Promise<boolean>`
- Returns `true` on successful insert, `false` on failure
- Added JSDoc documentation explaining the RLS constraint

#### Impact:
- All existing callers only check truthiness (`if (result)`) - no breaking changes
- Prevents future bugs from accidentally accessing missing fields
- Honest contract that matches actual behavior

#### Code Changes (services/supabaseService.ts):
```typescript
// BEFORE - misleading return type
createNotification: async (...): Promise<Notification | null> => {
  const { error } = await supabase.from('notifications').insert({...});
  if (error) return null;
  return { ...inputFields, is_read: false } as Notification; // Missing notification_id, created_at!
}

// AFTER - honest return type
createNotification: async (...): Promise<boolean> => {
  const { error } = await supabase.from('notifications').insert({...});
  if (error) return false;
  return true;
}
```

#### Code Changes (services/supabaseService.ts):
```javascript
// createNotification - BEFORE (caused 403)
.insert({...}).select().single();

// createNotification - AFTER (fixed)
.insert({...});  // No .select().single()

// getJobServiceRecord - BEFORE (caused 406)
.select('*').eq('job_id', jobId).single();

// getJobServiceRecord - AFTER (fixed)
.select('*').eq('job_id', jobId).limit(1);
return data?.[0] ?? null;
```

#### RLS Policies (Already Correct):
The database policies were correctly configured with SECURITY DEFINER functions. No SQL changes needed.

---

### 🚨 Notification RLS v3 - Bulletproof Fix (2026-01-08)
- **Updated:** 2026-01-08 (author: Claude)
- **Status:** 🔨 Migration Ready - Awaiting Deployment
- **Issue:** Technicians still getting 403 on notification SELECT after v2 cleanup

#### Problem:
The v2 cleanup used `get_user_id_from_auth()` helper function which either:
1. Doesn't exist in Supabase (migration not run)
2. Returns NULL due to missing GRANT or auth_id mismatch
3. Has SECURITY DEFINER but still fails permission check

#### Solution:
New migration `fix_notification_rls_v3.sql` that:
1. **Creates the helper function** (ensures it exists)
2. **Uses direct subqueries** instead of helper functions for reliability
3. **Handles role case sensitivity** (`'admin'` AND `'Admin'`)

#### Key Change:
```sql
-- Before (unreliable - depends on function):
USING (user_id = get_user_id_from_auth())

-- After (reliable - direct subquery):
USING (user_id IN (
    SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()
))
```

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
database/migrations/fix_notification_rls_v3.sql
```

#### Diagnostic Queries (run after migration):
```sql
-- 1. Verify policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'notifications';

-- 2. Test auth mapping (run as authenticated user)
SELECT get_user_id_from_auth() as my_user_id;

-- 3. Verify user has auth_id set
SELECT user_id, auth_id, name, role FROM users WHERE role = 'technician';
```

---

### 🚨 Notification RLS Policy Cleanup (2026-01-08)
- **Updated:** 2026-01-08 (author: Claude)
- **Status:** 🔨 Migration Ready - Awaiting Deployment
- **Issue Source:** Smoke test failure - 403 errors on notification insert/select

#### Problem:
Notification smoke test failed with RLS violations:
- `new row violates row-level security policy for table "notifications"`
- `GET /rest/v1/notifications?select=* → 403`

#### Root Cause:
**Two migration files created conflicting policies on the same table:**

| Migration | Policy Name | INSERT Allows |
|-----------|-------------|---------------|
| `fix_notification_realtime.sql` | `authenticated_insert_notifications` | ✅ All authenticated |
| `fix_rls_performance.sql` | `notifications_insert_policy` | ❌ Admin/Supervisor only |

The `fix_notification_realtime.sql` drops policies like `admin_all_notifications` but **doesn't drop** legacy `notifications_*_policy` policies (different naming convention).

Result: **10 policies** on one table with conflicting rules.

#### Policy Dump (Before Fix):
```
authenticated_insert_notifications  INSERT  WITH CHECK (true)           ← Should work
notifications_insert_policy         INSERT  WITH CHECK (Admin/Supervisor) ← Blocks technicians
```

#### Solution:
New migration `fix_notification_rls_cleanup.sql` that:
1. Drops ALL 10+ existing policies (both naming conventions)
2. Creates 7 clean, non-conflicting policies
3. Handles role case sensitivity (`'admin'` and `'Admin'`)
4. Uses direct `EXISTS` subqueries instead of helper functions

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
database/migrations/fix_notification_rls_cleanup.sql
```

#### New Policy Set:
| Policy | Operation | Who |
|--------|-----------|-----|
| `notif_select_own` | SELECT | Own notifications |
| `notif_select_admin` | SELECT | Admin/Supervisor: all |
| `notif_insert_any` | INSERT | Any authenticated user |
| `notif_update_own` | UPDATE | Own notifications |
| `notif_update_admin` | UPDATE | Admin/Supervisor: all |
| `notif_delete_own` | DELETE | Own notifications |
| `notif_delete_admin` | DELETE | Admin/Supervisor: all |

#### Testing After Migration:
- [ ] Technician can submit helper request (notification created)
- [ ] Admin receives notification for request
- [ ] Admin approves → Technician receives notification
- [ ] No 403 errors on notification operations

---

### 🔔 Real-Time Notification System Fix v2 (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✔️ Completed
- **Issue Source:** ACWER customer feedback (06/01/2025 troubleshooting report)

#### Issues Addressed (from Customer Report):
1. **Dashboard Notifications** - Notifications only on bell icon, not dashboard
2. **Request Alerts** - No sound/notification for helper/spare part requests  
3. **Job Assignment** - Technician B doesn't see assigned jobs immediately
4. **Real-Time Inconsistency** - Sometimes works, sometimes nothing

#### Root Cause Analysis:
The previous fix added `notifications` and `job_requests` to realtime publication, but **missed the `jobs` table**. This meant:
- Job assignment changes were never broadcast via WebSocket
- Technicians couldn't see new jobs in real-time
- Only notification records worked, not actual job data

Additionally, `NotificationBell` component was polling every 30 seconds instead of using the real-time hook, causing:
- Inconsistent state between bell icon and dashboard panel
- Unnecessary database queries
- Up to 30-second delay in bell updates

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
database/migrations/fix_jobs_realtime.sql
```

#### Fixes Applied:

**1. New Migration `fix_jobs_realtime.sql`:**
- Adds `jobs` table to `supabase_realtime` publication
- Sets `REPLICA IDENTITY FULL` for complete row data on changes
- Idempotent - safe to run multiple times

**2. Refactored `NotificationBell.tsx`:**
- Removed 30-second polling mechanism
- Now consumes `NotificationProvider` context (shared real-time state)
- Single source of truth for notification state
- Added connection status indicator (Live/Offline)
- Added dark mode support for dropdown

**3. Added `NotificationProvider` context:**
- Centralized real-time subscription in `contexts/NotificationContext.tsx`
- Shared state across bell + dashboard (no duplicate sounds/toasts)
- Dashboard refreshes on job update tick from provider

#### Architecture After Fix:
```
┌─────────────────────────────────────────────────────┐
│                    Supabase                         │
│  ┌─────────────────────────────────────────────┐   │
│  │         supabase_realtime publication        │   │
│  │  • notifications ✓                           │   │
│  │  • job_requests ✓                            │   │
│  │  • jobs ✓ (NEW)                              │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         │
                         │ WebSocket
                         ▼
┌─────────────────────────────────────────────────────┐
│              NotificationProvider                   │
│  • Uses useRealtimeNotifications                    │
│  • Subscribes to notifications (INSERT)             │
│  • Subscribes to jobs (INSERT/UPDATE)               │
│  • Subscribes to job_requests (INSERT/UPDATE)       │
│  • Plays sound, shows browser notification          │
│  • Vibrates on mobile                               │
└─────────────────────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
    ┌───────────────┐         ┌───────────────┐
    │NotificationBell│         │NotificationPanel│
    │  (Header)      │         │  (Dashboard)   │
    │  Real-time ✓   │         │  Real-time ✓   │
    └───────────────┘         └───────────────┘
```

#### Testing Checklist:
- [x] Run migration `fix_jobs_realtime.sql` on Supabase
- [ ] Admin assigns job → Technician receives notification + sound
- [ ] Technician requests helper → Admin receives notification + sound
- [ ] Admin approves request → Technician receives notification + sound
- [ ] Job reassignment → New technician sees job immediately
- [ ] Bell icon and Dashboard panel show same count
- [ ] Connection indicator shows "Live" when connected

---

### 🔧 Technician Licenses & Permits Tab Fix (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed
- **Issue:** Licenses and Permits tabs not showing for technicians in Employee Profile

#### Root Cause:
- After merging `employees` table into `users`, the `Employee` type became an alias for `User`
- Code in `EmployeeProfile.tsx` was checking `employee.user?.role` (nested property)
- This property no longer exists since `Employee = User` directly
- `isTechnician` was always evaluating to `false`

#### Fix Applied:
```tsx
// Before (broken):
const isTechnician = employee.user?.role === UserRole.TECHNICIAN;

// After (fixed):
const isTechnician = employee.role === UserRole.TECHNICIAN;
```

#### Impact:
- Technicians can now see and manage their **Licenses** tab
- Technicians can now see and manage their **Permits** tab
- Admin/Supervisors can add/view licenses and permits for technicians

#### Related Tables:
- `employee_licenses` - Stores technician driving licenses with expiry tracking
- `employee_permits` - Stores special permits (forklift operator, etc.) with expiry tracking

---

### 🐛 URL-State Desync Fix (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed
- **Issue:** Filter state not resetting when URL params are removed (back/forward navigation)

#### Root Cause:
- Effects in `EmployeesTab` and `LeaveTab` only updated state when param was truthy
- `if (initialStatus && ...)` evaluated to false when param was removed
- UI disagreed with URL after back/forward navigation

#### Fix Applied:
- Changed to use default fallback: `const newStatus = initialStatus || 'all'`
- Now resets to default when URL param is removed

---

### 🛠️ ES Module Import Fix (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed
- **Issue:** App.tsx failing to load (Vite 500 error)

#### Root Cause:
- Import statements were placed after executable code (`lazy()` calls)
- ES modules require all imports at the top level before any executable code
- Missing React imports: `useState`, `useEffect`, `lazy`, `Suspense`

#### Fix Applied:
- Moved all imports to top of `App.tsx` before `lazy()` calls
- Added missing React imports
- Removed duplicate import line

---

### 🔔 Real-Time Notification System Fix (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed
- **Issue Source:** ACWER customer feedback (06/01/2025 troubleshooting report)

#### Issues Addressed:
1. **Dashboard Notifications** - Notifications only on bell icon (dashboard panel exists)
2. **Request Alerts** - No sound/notification for helper/spare part requests
3. **Job Assignment** - Technician B doesn't see assigned jobs immediately
4. **Real-Time Inconsistency** - Sometimes works, sometimes nothing (CRITICAL)

#### Root Cause Analysis:
- **Channel naming with `Date.now()`** was creating orphaned WebSocket connections
- Every component re-render created a new channel with different name
- Race conditions between cleanup and new subscriptions
- RLS policies missing INSERT for system notifications

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
database/migrations/fix_notification_realtime.sql
```
- Migration is **idempotent** - safe to run multiple times
- Drops ALL existing notification policies before recreating
- Enables REPLICA IDENTITY FULL for realtime subscriptions
- Adds notifications and job_requests to supabase_realtime publication

#### Fixes Applied:

**1. `utils/useRealtimeNotifications.ts` - Major Rewrite:**
- Removed `Date.now()` from channel name → stable `fieldpro-notifications-{userId}`
- Added `mountedRef` to prevent state updates after unmount
- Added duplicate notification prevention in state updates
- Added device vibration support for mobile alerts
- Enhanced browser notification with unique tags
- Added listeners for:
  - New job assignments (INSERT on jobs table)
  - Job request status changes (for technicians)
  - New job requests (for admins/supervisors)
- Improved connection status logging and error handling
- Better cleanup on component unmount

**2. `database/migrations/fix_notification_realtime.sql` - New Migration:**
- Added `authenticated_insert_notifications` policy (allows system notifications)
- Enabled REPLICA IDENTITY FULL for notifications table
- Added notifications to supabase_realtime publication
- Added job_requests to realtime publication
- Added DELETE policy for notification cleanup

#### Migration Required:
```bash
# Run in Supabase SQL Editor:
# database/migrations/fix_notification_realtime.sql
```

#### Testing Checklist:
- [ ] Admin assigns job → Technician receives notification + sound
- [ ] Technician requests helper → Admin receives notification + sound
- [ ] Admin approves request → Technician receives notification + sound
- [ ] Job reassignment → New technician sees job immediately
- [ ] Multiple rapid notifications → No duplicates, all received
- [ ] Page refresh → Subscription reconnects properly
- [ ] Mobile → Vibration works on notification

---

### UI/UX: People Overview - Clickable Stats & Expand (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Implemented

#### Features Added:
1. **Clickable Stat Cards** - All 4 cards now navigate with URL params:
   - Total Employees → `?tab=employees`
   - Active → `?tab=employees&status=active`
   - On Leave Today → `?tab=leave&filter=today`
   - Pending Leaves → `?tab=leave&filter=pending`

2. **New "Today" Filter** - Leave tab now has 3 filters:
   - Pending (existing)
   - On Leave Today (new - shows approved leaves active today)
   - All Requests (existing)

3. **Expand In-Place for Expiring Items**:
   - "View all" / "Show less" toggle in section headers
   - Expands from 5 items to full list within the card
   - Max height increases from 48 to 96 for scrolling

4. **URL Param Sync**:
   - Employees tab reads `?status=` param on mount
   - Leave tab reads `?filter=` param on mount
   - Clicking stat cards updates URL for bookmarkable links

#### Technical:
- Added `LeaveFilterType = 'pending' | 'today' | 'all'`
- `onNavigate` callback replaces `onTabChange` for param support
- `initialStatus` and `initialFilter` props for child tabs
- Added ChevronDown/ChevronUp icons for expand toggle

---

### Bug Fixes: People Page & HR Service (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Fixed

#### Issues Fixed:
1. **High - Legacy Route Redirect**: `/hr/employees/:id` was using literal `:id` in Navigate
   - Fix: Route directly to `EmployeeProfile` component instead of broken redirect
   
2. **Medium - User Name Display**: `getPendingLeaves` only selected `full_name` but UI used `user?.name`
   - Fix: Added `name` to all user selects, UI now checks `full_name` first then `name` fallback

3. **FK Ambiguity Prevention**: `employee_licenses` and `employee_permits` have 3 FKs to users
   - Added explicit FK hints: `users!employee_licenses_user_id_fkey` and `users!employee_permits_user_id_fkey`
   - Prevents PGRST201 ambiguity errors when Overview tab loads

---

### UI/UX: People Page - Overview Tab Added (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Implemented

#### Changes Made:
- Added **Overview** as first tab in People page (Option 4 layout)
- Overview tab includes:
  - Stats cards: Total Employees, Active, On Leave Today, Pending Leaves
  - Expiring Licenses panel (with days until expiry badges)
  - Expiring Permits panel (with days until expiry badges)
  - Today's Attendance (Available vs On Leave)
  - Pending Leave Requests with quick approve action
- Tab order: Overview | Users | Employees | Leave
- Default tab changed from 'users' to 'overview'
- Clicking employee in expiring items navigates to `/people/employees/:id`
- "Pending Leaves" stat card links to Leave tab

---

### UI/UX: Sidebar Consolidation (2026-01-07)
- **Updated:** 2026-01-07 (author: Claude)
- **Status:** ✅ Implemented

#### Changes Made:
1. **New Tabbed Pages**
   - `ForkliftsTabs.tsx`: Combines Fleet list + Service Intervals + Service Due into one page with tabs
   - `People.tsx`: Combines Users + Employees + Leave management into one page with tabs (+ Overview)

2. **Sidebar Simplification**
   - Reduced from nested collapsible sections to flat 6-8 top-level items
   - Removed bullet points and heavy visual boxing
   - Cleaner, workflow-oriented navigation:
     - Dashboard, Jobs, Forklifts, Customers, Inventory
     - Service Records, Invoices (with divider)
     - Reports, People (with divider)
     - My Leave, My Profile, Sign Out (footer)

3. **Route Updates**
   - `/forklifts` now uses tabbed page (Fleet | Service Intervals | Service Due)
   - `/people` now uses tabbed page (Users | Employees | Leave)
   - `/reports` now points to Technician KPI page
   - Legacy routes redirect: `/users` → `/people?tab=users`, `/hr` → `/people?tab=employees`, etc.

4. **Design Improvements**
   - Narrower sidebar width (260px → 240px)
   - More compact header/logo section
   - Subtle dividers instead of collapsible sections
   - Tab-based navigation inside pages for related features

---

### Stability & Error-Handling Hardening (2026-01-07)
- **Updated:** 2026-01-07 (author: Codex)
- **Status:** ✅ Implemented

#### Changes Made:
1. **Page-level data loading guards**
   - Added try/catch + user feedback for Create Job, Job Board, Job Detail, User Management
   - Ensures backend failures surface as toasts instead of uncaught console errors
2. **Dashboard escalation actions**
   - Hardened acknowledge/save notes/overtime actions with error handling
3. **Service intervals reliability**
   - Wrapped create/update/delete actions with error handling to avoid failed saves
4. **Forklifts fallback safety**
   - Added guarded fallback load for forklift list to prevent unhandled errors
5. **Employees query handling**
   - Supabase user lookup now checks query errors explicitly
6. **Job Detail dependency cleanup**
   - Photo category refresh now tracks `started_at` (removes stale field)
7. **HR profile embed disambiguation**
   - `users → employee_leaves` join now specifies FK to avoid PGRST201 errors
8. **HR leave tab data load**
   - `People` leave tab now uses `getLeaves()` to avoid missing API calls
9. **Service interval payload alignment**
   - Removed unsupported `is_active` field from Forklifts tab create interval flow
10. **Tailwind CDN retained**
   - Restored CDN usage and removed PostCSS build config for demo stability
11. **Recharts container guards**
   - Added min dimensions to chart containers to prevent width/height -1 warnings
12. **Job fetch resilience**
   - Added retry on network errors and gated debug logs to DEV
13. **Forklift customer embed**
   - Disambiguated `forklifts → customers` join to avoid PGRST201 errors

### Real-Time Notification System (2026-01-06)
- **Updated:** 2026-01-06 (author: Claude)
- **Source:** ACWER Customer Feedback Implementation
- **Status:** ✅ Implemented

#### Changes Made:
1. **New Files Created:**
   - `utils/useRealtimeNotifications.ts` - Real-time hook with Supabase subscriptions, sound alerts, browser notifications
   - `components/NotificationPanel.tsx` - Dashboard notification panel component

2. **Dashboard Notifications Panel:**
   - ✅ Added NotificationPanel to Dashboard (Row 4, 3-column grid)
   - ✅ Shows real-time connection status (Live/Offline indicator)
   - ✅ Displays notifications with mark-as-read functionality
   - ✅ Auto-refreshes when new notifications arrive

3. **Sound & Browser Notifications:**
   - ✅ Audio notification sound on new alerts
   - ✅ Browser notification permission request
   - ✅ Desktop notifications with click-to-navigate

4. **Real-Time Subscriptions (Supabase Realtime):**
   - ✅ Subscribe to `notifications` table for user-specific alerts
   - ✅ Subscribe to `jobs` table for technician job assignments
   - ✅ Subscribe to `job_requests` table for request status changes
   - ✅ Admin/Supervisor: notified of new requests from technicians
   - ✅ Technician: notified when assigned, request approved/rejected

5. **Notification Service Updates:**
   - ✅ `approveAssistanceRequest` now notifies both requester AND helper technician
   - ✅ All request types (helper, spare part, skillful tech) trigger admin notifications
   - ✅ All approval/rejection actions trigger technician notifications

6. **New Notification Types Added:**
   - `HELPER_REQUEST`, `SPARE_PART_REQUEST`, `SKILLFUL_TECH_REQUEST`
   - `REQUEST_APPROVED`, `REQUEST_REJECTED`, `JOB_REASSIGNED`
   - Updated NotificationPanel & NotificationBell with new icons

#### Bug Fixes:
- ✔️ Fixed login/runtime crash caused by importing the `Notification` interface as a runtime export (ESM can’t import TS interfaces at runtime)
  - Switched to `import type` in:
    - `utils/useRealtimeNotifications.ts`
    - `components/NotificationPanel.tsx`
    - `components/NotificationBell.tsx`
    - `services/supabaseService.ts`
- ✔️ Prevented duplicate sound/toast alerts by treating `jobs`/`job_requests` realtime subscriptions as UI refresh only
  - User-facing alerts now come from the `notifications` table subscription (single source of truth)

#### UX/RLS Guardrails (2026-01-06) (author: Codex)
- ✔️ **Create Job permissions** - `pages/CreateJob.tsx` is now Admin/Supervisor-only (prevents “violates row level security policy” for Technician/Accountant)
- ✔️ **Customer → Create Job deep-link** - `pages/CustomerProfile.tsx` now routes to `/jobs/new?customer_id=...` and only shows the button for Admin/Supervisor
- ✔️ **Inventory stock updates** - `services/supabaseService.ts` only updates `parts.stock_quantity` for Admin/Technician; other roles can still add/remove job parts without triggering RLS failures
- ✔️ **Parts UI permission alignment** - `pages/JobDetail.tsx` now hides Add/Edit/Remove part actions for Supervisor (avoids job_parts RLS violations); technicians can edit in-progress, admins/accountants can amend at finalization
- ✔️ **Fix `canCreateJobs` crash** - Defined `canCreateJobs` in `App.tsx` to prevent `ReferenceError: canCreateJobs is not defined`
- ✔️ **Create Job insert response hardening** - `services/supabaseService.ts:createJob()` no longer embeds `job_parts` / `job_media` / `extra_charges` in the insert response (avoids Supervisor embed-RLS failures); defaults `parts_used`, `media`, `extra_charges` to `[]`
- ✔️ **Favicon for web + notifications** - Added `public/favicon.svg`, linked from `index.html`, and used for browser notifications (`utils/useRealtimeNotifications.ts`)
- ⚠️ **Tailwind note** - Tailwind utilities are currently loaded via `cdn.tailwindcss.com` in `index.html` for demo reliability; move to compiled Tailwind when ready to ship

### TypeScript Fixes (2026-01-06) - Type Safety (author: Claude)
- ✔️ **Added JobStatus.CANCELLED** - Missing enum value added to `types_with_invoice_tracking.ts`
- ✔️ **Fixed actual_start_time → started_at** - `JobDetail.tsx` was referencing non-existent field
- ✔️ **Fixed addMedia signature** - Removed extra `helperAssignmentId` argument from call
- ✔️ **Fixed forklift ID types** - Explicit `string[]` typing for `Array.from()` in `CustomerProfile.tsx`
- ✔️ **Fixed Object.entries typing** - Cast to `[string, number][]` in `Dashboard.tsx`
- ✔️ **Fixed LeaveCard props** - Used `React.FC<>` type for component in `EmployeeProfile.tsx`
- ✔️ **Fixed employee → user** - `hrService.ts` was accessing wrong relation field
- ✔️ **Fixed asyncToast return** - Return original promise instead of toast result in `toastService.ts`

### Performance Improvements (2026-01-06) - Bundle Optimization (author: Claude)
- ✔️ **Route-level lazy loading** - All pages now use `React.lazy()` with Suspense, reducing initial bundle from ~1.5MB to ~290KB
- ✔️ **Vendor chunking** - Split into vendor-react (49KB), vendor-supabase (171KB), vendor-charts (359KB), vendor-ui (75KB)
- ✔️ **Removed ineffective dynamic import** - `EmployeesPage.tsx` was dynamically importing supabaseService which was already in main bundle
- ✔️ **Added typecheck script** - `npm run typecheck` and `npm run lint` for catching type errors
- ✔️ **PageLoader component** - Loading spinner shown during lazy chunk loading

### UI Improvements (2026-01-06) - Dashboard 3-Panel Redesign (author: Claude)
- ✔️ **Service Automation Widget** - Cleaner layout with gradient header icon, row-based stats with hover arrows, improved button styling
- ✔️ **Recent Jobs Panel** - Compact list view with status dots, hover states, cleaner typography, gradient header icon
- ✔️ **Notifications Panel** - Icon backgrounds by type, compact items with dividers, smaller timestamps, unread dot indicator
- ✔️ **Consistent Design Language** - All 3 panels now share: header structure with gradient icons, divide-y lists, footer with "View all" links, 480px fixed height

### Bugfixes (2026-01-06) - Dashboard Stability (author: Claude)
- ✔️ **Null safety for parts_used** - Dashboard revenue calculations now handle null/undefined `parts_used` arrays
- ✔️ **Better debug logging** - `loadDashboardData` now logs user info and job count for debugging
- ✔️ **Fixed realtime subscription loop** - `useRealtimeNotifications` was re-subscribing on every render due to callback dependencies; now uses refs for callbacks
- ✔️ **Fixed chart dimension errors** - Changed chart containers from Tailwind classes to inline styles with explicit pixel dimensions to prevent Recharts width/height -1 errors

### Bugfixes (2026-01-06) - Realtime + Embed Disambiguation (author: Codex)
- ✔️ **Realtime notification import** - `utils/useRealtimeNotifications.ts` now inlines `AppNotification` type to avoid runtime import error
- ✔️ **Jobs ↔ forklifts embed ambiguity** - Explicit FK added to all `forklift:forklifts(...)` embeds in `services/supabaseService.ts`
  - Affected: getRecentlyDeletedJobs, getCustomerJobsWithCancelled, getPendingRequests, getEscalatedJobs, getJobsAwaitingAck
- ✔️ **Helper assignment fetch** - `services/supabaseService.ts:getJobById()` uses `maybeSingle()` to avoid 406 when no helper assignment exists
- ✔️ **Chart containers** - `pages/Dashboard.tsx` chart wrappers now include `min-h` + `w-full` to prevent Recharts width/height -1 warnings

### Customer Feedback Report (2026-01-05)
- **Source:** ACWER User Testing
- **Status:** ✅ Implemented (see above)

#### 1. Dashboard Notifications
| Current | Expected |
|---------|----------|
| Notifications only appear on bell icon at top | All notifications should be listed on dashboard for easy visibility |

#### 2. Notification Alerts for Requests
- **Issue 1:** No sound or visible notification triggered for Admin when Technician requests helper or spare part; same issue vice versa when Admin accepts/rejects
- **Issue 2:** When Admin assigns a request to Technician B, there is no notification and job does not appear in Technician B's app

#### 3. Real-Time Updates on Technician App
| Current | Expected |
|---------|----------|
| No immediate update visible in technician's app once Admin approves a request | Technician's app should display on-the-spot updates reflecting Admin's actions |

**Technical Requirements:**
- Implement Supabase Realtime subscriptions for `notifications`, `jobs`, `job_requests` tables
- Add browser/push notification support with sound
- Dashboard notification panel (not just bell icon)
- Ensure RLS policies allow realtime subscriptions

### Critical RLS Fix (2026-01-05)
- **Updated:** 2026-01-05 (author: Claude)
- 🔨 **Bug Fix: Role Case Mismatch Breaking All Write Operations**
  - **Issue:** Database stores roles as lowercase (`'admin'`, `'supervisor'`) but RLS policies compare against Title case (`'Admin'`, `'Supervisor'`)
  - **Additional Issue:** `get_current_user_role()` used `user_id = auth.uid()` but should use `auth_id = auth.uid()`
  - **Symptom:** Creating jobs, adding parts, updating stock all failed with "violates row level security policy" error
  - **Root Cause:** `fix_rls_performance.sql` policies check `get_my_role() = 'Admin'` but function returns `'admin'`
  - **Fix:** Updated role helper functions to use `initcap()` and correct column reference:
    - `get_my_role()` → returns `'Admin'` instead of `'admin'`
    - `get_current_user_role()` → fixed to use `auth_id` column + `initcap()`
    - `has_role()` → compares using `initcap()` on input
  - **File:** `database/migrations/fix_role_case_mismatch.sql`
- 🔨 **Bug Fix: Missing RLS Policies on job_parts and job_media tables**
  - **Issue:** RLS redesign dropped old policies and enabled RLS but never created new policies
  - **Fix:** Created role-based policies for Admin, Supervisor, Accountant, Technician
  - **Workflow Clarification:** Per WORKFLOW_SPECIFICATION.md:
    - **Technicians** can only REQUEST parts (via spare_part_requests)
    - **Admin/Supervisor** actually SELECT and ADD parts to jobs
    - Technicians get SELECT only on job_parts (not INSERT)
  - **File:** `database/migrations/fix_missing_rls_policies.sql`

### Dashboard Premium UI Polish (2026-01-05)
- **Updated:** 2026-01-05 11:38:37 CST (author: Codex)
- ✔️ **Border consistency fix** - Replaced hardcoded `#e2e8f0` with theme tokens `var(--border)`, `var(--border-subtle)`, `var(--border-strong)`
- ✔️ **Complete status coverage** - Added `STATUS_CONFIG` and `CHART_COLORS` for all 10 job statuses; chart shows all statuses with values > 0
- ✔️ **Action Required count fix** - KPI now includes: escalated + disputed + awaiting ack (was missing awaiting ack)
- ✔️ **Inline style cleanup** - Replaced inline styles with `.card-premium`, `.btn-premium`, `.input-premium` classes
- ✔️ **Notes discoverability** - Added `StickyNote` icon in collapsed Action Required rows; highlighted if notes exist
- ✔️ **Premium theme enabled** - `index.tsx` imports `./index.css` so premium tokens/classes actually apply at runtime
- ✔️ **Surface hierarchy tuning** - Adjusted `--bg`, `--bg-subtle`, and border tokens in `index.css` so cards “lift” off the page (less white-on-white)
- ✔️ **Chart empty states** - Job Status + Revenue Trend cards collapse to compact empty states when there’s no data (no giant blank slabs)
- ✔️ **Recent Jobs scanability** - Switched to row-card list (status rail + chevron + keyboard support) and removed inner-scroll “table” feel
- ✔️ **Service Automation layout** - Widget uses a fixed-height layout with pinned action footer (prevents awkward blank space and keeps the row balanced)
- ✔️ **Contrast improvements**:
  - Action Required header: added `bg-[var(--bg-subtle)]` tint for visual anchor
  - Recent Jobs: row-card hover states + clearer separation (without heavy boxing)
  - Service Automation inner tiles: already have light tint via `bg-[var(--bg-subtle)]`
- ✔️ **Notifications hierarchy fix** - Removed duplicate `NotificationPanel` render and kept notifications compact in the rightmost column (prevents notifications from dominating the dashboard)
- ✔️ **Row 4 height alignment** - Service Automation / Recent Jobs / Notifications now share a fixed height on desktop with internal scroll areas (more balanced, less “floating cards”)
- ✔️ **Notifications visual cleanup** - Reduced noisy tinted backgrounds; notifications are now white cards with semantic left rails + clearer header/connection pill

### Job Detail Premium UI Polish (2026-01-05)
- **Updated:** 2026-01-05 15:09:41 CST (author: Codex)
- ✔️ **Hero card contrast** - Scan anchors use semantic accent rails (Equipment/Repair Time/Summary) instead of large gradients
- ✔️ **Right-rail hierarchy** - Summary → Timeline → Signatures → AI (better scan path, less “where do I look?”)
- ✔️ **Right-rail cohesion** - Timeline/Signatures/AI use the same header pattern (icon tile + title); AI uses semantic info rail (no gradients)
- ✔️ **Header action hierarchy** - Primary action uses brand accent; exception actions are outline; Delete is ghost-danger; Finalize Invoice uses primary accent
- ✔️ **Assignment actions** - Reassign / Add Helper / Remove Helper use high-signal chip buttons + mini-panels (more discoverable, less “hidden text”)
- ✔️ **RM input prefix fix** - Added `.input-premium-prefix` and updated currency inputs so “RM” never overlaps placeholder/value
- ✔️ **Photos upload hierarchy** - Category dropdown lives in Photos header; empty state is a full-size dropzone (drag & drop + click) with a single Upload CTA (no duplicates)
- ✔️ **Reduced “everything tinted” noise** - Signatures + Checklist category tiles use white surfaces + border; tints reserved for callouts
- ✔️ **Label/subtitle contrast** - Added `.label-premium` / `.value-premium` helpers and removed low-contrast `--text-subtle` labels/empties in Job Detail
- ✔️ **Secondary button clarity** - `.btn-premium-secondary` now uses `--border-strong` + subtle shadow so outline actions read as clickable
- ✔️ **Theme tuning** - Neutralized `--bg` / `--bg-subtle` in `index.css` (less blue cast)
- ✔️ **New theme classes** - `.card-tint-*` now render as accent rails (not gradients)

### UI Consistency Updates (2026-01-05) - #7/#8 Status Integration Across Pages
- ✔️ **JobBoard.tsx** - Added new statuses to filters, counts, and badges
  - Status filter dropdown includes: Incomplete - Continuing, Incomplete - Reassigned, Completed Awaiting Acknowledgement, Disputed
  - Badge colors for all new statuses in job cards
  - "Unfinished" date filter excludes Completed and Completed Awaiting Ack (work done)
  - getStatusBadge() and getStatusBadgeClass() handle all new statuses
- ✔️ **Dashboard.tsx** - Status counts and alert sections
  - Status summary counts include new statuses in appropriate categories
  - Separate alert sections for "Awaiting Acknowledgement" and "Disputed" jobs
  - Admins see jobs needing attention while main totals treat them as completed
  - Donut chart includes new status colors
- ✔️ **CustomerProfile.tsx** - Open vs Completed classification
  - Completed statuses include: Completed, Awaiting Finalization, Completed Awaiting Acknowledgement, Disputed
  - Work done = counted as completed for totals
- ✔️ **ForkliftProfile.tsx** - Badge colors and completed services count
  - getJobStatusBadge() includes all new status colors
  - Completed services calculation updated
- ✔️ **disputeJob() response_method fix**
  - Function now accepts optional `method` parameter: 'portal' | 'email' | 'phone' (default: 'portal')
  - JobDetail.tsx dispute button prompts for communication method before recording
  - Consistent with acknowledgeJob() behavior

### Feature: Enhanced Escalation Management (2026-01-05)
Dashboard escalation panel upgraded with industry-standard workflow:
- ✔️ **Acknowledge ownership** - Admin can "Ack" to take ownership of escalated job
- ✔️ **Days overdue** - Shows "2d overdue" instead of raw dates (color-coded severity)
- ✔️ **Expand/collapse rows** - Click to see full details without leaving Dashboard
- ✔️ **Contact info** - Customer & technician phone numbers with click-to-call
- ✔️ **Escalation notes** - Add/edit notes explaining delay or action taken
- ✔️ **Quick actions** - Reassign, Mark Overtime, View Job buttons inline
- ✔️ **Acknowledged state** - Acknowledged jobs show dimmed with green badge

Database additions:
- `jobs.escalation_acknowledged_at` - When admin acknowledged
- `jobs.escalation_acknowledged_by` - Which admin acknowledged
- `jobs.escalation_notes` - Notes about the escalation

Files:
- `database/migrations/add_escalation_acknowledgement.sql`
- `services/supabaseService.ts` - acknowledgeEscalation(), updateEscalationNotes()
- `pages/Dashboard.tsx` - Enhanced escalation panel

### Bugfixes (2026-01-05) - #8 Deferred Completion Critical Fixes
- ✔️ **High: Deferred completion missing hourmeter check**
  - Added `deferredHourmeter` state to JobDetail.tsx
  - Deferred Completion modal now requires hourmeter input with validation (>= start hourmeter)
  - Hourmeter passed to `deferJobCompletion()` and stored in `end_hourmeter`
  - Forklift hourmeter updated on deferred completion
- ✔️ **High: Missing completion timestamps in deferJobCompletion()**
  - `deferJobCompletion()` now sets: `completed_at`, `completion_time`, `repair_end_time`, `completed_by_user_id`, `completed_by_name`
  - Function signature updated to accept optional `endHourmeter` parameter
  - Ensures reporting/invoicing works correctly for deferred jobs
- ✔️ **Medium: KPI pages excluded Completed Awaiting Acknowledgement**
  - Updated `TechnicianKPIPage.tsx` and `TechnicianKPIPageV2.tsx`
  - `completedJobs` filter now includes: Completed, Awaiting Finalization, Completed Awaiting Acknowledgement, Disputed
  - All "work done" statuses now count toward technician KPIs

### Data Cleanup (2026-01-05) - Duplicate Service Intervals
- ✔️ **Duplicate records in service_intervals table**
  - Same service type appeared multiple times per forklift type
  - Cleaned up duplicates (keeping oldest record by created_at)
  - Added unique partial index to prevent future duplicates
  - Index: `idx_service_intervals_unique_active` on (forklift_type, service_type, hourmeter_interval) WHERE is_active = true
  - File: `database/migrations/fix_duplicate_service_intervals.sql`

### Security Fixes (2026-01-05) - Supabase Linter Warnings
- ✔️ **SECURITY DEFINER views** - 4 HR views flagged as security risk
  - Views: `v_pending_leaves`, `v_expiring_permits`, `v_todays_leave`, `v_expiring_licenses`
  - Recreated with explicit `WITH (security_invoker = true)`
  - Views now respect RLS policies of the querying user
  - Updated original migration to prevent issue on fresh deployments
  - File: `database/migrations/fix_security_linter_warnings.sql`
- ✔️ **Backup tables without RLS** - Migration backup tables exposed
  - Tables: `_backup_users_before_merge`, `_backup_employees_before_merge`
  - Enabled RLS with restrictive policy (`USING (false)`)
  - Only service_role can access backup data now
  - File: `database/migrations/fix_security_linter_warnings.sql`
- ✔️ **Function search_path mutable** - 3 trigger functions missing search_path
  - Functions: `update_job_assignments_updated_at`, `update_user_timestamp`, `update_job_requests_updated_at`
  - Added `SET search_path = public` to all 3 functions
  - Updated original migration files to prevent issue on fresh deployments
  - File: `database/migrations/fix_function_search_paths_v2.sql`
- ⚠️ **Leaked Password Protection** - Dashboard setting (manual action required)
  - Go to Supabase Dashboard → Authentication → Settings
  - Enable "Leaked Password Protection"

### Bugfixes (2026-01-05) - HR Dashboard & Migration Fixes
- ✔️ **Migration Fix: EXTRACT on integer** - `EXTRACT(DAY FROM date - date)` fails because date subtraction returns integer, not interval
  - Changed `EXTRACT(DAY FROM ...)` to just `(date - date)` in v_expiring_licenses and v_expiring_permits views
  - File: `database/migration_merge_employees_into_users.sql`
- ✔️ **HR Dashboard Fix: Multiple FK error** - "Could not embed because more than one relationship was found for employee_leaves and users"
  - `employee_leaves` has 4 FKs to users: user_id, requested_by_user_id, approved_by_user_id, rejected_by_user_id
  - Supabase can't auto-resolve which FK to use for embeds
  - Added explicit `!employee_leaves_user_id_fkey` to all 9 user:users embeds in hrService.ts
  - File: `services/hrService.ts`
- ✔️ **Migration Fix: employees table conditional** - Migration failed if `employees` table doesn't exist
  - Wrapped backup, data migration, DROP POLICY/TRIGGER in `IF EXISTS` checks
  - Migration now works whether employees table exists or not
  - File: `database/migration_merge_employees_into_users.sql`

### Bugfixes (2026-01-05) - #8 Deferred Acknowledgement Hardening
- ✔️ **Migration Fix: NOW() in index** - `idx_customer_ack_token` used `WHERE token_expires_at > NOW()` but NOW() isn't IMMUTABLE
  - Removed WHERE clause, expiry check done in application layer
  - File: `database/migrations/add_deferred_acknowledgement.sql`
- ✔️ **Migration Fix: Non-existent column** - `idx_jobs_disputed` referenced `updated_at` which doesn't exist on jobs table
  - Changed to `disputed_at` (added in same migration)
  - File: `database/migrations/add_deferred_acknowledgement.sql`
- ✔️ **Evidence Photo Enforcement** - Now requires minimum 1 photo for deferred completion
  - Handler validates `selectedEvidenceIds.length > 0`
  - Service layer returns error if array empty/null
  - Button disabled until 1+ photos selected
  - Label shows "Evidence Photos * (min. 1 required)"
- ✔️ **Admin Acknowledge on Behalf** - MVP for customer workflow
  - "Record Acknowledgement" button (phone/email confirmation)
  - "Record Dispute" button (record customer complaint)
  - Admin/Supervisor can complete the acknowledgement flow without customer portal
  - Full customer portal with access_token can be built later if needed

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
  - `database/migrations/add_job_media_category.sql` - DB migration (production-safe, idempotent)
- **Files modified:**
  - `types_with_invoice_tracking.ts` - Added `MediaCategory` type and `category` field to `JobMedia`
  - `pages/JobDetail.tsx`:
    - Added photo category filter tabs (All, Before, After, Spare Parts, Condition, Evidence, Other)
    - Added category selector dropdown when uploading photos
    - Added category badges on photo thumbnails
    - Added "Download ZIP" button with category-organized folders
    - Added `getDefaultPhotoCategory()` helper for status-linked defaults
    - Uses JSZip for client-side ZIP generation
  - `package.json` - Added `jszip` dependency
- **Features:**
  - 6 photo categories: `before`, `after`, `spare_part`, `condition`, `evidence`, `other`
  - Color-coded category badges on each photo
  - Filter photos by category with count indicators
  - **Status-linked default category (auto-suggest with user override):**
    - New / Assigned → `before` (pre-service documentation)
    - In Progress (first 30 min) → `before`
    - In Progress (after 30 min) → `other` (user picks)
    - Awaiting Finalization → `after` (post-service documentation)
  - Photo upload available for: New, Assigned, In Progress, Awaiting Finalization
  - Download all photos as ZIP with folders per category
  - Filtered downloads respect current category filter
- **DB Migration (production-safe):**
  - Adds column as nullable first, backfills, then sets NOT NULL DEFAULT 'other'
  - CHECK constraint for valid category values
  - Index on (job_id, category) for filtered queries
  - Run `add_job_media_category.sql` in Supabase SQL Editor before use
- **Access:** Technician, Admin, Supervisor

#### #1 Helper Technician Support - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_job_assignments.sql` - Job assignments table with RLS
- **Files modified:**
  - `types_with_invoice_tracking.ts` - Added `JobAssignment` interface
  - `services/supabaseService.ts`:
    - Added helper assignment functions: `assignHelperToJob`, `removeHelperFromJob`, `getJobHelperAssignment`
    - Updated `getJobs()` to include helper jobs for technicians
    - Photos tagged with `is_helper_photo` when uploaded by helper
  - `pages/JobDetail.tsx`:
    - Added Helper Technician section in sidebar showing assigned helper
    - Added "Add Helper" / "Remove Helper" buttons for Admin/Supervisor
    - Added "You are the helper on this job" notice for helpers
    - Added Assign Helper modal with technician selection
    - Added `isHelperOnly` permission flag with restrictions:
      - ❌ Start Job, Complete Job (status changes)
      - ❌ Hourmeter reading input
      - ❌ Add/edit spare parts
      - ❌ Technician/Customer signatures
      - ❌ Add notes
      - ❌ Edit Job Carried Out / Recommendation
      - ❌ Edit Condition Checklist
      - ❌ Edit prices / extra charges
      - ✅ Upload photos (tagged as helper photos)
      - ✅ View job details
  - `pages/JobBoard.tsx`:
    - Added "Helper" badge for jobs where user is assigned as helper
    - Helper jobs now appear in technician's job list
- **Features:**
  - Max 1 helper per job (enforced by unique index)
  - Same "Technician" role, different `assignment_type` (lead/assistant)
  - Helper can only upload photos - all other actions blocked
  - Photos uploaded by helper are tagged for audit trail
  - Helper sees job in their job list with "Helper" badge
- **DB Migration Required:** Run `add_job_assignments.sql` in Supabase SQL Editor
- **Access:** Technician (as helper), Admin/Supervisor (assign/remove)

#### #2 + #3 In-Job Request System + Spare Parts Approval - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_job_requests.sql` - Job requests table with RLS
- **Files modified:**
  - `types_with_invoice_tracking.ts` - Added `JobRequest`, `JobRequestType`, `JobRequestStatus` types
  - `services/supabaseService.ts`:
    - `createJobRequest()` - Create assistance/spare_part/skillful_technician request
    - `getJobRequests()` - Get all requests for a job with user/part details
    - `getPendingRequests()` - Get pending requests for admin dashboard
    - `approveSparePartRequest()` - Approve and add part to job's parts_used
    - `rejectRequest()` - Reject with reason
    - `approveAssistanceRequest()` - Approve and assign helper
    - `getRequestCounts()` - Get pending/total counts for badges
  - `pages/JobDetail.tsx`:
    - Added Requests section with 3 request buttons (visible during In Progress)
    - Request buttons: "Request Assistance", "Request Spare Part", "Request Skillful Tech"
    - Request list showing all requests with status badges
    - Request modal for creating new requests with description + optional photo
    - Color-coded request types and statuses
- **Features:**
  - 3 request types: assistance, spare_part, skillful_technician
  - Lead technician can create requests during In Progress status
  - Requests show pending count badge
  - Each request shows type, status, timestamp, description, photo (if any)
  - Approved spare parts auto-added to job's parts_used with `added_via_request` tracking
  - Admin response notes visible on resolved requests
- **DB Migration Required:** Run `add_job_requests.sql` in Supabase SQL Editor
- **Access:** Technician (create), Admin/Supervisor (approve/reject)

#### #7 Multi-Day Escalation - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_multiday_escalation.sql` - Schema + holidays + settings
  - `utils/businessDays.ts` - Business day calculation utilities
- **Files modified:**
  - `types_with_invoice_tracking.ts`:
    - Added new JobStatus values: `COMPLETED_AWAITING_ACK`, `INCOMPLETE_CONTINUING`, `INCOMPLETE_REASSIGNED`, `DISPUTED`
    - Added Job fields: `cutoff_time`, `is_overtime`, `escalation_triggered_at`
    - Added `PublicHoliday` and `AppSetting` interfaces
  - `services/supabaseService.ts`:
    - `getPublicHolidays()` - Fetch holidays for business day calc
    - `getAppSetting()` / `updateAppSetting()` - Config management
    - `markJobContinueTomorrow()` - Set cutoff and status
    - `resumeMultiDayJob()` - Resume continuing job
    - `getJobsNeedingEscalation()` - Find jobs to escalate
    - `triggerEscalation()` - Mark job as escalated
    - `markJobAsOvertime()` - Toggle overtime flag
    - `getEscalatedJobs()` - For admin dashboard
  - `pages/JobDetail.tsx`:
    - "Continue Tomorrow" button (In Progress → Incomplete - Continuing)
    - "Resume Job" button (Incomplete - Continuing → In Progress)
    - Multi-Day Controls panel (Admin/Supervisor): Overtime toggle, cutoff time, escalation info
    - Status badges: "Escalated" (red pulse), "OT Job" (purple), "Continuing" (amber)
    - Continue Tomorrow modal with reason input
- **Schema changes:**
  - `jobs` table: `cutoff_time`, `is_overtime`, `escalation_triggered_at`
  - `public_holidays` table: Malaysian holidays 2025-2026 (Sunday + holidays = non-working)
  - `app_settings` table: Configurable settings (SLA days, etc.)
  - Index: `idx_jobs_pending_escalation` for queue scans
- **Business rules:**
  - Working days: Monday-Saturday (Sunday only off)
  - Holidays: Skip Malaysian public holidays
  - Escalation: 8:00 AM next business day, notify Admin (no auto-reassign)
  - Overtime jobs: No escalation
  - SLA: Configurable, default 5 business days
- **DB Migration Required:** Run `add_multiday_escalation.sql` in Supabase SQL Editor
- **Access:** Technician (continue/resume), Admin/Supervisor (overtime toggle, view escalations)
- **Note:** Escalation check runs on Dashboard load (MVP). Upgrade to Edge Function cron with Supabase Pro for automatic 8 AM daily checks.

#### #8 Deferred Acknowledgement - ✔️ COMPLETED
- **Files created:**
  - `database/migrations/add_deferred_acknowledgement.sql` - Schema + customer_acknowledgements table
- **Files modified:**
  - `types_with_invoice_tracking.ts`:
    - Added `CustomerAcknowledgement` interface
    - Added Job fields: `verification_type`, `deferred_reason`, `evidence_photo_ids`, `customer_notified_at`, `customer_response_deadline`, `auto_completed_at`, `dispute_notes`, `disputed_at`, `dispute_resolved_at`, `dispute_resolution`
  - `services/supabaseService.ts`:
    - `deferJobCompletion()` - Complete job without customer signature
    - `getJobAcknowledgement()` - Get ack record for job
    - `acknowledgeJob()` - Customer acknowledges via portal/phone/email
    - `disputeJob()` - Customer disputes completion
    - `resolveDispute()` - Admin resolves dispute
    - `checkAndAutoCompleteJobs()` - Auto-complete expired deferred jobs
    - `getJobsAwaitingAck()` - List jobs pending acknowledgement
    - `getDisputedJobs()` - List disputed jobs
  - `pages/JobDetail.tsx`:
    - "Customer Unavailable" button (In Progress → Completed Awaiting Acknowledgement)
    - Deferred Completion modal with reason + evidence photo selection
    - Acknowledgement Status panel showing deadline, reason, dispute info
    - Admin dispute resolution buttons (Accept & Complete / Reopen Job)
  - `pages/Dashboard.tsx`:
    - Auto-complete check runs on load (same as escalation check)
- **Schema changes:**
  - `jobs` table: verification_type, deferred_reason, evidence_photo_ids, customer_notified_at, customer_response_deadline, auto_completed_at, dispute_notes, disputed_at, dispute_resolved_at, dispute_resolution
  - `customer_acknowledgements` table: access_token for customer portal, signature, response tracking
  - Index for deferred jobs pending auto-completion
- **Business rules:**
  - SLA: Configurable business days (default 5) for customer response
  - Auto-complete: Jobs past deadline auto-complete with verification_type='auto_completed'
  - Disputes: Customer can dispute, Admin resolves by completing or reopening
  - Evidence: Photos selected from job's existing media as proof of work
- **Verification types:** signed_onsite, deferred, auto_completed, disputed
- **DB Migration Required:** Run `add_deferred_acknowledgement.sql` in Supabase SQL Editor
- **Access:** Technician (defer), Customer (acknowledge/dispute), Admin/Supervisor (resolve disputes)

### Bugfixes (2026-01-04) - Request System Schema & UI Fixes
- ✔️ **Fixed Spare Part Approval** - Was writing to non-existent `jobs.parts_used` column
  - Now correctly inserts into `job_parts` table
  - Also updates stock quantity in `parts` table
  - File: `services/supabaseService.ts:approveSparePartRequest()`
- ✔️ **Fixed Assistance Approval Call** - Was calling non-existent `assignHelperToJob()`
  - Changed to correct function `assignHelper()`
  - File: `services/supabaseService.ts:approveAssistanceRequest()`
- ✔️ **Fixed Part Column Name** - Was using `parts.name` instead of `parts.part_name`
  - Fixed in `getJobRequests()` query
  - Fixed in JobDetail.tsx display
  - Files: `services/supabaseService.ts`, `pages/JobDetail.tsx`
- ✔️ **Added Admin Approval UI** - Was missing UI for approve/reject actions
  - Added "Review & Approve" / "Reject" buttons on pending requests for Admin/Supervisor
  - Added approval modal with:
    - Part picker + quantity selector (for spare_part requests)
    - Technician picker (for assistance requests)
    - Info panel (for skillful_technician requests - requires separate reassignment)
    - Notes field
  - File: `pages/JobDetail.tsx`
- ✔️ **Added `acknowledgeSkillfulTechRequest()`** - Sets status to 'approved' (not 'rejected')
  - Skillful tech requests are now properly marked as approved/acknowledged
  - File: `services/supabaseService.ts`

### Bugfixes (2026-01-04) - Helper Technician RLS & Schema Fixes
- ✔️ **RLS Policy Fix** - Fixed `job_assignments` policies that would block production access
  - Changed `users.user_id = auth.uid()` → `users.auth_id = auth.uid()` (correct auth mapping)
  - Changed role check `'Admin', 'Supervisor'` → `'admin', 'supervisor'` (lowercase to match schema)
  - Technician policies now use subquery to map `auth.uid()` to `user_id`
  - File: `database/migrations/add_job_assignments.sql`
- ✔️ **Remove Invalid Column Reference** - Fixed `addMedia()` insert that referenced non-existent column
  - Removed `uploaded_by_assignment_id` from insert (column never added to `job_media`)
  - `uploaded_by` + `is_helper_photo` already provides sufficient audit trail
  - File: `services/supabaseService.ts`
- ✔️ **Fix Column Name** - Fixed `getUserAssignmentType()` using wrong column
  - Changed `assigned_to` → `assigned_technician_id` (correct column name)
  - File: `services/supabaseService.ts`
- **Deferred:**
  - Helper time logging UI (not requested by ACWER yet)
  - Lead assignment records in `job_assignments` (using `jobs.assigned_technician_id` + audit log instead)
  - `jobs.helper_technician_id` cleanup (unused denormalized field, can remove later)

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
| 1 | Helper Technician | Medium | ✅ Confirmed | ✔️ Completed |
| 2 | In-Job Request System | High | ✅ Confirmed | ✔️ Completed |
| 3 | Spare Parts Request/Approval | Medium | ✅ Confirmed | ✔️ Completed |
| 4 | Hourmeter Reading + prediction | Medium | ✅ Confirmed | ✔️ Completed |
| 5 | Service Intervals | Low | ✅ Confirmed | ✔️ Completed |
| 6 | Job Reassignment + Items/KPI | High | ✅ Confirmed | 🔨 Partial (UI pending) |
| 7 | Multi-Day Jobs + Escalation | Medium | ✅ Confirmed | ✔️ Completed |
| 8 | Deferred Customer Acknowledgement | Medium | ✅ Confirmed | ✔️ Completed |
| 9 | KPI Dashboard | Medium | ✅ Confirmed | ✔️ Completed |
| 10 | Photo Categorization + ZIP | Low | ✅ Confirmed | ✔️ Completed |
| 11 | Partial Work Tracking | Low-Medium | ⏳ Pending | ❌ Not started |

**Summary:** 9 features completed, 1 partial (UI pending), 1 awaiting client confirmation

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

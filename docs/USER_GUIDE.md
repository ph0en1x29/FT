# FieldPro User Guide
## Field Service Management System

---

> 📢 **What's New?**
>
> **🆕 Latest Update (2026-04-06):**
> - **🚜 External forklift add flow fixed** — When creating a customer-owned external forklift during Create Job, the newly added unit now stays available and selected instead of seeming to disappear after pressing Add.
> - **🔁 Reassign button made reliable** — The Reassign action in Job Detail now responds consistently and opens the reassignment flow correctly.
>
> **Previous update (2026-03-07):**
> - **📱 Technician Workflow Card** — On mobile, technicians see a guided workflow card: Accept → Start → Work → Complete. Shows exactly what's left before completing (photos, hourmeter, signatures).
> - **🖥️ Role-specific dashboards** — Service Admin sees jobs pipeline and fleet. Store Admin sees parts requests and inventory alerts. Each role loads only their own dashboard (faster).
> - **📦 Inventory pagination** — Parts catalog loads 50 items per page with server-side filtering. Faster for large inventories.
> - **🎨 Themed confirmation dialogs** — All delete/end-rental actions use styled modals instead of browser popups.
> - **⚡ Per-role code splitting** — Dashboard code split per role, reducing load size for technicians and other non-admin roles.
>
> **2026-03-06:**
> - **🧭 Clearer admin dashboard** — The dashboard now opens with a more obvious action summary: what is due today, what is waiting for review, where jobs are unassigned, and how much technician capacity is available.
> - **🔎 Cleaner Jobs controls** — Search, status, date filters, and result counts are grouped more clearly, so it is faster to narrow the work queue.
> - **🚚 Fleet overview cards** — Fleet now shows instant counts for total units, available units, rented units, and maintenance attention items before the grid.
> - **👥 Better customer scanning** — Customers page now shows summary cards and stronger customer cards so accounts with full contact info or missing details stand out faster.
> - **⏳ Better loading feedback** — Jobs and Fleet loading states now preserve page structure with skeleton layouts instead of large blank spinners.
>
> **Also on 2026-03-06:**
> - **✍️ Swipe-to-Sign** — Replaced signature drawing with a simple swipe slider. Technician swipes to sign; customer fills in Name + IC Number then swipes. Much faster on mobile.
> - **📋 Bulk Site Sign-Off** — Technicians with 2+ jobs at the same site can sign all of them at once. One swipe for tech, one swipe for customer. No more signing each job individually.
> - **🔐 Admin Role Split** — Admin (Service) manages jobs, customers, forklifts, and HR. Admin (Store) manages inventory and parts. Each sees only what they need.
> - **🔧 Reach Truck = Electric** — Reach trucks now follow electric forklift service schedules (3-month calendar-based tracking).
> - **📍 Site address only** — Job detail shows the site address selected during creation, not the customer's office address.
>
> **Previous (2026-03-05):**
> - **🔍 Searchable dropdowns everywhere** — Type to filter customers, parts, forklifts, and other lists. No more endless scrolling.
> - **📅 Job Board pill tabs** — Quick navigation by date range (Unfinished/Today/Week/month/All) replacing the old dropdown.
> - **📸 Camera-only photos for Start Job** — Prevents fake photos with mandatory camera capture before starting work. Includes timestamp + location.
> - **🔄 Return Forklift button** — Fleet cards now have prominent Rent Out and Return buttons for faster workflows.
> - **✏️ Edit Customer button works now** — Previously broken, now opens full modal with Company and Contact sections.
> - **📱 All modals scroll properly on mobile** — Fixed content clipping on small screens.
> - **💻 Desktop modals use 2-column layouts** — Better use of screen space on larger displays (Create Job, Schedule Service, Edit Forklift, etc.).
> - **⚡ Faster page transitions** — Improved caching means less waiting between pages.
> - **RM currency display** — Inventory now correctly shows Malaysian Ringgit (RM) instead of $.
> - **📦 Purchase History viewer** — See all inventory purchases grouped by invoice with document viewer.
>
> **Previous (February 2026):**
> - **⌨️ Command Palette (Cmd/Ctrl+K)** - Role-aware quick navigation and actions from anywhere
> - **📱 Mobile Bottom Navigation** - Role-specific tabs with unread notification badge support
> - **🔵 Floating Action Button (FAB)** - Mobile quick actions menu by role
> - **🔄 Pull-to-Refresh** - Pull down on Jobs page to reload with arrow/spinner feedback
> - **👆 Swipe Actions** - Swipe right to approve (green), left to reject (red) in StoreQueue/Approvals
> - **📲 PWA Install** - Add FieldPro to home screen for standalone app experience + offline cached pages
> - **🌙 Dark Mode** - Full app dark theme that follows your system preference
>
> **Previous (2026-02-16):**
> - **📦 Van History Tab** - Full parts deduction log with technician, job, and timestamps
> - **🔢 Decimal Quantities** - Type exact amounts (e.g., 1.5L) for liquid/bulk parts
> - **⛔ Stock Indicators** - Parts dropdown now shows OOS/low stock warnings with visual icons
> - **🔓 Admin Override** - Admins can add out-of-stock parts (pre-allocation, ordering)
>
> **Previous (2026-02-01):**
> - **✅ Check All Button** - Mark all 48 checklist items as OK with one click
> - **↩️ Auto-X on Untick** - Click OK on checked item to mark as needs attention
> - **👁️ Parts Visible to Technicians** - Technicians see parts immediately (no prices)
> - **⚡ Auto-Confirm Parts** - Parts auto-confirmed when admin adds them
> - **🔧 Unified Admin Roles** - All admins can add parts AND confirm them
> - **📸 Photo Upload Fix** - Faster uploads with image compression
> - **📋 Part Request UI** - Technicians can request parts, admins approve
>
> **Previous (January 2026):**
> - Helper Technician System (assign assistants to jobs)
> - In-Job Request System (request assistance, spare parts, skillful tech)
> - Multi-Day Job Support with escalation management
> - Deferred Customer Acknowledgement (complete jobs without on-site signature)
> - Photo Categorization with ZIP download
> - Real-time notifications with sound alerts
> - Enhanced Dashboard with Action Required queue
> - AutoCount Integration - Export invoices to AutoCount accounting software
> - Photo Validation - GPS tracking and timestamp verification
> - Fleet Dashboard - Real-time forklift status updates
> - Push Notifications - Real browser push notifications
> - 15-Minute Accept/Reject - Technicians must respond within 15 minutes
> - Pricing Hidden from Technicians - Financial data visible to admin/accountant only
> - Parts Entry by Admin Only - Technicians use Spare Part Request workflow
>
> 📚 **All Documentation:** See [Documentation Index](./README.md) for complete docs navigation.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Roles Overview](#user-roles-overview)
3. [Job Workflow](#job-workflow)
4. [Role-Specific Guides](#role-specific-guides)
   - [Technician Guide](#technician-guide)
   - [Accountant Guide](#accountant-guide)
   - [Supervisor Guide](#supervisor-guide)
   - [Admin Guide](#admin-guide)
5. [Job Completion Requirements](#job-completion-requirements)
6. [Common Tasks](#common-tasks)
7. [Mobile Features](#mobile-features-new---2026-02-18)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Logging In
1. Open the FieldPro application at https://ft-kappa.vercel.app/
2. Enter your email and password
3. Click "Login"

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin1@example.com | Admin123! |
| Admin | admin2@example.com | Admin123! |
| Supervisor | super1234@gmail.com | Super123! |
| Technician | tech1@example.com | Tech123! |
| Technician | tech2@example.com | Tech123! |
| Technician | tech3@example.com | Tech123! |
| Accountant | accountant1@example.com | Account123! |

---

## User Roles Overview

### Admin 👑
- Full system access
- Manage all users and settings
- Create, assign, and manage jobs
- Add parts directly to jobs (auto-confirmed)
- Approve part requests from technicians
- Confirm job completion
- Hourmeter amendment approval
- Override any restrictions
- Access all reports and data

### Supervisor 👔
- View and manage all jobs
- Create and assign jobs
- Reassign technicians
- Manage inventory and forklifts
- Approve or finalize invoices
- View KPI dashboards

### Technician 🔧
- View only assigned jobs
- Accept or reject job assignments (within 15 minutes)
- Start and complete jobs
- Fill condition checklist (Check All + mark exceptions)
- Request parts (admin must approve)
- View parts used (names only, no prices)
- Capture before/after photos
- Capture customer signatures
- Submit for finalization

### Accountant 💼
- View all jobs
- Finalize invoices
- Record payments
- View service records (read-only)
- Generate financial reports

---

## Job Workflow

### Status Flow Diagram

```
┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────────────────┐     ┌───────────┐
│   New   │ ──▶ │ Assigned │ ──▶ │ In Progress │ ──▶ │ Awaiting            │ ──▶ │ Completed │
│         │     │          │     │             │     │ Finalization        │     │           │
└─────────┘     └──────────┘     └─────────────┘     └─────────────────────┘     └───────────┘
     │               │                  │                     │                        │
     │               │                  │                     │                        │
Admin/Supervisor   Admin/Supervisor   Technician           Accountant/Admin         LOCKED
creates job       assigns technician  works on job         finalizes invoice        (Admin unlock only)
```

#### Multi-Day & Deferred Acknowledgement Flow (NEW)

```
In Progress ──▶ ┌─────────────────────────────────┐
             │  Completed Awaiting Ack       │ ──▶ Completed (after customer response/auto-complete)
             │  (Customer unavailable)        │
             └─────────────────────────────────┘
                           │
                           ▼
                      ┌───────────┐
                      │  Disputed  │ ──▶ Admin resolves
                      └───────────┘

In Progress ──▶ ┌──────────────────────────────┐
             │  Incomplete - Continuing      │ ──▶ Resume next day ─▶ In Progress
             │  (Continue Tomorrow)          │
             └──────────────────────────────┘

In Progress ──▶ ┌──────────────────────────────┐
             │  Incomplete - Reassigned      │ ──▶ New tech takes over
             │  (Admin reassigned)           │
             └──────────────────────────────┘
```

### Status Descriptions

| Status | Description | Who Can Move Forward | Who Can Move Backward |
|--------|-------------|---------------------|----------------------|
| **New** | Job created, awaiting assignment | Admin, Supervisor | - |
| **Assigned** | Technician assigned, awaiting start | Technician, Admin, Supervisor | Admin, Supervisor |
| **In Progress** | Technician actively working | Technician, Admin | Admin, Supervisor |
| **Awaiting Finalization** | Work complete, invoice pending | Accountant, Admin | Admin, Supervisor |
| **Completed** | Invoice finalized, record locked | - | Admin only (with override) |
| **Completed Awaiting Ack** | Work done, customer couldn't sign on-site | Customer (acknowledge), System (auto-complete) | Admin |
| **Incomplete - Continuing** | Multi-day job, technician will resume | Technician (resume) | Admin |
| **Incomplete - Reassigned** | Job reassigned to different technician | New Technician | Admin |
| **Disputed** | Customer disputed the completion | Admin (resolve) | - |

---

## Role-Specific Guides

---

## Technician Guide

### Your Dashboard
When you log in, you'll see a **personalized Technician Dashboard** showing:

- **Today's Jobs** - Jobs assigned to you for today
- **In Progress** - Count of jobs currently being worked on
- **Completed This Week** - Your productivity summary
- **Van Stock Alerts** - Items in your van running low

The dashboard also shows your **Active Jobs** list with quick actions to view or start jobs. Each job displays the customer, forklift, and Slot-In SLA badge (time remaining).

**Quick Actions** at the bottom let you navigate to All Jobs, Van Stock, Fleet, or Customers.

### 📱 Push Notifications (NEW - 2026-01-29)

Enable push notifications to get instant alerts even when the app isn't open!

**What You'll Be Notified About:**
- New job assignments
- Request approvals/rejections
- Job reassignments

**How to Enable:**
1. You'll see a prompt on your dashboard: "Enable push notifications"
2. Click **"Enable"**
3. Your browser will ask for permission - click **"Allow"**
4. Done! You'll now receive push notifications

**Troubleshooting:**
- If you see "Notifications Blocked", click the lock icon in your browser's address bar
- Find "Notifications" and change to "Allow"
- Refresh the page

### 📲 Telegram Notifications (NEW - 2026-01-31)

Get instant notifications on Telegram! No app needed - use your existing Telegram.

**How to Connect:**
1. Go to **My Profile** (click your name in the sidebar)
2. Scroll to the **Notifications** section
3. Click **"Connect Telegram"**
4. Telegram opens → tap **"Start"**
5. Choose your language: 🇬🇧 English or 🇲🇾 Bahasa Melayu
6. Done! You'll now receive job notifications on Telegram

**What You'll Receive:**
- 🔧 New job assignments (with Accept/Reject buttons)
- ✅ Request approvals
- ❌ Request rejections
- 🚨 Escalation alerts
- 📋 Daily reminders for pending items

**Notification Preferences:**
In the Telegram section of your profile, you can toggle which notifications you want:
- Job Assignments
- Job Accepted/Rejected
- Request Status Updates
- Escalation Alerts
- Daily Reminders

**For Admins:**
You can view which team members have Telegram connected in the Team Status section.

### ⏰ Accepting Job Assignments (NEW - 2026-01-29)

When a job is assigned to you, you have **15 minutes** to accept or reject it.

**On the Job List:**
1. New assigned jobs show **"Accept"** and **"Reject"** buttons
2. A countdown timer shows remaining response time
3. Timer turns amber below 10 minutes, red below 5 minutes

**To Accept:**
1. Click the **"Accept"** button on the job card or job detail page
2. The job is marked as accepted
3. You can now start the job when ready

**To Reject** *(updated 2026-04-07 — photo proof now required)*:
1. Click the **"Reject"** button
2. Enter a reason for rejection (required) — e.g., weather hazard at site, vehicle blocked, customer not on premises
3. **Take an on-site photo** by tapping the camera capture area. The photo proves you were at the site when rejecting. **GPS location is captured automatically and is required** — if you deny location permission, the rejection will be blocked with a clear error
4. Click **"Reject Job"** (it stays disabled until both reason and photo are provided)
5. The job returns to the admin queue for reassignment, with the photo + reason attached for the admin to review

**What Happens If You Don't Respond** *(updated 2026-04-07 — re-alerts now automated)*:
- After **15 minutes**, the system sends an automatic notification to all admins/supervisors: *"⏰ No Response from Technician (1/4)"*
- If you still haven't responded after another 15 minutes, a second alert fires: *"(2/4)"*. This continues for up to **4 alerts over 1 hour**, after which the system stops notifying and the job remains in your queue until an admin reassigns it
- The final alert (4/4) is marked **urgent** and reads *"This is the final automatic reminder — please reassign or contact the technician."*
- If you can't respond in time, message your supervisor directly so they can reassign manually before the alerts escalate

### Starting a Job

1. Find the job in your list (status: "Assigned")
2. Click on the job to open details
3. Click **"Start Job"** button
4. Enter the current hourmeter reading (mandatory, minimum **1**). **If the hourmeter is broken or the reading is unavailable, enter `1` and add a remark in the "Broken meter remark" field that appears.** `0` is never accepted. Field Technical Services and Repair jobs do not collect a hourmeter reading and the input is hidden for them.
5. Complete the **Condition Checklist** (48 inspection items) — skipped for Repair and Field Technical Services
6. The job status changes to "In Progress"

### Working on a Job

While the job is "In Progress", you can:

#### Request Parts (Changed - 2026-01-19)
> **Note:** Technicians can no longer directly add parts to jobs. Use the Spare Part Request workflow instead:

1. Click **"Request Spare Part"** in the Request section
2. Describe the part needed
3. Upload a photo of the faulty component (optional)
4. Wait for Admin approval
5. Approved parts appear in the "Parts Used" list

**Why this change?** To improve inventory accuracy and ensure proper stock management.

#### Return a Part That Doesn't Fit (NEW - 2026-04-23)

If an approved part turns out to be the **wrong model, damaged, or not compatible** when you try to use it on-site, you can flag the part for return so the job isn't blocked.

1. In the **Parts Used** section, find the row for the part you can't use.
2. Click the small **circular arrow icon** (Return) on that row.
3. Pick a reason — **Wrong model**, **Damaged**, **Not compatible**, or **Other** (free-text required for "Other").
4. Add an optional note for the admin and tap **Request Return**.
5. The row stays visible but is greyed out with a **Pending Return** label. The job is no longer blocked by that part — you can complete the job once everything else is in order.
6. Hand the physical part back to the warehouse. An **admin will click Confirm Return** when they receive it, and the part will be credited back to inventory.

**Changed your mind?** Tap the **undo icon** on a Pending Return row before the admin confirms — the part returns to active use. Once the admin clicks Confirm Return, the row locks as **Returned** and the part can no longer be brought back without re-requesting a spare part.

Returned parts (both Pending Return and confirmed Returned) are **automatically excluded from the customer invoice** — you won't be charged for parts that went back to the warehouse.

#### Record Service Details
1. Fill in "Job Carried Out" - describe the work done
2. Add "Recommendation" - any follow-up suggestions
3. Set repair start/end times

#### Add Photos (Updated - 2026-01-19)
1. Click **"Add Photo"** in the Media section
2. Take or upload photos of:
   - Before condition
   - Work in progress
   - After condition
   - Parts replaced

**Photo-Based Time Tracking** - The job timer is controlled by photos:
- **First photo** → Timer starts automatically
- **"After" category photo** → Timer stops automatically
- Photos are captured **live** (camera only, no gallery access)
- Only the **lead technician** can start/stop the timer (helpers cannot)

#### Condition Checklist (Updated - 2026-01-19)
The checklist now uses binary states:
- Click **✓ OK** (green) if the item passes inspection
- Click **✗ Not OK** (red) if the item fails
- All mandatory items must be marked before completing the job

### Completing a Job

**Before you can complete**, ensure you have:
- ✅ Started the job (hourmeter recorded)
- ✅ Filled the condition checklist
- ✅ Added service notes/job carried out
- ✅ Recorded parts used OR checked "No parts used"
  - ⚠️ If you uploaded any photos tagged **"Parts"**, you cannot also tick **"No parts used"**. Either add the parts to the Used Parts list, or re-tag the photos as **Condition / Evidence / Other** before completing.
- ✅ Obtained **technician signature**
- ✅ Obtained **customer signature**

1. Click **"Complete Job"**
2. If any requirements are missing, you'll see an error message
3. Once complete, job moves to "Awaiting Finalization"

### Requesting Help (NEW)

During an "In Progress" job, you can request assistance:

#### Request Assistance
1. Click **"Request Assistance"** button
2. Describe why you need help
3. Optionally upload a photo
4. Admin will assign a helper technician
5. Helper can upload photos but cannot modify job details

#### Request Spare Parts
1. Open the job detail page (job must be In Progress)
2. Scroll to the **"Part Requests"** section
3. Click the **"Request Part"** button
4. Select request type: Spare Part, Assistance, or Skillful Technician
5. Describe the part/assistance needed in detail
6. Optionally add a photo URL showing the issue
7. Click **"Submit Request"**
8. Admin receives notification and reviews your request
9. Once approved, the part is automatically added to your job
10. You can see the request status (Pending → Approved/Rejected) in the Part Requests section

#### Request Skillful Technician
1. Click **"Request Skillful Technician"** button
2. Explain the skill/expertise issue
3. Admin may reassign the job to a specialist

#### Edit Pending Requests (NEW - 2026-01-19)
If you made a mistake in a request that hasn't been processed yet:

1. Find your request in the "Requests" section of the job
2. If status is "Pending", click the **"Edit"** button
3. Update the description, type, or photo
4. Click **"Save"**

> **Note:** You can only edit your own requests while they are still pending. Once approved or rejected, requests cannot be edited.

### Your Dashboard (Updated - 2026-01-19)

Your dashboard now shows a **Notifications** card with recent alerts:

- Job assignments
- Request approvals/rejections
- Escalation notices

Click any notification to go directly to the related job or page.

### Multi-Day Jobs (NEW)

For jobs that cannot be completed in one day:

1. Click **"Continue Tomorrow"** button
2. Enter reason for continuation
3. Job status changes to "Incomplete - Continuing"
4. Next day, click **"Resume Job"** to continue
5. All previous work (photos, notes, hourmeter) is preserved

### Customer Unavailable (NEW)

If customer cannot sign on-site:

1. Complete all work as normal
2. Click **"Customer Unavailable"** button
3. Select reason from dropdown
4. Select evidence photos (minimum 1 required)
5. Enter final hourmeter reading
6. Job status changes to "Completed Awaiting Acknowledgement"
7. Customer receives notification to acknowledge remotely
8. Job auto-completes after 3-5 business days if no response

### Helper Technician Mode (NEW)

If you're assigned as a **helper** to another technician's job:

- You'll see "You are the helper on this job" notice
- You CAN upload photos (tagged as helper photos)
- You CANNOT start/complete job, record hourmeter, add parts, or capture signatures
- The lead technician handles all other actions

### What You CANNOT Do
- ❌ See jobs assigned to other technicians (except as helper)
- ❌ Change the customer
- ❌ Reassign the job
- ❌ Edit after job is completed
- ❌ Delete jobs or parts

---

## Accountant Guide

### Your Dashboard
When you log in, you'll see a **billing-focused Accountant Dashboard** showing:

- **Monthly Revenue** - Estimated revenue for the current month
- **Jobs to Finalize** - Jobs awaiting your review
- **Awaiting Ack** - Jobs pending customer acknowledgement
- **Completed This Month** - Total jobs completed

The dashboard includes:
- **Revenue Trend** chart (last 7 days)
- **Invoice Status** distribution pie chart
- **Finalization Queue** - Jobs ready for invoice finalization with estimated revenue

You can view **all jobs** but can only edit jobs in "Awaiting Finalization" or "Completed" status.

### Viewing Jobs
1. All jobs are visible in the Jobs list
2. Use filters to find specific jobs
3. Click on a job to view full details

**Jobs Board Layouts (Updated 2026-03-10)**
- **Card view** — Better for visual triage. Each card now shows customer, site, equipment, assignee, schedule, status, and type in one scan-friendly block.
- **List view** — Better for office operations. Rows show denser job data across customer, site, equipment, assignee, scheduled date, status, and urgency.
- **View toggle** — Use the Card/List control at the top of the Jobs page. The selected mode is saved in the page URL, so refresh keeps the same layout.
- **Expanded search** — Search now matches job number, customer, account number, contact person, forklift number, customer forklift number, and site text.

### Finalizing an Invoice

Jobs in "Awaiting Finalization" status are ready for your review:

1. Open the job
2. Review:
   - Service details
   - Parts used and pricing
   - Labor costs
   - Extra charges
3. Adjust labor cost if needed
4. Add any extra charges
5. Click **"Finalize Invoice"**
6. Job status changes to "Completed"

### Recording Payments

For "Completed" jobs:
1. Open the job
2. Go to Payment section
3. Enter payment amount
4. Select payment method
5. Add reference number (optional)
6. Click **"Record Payment"**

### Generating Documents
- **Invoice PDF**: Click "Generate Invoice"
- **Service Report**: Click "Generate Service Report" — *(updated 2026-04-07)* a confirmation appears asking whether to **Hide Prices (Customer Copy)** or **Show Prices (Internal Copy)**. Hide Prices removes the Unit Price / Amount columns and the Labor / TOTAL row, leaving parts and labor descriptions and quantities visible
- Both can be downloaded or emailed/WhatsApp to customer

### What You CANNOT Do
- ❌ Create new jobs
- ❌ Assign or reassign technicians
- ❌ Edit service details (signatures, checklist)
- ❌ Delete jobs
- ❌ Manage inventory

---

## Supervisor Guide

### Your Dashboard
When you log in, you'll see the **Admin/Supervisor Dashboard** with full operational visibility:

**KPI Cards** (clickable - navigate to filtered job list):
- **Overdue** - Jobs past their SLA deadline
- **Unassigned** - Jobs waiting for technician assignment
- **Escalated** - Jobs flagged for attention
- **Awaiting Ack** - Jobs pending customer acknowledgement

**Dashboard Sections:**
- **Escalation Banner** - Urgent items requiring immediate attention
- **Work Queue** - Prioritized list of action items
- **Team Status** - Real-time view of technician availability and workload
- **Job Status** breakdown by status
- **Quick Stats** - Key performance indicators

**Header Quick Actions:**
- Assign chip (shows unassigned count)
- Finalize chip (shows awaiting finalization count)
- Notifications bell with badge
- New Job button

You have full visibility of all jobs and can manage most operations.

### Creating Jobs

1. Click **"New Job"** button
2. Select customer
3. Enter job title and description
4. Set priority (Low/Medium/High/Emergency)
5. Select job type (Service/Repair/Checking/Accident)
6. Optionally assign forklift
7. Optionally assign technician immediately
8. Click **"Create Job"**

### Assigning Jobs

1. Find unassigned job (status: "New")
2. Click **"Assign"**
3. Select technician from dropdown
4. Click **"Confirm Assignment"**
5. Technician receives notification

### Reassigning Jobs

For jobs in "Assigned" or "In Progress":
1. Open the job
2. Click **"Reassign"**
3. Select new technician
4. Original technician is notified

### Managing Inventory

1. Go to **Inventory** section
2. View all parts and stock levels
3. Add new parts
4. Update stock quantities
5. Set minimum stock levels

### Managing Forklifts

1. Go to **Forklifts** section
2. View all forklifts and their status
3. Add new forklifts
4. Update hourmeter readings
5. Manage rental assignments

### Service Prediction (Hourmeter-Based)

For Diesel, LPG, and Petrol forklifts, the system predicts when service is due based on actual usage.

#### How It Works
1. **Enter hourmeter readings** during jobs or inspections
2. System calculates **average daily usage** from readings
3. Predicts **next service date** based on usage patterns
4. Dashboard shows forklifts by urgency: Overdue, Due Soon, Upcoming

#### Recording Hourmeter Readings
- During job completion, technicians enter the current hourmeter
- Readings are tracked over time to improve prediction accuracy
- More readings = higher confidence predictions

#### Viewing Service Predictions
- **Dashboard Widget** shows forklifts needing service soon
- **Forklift Profile** shows detailed prediction with confidence level
- Urgency colors: 🔴 Overdue, 🟠 Due This Week, 🟡 Next 2 Weeks, 🟢 On Track

#### After Service Completion
When a PM service job is completed, the hourmeter resets automatically and the prediction cycle restarts.

#### Configuring Service Intervals
Default interval is 500 hours. To change for a specific forklift:
1. Open Forklift Profile
2. Go to Service Settings
3. Update the service interval (e.g., 250, 500, 1000 hours)

### Viewing KPIs

1. Go to **Dashboard** or **Reports**
2. View technician performance metrics
3. See job completion rates
4. Monitor inventory levels

### What You CANNOT Do
- ❌ Manage user accounts (Admin only)
- ❌ Unlock completed/invoiced records (Admin only)
- ❌ Delete completed jobs

---

## Admin Guide

### Your Dashboard
As an Admin, you share the same **Admin/Supervisor Dashboard** as Supervisors (see [Supervisor Dashboard](#your-dashboard-2) for details). This provides full operational visibility with KPI cards, escalation management, work queue, and team status.

### Full System Access
As an Admin, you have complete control over the system.

### Managing Users

1. Go to **Settings** → **Users**
2. View all user accounts
3. Create new users:
   - Enter name, email, role
   - Set temporary password
4. Edit existing users:
   - Change role
   - Activate/deactivate accounts
5. Reset passwords

### Override Capabilities

#### Unlocking Records
When a job is "Completed", service records are locked. To make changes:

1. Open the completed job
2. Click **"Admin Override"**
3. Enter reason (required for audit trail)
4. Select action:
   - Unlock service record
   - Rollback status
   - Edit invoice
5. Make necessary changes
6. Record will re-lock when job is finalized again

#### Skipping Requirements
Admin can force-complete jobs without all requirements by checking "Force Complete" option.

### Managing Technician Requests (NEW)

View and respond to requests from technicians in the Dashboard or Job Detail:

#### Assistance Requests
1. See pending requests in Dashboard notification panel
2. Open the job to view request details
3. Click **"Approve"** and select helper technician
4. Or click **"Reject"** with reason

#### Spare Part Requests
1. See pending requests notification
2. Open job → Requests section
3. Review part description and photo
4. Click **"Review & Approve"**
5. Select part from inventory, set quantity
6. Part is automatically added to job's Items Used

#### Skillful Technician Requests
1. Review the skill issue described
2. Click **"Acknowledge"** (no automatic assignment)
3. Use the Reassign function to assign appropriate technician

### ✅ Job Finalization Workflow (Updated - 2026-02-01)

**Simplified workflow with unified admin roles:**

#### Adding Parts
1. Admin opens job (any status except Completed)
2. Go to "Parts Used" section
3. Click **"Add Part"** and select from dropdown
4. Parts are **auto-confirmed** when added by admin

#### Approving Part Requests
1. Technician requests part via "Request Part" button
2. Admin receives notification
3. Open job → "Part Requests" section
4. Review request and click **"Approve"** or **"Reject"**
5. Approved parts auto-added and auto-confirmed

#### Confirming a Tech-Initiated Part Return (NEW - 2026-04-23)

When a technician finds an approved part is the wrong model / damaged / not compatible, they can flag it for return so they're not stuck unable to complete the job. Returns wait for **your physical confirmation** at the warehouse before stock is credited.

**How you'll be notified** (three surfaces):
1. **Badge** on the **Approvals** tab (Jobs page) shows the count of returns awaiting your confirmation.
2. **Realtime list** at the top of the **Store Queue** (Approvals tab → Pending Part Returns section) — appears instantly when a tech requests a return.
3. **Toast** in the corner of the screen if you're on a different page when a new return arrives. Click **Review** to jump to the queue.

**Confirming a return** (after the tech hands the physical part back at the warehouse):
1. Go to **Jobs → Approvals** tab.
2. In the **Pending Part Returns** section at the top, find the row.
3. Confirm the part name + quantity + reason match what the tech physically returned.
4. Click **Confirm Return**. The system automatically:
   - Increments the part's `stock_quantity` (or `container_quantity` for liquids) back to inventory.
   - Writes an audit entry in `inventory_movements` with type `tech_return`, your name, and the original return reason.
   - Marks the row as **Returned** (greyed out) on the job.
5. The job's invoice **already excluded** the returned part — no separate action needed.

**Cancelling a return**: if the tech changes their mind or the return was a mistake, click **Cancel** on the row. The part goes back into active use on the job; nothing is restocked.

**Important**: you cannot use **Confirm Return** to refuse a return — it's a "I received the physical part" action only. If a tech is misusing the flow (e.g. reporting parts as returned that they kept), use the audit trail (`return_reason`, `return_requested_by`, `return_requested_at`) to address it operationally.

#### Finalizing Jobs
1. Open job in "Awaiting Finalization" status
2. Verify all information is correct
3. Click **"Finalize Invoice"**

> **Note:** Parts are now auto-confirmed when admin adds them. No separate verification step needed.

### Monitoring Job Responses (NEW - 2026-01-29)

Track technician responses to job assignments:

1. When a job is assigned, technician has 15 minutes to accept/reject
2. If no response, you receive an urgent notification
3. View pending response jobs in Dashboard
4. Consider reassigning if technician unresponsive

### Managing Helper Technicians (NEW)

1. Open any "In Progress" job
2. Click **"Add Helper"** button
3. Select technician from dropdown
4. Helper can now upload photos on this job
5. To remove: Click **"Remove Helper"**

### Managing Escalated Jobs (NEW)

Jobs that exceed SLA appear in Dashboard's "Action Required" section:

1. **Acknowledge** - Take ownership (stops repeated alerts)
2. **Add Notes** - Document reason for delay
3. **Actions:**
   - Reassign to different technician
   - Mark as Overtime (disables escalation)
   - View job details
4. Contact info shown for customer and technician

### Managing Deferred Acknowledgements (NEW)

Jobs awaiting customer acknowledgement appear in Dashboard:

1. View jobs in "Awaiting Acknowledgement" section
2. **Record Acknowledgement** - If customer confirmed via phone/email
3. **Record Dispute** - If customer complained
4. Jobs auto-complete after SLA period (configurable, default 5 business days)

### Resolving Disputes (NEW)

1. Open disputed job
2. Review dispute notes and evidence photos
3. Options:
   - **Accept & Complete** - Finalize despite dispute
   - **Reopen Job** - Send back to technician for rework

### Pre-Job Parts Allocation

Admins can add parts to jobs **before** technician starts:

1. Open a job with status "New" or "Assigned"
2. Go to "Parts Used" section
3. Click **"Add Part"**
4. Select part and quantity
5. Parts are ready for technician when they start the job

### Multi-Admin Conflict Prevention (NEW - 2026-01-19)

When multiple admins work on the same job:

- A **5-minute lock** is acquired when confirming/editing
- If another admin tries to access, they see: "Job Locked - Being reviewed by [Name]"
- Lock automatically releases after 5 minutes of inactivity

This prevents conflicting changes when multiple admins are active.

### System Configuration

- Manage default labor rates
- Configure notification settings
- View audit logs
- Export system data
- **Configure Service Intervals** (Forklifts → Service Intervals tab)

### Viewing Audit Logs

1. Go to job details
2. Click **"Audit Log"** tab
3. View complete history:
   - Who made changes
   - What was changed
   - When it happened
   - Why (for overrides)

---

## Fleet Management (NEW - 2026-02-05)

### Overview
The Fleet page provides comprehensive visibility into your forklift fleet status, service schedules, and maintenance needs.

### Tabs

#### Overview Tab
Shows high-level fleet statistics:
- **Rented Out** — Units currently with customers
- **In Service** — Units undergoing maintenance
- **Service Due** — Units needing attention (within 7 days or 50 hours)
- **Available** — Ready for deployment
- **Out of Service** — Non-operational units

#### Fleet Tab
List of all forklifts with search and filtering.

#### Service Intervals Tab
Configure service intervals per forklift type:
| Type | Hourmeter Interval | Calendar Interval |
|------|-------------------|-------------------|
| Diesel | 500 hours | — |
| LPG | 350 hours | — |
| Electric | — | 90 days |

#### Service Due Tab ⭐
**Key Feature:** Proactive service tracking with intelligent predictions.

**What it shows:**
- Forklifts overdue for service (highlighted in red)
- Forklifts due soon (within threshold)
- Current hourmeter vs next target service hour
- Daily usage trend (increasing/decreasing/stable)
- Stale data warnings (no hourmeter update in 60+ days)

**How it works:**
1. When a Full Service job is completed, `last_serviced_hourmeter` is recorded
2. System calculates `next_target_service_hour` = last_serviced + interval
3. Service Due tab shows all units approaching or past their target
4. **Service Upgrade Prompt**: When starting a Minor Service on an overdue unit, system prompts to upgrade to Full Service

**Run Service Check button:**
- Creates jobs for overdue forklifts
- Sends notifications to supervisors
- Runs automatically at 8:00 AM daily

#### Hourmeter Review Tab
Audit trail for all hourmeter readings with anomaly detection.

### Hourmeter Tracking

**Recording hourmeters:**
- Technicians enter current hourmeter when starting/completing jobs
- Readings are validated (must be ≥ previous reading)
- History is preserved for trend analysis

**Stale Data Detection:**
Units with no hourmeter update in 60+ days are flagged. This helps identify:
- Inactive equipment
- Missing job completions
- Data entry gaps

---

## Job Completion Requirements

### Mandatory Requirements Checklist

| Requirement | Description | Who Fills |
|-------------|-------------|-----------|
| **Started At** | Job must be started with hourmeter | Technician |
| **Condition Checklist** | 48-item inspection form | Technician |
| **Service Notes** | Description of work done | Technician |
| **Parts Used** | List of parts OR "No parts used" flag | Technician |
| **Technician Signature** | Digital signature | Technician |
| **Customer Signature** | Digital signature from customer | Customer |

### Signature Requirements

#### Technician Signature
- Must include full name
- Digital signature canvas
- Timestamp automatically recorded

#### Customer Signature
- Must include customer representative name
- Optional: IC number, department
- Digital signature canvas
- Timestamp automatically recorded

---

## Common Tasks

### Searching for Jobs
1. Use the search bar at the top
2. Enter job number, customer name, or forklift serial
3. Use filters for status, date range, technician

### Viewing Job History
1. Go to Customer or Forklift profile
2. Click **"Service History"**
3. View all past jobs

### Generating Reports
1. Go to **Reports** section
2. Select report type
3. Set date range
4. Choose format (PDF/Excel)
5. Click **"Generate"**

### Adding Extra Charges
1. Open the job
2. Go to **Extra Charges** section
3. Click **"Add Charge"**
4. Enter name, description, amount
5. Save

---

## Mobile Features (NEW - 2026-02-18)

### Command Palette

Use Command Palette for fast navigation and quick actions.

- Open with `Cmd+K` (Mac) or `Ctrl+K` (Windows)
- Or click the search icon in the header
- Results are role-aware (pages + actions you are allowed to access)
- Navigate directly to pages or run quick actions like creating jobs/customers
- Use `↑` / `↓` to move, `Enter` to select, `Escape` to close

### Mobile Bottom Navigation

On mobile screens, a bottom navigation bar appears automatically (hidden on desktop).

- **Technician tabs:** Home, Jobs, Van Stock, More
- **Supervisor tabs:** Home, Jobs, Approvals, More
- **Accountant tabs:** Home, Jobs, Billing, More
- **Admin tabs:** Home, Jobs, Inventory, More
- Role-specific tab can show an unread notification badge count

### Floating Action Button (FAB)

On mobile, a blue floating action button appears in the bottom-right corner.

- Tap the main button to expand quick actions
- Tap an action to navigate directly
- **Technician actions:** Van Stock, My Jobs
- **Supervisor actions:** Approvals, Assign Job
- **Admin actions:** New Job, Approvals, Inventory
- **Accountant actions:** Billing

### Pull-to-Refresh (Jobs Page)

On the Jobs page (mobile), pull down to refresh the jobs list.

- Pull down from the top of the list
- Arrow indicator appears while pulling
- Indicator switches to spinner while loading
- List updates when refresh completes

### Swipe Actions (StoreQueue / Approvals)

Use swipe gestures as a fast alternative to action buttons.

- Swipe right to approve (green)
- Swipe left to reject (red)
- Available in StoreQueue and Approvals views

### PWA Install (Add to Home Screen)

Install FieldPro as an app from your mobile browser.

1. Open FieldPro in Safari (iOS) or Chrome (Android)
2. Tap **Add to Home Screen**:
   - iOS Safari: Share icon → Add to Home Screen
   - Android Chrome: Browser menu → Add to Home Screen
3. Launch FieldPro from your home screen

Benefits:
- Runs in standalone mode (no browser address bar/chrome)
- Supports offline access for cached pages

### Dark Mode

FieldPro supports full dark theme across all pages.

- Dark mode is automatic and follows your device/system preference
- No manual switch required

---

## Troubleshooting

### "Cannot complete job" Error

**Problem**: Missing required fields

**Solution**: Check and fill:
- Condition checklist
- Service notes
- Parts used (or mark "no parts")
- Both signatures

### "Service record is locked" Error

**Problem**: Job already invoiced

**Solution**: Contact Admin to unlock the record

### "Insufficient stock" Error

**Problem**: Not enough parts in inventory

**Solution**: 
- Contact Supervisor to update inventory
- Or use different part
- Admin/Supervisor can override

### "Not authorized" Error

**Problem**: Trying to access restricted function

**Solution**: Check your role permissions or contact Admin

### Job not visible

**Problem**: Technician can't see a job

**Solution**: 
- Job might be assigned to different technician
- Ask Supervisor to reassign

---

## Contact Support

For technical issues or questions:
- Contact your system administrator
- Email: [Your Support Email]
- Phone: [Your Support Number]

---

*Last Updated: January 28, 2026*
*Version: 2.2 - Customer Feedback Implementation Phase 2*

---

## Inventory Audit Trail (New — Feb 2026)

### Stock Adjustments
If you need to correct stock levels (damage, theft, spillage, counting error):
1. Go to **Inventory** → click **Stock Adjustment** button
2. Select the fluid part, enter the +/- quantity
3. Choose a **reason code** (required)
4. Submit — the adjustment goes to the approval queue
5. A different admin must approve before stock changes

### Stocktake (Physical Count)
To reconcile system stock with actual physical stock:
1. Go to **Inventory** → **Stocktake** tab
2. Click **New Stocktake**
3. Enter the physical quantity you counted for each fluid
4. System shows variance (green = match, red = short, amber = over)
5. Select a reason for any variance
6. Submit — a different admin approves and stock auto-corrects

### Pending Adjustments
- **Inventory** → **Pending Adjustments** tab shows all adjustments waiting for approval
- You cannot approve your own adjustment (anti-fraud control)
- Rejected adjustments get a reason logged

### Batch Tracking & Expiry
- When receiving stock, you can optionally add a **Batch Label** and **Expiry Date**
- If stock is expiring within 30 days, an amber warning banner appears on the inventory page
- Every movement traces back to the specific purchase batch

### Cost Alerts
- When entering a new purchase, if the cost per liter differs more than 10% from the average, a warning appears
- This helps catch supplier price changes early

### CSV Import
Import inventory items from CSV files (standard or ACWER format):

**How to Use:**
1. Go to **Inventory** page
2. Click the **Import** button in the header
3. Select your CSV file
4. System auto-detects the format:
   - **Standard format** — Header row with columns: part_code, name, category, etc.
   - **ACWER format** — 3 header rows (company info, headers, units), 7 columns (Item Code, Description, Category, Unit, Stock Balance, Avg Cost, Price)
5. Preview the items to be imported
6. Click **Confirm Import**

**What Happens:**
- **New items** — Created with initial stock and purchase audit trail
- **Existing items** — Updated (stock, price, category) with adjustment audit trail
- **Junk rows** — Auto-filtered (empty codes, non-numeric stock, header rows)
- **Smart liquid detection** — Items with units like "L", "kg", "litre" auto-flagged as liquid
- **Category mapping** — ACWER categories auto-mapped to FieldPro categories

**Batch Processing:**
- Large files imported in batches of 100 items
- Progress indicator shows import status
- Success/error count displayed after completion

### Purchase History
Track all inventory purchases with batch grouping and invoice viewer:

**How to Access:**
1. Go to **Inventory** page → **Ledger** tab
2. Use the **3-way toggle** to switch between:
   - **Recent Activity** — All recent inventory movements
   - **Purchase History** — Grouped purchases with invoices
   - **Item Ledger** — Item-specific movement history

**Purchase History View:**
- Batches grouped by **PO number + date**
- Each batch shows:
  - PO reference number
  - Purchase date
  - Total items purchased
  - Total cost
  - Invoice/receipt icon (if uploaded)
- **Search filter** — Find specific purchases by PO, supplier, or item name

**Invoice Viewer:**
- Click the 📄 **invoice icon** to view uploaded receipt/invoice
- Invoices stored in private Supabase bucket
- Access via **signed URLs** (secure, 1-hour expiry)
- Supports PDF, images (JPG, PNG), and other document formats

**Use Cases:**
- Verify purchase costs against invoices
- Audit inventory procurement
- Track supplier pricing trends

### Batch Receive Stock
Streamlined workflow for receiving inventory purchases:

**How to Use:**
1. Go to **Inventory** page
2. Click **Receive Stock** button
3. **Search and select items** — No more scrolling through dropdown:
   - Type item name or code
   - Results filter in real-time
   - Select one or multiple items
4. For each item, enter:
   - Quantity received
   - Unit cost (optional)
   - PO reference (optional)
5. **Upload invoice/receipt** (optional):
   - Click **Upload Invoice** button
   - Select PDF or image file
   - File uploaded to private Supabase bucket
   - Linked to the purchase batch
6. **Liquid items** show container context:
   - Container size (e.g., 20L drum, 5L bottle)
   - Bulk quantity (total liters)
   - Unit vs liquid quantity clearly displayed
7. Click **Confirm** to complete the receipt

**Benefits:**
- **Faster item selection** — Search beats dropdown for large inventories
- **Invoice tracking** — Attach proof of purchase for audit
- **Liquid clarity** — Container context prevents unit confusion
- **Batch grouping** — All items received together linked to one PO

**Security:**
- Invoices stored in private bucket (not publicly accessible)
- Access via signed URLs with automatic expiry
- Full audit trail of who received what and when

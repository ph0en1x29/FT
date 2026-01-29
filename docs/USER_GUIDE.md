# FieldPro User Guide
## Field Service Management System

---

> 📢 **What's New in January 2026?** Major ACWER workflow implementation including:
> - Helper Technician System (assign assistants to jobs)
> - In-Job Request System (request assistance, spare parts, skillful tech)
> - Multi-Day Job Support with escalation management
> - Deferred Customer Acknowledgement (complete jobs without on-site signature)
> - Photo Categorization with ZIP download
> - Real-time notifications with sound alerts
> - Enhanced Dashboard with Action Required queue
> - **Admin Role Split** - Admin Service vs Admin Store for dual confirmation workflow
> - **AutoCount Integration** - Export invoices to AutoCount accounting software
> - **Photo Validation** - GPS tracking and timestamp verification on photos
> - **Fleet Dashboard** - Real-time forklift status updates
>
> **🆕 Latest Update (2026-01-29) - Critical Features:**
> - **📱 Push Notifications** - Real browser push notifications (not just in-app)
> - **⏰ 15-Minute Accept/Reject** - Technicians must accept or reject jobs within 15 minutes
> - **✅ Dual Approval Flow** - Admin 1 cannot finalize until Admin 2 verifies parts
>
> **Update (2026-01-28) - Phase 3:**
> - **Enhanced Real-Time Updates** - Live updates for job status, assignments, and request approvals
> - **Connection Health Indicator** - Visual dot showing WebSocket connection status
> - **Checklist Binary States** - OK/Not OK only, no neutral states, Check All button
> - **Auto-Set Unchecked Items** - Unchecked checklist items auto-marked as Not OK on save
> - **Expanded Dashboard Notifications** - Toggle unread/all, expandable full feed
> - **Tech Parts Filter** - Technicians only see parts after Admin 2 verification
>
> **Update (2026-01-28) - Phase 2:**
> - **Real-Time Job Deletion Sync** - Deleted jobs automatically removed from technician's list
> - **Job Redirect on Deletion** - Viewing a deleted job redirects to job list with warning
> - **Pricing Hidden from Technicians** - Financial summary, extra charges, and part prices hidden
> - **Parts Entry by Admin Only** - Technicians must use Spare Part Request workflow
>
> **Previous Update (2026-01-19):**
> - **Parts Confirmation Workflow** - Admin Service must wait for Admin Store to verify parts
> - **Binary Checklist** - Checklist items are now OK ✓ or Not OK ✗
> - **Photo Auto-Start** - First photo automatically starts job timer
> - **Edit Pending Requests** - Technicians can edit their own pending requests
> - **Hourmeter Persistence** - Hourmeter readings preserved across job reassignment
> - **Dashboard Notifications** - See recent notifications on your dashboard
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
7. [Troubleshooting](#troubleshooting)

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
- Full system access (acts as both Admin Service and Admin Store)
- Manage all users and settings
- Override any restrictions
- Access all reports and data
- Can unlock locked records

### Admin Service 🔧👑
- Job operations and confirmations
- Hourmeter amendment approval/rejection
- Job completion confirmation
- Escalation management
- Cannot manage inventory or van stock replenishments

### Admin Store 📦👑
- Parts and inventory management
- Van stock replenishment approvals
- Parts confirmation on completed jobs
- Cannot approve hourmeter amendments

### Supervisor 👔
- View and manage all jobs
- Create and assign jobs
- Reassign technicians
- Manage inventory and forklifts
- Approve or finalize invoices
- View KPI dashboards

### Technician 🔧
- View only assigned jobs
- Start and complete jobs
- Record service details
- Add parts used
- Capture signatures
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

**To Reject:**
1. Click the **"Reject"** button
2. Enter a reason for rejection (required)
3. Click **"Reject Job"**
4. The job returns to the admin queue for reassignment

**What Happens If You Don't Respond:**
- After 15 minutes, admins are automatically notified
- The job remains assigned to you until reassigned
- Consider communicating with your supervisor if you can't respond in time

### Starting a Job

1. Find the job in your list (status: "Assigned")
2. Click on the job to open details
3. Click **"Start Job"** button
4. Enter the current hourmeter reading
5. Complete the **Condition Checklist** (48 inspection items)
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
1. Click **"Request Spare Part"** button
2. Describe the part needed
3. Upload photo of faulty component (optional)
4. Admin reviews and selects from inventory
5. Approved parts appear in your Items Used list

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
- **Service Report**: Click "Generate Service Report"
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

### ✅ Dual Approval Workflow (Updated - 2026-01-29)

For jobs to be finalized, **both Admin roles must confirm**:

#### Admin 2 (Store) - Parts Verification
1. Open job in "Awaiting Finalization" status
2. Review the "Parts Used" section
3. Verify parts match what was actually used
4. Click **"Verify Parts"** button
5. Your name and timestamp are recorded

**Note:** If no parts were used, this step is automatically skipped.

#### Admin 1 (Service) - Job Finalization
1. Open job in "Awaiting Finalization" status
2. Check "Confirmation Status" card shows:
   - ✅ Parts Confirmation (Admin 2) - Verified
   - ⏳ Job Confirmation (Admin 1) - Pending
3. If parts not verified, you'll see "Store Verification Pending" error
4. Once parts verified, click **"Finalize Invoice"**

**Why Dual Approval?**
- Ensures inventory accuracy (Admin Store verifies parts)
- Separates service operations from inventory management
- Creates audit trail for both functions

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

### Parts Confirmation Workflow (NEW - 2026-01-19)

For jobs with parts used, a **two-admin confirmation** is required:

#### Admin Store (Parts Verification)
1. Go to **Pending Confirmations** page
2. View jobs in "Parts Confirmation Queue" tab
3. Review parts used against inventory
4. Click **"Confirm Parts"** if correct
5. Or **"Reject"** with reason if issues found

#### Admin Service (Job Finalization)
1. Cannot finalize until Admin Store confirms parts
2. If parts not confirmed, you'll see: "Store Verification Pending"
3. Wait for Admin Store to confirm, then finalize

> **Note:** This ensures both operational and inventory verification before job completion.

### Pre-Job Parts Allocation (NEW - 2026-01-19)

Admin Store can add parts to jobs **before** technician starts:

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

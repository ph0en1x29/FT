# FieldPro User Guide
## Field Service Management System

---

> 📢 **What's New in February 2026?**
>
> **🆕 Latest Update (2026-02-01):**
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

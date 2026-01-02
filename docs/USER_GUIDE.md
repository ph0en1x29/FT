# FieldPro User Guide
## Field Service Management System

---

> 📢 **What's New?** See [User Manual v1.1](./User_Manual_v1.1.md) for the latest features including Job Types, Photo Tracking, and Professional Invoice format.
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
- Override any restrictions
- Access all reports and data
- Can unlock locked records

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

### Status Descriptions

| Status | Description | Who Can Move Forward | Who Can Move Backward |
|--------|-------------|---------------------|----------------------|
| **New** | Job created, awaiting assignment | Admin, Supervisor | - |
| **Assigned** | Technician assigned, awaiting start | Technician, Admin, Supervisor | Admin, Supervisor |
| **In Progress** | Technician actively working | Technician, Admin | Admin, Supervisor |
| **Awaiting Finalization** | Work complete, invoice pending | Accountant, Admin | Admin, Supervisor |
| **Completed** | Invoice finalized, record locked | - | Admin only (with override) |

---

## Role-Specific Guides

---

## Technician Guide

### Your Dashboard
When you log in, you'll see only jobs assigned to you. Jobs are sorted by priority and date.

### Starting a Job

1. Find the job in your list (status: "Assigned")
2. Click on the job to open details
3. Click **"Start Job"** button
4. Enter the current hourmeter reading
5. Complete the **Condition Checklist** (48 inspection items)
6. The job status changes to "In Progress"

### Working on a Job

While the job is "In Progress", you can:

#### Add Parts Used
1. Go to "Parts Used" section
2. Click **"Add Part"**
3. Search and select the part
4. Enter quantity
5. Adjust price if needed (with supervisor approval)

#### Record Service Details
1. Fill in "Job Carried Out" - describe the work done
2. Add "Recommendation" - any follow-up suggestions
3. Set repair start/end times

#### Add Photos
1. Click **"Add Photo"** in the Media section
2. Take or upload photos of:
   - Before condition
   - Work in progress
   - After condition
   - Parts replaced

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

### What You CANNOT Do
- ❌ See jobs assigned to other technicians
- ❌ Change the customer
- ❌ Reassign the job
- ❌ Edit after job is completed
- ❌ Delete jobs or parts

---

## Accountant Guide

### Your Dashboard
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

### System Configuration

- Manage default labor rates
- Configure notification settings
- View audit logs
- Export system data

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

*Last Updated: December 2024*
*Version: 2.0 - RLS Security Update*

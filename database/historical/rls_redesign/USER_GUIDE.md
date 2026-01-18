# FieldPro User Guide
## Complete System Manual for All Roles

---

## Table of Contents

1. [System Overview](#system-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Job Workflow](#job-workflow)
4. [Role-Specific Guides](#role-specific-guides)
   - [Technician Guide](#technician-guide)
   - [Accountant Guide](#accountant-guide)
   - [Supervisor Guide](#supervisor-guide)
   - [Admin Guide](#admin-guide)
5. [Common Tasks](#common-tasks)
6. [Troubleshooting](#troubleshooting)

---

## System Overview

FieldPro is a comprehensive field service management system designed for forklift service companies. It manages the complete lifecycle of service jobs from creation to payment, including:

- **Job Management**: Create, assign, track, and complete service jobs
- **Asset Tracking**: Manage forklifts, track locations, and service history
- **Inventory Management**: Track parts usage and stock levels
- **Invoicing**: Generate professional invoices and track payments
- **Rental Management**: Manage forklift rentals to customers
- **Reporting**: KPI dashboards and performance tracking

### Access URL
**Production**: https://ft-kappa.vercel.app/

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

## User Roles & Permissions

### Role Hierarchy

```
Admin (Full Control)
  └── Supervisor (Operations Management)
        └── Accountant (Financial Operations)
        └── Technician (Field Work)
```

### Permission Matrix

| Feature | Admin | Supervisor | Accountant | Technician |
|---------|:-----:|:----------:|:----------:|:----------:|
| **Jobs** |
| View All Jobs | ✅ | ✅ | ✅ | ❌ |
| View Own Assigned Jobs | ✅ | ✅ | ✅ | ✅ |
| Create Jobs | ✅ | ✅ | ❌ | ❌ |
| Assign/Reassign Jobs | ✅ | ✅ | ❌ | ❌ |
| Start Jobs | ✅ | ✅ | ❌ | ✅* |
| Complete Jobs | ✅ | ✅ | ❌ | ✅* |
| Cancel Jobs | ✅ | ✅ | ❌ | ❌ |
| **Invoicing** |
| Finalize Invoices | ✅ | ✅ | ✅ | ❌ |
| Record Payments | ✅ | ✅ | ✅ | ❌ |
| Edit Invoices | ✅ | ❌ | ✅ | ❌ |
| **Service Records** |
| Edit Service Records | ✅ | ❌ | ❌ | ✅* |
| View Service Records | ✅ | ✅ | ✅ | ✅* |
| **Assets & Inventory** |
| Manage Forklifts | ✅ | ✅ | ❌ | ❌ |
| Manage Rentals | ✅ | ✅ | ❌ | ❌ |
| Manage Inventory | ✅ | ✅ | ❌ | ❌ |
| View Inventory | ✅ | ✅ | ✅ | ✅ |
| **Customers** |
| Create/Edit Customers | ✅ | ✅ | ❌ | ❌ |
| View Customers | ✅ | ✅ | ✅ | ✅ |
| **System** |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Override Locks | ✅ | ❌ | ❌ | ❌ |
| Rollback Status | ✅ | ✅ | ❌ | ❌ |
| View Audit Log | ✅ | ✅ | ✅ | ❌ |
| View KPI Dashboard | ✅ | ✅ | ❌ | ❌ |

*Only for their own assigned jobs

---

## Job Workflow

### Status Flow Diagram

```
┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────────────┐    ┌───────────┐
│   New   │───▶│ Assigned │───▶│ In Progress │───▶│ Awaiting Finalization│───▶│ Completed │
└─────────┘    └──────────┘    └─────────────┘    └──────────────────────┘    └───────────┘
     │              │                                                              │
     │              │                                                              │
     ▼              ▼                                                              ▼
 [Can Cancel]  [Can Cancel]                                                   [LOCKED]
```

### Status Descriptions

| Status | Description | Who Can Change |
|--------|-------------|----------------|
| **New** | Job created, not yet assigned | Admin, Supervisor |
| **Assigned** | Technician assigned, waiting to start | Admin, Supervisor, Technician (assigned) |
| **In Progress** | Technician actively working on job | Admin, Supervisor, Technician (assigned) |
| **Awaiting Finalization** | Work complete, pending invoice | Admin, Supervisor, Accountant |
| **Completed** | Invoice finalized, job closed | Admin only (via override) |

### Status Transition Rules

1. **Forward Movement**: Jobs must progress sequentially (no skipping steps, except Admin)
2. **Backward Movement**: Only Admin and Supervisor can move jobs backward
3. **Cancellation**: Only from "New" or "Assigned" status, by Admin/Supervisor only
4. **Locking**: Once "Completed", service records are locked and cannot be edited

### Completion Requirements

Before a job can move to "Awaiting Finalization", ALL of the following must be completed:

1. ✅ **Job Started** - Started time recorded
2. ✅ **Condition Checklist** - All 48 inspection items filled
3. ✅ **Service Notes** - Description of work performed
4. ✅ **Parts Used** - Parts recorded OR "No parts used" checked
5. ✅ **Technician Signature** - Digital signature captured
6. ✅ **Customer Signature** - Customer confirmation signature

---

## Role-Specific Guides

---

# Technician Guide

## Your Dashboard

When you log in, you'll see:
- **Assigned Jobs**: Jobs waiting for you to start
- **In Progress Jobs**: Jobs you're currently working on
- **Recently Completed**: Jobs you've finished

## Daily Workflow

### Step 1: View Assigned Jobs

1. Log in to FieldPro
2. You'll see your assigned jobs on the dashboard
3. Click on a job to view details:
   - Customer information
   - Forklift details (make, model, serial number, location)
   - Job description and priority
   - Special instructions

### Step 2: Start a Job

1. Travel to the customer location
2. Open the assigned job
3. Click **"Start Job"**
4. Enter the **Hourmeter Reading** from the forklift
5. The job status changes to **"In Progress"**

### Step 3: Complete the Condition Checklist

1. Go to the **"Condition Check"** tab
2. Fill out ALL 48 inspection items:
   - Engine & Fuel System (15 items)
   - Hydraulic System (10 items)
   - Transmission & Drivetrain (7 items)
   - Brakes (6 items)
   - Steering (6 items)
   - Mast & Forks (8 items)
   - Tyres & Wheels (7 items)
   - Electrical (12 items)
   - Safety & Comfort (8 items)
3. Mark each item as:
   - ✅ **Good** - No issues
   - ⚠️ **Needs Attention** - Minor issue
   - ❌ **Defective** - Requires repair
   - ➖ **N/A** - Not applicable

### Step 4: Record Parts Used

1. Go to the **"Parts Used"** tab
2. Click **"Add Part"**
3. Search and select the part from inventory
4. Enter quantity used
5. Adjust price if needed (optional)
6. Click **"Add"**

**If no parts were used:**
- Check the **"No Parts Used"** checkbox

### Step 5: Document the Work

1. Go to the **"Service Details"** tab
2. Fill in:
   - **Job Carried Out**: Detailed description of work performed
   - **Recommendation**: Any follow-up recommendations
   - **Repair Start/End Time**: Actual work duration

### Step 6: Add Photos (Optional)

1. Click **"Add Photo"**
2. Take or upload photos of:
   - Before/After condition
   - Problem areas
   - Parts replaced
   - Customer-visible issues

### Step 7: Collect Signatures

1. Go to the **"Signatures"** tab
2. **Technician Signature**:
   - Sign in the signature pad
   - Click "Save Signature"
3. **Customer Signature**:
   - Have the customer sign
   - Enter customer's name
   - Click "Save Signature"

### Step 8: Submit Job

1. Review all information is complete
2. Click **"Complete Job"**
3. System validates all requirements:
   - ✅ Started time recorded
   - ✅ Checklist filled
   - ✅ Service notes entered
   - ✅ Parts recorded or "No parts" checked
   - ✅ Technician signature captured
   - ✅ Customer signature captured
4. If validation passes, job moves to **"Awaiting Finalization"**
5. If validation fails, you'll see which fields are missing

## What You CANNOT Do

- ❌ View jobs assigned to other technicians
- ❌ Create new jobs
- ❌ Assign or reassign jobs
- ❌ Edit jobs after they're invoiced (locked)
- ❌ Cancel jobs
- ❌ Finalize invoices
- ❌ Manage inventory, forklifts, or rentals

---

# Accountant Guide

## Your Dashboard

When you log in, you'll see:
- **Awaiting Finalization**: Jobs completed by technicians, ready for invoicing
- **Recently Invoiced**: Jobs you've finalized
- **Payment Status**: Overview of outstanding payments

## Daily Workflow

### Step 1: Review Completed Jobs

1. Navigate to **Jobs** → Filter by "Awaiting Finalization"
2. You'll see all jobs ready for invoicing
3. Click on a job to review:
   - Service details and work performed
   - Parts used with prices
   - Extra charges added
   - Condition checklist results

### Step 2: Review Service Report

1. Open the job details
2. Review the **Service Report** tab:
   - Verify work description is accurate
   - Check parts quantities and prices
   - Review extra charges
3. Check the **Signatures** tab:
   - Confirm both signatures are present
   - Verify customer name

### Step 3: Add Extra Charges (If Needed)

1. Go to **"Extra Charges"** tab
2. Click **"Add Charge"**
3. Enter:
   - Description (e.g., "Transportation", "Emergency callout fee")
   - Amount
4. Click **"Save"**

### Step 4: Adjust Pricing (If Needed)

1. You can adjust:
   - Labor cost
   - Part prices (individual items)
   - Apply discounts
2. All changes are tracked in the audit log

### Step 5: Finalize Invoice

1. Click **"Finalize Invoice"**
2. The system will:
   - Generate an invoice number (e.g., INV-2024-0001)
   - Calculate totals (parts + labor + extra charges)
   - Lock the service record (no more edits)
   - Move job to **"Completed"** status
3. Confirm the action

### Step 6: Send Invoice

1. After finalizing, click **"Send Invoice"**
2. Choose delivery method:
   - **Email**: Sends PDF to customer email
   - **WhatsApp**: Opens WhatsApp with invoice text
   - **Download PDF**: Save to send manually
3. System records when and how invoice was sent

### Step 7: Record Payments

1. When payment is received, open the job
2. Go to **"Payment"** tab
3. Click **"Record Payment"**
4. Enter:
   - Amount received
   - Payment method (Cash, Bank Transfer, Cheque, etc.)
   - Reference number (cheque number, transaction ID)
   - Notes (optional)
5. Payment status updates:
   - **Pending** → No payments
   - **Partial** → Some payment received
   - **Paid** → Full amount received

## What You CANNOT Do

- ❌ Create or assign jobs
- ❌ Edit service records (technician data)
- ❌ Start or complete jobs
- ❌ Cancel jobs
- ❌ Manage forklifts or rentals
- ❌ Manage inventory
- ❌ Manage users

---

# Supervisor Guide

## Your Dashboard

When you log in, you'll see:
- **All Jobs Overview**: Complete list of all jobs
- **Technician Workload**: Jobs per technician
- **KPI Dashboard**: Performance metrics
- **Pending Actions**: Jobs needing attention

## Daily Workflow

### Managing Jobs

#### Create a New Job

1. Click **"+ New Job"**
2. Fill in:
   - **Customer**: Select from list or create new
   - **Title**: Brief description
   - **Description**: Detailed issue description
   - **Priority**: Low, Medium, High, Emergency
   - **Job Type**: Service, Repair, Installation, etc.
   - **Forklift**: Select the equipment (optional)
3. Click **"Create Job"**

#### Assign a Technician

1. Open the job
2. Click **"Assign Technician"**
3. Select from available technicians
4. Optionally set a scheduled date
5. Click **"Assign"**
6. Technician receives a notification

#### Reassign a Job

1. Open an assigned or in-progress job
2. Click **"Reassign"**
3. Select the new technician
4. Enter reason for reassignment
5. Click **"Confirm"**
6. Both technicians receive notifications

#### Cancel a Job

1. Open a job in "New" or "Assigned" status
2. Click **"Cancel Job"**
3. Enter cancellation reason (required)
4. Click **"Confirm"**
5. Job is soft-deleted (not permanently removed)

### Managing Assets

#### Add a Forklift

1. Go to **Assets** → **Forklifts**
2. Click **"+ Add Forklift"**
3. Enter:
   - Serial Number (unique)
   - Make & Model
   - Type (Diesel, Electric, LPG, Petrol)
   - Hourmeter reading
   - Year, Capacity
   - Current location
4. Click **"Save"**

#### Assign Forklift to Customer (Create Rental)

1. Go to **Assets** → **Rentals**
2. Click **"+ New Rental"**
3. Select:
   - Forklift
   - Customer
   - Start Date
   - Monthly Rate
4. Click **"Create Rental"**
5. Forklift location updates to customer's address

#### End a Rental

1. Go to the rental record
2. Click **"End Rental"**
3. Enter end date
4. Click **"Confirm"**

### Managing Inventory

#### Add New Part

1. Go to **Inventory**
2. Click **"+ Add Part"**
3. Enter:
   - Part Name & Code
   - Category
   - Cost Price / Sell Price
   - Stock Quantity
   - Minimum Stock Level
4. Click **"Save"**

#### Update Stock

1. Find the part in inventory
2. Click **"Edit"**
3. Adjust stock quantity
4. Click **"Save"**
5. Change is logged in audit trail

### Monitoring Performance

#### View KPI Dashboard

1. Go to **Dashboard** → **KPI**
2. View metrics:
   - Jobs completed per technician
   - Average completion time
   - Revenue by technician
   - Parts usage statistics

#### View Audit Log

1. Go to **System** → **Audit Log**
2. Filter by:
   - Job ID
   - User
   - Event type
   - Date range
3. See all system changes with timestamps

## What You CANNOT Do

- ❌ Override locked records (Admin only)
- ❌ Manage user accounts (Admin only)
- ❌ Edit service records after technician submits
- ❌ Edit invoices after accountant finalizes

---

# Admin Guide

## Full System Access

As Admin, you have complete control over the system including:

- All Supervisor capabilities
- All Accountant capabilities
- User management
- System overrides
- Full audit access

## User Management

### Create a New User

1. Go to **System** → **Users**
2. Click **"+ Add User"**
3. Enter:
   - Name
   - Email
   - Password (temporary)
   - Role (Admin, Supervisor, Accountant, Technician)
4. Click **"Create"**
5. User receives activation email

### Deactivate a User

1. Go to **System** → **Users**
2. Find the user
3. Click **"Edit"**
4. Toggle **"Active"** to OFF
5. Click **"Save"**
6. User can no longer log in

### Reset User Password

1. Go to **System** → **Users**
2. Find the user
3. Click **"Reset Password"**
4. Enter new password
5. Click **"Save"**
6. Inform user of new password

## System Overrides

### Unlock a Completed Job

Sometimes you need to edit a job that's already been invoiced:

1. Open the completed job
2. Click **"Admin Override"**
3. Select action:
   - **Unlock**: Remove all locks for editing
   - **Rollback Status**: Move back to "Awaiting Finalization"
   - **Edit Service Record**: Temporarily unlock for edits
   - **Edit Invoice**: Temporarily unlock invoice
4. **Enter reason** (required for audit trail)
5. Click **"Confirm"**
6. Make your changes
7. Re-finalize when done

### Rollback Job Status

1. Open any job
2. Click **"Rollback Status"**
3. Select the target status
4. Enter reason
5. Click **"Confirm"**
6. All related locks are cleared

## Audit & Compliance

### Full Audit Trail

Every action in the system is logged:
- Who made the change
- What was changed
- When it happened
- Old and new values
- IP address and device

### Export Audit Log

1. Go to **System** → **Audit Log**
2. Set date range
3. Click **"Export"**
4. Download CSV file

---

## Common Tasks

### How to Generate a Service Report PDF

1. Open a completed job
2. Click **"Service Report"** tab
3. Click **"Download PDF"** or **"Print"**
4. PDF includes:
   - Company header
   - Customer details
   - Forklift information
   - Service details
   - Condition checklist results
   - Parts used
   - Signatures

### How to Generate an Invoice PDF

1. Open a finalized job
2. Click **"Invoice"** tab
3. Click **"Download PDF"**
4. PDF includes:
   - Company header with logo
   - Invoice number and date
   - Customer billing info
   - Line items (parts, labor, extras)
   - Totals and taxes
   - Payment terms

### How to Search for Jobs

1. Go to **Jobs**
2. Use filters:
   - Status
   - Customer
   - Technician
   - Date range
   - Priority
3. Or use the search bar for:
   - Job ID
   - Customer name
   - Forklift serial number

### How to Check Job History for a Forklift

1. Go to **Assets** → **Forklifts**
2. Click on a forklift
3. View **"Service History"** tab
4. See all past jobs with dates and descriptions

---

## Troubleshooting

### "Cannot complete job" Error

**Cause**: Missing required fields

**Solution**: Check and complete:
1. Job has been started (Started time exists)
2. Condition checklist is filled
3. Service notes or "Job Carried Out" is filled
4. Parts are recorded OR "No parts used" is checked
5. Technician signature is captured
6. Customer signature is captured

### "Access Denied" Error

**Cause**: Your role doesn't have permission

**Solution**: 
- Contact Admin or Supervisor for the required action
- Or ask them to perform the action on your behalf

### "Service record is locked" Error

**Cause**: Job has been invoiced

**Solution**: 
- Contact Admin for override
- Admin can unlock with a reason

### "Insufficient stock" Error

**Cause**: Not enough parts in inventory

**Solution**: 
- Contact Supervisor to update stock
- Or use different part
- Admin/Supervisor can override

### Jobs Not Appearing

**For Technicians**: You can only see jobs assigned to YOU

**For Others**: Check your filters and date range

### Forgot Password

1. Click "Forgot Password" on login screen
2. Enter your email
3. Check email for reset link
4. Or contact Admin for manual reset

---

## Contact & Support

For technical issues or questions:
- Contact your system administrator
- Use the feedback button in the app
- Check the audit log for recent changes

---

*FieldPro v1.0 - ACWER Industrial Equipment Sdn Bhd*

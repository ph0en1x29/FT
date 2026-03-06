# Service Automation & PM Tracking Specification

## Overview

This feature automates preventive maintenance (PM) tracking across the fleet, providing visibility into service status, eliminating manual tracking, and integrating with the job order system.

---

## Core Concepts

### Service Intervals

Each forklift can have configurable service intervals based on:
- **Hourmeter** — PM due every X hours (e.g., 500 hrs)
- **Calendar** — PM due every X days/months (e.g., 90 days)
- **Whichever comes first** — Trigger when either threshold is reached

### Service Status Logic

| Status | Icon | Condition |
|--------|------|-----------|
| **Overdue** | 🔴 | Past due threshold, no open job order |
| **Due Soon** | ⚠️ | Within warning threshold (e.g., 50 hrs or 7 days), no open job order |
| **OK** | ✅ | Not yet due |
| **Job Created** | 🔄 | Open job order exists for this service type |

### Status Calculation

```
next_pm_due = last_completed_pm_hourmeter + service_interval_hours
hours_remaining = next_pm_due - current_hourmeter

if open_job_exists for PM:
    status = "Job Created"
else if hours_remaining <= 0:
    status = "Overdue"
else if hours_remaining <= warning_threshold:
    status = "Due Soon"
else:
    status = "OK"
```

---

## Data Models

### Forklift Service Profile

```typescript
interface ForkliftServiceProfile {
  forklift_id: string;
  
  // Service Intervals (configurable per unit or use customer/global defaults)
  pm_interval_hours: number;          // e.g., 500
  pm_interval_days: number | null;    // e.g., 90 (optional calendar-based)
  pm_warning_threshold_hours: number; // e.g., 50
  pm_warning_threshold_days: number;  // e.g., 7
  
  // Current State
  current_hourmeter: number;
  hourmeter_updated_at: Date;
  
  // Last Completed PM
  last_pm_hourmeter: number;
  last_pm_date: Date;
  last_pm_job_order_id: string;
  
  // Calculated (can be stored or computed)
  next_pm_due_hourmeter: number;
  next_pm_due_date: Date | null;
  service_status: 'overdue' | 'due_soon' | 'ok' | 'job_created';
  
  // Active Job Reference
  active_pm_job_order_id: string | null;
}
```

### Job Order (Service-Related Fields)

```typescript
interface JobOrder {
  id: string;
  job_order_number: string;           // e.g., "JO-2024-0923"
  forklift_id: string;
  customer_id: string;
  
  // Job Details
  job_type: 'pm_service' | 'repair' | 'inspection' | 'warranty' | 'other';
  status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';
  
  // Hourmeter Capture
  hourmeter_at_creation: number;
  hourmeter_at_completion: number | null;
  
  // Timestamps
  created_at: Date;
  created_by: string;
  completed_at: Date | null;
  completed_by: string | null;
  
  // Cancellation (soft delete)
  cancelled_at: Date | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  
  // Parts assigned to this job
  parts: JobOrderPart[];
}
```

### Job Order Part Tracking

```typescript
interface JobOrderPart {
  id: string;
  job_order_id: string;
  part_id: string;
  serial_number: string | null;       // For serialized parts
  quantity_assigned: number;
  quantity_used: number;
  quantity_returned: number;
  
  // Status
  status: 'assigned' | 'installed' | 'returned' | 'pending_return';
  
  // Tracking
  assigned_at: Date;
  assigned_by: string;
  installed_at: Date | null;
  returned_at: Date | null;
}
```

---

## Service Dashboard

### Main View: Fleet Service Status

**Default Sort:** Overdue first, then Due Soon, then by hours remaining

| Column | Description |
|--------|-------------|
| Unit # | Forklift identifier (tap to view profile) |
| Customer | Customer name |
| Model | Forklift model |
| Last PM | Hourmeter at last completed PM |
| Current | Current hourmeter reading |
| Next PM Due | Target hourmeter for next PM |
| Hours Remaining | Calculated: Next PM Due - Current |
| Status | Visual indicator (🔴⚠️✅🔄) |
| Job Order | Link to open job if exists, or "Create Job" button |

### Filters

- **Status:** All, Overdue, Due Soon, OK, Job Created
- **Customer:** All, or select specific customer
- **Location:** All, or filter by customer location/site
- **Assigned Tech:** All, or filter by technician (if jobs exist)
- **Date Range:** Filter by next due date (for calendar-based intervals)

### Quick Actions

1. **Create Job** — One-tap job order creation for overdue/due units
2. **Bulk Create Jobs** — Select multiple units, create jobs in batch
3. **Update Hourmeter** — Quick hourmeter update without full job
4. **View History** — Jump to forklift's service history

---

## Forklift Profile: Service History

### Display Format

Each service history entry shows:

```
┌─────────────────────────────────────────────────────────────┐
│ JO-2024-0892                                    ✅ Completed │
│ PM Service                                                   │
│ Hourmeter: 4,250 hrs                                        │
│ Completed: Dec 18, 2024 by Mike T.                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ JO-2024-0915                                    ❌ Cancelled │
│ Repair                                                       │
│ Hourmeter at time: 4,312 hrs                                │
│ Created: Dec 20, 2024 by Mike T.                            │
│ Cancelled: Dec 20, 2024 by Jay                              │
│ Reason: Customer postponed - waiting on budget approval     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ JO-2024-0923                                   🔄 In Progress│
│ PM Service                                                   │
│ Hourmeter: 4,320 hrs                                        │
│ Created: Dec 21, 2024 by Jay                                │
│ Assigned to: Mike T.                                        │
└─────────────────────────────────────────────────────────────┘
```

### Cancelled Job Details

When viewing a cancelled job, show full context:

- Original job details (type, description, assigned tech)
- Hourmeter reading captured at time of cancellation
- Who cancelled and when
- Cancellation reason (required field)
- Parts that were assigned and their return status

---

## Job Cancellation Flow

### Process

1. User selects "Cancel Job" on an open/in-progress job
2. System prompts for **cancellation reason** (required)
3. System checks for assigned parts:
   - If parts assigned → prompt to confirm parts will be returned to inventory
   - Log part returns with reason "Job Cancelled"
4. Job status set to `cancelled`
5. Record `cancelled_at`, `cancelled_by`, `cancellation_reason`
6. Forklift's service status recalculates (may return to Overdue/Due Soon)

### Cancellation Reasons (Suggested Presets + Custom)

- Customer postponed
- Customer cancelled
- Duplicate job order
- Created in error
- Forklift no longer in service
- Scheduling conflict
- Other (free text)

---

## Automation Rules

### Auto-Status Updates

- When job order **completed** → Update `last_pm_hourmeter`, recalculate `next_pm_due`
- When job order **cancelled** → Recalculate service status (remove job reference)
- When hourmeter updated → Recalculate all service statuses for that unit

### Notifications (Future Enhancement)

- Alert when unit becomes **Overdue** with no job created
- Daily digest of all **Due Soon** units
- Alert when PM job sits **In Progress** for X days

---

## Integration Points

### Job Order System

- Service dashboard can create job orders directly
- Job completion updates service tracking automatically
- Cancelled jobs maintain audit trail in service history

### Inventory System

- Parts assigned to cancelled jobs auto-return to inventory
- Service history shows parts used per job
- Serialized parts track which forklift they're installed on

### Hourmeter Tracking

- Hourmeter captured at job creation
- Hourmeter captured at job completion
- Hourmeter captured even on cancelled jobs (audit trail)
- Quick hourmeter update available outside of job flow

---

## Database Schema (Reference)

### forklift_service_profiles

| Column | Type | Description |
|--------|------|-------------|
| forklift_id | FK | Reference to forklift |
| pm_interval_hours | INT | Hours between PMs |
| pm_interval_days | INT | Days between PMs (nullable) |
| pm_warning_threshold_hours | INT | Warning threshold in hours |
| current_hourmeter | INT | Latest hourmeter reading |
| hourmeter_updated_at | TIMESTAMP | When hourmeter was last updated |
| last_pm_hourmeter | INT | Hourmeter at last completed PM |
| last_pm_date | DATE | Date of last completed PM |
| last_pm_job_order_id | FK | Reference to last completed PM job |

### job_orders

| Column | Type | Description |
|--------|------|-------------|
| id | PK | Primary key |
| job_order_number | VARCHAR | Display number (JO-YYYY-XXXX) |
| forklift_id | FK | Reference to forklift |
| customer_id | FK | Reference to customer |
| job_type | ENUM | pm_service, repair, inspection, etc. |
| status | ENUM | draft, open, in_progress, completed, cancelled |
| hourmeter_at_creation | INT | Captured at job creation |
| hourmeter_at_completion | INT | Captured at completion (nullable) |
| created_at | TIMESTAMP | |
| created_by | FK | User who created |
| completed_at | TIMESTAMP | Nullable |
| completed_by | FK | Nullable |
| cancelled_at | TIMESTAMP | Nullable |
| cancelled_by | FK | Nullable |
| cancellation_reason | TEXT | Required if cancelled |

### job_order_parts

| Column | Type | Description |
|--------|------|-------------|
| id | PK | Primary key |
| job_order_id | FK | Reference to job order |
| part_id | FK | Reference to part |
| serial_number | VARCHAR | For serialized parts (nullable) |
| quantity_assigned | INT | How many assigned to job |
| quantity_used | INT | How many actually used |
| quantity_returned | INT | How many returned to inventory |
| status | ENUM | assigned, installed, returned |
| assigned_at | TIMESTAMP | |
| assigned_by | FK | |

---

## Future Enhancements

1. **Multi-level PM schedules** — PM-A every 250 hrs, PM-B every 500 hrs, PM-C every 1000 hrs
2. **Calendar + hourmeter hybrid** — Whichever comes first logic
3. **Customer-specific intervals** — Override defaults per customer
4. **Predictive scheduling** — Based on usage patterns, estimate when PM will be due
5. **Mobile notifications** — Push alerts for overdue units
6. **Route optimization** — Group due/overdue units by location for efficient scheduling

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 21, 2024 | Jay | Initial specification |

# FieldPro Workflow Specification

## ACWER Industrial Equipment — Forklift Service Management

**Version:** 1.0-draft  
**Last Updated:** January 2026  
**Status:** Requirements confirmed, awaiting build phase

---

## Implementation Status

> ⚠️ **IMPORTANT:** This specification documents CONFIRMED REQUIREMENTS, not completed features.  
> None of the features below have been implemented yet.

| Phase | Status |
|-------|--------|
| Requirements Gathering | ✅ Complete |
| Client Confirmation | ✅ Complete (except #11 Partial Work) |
| Technical Specification | ✅ Complete (this document) |
| Database Migration | ❌ Not started |
| Backend Implementation | ❌ Not started |
| Frontend Implementation | ❌ Not started |
| Testing | ❌ Not started |

---

## Table of Contents
1. [Overview](#overview)
2. [Entities & Roles](#entities--roles)
3. [Job Lifecycle](#job-lifecycle)
4. [Helper Technician](#helper-technician)
5. [In-Job Request System](#in-job-request-system)
6. [Job Reassignment](#job-reassignment)
7. [Multi-Day Jobs & Escalation](#multi-day-jobs--escalation)
8. [Customer Signature Flow](#customer-signature-flow)
9. [Hourmeter & Service Prediction](#hourmeter--service-prediction)
10. [KPI Tracking](#kpi-tracking)
11. [Database Schema Changes](#database-schema-changes)

---

## Overview

This specification covers the workflow implementation for ACWER Industrial Equipment, a forklift rental company in Malaysia. The system manages service jobs for ~2,000 forklifts with ~60 daily jobs across branches in Johor and Penang.

### Key Principles
- **Auditability:** Every action must be traceable
- **Operational realism:** Edge cases handled gracefully
- **Mobile-first:** Technicians work on-site with phones
- **Admin control:** Spare parts and reassignments require Admin approval

---

## Entities & Roles

### Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Create/assign jobs, approve requests, select spare parts, amend Items Used, download photos, monitor hourmeter, handle reassignments, track KPI |
| **Supervisor** | View all jobs, limited approvals (TBD) |
| **Lead Technician** | Full job permissions: hourmeter input, spare parts requests, job completion, customer signature |
| **Assistant Technician** | Limited: start/end times, photos only. No hourmeter, no spare parts, no signature |
| **Accountant** | View completed jobs, billing data, reports |

### Data Objects

```
JobOrder
├── id, status, created_at, updated_at
├── assigned_technician_id (lead)
├── forklift_id
├── customer_id
├── branch_id
├── hourmeter_reading
├── completion_date
├── cutoff_time (for multi-day)
├── is_overtime (boolean)
└── escalation_triggered_at

JobAssignment
├── job_id
├── technician_id
├── assignment_type: 'lead' | 'assistant'
├── assigned_at, started_at, ended_at
├── reassignment_reason (if applicable)
├── partial_work_notes (if reassigned)
└── partial_work_time_minutes (if reassigned)

SparePartRequest
├── job_id
├── requested_by (technician_id)
├── description (text)
├── photo_url (optional)
├── status: 'pending' | 'approved' | 'rejected'
├── admin_response_part_name
├── admin_response_quantity
└── responded_at

CustomerVerification
├── job_id
├── signature_data (base64 or null)
├── verification_type: 'signed_onsite' | 'deferred' | 'auto_completed' | 'disputed'
├── deferred_reason (if not signed onsite)
├── evidence_photos[] 
├── customer_notified_at
├── customer_response_deadline
└── dispute_notes
```

---

## Job Lifecycle

### States

```
CREATED
    ↓
ASSIGNED
    ↓ (technician accepts)
IN_PROGRESS
    ↓
    ├── COMPLETED (signature obtained)
    ├── COMPLETED_AWAITING_ACKNOWLEDGEMENT (deferred signature)
    ├── INCOMPLETE_TO_BE_CONTINUED (same tech continues)
    └── INCOMPLETE_REASSIGNED (new tech assigned)
    
COMPLETED_AWAITING_ACKNOWLEDGEMENT
    ↓ (3-5 working days)
    ├── COMPLETED (customer acknowledged or auto-completed)
    └── DISPUTED (customer raised dispute)
```

### State Transitions

| From | To | Trigger | Requirements |
|------|----|---------|--------------|
| CREATED | ASSIGNED | Admin assigns | technician_id set |
| ASSIGNED | IN_PROGRESS | Technician accepts | Start photo uploaded |
| ASSIGNED | REJECTED | Technician rejects | Rejection reason |
| IN_PROGRESS | COMPLETED | Technician completes | End photo, signature, hourmeter |
| IN_PROGRESS | COMPLETED_AWAITING_ACK | Technician completes without sig | Reason, evidence photos |
| IN_PROGRESS | INCOMPLETE_TO_BE_CONTINUED | Technician pauses | Reason, cutoff_time |
| IN_PROGRESS | INCOMPLETE_REASSIGNED | Admin reassigns | Reassignment reason, new tech |
| COMPLETED_AWAITING_ACK | COMPLETED | Customer acknowledges OR 3-5 days pass | — |
| COMPLETED_AWAITING_ACK | DISPUTED | Customer disputes | Dispute notes |

---

## Helper Technician

### Implementation

Helper is **not a new role**. It's an `assignment_type` within `JobAssignment`.

```typescript
interface JobAssignment {
  job_id: string;
  technician_id: string;
  assignment_type: 'lead' | 'assistant';
  assigned_at: timestamp;
  started_at?: timestamp;
  ended_at?: timestamp;
}
```

### Permissions Matrix

| Action | Lead | Assistant |
|--------|------|-----------|
| View job details | ✅ Full | ✅ Limited (machine, location, issue) |
| Upload start photo | ✅ | ✅ |
| Upload end photo | ✅ | ✅ |
| Input hourmeter | ✅ | ❌ |
| Request spare parts | ✅ | ❌ |
| Add Items Used | ✅ | ❌ |
| Complete job | ✅ | ❌ |
| Capture signature | ✅ | ❌ |
| View job history/notes | ✅ | ❌ |

### Constraints

- Maximum **1 assistant** per job at any time
- Same person can be lead on Job A, assistant on Job B
- Assistant can be **replaced** (sequential, not simultaneous)
- All assistant photos tagged with `is_helper_photo = true`


---

## In-Job Request System

Three request types during active job:

### 1. Assistance Request

**Flow:**
1. Lead Technician → clicks "Request Assistance"
2. Admin receives notification
3. Admin assigns Assistant Technician
4. Assistant sees job in their app (limited view)
5. Assistant logs start/end times, uploads photos
6. No Items Used, no signature from assistant

### 2. Spare Part Request

**Flow:**
1. Lead Technician → clicks "Request Spare Part"
2. Enters: text description + optional photo of faulty component
3. Can request multiple parts at once
4. Admin receives notification
5. Admin reviews, selects part from inventory, sets quantity
6. Approves or rejects with reason
7. Approved parts appear in Lead Technician's Items Used list
8. Admin can amend Items Used post-job before finalizing

### 3. Skillful Technician Request

**Flow:**
1. Lead Technician → clicks "Request Skillful Technician"
2. Enters reason (skill/expertise issue)
3. Admin reviews
4. Admin reassigns job to new technician
5. Triggers reassignment flow (see below)

---

## Job Reassignment

### Triggers
- Skillful Technician Request (skill issue)
- Technician unavailable (sick, emergency)
- Admin decision

### Flow

1. **Current tech's job marked:** `INCOMPLETE_REASSIGNED`
2. **Partial work recorded:**
   - `reassignment_reason`
   - `partial_work_notes` (tasks completed)
   - `partial_work_time_minutes` (hours spent)
3. **Items Used handling:**
   - Admin reviews each item
   - Decision per item: `cancelled` or `transferred`
   - Only `transferred` items appear for new tech
4. **New tech assigned:**
   - Job appears as new assignment
   - All history visible (notes, photos, hourmeter)
   - Only new tech updates Items Used going forward
5. **KPI impact:**
   - Original tech: +1 incomplete
   - New tech: +1 completed (when finished)

### Multi-Reassignment (A → B → C)

Same rules apply at each step:
- Tech A: incomplete
- Tech B: incomplete  
- Tech C: completed (when finished)

Each reassignment creates audit record with reason and partial work.

---

## Multi-Day Jobs & Escalation

### CutOffTime

When technician cannot complete same day:
1. Submits reason/details
2. Job marked `INCOMPLETE_TO_BE_CONTINUED`
3. `cutoff_time` recorded
4. Job stays with same technician
5. All data persists (notes, photos, hourmeter)

### Escalation Rules

| Day Type | Escalation | Work Status | Days Counter |
|----------|------------|-------------|--------------|
| Monday-Friday | 8:00 AM next business day | Standard Job | Counts |
| Saturday (Admin-arranged OT) | Disabled | Overtime Job | Paused |
| Sunday | No work expected | — | Paused |

### Escalation Logic

```typescript
function calculateEscalationTime(jobAssignedAt: Date, isOvertime: boolean): Date | null {
  if (isOvertime) return null; // No escalation for OT jobs
  
  const nextBusinessDay = getNextBusinessDay(jobAssignedAt);
  return setTime(nextBusinessDay, 8, 0, 0); // 8:00 AM
}

function getNextBusinessDay(date: Date): Date {
  let next = addDays(date, 1);
  while (isWeekend(next)) {
    next = addDays(next, 1);
  }
  return next;
}
```

---

## Customer Signature Flow

### Standard Flow (On-Site Signature)

1. Lead Technician completes work
2. Uploads end photo
3. Captures customer signature on device
4. Enters customer name/designation
5. Job → `COMPLETED`

### Deferred Acknowledgement Flow

**Trigger:** Customer not available or refuses to sign

1. Technician selects "Customer Not Signed Onsite"
2. **Required inputs:**
   - Reason (dropdown + text)
   - Evidence photos (minimum 1)
   - Hourmeter reading
3. Job → `COMPLETED_AWAITING_ACKNOWLEDGEMENT`
4. **System auto-sends** digital service report to customer:
   - Email
   - Customer portal
   - SMS (if configured)
5. **Customer has 3-5 working days** to:
   - Sign digitally
   - Acknowledge without signature
   - Raise dispute
6. **No response:** Job auto-converts to `COMPLETED`, Admin notified
7. **Dispute:** Job → `DISPUTED`, Admin handles manually

---

## Hourmeter & Service Prediction

### Input Rules

- **Who:** Lead Technician only
- **When:** During job (required for completion)
- **Validation:** Must be ≥ last recorded reading for that forklift

### Service Intervals by Forklift Type

| Type | Interval | Trigger |
|------|----------|---------|
| Electric | 3 months | Calendar (from delivery date) |
| Diesel | 500 hours | Hourmeter |
| LPG | 350 hours | Hourmeter |

### Prediction Logic

```typescript
function predictNextService(forklift: Forklift): ServicePrediction {
  if (forklift.type === 'electric') {
    const lastService = forklift.last_service_date || forklift.delivery_date;
    const nextDue = addMonths(lastService, 3);
    return {
      forklift_id: forklift.id,
      next_service_due: nextDue,
      days_until_service: differenceInDays(nextDue, new Date()),
      trigger_type: 'calendar'
    };
  } else {
    const interval = forklift.type === 'diesel' ? 500 : 350;
    const lastServiceHours = forklift.last_service_hourmeter || 0;
    const currentHours = forklift.current_hourmeter;
    const hoursRemaining = (lastServiceHours + interval) - currentHours;
    
    return {
      forklift_id: forklift.id,
      hours_until_service: hoursRemaining,
      trigger_type: 'hourmeter'
    };
  }
}
```

---

## KPI Tracking

### Metrics per Technician

| Metric | Calculation |
|--------|-------------|
| Jobs Completed | Count where final status = COMPLETED and tech was last assignee |
| Jobs Incomplete | Count where job was reassigned away from tech |
| Jobs Reassigned To | Count where tech received already-started job |
| Completion Rate | Completed / (Completed + Incomplete) |

### Visibility

| Role | Can See |
|------|---------|
| Admin | All technicians, all metrics |
| Supervisor | Their branch technicians |
| Technician | Own metrics only |

---

## Database Schema Changes

### New Tables

```sql
-- Job Assignments (supports lead + assistant)
CREATE TABLE job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES profiles(id),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('lead', 'assistant')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  reassignment_reason TEXT,
  partial_work_notes TEXT,
  partial_work_time_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spare Part Requests
CREATE TABLE spare_part_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES profiles(id),
  description TEXT NOT NULL,
  photo_url TEXT,
  issue_description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_id UUID REFERENCES profiles(id),
  admin_part_name TEXT,
  admin_quantity INTEGER,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- Customer verification enhancements
ALTER TABLE customer_verifications ADD COLUMN IF NOT EXISTS
  verification_type TEXT DEFAULT 'signed_onsite',
  deferred_reason TEXT,
  evidence_photo_urls TEXT[],
  customer_notified_at TIMESTAMPTZ,
  customer_response_deadline TIMESTAMPTZ,
  auto_completed_at TIMESTAMPTZ,
  dispute_notes TEXT;

-- Job enhancements
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS
  is_overtime BOOLEAN DEFAULT FALSE,
  escalation_triggered_at TIMESTAMPTZ,
  cutoff_time TIMESTAMPTZ;

-- Forklift service tracking
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS
  forklift_type TEXT CHECK (forklift_type IN ('electric', 'diesel', 'lpg')),
  delivery_date DATE,
  last_service_date DATE,
  last_service_hourmeter INTEGER;

-- Photo categorization
ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS
  category TEXT DEFAULT 'other' CHECK (category IN ('start', 'end', 'spare_part', 'evidence', 'other')),
  is_helper_photo BOOLEAN DEFAULT FALSE;
```

### Indexes

```sql
CREATE INDEX idx_job_assignments_job ON job_assignments(job_id);
CREATE INDEX idx_job_assignments_tech ON job_assignments(technician_id);
CREATE INDEX idx_spare_part_requests_job ON spare_part_requests(job_id);
CREATE INDEX idx_spare_part_requests_status ON spare_part_requests(status);
CREATE INDEX idx_jobs_escalation ON jobs(escalation_triggered_at) WHERE escalation_triggered_at IS NULL;
```

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0-draft | Jan 2026 | Initial specification from ACWER requirements |

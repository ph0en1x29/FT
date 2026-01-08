# ACWER Client Requirements Review
**Date:** January 7, 2025  
**Status:** 🟡 Under Discussion  
**Document Version:** 1.0

---

## 📋 Overview

This document captures and analyzes feature requests from ACWER Industrial Equipment Sdn Bhd. Each requirement is evaluated for feasibility, complexity, and implementation approach. Questions requiring client clarification are highlighted.

---

## Table of Contents

1. [Job Types & Categories](#1-job-types--categories)
2. [Dual-Path Inventory System](#2-dual-path-inventory-system)
3. [Parts Usage Control](#3-parts-usage-control)
4. [Hourmeter Handling](#4-hourmeter-handling)
5. [Dual Admin Approval Flow](#5-dual-admin-approval-flow)
6. [Offline Mode](#6-offline-mode)
7. [Condition Checklist](#7-condition-checklist)
8. [Photo-Based Job Tracking](#8-photo-based-job-tracking)
9. [Request Management](#9-request-management)
10. [Pricing Visibility](#10-pricing-visibility)
11. [Implementation Phases](#implementation-phases)
12. [Database Changes Summary](#database-changes-summary)

---

## 1. Job Types & Categories

### Client Request
Expand job types from current 4 to 5 categories with different field requirements:

| Category | Typical Tasks | Required Fields |
|----------|---------------|-----------------|
| Service | Planned maintenance | Hourmeter, Condition Checklist, Parts Request |
| Repair | Breakdown fixes | Hourmeter, Condition Checklist, Parts Request |
| Slot-In (On-Call) | Emergency repairs | Hourmeter, Van Standby Units (50 SKUs) |
| Checking | Inspections | Hourmeter, Condition Checklist |
| Courier/Collection | Parts delivery, pallet truck collection | POD photo only (No Hourmeter) |

### Current State
- **Existing types:** Service, Repair, Checking, Accident
- Job type is stored as text field in `service_jobs` table

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🟢 Low |
| Feasibility | ✅ Easy |
| Breaking Changes | None |

### Implementation Approach
1. Update job type dropdown options
2. Create conditional field visibility rules based on job type
3. Add `job_category` field for grouping (Standard vs Emergency vs Logistics)

### Questions for Client ❓

```
Q1.1: Should "Accident" job type be removed or kept alongside the new types?

Q1.2: For Courier/Collection jobs:
      - Is customer signature required?
      - What proof of delivery (POD) details are needed besides photo?
      - Can one courier job have multiple stops/deliveries?

Q1.3: Can a job type be changed after creation? (e.g., Service → Repair if issue found)

Q1.4: For Slot-In jobs, is there a time limit for emergency response tracking?
```

### Proposed Field Visibility Matrix

| Field | Service | Repair | Slot-In | Checking | Courier |
|-------|---------|--------|---------|----------|---------|
| Hourmeter | ✅ | ✅ | ✅ | ✅ | ❌ |
| Condition Checklist | ✅ | ✅ | ✅ | ✅ | ❌ |
| Parts Request (Store) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Van Stock Usage | ❌ | ❌ | ✅ | ❌ | ❌ |
| POD Photo | ❌ | ❌ | ❌ | ❌ | ✅ |
| Customer Signature | ✅ | ✅ | ✅ | ✅ | ✅ |
| Forklift Selection | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 2. Dual-Path Inventory System

### Client Request
Two distinct inventory behaviors:

**Source A (Warehouse) - For Scheduled Jobs:**
- Tech must "Request" parts
- Admin 2 (Store) must "Issue" parts
- Tech collects before leaving for site

**Source B (Van Stock) - For On-Call/Emergency Jobs:**
- 50 "Standby Units" pre-loaded in each van
- Tech "Consumes" directly without approval
- Auto-Requisition triggers to replenish van stock next morning

### Current State
- Basic spare parts request/approval flow exists
- No inventory tracking or stock levels
- No concept of "van warehouse" or technician inventory

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🔴 High |
| Feasibility | ✅ Possible but requires Inventory Module |
| Breaking Changes | New tables and workflows |
| Dependencies | Smart Inventory System (Roadmap item) |

### Implementation Approach

**Phase A - Foundation:**
1. Create `inventory_locations` table (Main Warehouse, Van-001, Van-002, etc.)
2. Create `inventory_items` table with SKU management
3. Create `inventory_stock` table (location + item + quantity)
4. Create `inventory_transactions` table (audit trail)

**Phase B - Van Stock:**
1. Link each technician to a "Van Warehouse" location
2. Pre-populate 50 standard SKUs per van
3. Create "Van Stock" consumption flow for Slot-In jobs

**Phase C - Auto-Requisition:**
1. Trigger requisition when van stock is consumed
2. Morning batch process to consolidate requisitions
3. Admin 2 prepares replenishment

### Questions for Client ❓

```
Q2.1: What are the 50 standard SKUs for van stock? Is it the same for all vans?

Q2.2: Can techs request ADDITIONAL parts beyond van stock during emergency jobs?

Q2.3: How is van stock physically replenished?
      - Tech returns to warehouse?
      - Delivery to tech's home?
      - Exchange at specific location?

Q2.4: What happens if tech uses parts from van stock for a SCHEDULED job?
      (Should this be blocked or just flagged?)

Q2.5: Is there a maximum value limit for van stock usage without approval?

Q2.6: How often should van stock be audited/verified?

Q2.7: For the "Slot-In Rule" - does Auto-Requisition go to Admin 2 automatically,
      or does Admin 1 need to approve first?
```

### Conditional Visibility Logic

```javascript
// Pseudocode for Parts UI
if (job.type === 'Service' || job.type === 'Repair') {
  show: 'Request from Main Store' button
  hide: 'Use Van Stock' option
}

if (job.type === 'Slot-In' || job.type === 'On-Call') {
  show: 'Use Standby/Van Stock' list
  hide: 'Request from Main Store' button
  onPartUsed: triggerAutoRequisition()
}
```

---

## 3. Parts Usage Control

### Client Request
- Remove "Parts Used" entry from technician's app
- Parts records created and issued by Admin only (upon tech request)
- Tech job summary shows items approved by Admin 2, not self-reported usage

### Current State
- Techs can request spare parts
- Admin approves/rejects requests
- Parts used section exists in job details

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🟢 Low |
| Feasibility | ✅ Easy |
| Breaking Changes | UI only |

### Implementation Approach
1. Remove "Parts Used" input field from Technician App
2. Show read-only list of "Parts Issued" (approved by Admin 2)
3. Ensure pricing is hidden from this view

### Questions for Client ❓

```
Q3.1: Can tech see the QUANTITY of parts issued, or just item names?

Q3.2: Should tech be able to "confirm receipt" of issued parts?

Q3.3: What if Admin issues wrong parts? Can tech flag/reject?

Q3.4: For warranty tracking - who records serial numbers of parts installed?
      Tech or Admin?
```

---

## 4. Hourmeter Handling

### Client Request
- Hourmeter reading recorded by FIRST assigned technician only
- If job is reassigned, hourmeter value persists (Technician 2 doesn't re-enter)
- Include "Amendment" button for authorized corrections

### Current State
- Hourmeter field exists in job form
- No locking mechanism after initial entry
- No amendment audit trail

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🟢 Low |
| Feasibility | ✅ Easy |
| Breaking Changes | Minor logic change |

### Implementation Approach
1. Add `hourmeter_recorded_by` field to track who entered the value
2. Add `hourmeter_recorded_at` timestamp
3. Lock hourmeter field after first entry (for subsequent technicians)
4. Add "Request Amendment" button → Creates amendment request to Admin
5. Admin can approve amendment with reason logged

### Database Changes
```sql
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS hourmeter_recorded_by UUID REFERENCES users(id);
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS hourmeter_recorded_at TIMESTAMPTZ;
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS hourmeter_locked BOOLEAN DEFAULT FALSE;

-- Amendment tracking
CREATE TABLE IF NOT EXISTS hourmeter_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES service_jobs(id),
  old_value DECIMAL,
  new_value DECIMAL,
  reason TEXT,
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
```

### Questions for Client ❓

```
Q4.1: Who can approve hourmeter amendments? Admin 1, Admin 2, or both?

Q4.2: Should there be a tolerance threshold for amendments?
      (e.g., changes > 100 hours require supervisor approval)

Q4.3: Is hourmeter mandatory for all applicable job types, or optional?

Q4.4: Should system flag suspicious hourmeter readings?
      (e.g., lower than last recorded, unusually high jump)
```

---

## 5. Dual Admin Approval Flow

### Client Request
- Admin 1 (Service): Technician arrangement, job assignment
- Admin 2 (Store): Spare parts response & items approval
- Both must be able to view and respond SIMULTANEOUSLY
- Job completion flow:
  1. Technician presses "Complete"
  2. Admin 2 (Store) confirms spare parts used
  3. ONLY AFTER Admin 2 confirmation → Admin 1 can finalize/close job

### Current State
- Single admin approval flow
- Any admin can approve/complete jobs
- No sequential dependency

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🟡 Medium |
| Feasibility | ✅ Possible |
| Breaking Changes | Workflow change |

### Implementation Approach

**Option A: Sequential Gates**
```
Tech Complete → [Parts Pending] → Admin 2 Confirms → [Awaiting Close] → Admin 1 Closes
```

**Option B: Parallel with Final Gate**
```
Tech Complete → Admin 1 & Admin 2 can work simultaneously
             → Job only closeable when BOTH have signed off
```

### Proposed Job Status Flow
```
ASSIGNED → IN_PROGRESS → TECH_COMPLETED → PARTS_CONFIRMED → CLOSED
                                ↓
                         (Admin 2 confirms)
                                ↓
                         (Admin 1 closes)
```

### Questions for Client ❓

```
Q5.1: What if a job has NO parts used? Does Admin 2 still need to confirm?

Q5.2: Can Admin 1 and Admin 2 be the same person for smaller branches?

Q5.3: What's the SLA for Admin 2 to confirm parts? 
      Should there be escalation if delayed?

Q5.4: Can Admin 1 override and close without Admin 2 confirmation in emergencies?

Q5.5: For Slot-In jobs using Van Stock - does Admin 2 still need to confirm?
      (Since parts weren't "issued" from store)

Q5.6: Should there be a dashboard showing jobs "Pending Parts Confirmation"?
```

### UI Changes Required
- Add "Confirm Parts" action for Admin 2 role
- Add visual indicator showing parts confirmation status
- Disable "Close Job" button until parts confirmed
- Add filter for "Awaiting Parts Confirmation" status

---

## 6. Offline Mode

### Client Request
- Support offline operation at sites with no WiFi coverage
- Time tracking should start and end accurately while offline
- Sync data once connection is restored

### Current State
- Fully online application
- No offline capability
- No local data storage

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🔴 Very High |
| Feasibility | ✅ Possible with significant effort |
| Breaking Changes | Architecture change |
| Estimated Effort | 4-6 weeks dedicated development |

### Technical Requirements
1. **Progressive Web App (PWA)** setup
2. **Service Workers** for offline caching
3. **IndexedDB** for local data storage
4. **Sync Queue** for pending operations
5. **Conflict Resolution** strategy
6. **Offline Indicators** in UI

### Implementation Approach (High-Level)

**Phase 1 - PWA Foundation:**
- Service worker registration
- App manifest
- Basic offline page

**Phase 2 - Data Caching:**
- Cache assigned jobs for offline viewing
- Cache customer/asset reference data
- Cache checklist templates

**Phase 3 - Offline Actions:**
- Queue job updates locally
- Store photos locally with timestamps
- Track time offline with device clock

**Phase 4 - Sync Engine:**
- Detect online/offline status
- Sync queued actions when online
- Handle conflicts (server vs local changes)

### Questions for Client ❓

```
Q6.1: What percentage of job sites have no connectivity?

Q6.2: How long are techs typically offline? (minutes/hours/full day?)

Q6.3: What actions MUST work offline?
      - View job details?
      - Update job status?
      - Take photos?
      - Complete checklist?
      - Record hourmeter?
      - Request parts? (probably not possible offline)

Q6.4: Is it acceptable to show "Pending Sync" status for offline-created data?

Q6.5: What if two techs update the same job offline? (conflict scenario)

Q6.6: Should offline time tracking use device time or require NTP sync?
```

### Recommendation
**Defer to Phase 4 (Post-MVP)**. This is a significant undertaking that should be properly scoped after core features are stable. Many FSM competitors also struggle with robust offline support.

---

## 7. Condition Checklist

### Client Request
- Include a "Check All" button for the condition checklist
- Quick way to mark all items as checked, then uncheck specific issues

### Current State
- Individual checkbox items
- No bulk selection

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🟢 Very Low |
| Feasibility | ✅ Trivial |
| Breaking Changes | None |

### Implementation Approach
1. Add "Check All" button at top of checklist
2. Add "Uncheck All" button for reset
3. Maintain existing individual toggle functionality

### Questions for Client ❓

```
Q7.1: Should "Check All" include a confirmation prompt?
      (To prevent accidental bulk checking)

Q7.2: Are there any checklist items that should NOT be bulk-checkable?
      (e.g., safety-critical items requiring individual attention)
```

---

## 8. Photo-Based Job Tracking

### Client Request
- Job should START automatically once a photo of the forklift is taken
- Photos must be captured LIVE (no access to phone gallery)
- Time STARTS when photo taken, STOPS when completion photo taken
- Same logic applies to helpers and reassigned technicians

### Current State
- Manual "Start Job" button
- Photos can be uploaded from gallery
- Time tracking is manual

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🟡 Medium |
| Feasibility | ✅ Mostly possible |
| Breaking Changes | UX flow change |

### Implementation Approach

**Auto-Start on Photo:**
1. When tech opens assigned job, prompt for "Start Photo"
2. Camera opens directly (not file picker)
3. On photo capture → Job status changes to IN_PROGRESS
4. Timestamp recorded as job start time

**Live Camera Only:**
1. Use `<input type="file" accept="image/*" capture="environment">`
2. This opens camera directly on mobile devices
3. **Limitation:** Some browsers/devices may still allow gallery access

**Completion Photo:**
1. "Complete Job" requires completion photo
2. On photo capture → Timestamp recorded as job end time

### Questions for Client ❓

```
Q8.1: What if tech's camera is broken or phone has issues?
      Should there be a fallback option with supervisor override?

Q8.2: For multi-day jobs, how should photo-based timing work?
      - Photo at start of each day?
      - Photo only on first and last day?

Q8.3: Should the START photo show the forklift's serial/asset number plate?
      (For verification purposes)

Q8.4: What if tech accidentally takes a wrong photo?
      - Allow retake?
      - Delete and start over?

Q8.5: For reassigned jobs - does Technician 2 take a new start photo?
      (Or continue from where Tech 1 left off?)

Q8.6: GPS/Location tagging on photos - is this required?

Q8.7: What's the maximum time between "Start Photo" and "End Photo"?
      Should system flag unusually long jobs?
```

### Technical Note on "No Gallery" Restriction
Completely blocking gallery access is **not reliably possible** across all devices and browsers. Some approaches:

**Option A: Honor System + Verification**
- Request camera-only, but can't guarantee
- Add EXIF timestamp verification
- Flag photos where timestamp doesn't match job time

**Option B: In-App Camera**
- Build custom camera within app
- More control but more development effort
- May have quality/compatibility issues

**Recommendation:** Implement Option A with metadata verification. Explain to client that 100% gallery blocking isn't technically reliable across all Android/iOS versions.

---

## 9. Request Management

### Client Request
- Requests for Assistant, Spare Parts, and Skilled Technician should include an "Edit" button
- Allow amendments, corrections, or additional requests

### Current State
- Requests can be created
- No edit functionality after submission
- Must cancel and recreate for changes

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🟢 Low |
| Feasibility | ✅ Easy |
| Breaking Changes | None |

### Implementation Approach
1. Add "Edit" button on pending requests
2. Only allow edits while status is "Pending"
3. Log edit history for audit trail
4. Notify Admin when request is modified

### Questions for Client ❓

```
Q9.1: Can requests be edited AFTER admin has seen them?
      (Or only before admin opens the request?)

Q9.2: Should editing a request reset its position in the queue?

Q9.3: What fields can be edited?
      - Quantity?
      - Item type?
      - Urgency?
      - Notes?

Q9.4: Is there a limit to how many times a request can be edited?
```

---

## 10. Pricing Visibility

### Client Request
- Remove "extra charges" from technician's app (not required)
- Technician job summary should exclude pricing
- Show only details of parts used (names/quantities, not costs)

### Current State
- Pricing may be visible in some views
- Need to audit all tech-facing screens

### Analysis
| Aspect | Assessment |
|--------|------------|
| Complexity | 🟢 Low |
| Feasibility | ✅ Easy |
| Breaking Changes | None |

### Implementation Approach
1. Audit all Technician App screens for pricing fields
2. Remove or hide: unit cost, total cost, charges, pricing
3. Keep visible: item names, quantities, specifications
4. Ensure API responses to tech role exclude pricing data

### Questions for Client ❓

```
Q10.1: Should techs see ANY cost-related information?
       (e.g., "High-value part" warning without showing actual price?)

Q10.2: What about labor charges - should time-based costs be hidden too?

Q10.3: For customer-facing receipts that tech shows on-site:
       Should pricing be visible to customer but not editable by tech?
```

---

## Implementation Phases

### Phase 1: Quick Wins (1-2 weeks)
Target: Immediate value with minimal risk

| Item | Effort | Priority |
|------|--------|----------|
| Job Types Update | 2 hours | 🔴 High |
| Conditional Field Visibility | 4 hours | 🔴 High |
| "Check All" Checklist Button | 1 hour | 🟢 Low |
| Hide Pricing from Tech | 2 hours | 🔴 High |
| Edit Button for Requests | 3 hours | 🟡 Medium |
| Hourmeter Locking | 4 hours | 🟡 Medium |

**Total Estimate: ~16 hours**

### Phase 2: Asset Dashboard + Photo Flow (2-3 weeks)
Target: Foundation for asset management and improved job tracking

| Item | Effort | Priority |
|------|--------|----------|
| Asset Overview Dashboard | 16 hours | 🔴 High |
| Photo-Based Job Start/End | 8 hours | 🟡 Medium |
| Hourmeter Amendments | 4 hours | 🟡 Medium |
| POD Flow for Courier Jobs | 4 hours | 🟡 Medium |

**Total Estimate: ~32 hours**

### Phase 3: Workflow Enhancements (2-3 weeks)
Target: Dual admin approval and enhanced parts flow

| Item | Effort | Priority |
|------|--------|----------|
| Dual Admin Approval Flow | 16 hours | 🟡 Medium |
| Parts Confirmation Step | 8 hours | 🟡 Medium |
| Request Edit History | 4 hours | 🟢 Low |

**Total Estimate: ~28 hours**

### Phase 4: Inventory System (4-6 weeks)
Target: Full inventory with van stock support

| Item | Effort | Priority |
|------|--------|----------|
| Inventory Module Foundation | 24 hours | 🟡 Medium |
| Van Stock (Virtual Warehouse) | 16 hours | 🟡 Medium |
| Auto-Requisition System | 12 hours | 🟡 Medium |
| Dual-Path Parts Flow | 8 hours | 🟡 Medium |

**Total Estimate: ~60 hours**

### Phase 5: Advanced Features (Future)
Target: Post-MVP enhancements

| Item | Effort | Priority |
|------|--------|----------|
| Offline Mode (PWA) | 80+ hours | 🟢 Low |
| Contract Management | 40 hours | 🟡 Medium |
| Preventive Maintenance Automation | 24 hours | 🟡 Medium |

---

## Database Changes Summary

### New Tables Required

```sql
-- Phase 2: Asset Management
CREATE TABLE assets (...);
CREATE TABLE asset_status_history (...);

-- Phase 3: Workflow
CREATE TABLE job_approvals (...);
CREATE TABLE hourmeter_amendments (...);

-- Phase 4: Inventory
CREATE TABLE inventory_locations (...);
CREATE TABLE inventory_items (...);
CREATE TABLE inventory_stock (...);
CREATE TABLE inventory_transactions (...);
CREATE TABLE van_stock_assignments (...);
CREATE TABLE auto_requisitions (...);
```

### Existing Table Modifications

```sql
-- service_jobs table
ADD COLUMN job_category TEXT; -- 'standard', 'emergency', 'logistics'
ADD COLUMN hourmeter_recorded_by UUID;
ADD COLUMN hourmeter_recorded_at TIMESTAMPTZ;
ADD COLUMN hourmeter_locked BOOLEAN;
ADD COLUMN start_photo_url TEXT;
ADD COLUMN start_photo_at TIMESTAMPTZ;
ADD COLUMN end_photo_url TEXT;
ADD COLUMN end_photo_at TIMESTAMPTZ;
ADD COLUMN parts_confirmed_by UUID;
ADD COLUMN parts_confirmed_at TIMESTAMPTZ;

-- Update job_type enum/options
-- Add: 'slot_in', 'courier_collection'
-- Keep or remove: 'accident' (pending client confirmation)
```

---

## Open Questions Summary

### Must Answer Before Phase 1:
- Q1.1: Keep "Accident" job type?
- Q1.2: Courier/Collection POD requirements
- Q3.1: Parts quantity visibility for techs
- Q10.1: Any cost visibility for techs?

### Must Answer Before Phase 2:
- Q4.1: Who approves hourmeter amendments?
- Q8.1: Camera fallback option?
- Q8.3: Start photo verification requirements

### Must Answer Before Phase 3:
- Q5.1: Parts confirmation for zero-parts jobs?
- Q5.4: Admin override capability?
- Q5.5: Slot-In jobs parts confirmation?

### Must Answer Before Phase 4:
- Q2.1: Standard 50 SKUs list
- Q2.2: Additional parts for emergency jobs?
- Q2.3: Van stock replenishment process
- Q2.7: Auto-requisition approval flow

---

## Next Steps

1. [ ] Review this document with Jay
2. [ ] Compile questions for ACWER client
3. [ ] Get client responses on critical questions
4. [ ] Finalize Phase 1 scope
5. [ ] Begin implementation

---

*Document maintained by: Claude AI Assistant*  
*Last Updated: January 7, 2025*

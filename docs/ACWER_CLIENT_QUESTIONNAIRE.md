# FieldPro Implementation Questionnaire
## ACWER Industrial Equipment Sdn Bhd

---

**Document Version:** 1.0  
**Date:** January 8, 2026  
**Prepared by:** FieldPro Development Team  
**Purpose:** Requirements clarification for system customization

---

## Introduction

Thank you for your detailed requirements submission. To ensure we build the system exactly to your specifications, we need clarification on several points. Please review each section and provide your responses in the spaces provided.

**How to complete this questionnaire:**
- Select options by marking with **[X]** where applicable
- Provide written answers in the spaces provided
- Add any additional comments or context that would help us understand your needs
- If unsure about any question, please indicate and we can discuss further

**Estimated completion time:** 20-30 minutes

---

## Table of Contents

1. [Job Types & Categories](#section-1-job-types--categories)
2. [Parts & Inventory Management](#section-2-parts--inventory-management)
3. [Workflow & Approvals](#section-3-workflow--approvals)
4. [Technician App Features](#section-4-technician-app-features)
5. [Photo & Time Tracking](#section-5-photo--time-tracking)
6. [Offline Operations](#section-6-offline-operations)
7. [Reporting & Visibility](#section-7-reporting--visibility)
8. [Asset Management](#section-8-asset-management)
9. [Additional Requirements](#section-9-additional-requirements)

---

## Section 1: Job Types & Categories

Based on your submission, you require 5 job types: **Service, Repair, Slot-In (On-Call), Checking, and Courier/Collection**.

### 1.1 Existing Job Types

We currently have an **"Accident"** job type in the system.

**Should we keep "Accident" as a separate job type?**

- [ ] Yes, keep "Accident" as a 6th job type
- [ ] No, remove it (accidents will be handled under "Repair")
- [ ] Rename "Accident" to: _______________

---

### 1.2 Slot-In (On-Call/Emergency) Jobs

**1.2.1 How quickly must Slot-In jobs be responded to?**

- [ ] Within 1 hour
- [ ] Within 2 hours
- [ ] Within 4 hours
- [ ] Same day
- [ ] Other: _______________

**1.2.2 Should the system track response time for Slot-In jobs?**

- [ ] Yes, track time from job creation to technician arrival
- [ ] Yes, track time from customer call to job completion
- [ ] No, response time tracking not needed

**1.2.3 Can a Slot-In job be converted to a regular Repair job if it requires follow-up?**

- [ ] Yes, allow conversion with linked reference
- [ ] No, create a new separate job instead
- [ ] Other: _______________

---

### 1.3 Courier/Collection Jobs

**1.3.1 What items are typically involved in Courier/Collection jobs?**

Select all that apply:
- [ ] Spare parts delivery to customer site
- [ ] Documents/paperwork delivery
- [ ] Pallet truck collection
- [ ] Forklift collection for major repair
- [ ] Other: _______________

**1.3.2 Proof of Delivery (POD) requirements:**

What information must be captured for Courier/Collection jobs?
- [ ] Photo of delivered items
- [ ] Photo of collection items
- [ ] Recipient name
- [ ] Recipient signature
- [ ] Recipient contact number
- [ ] Delivery/collection timestamp
- [ ] GPS location verification
- [ ] Other: _______________

**1.3.3 Can a single Courier job have multiple stops/deliveries?**

- [ ] No, one job = one delivery/collection point
- [ ] Yes, allow multiple stops (please specify maximum): _______________

**1.3.4 Is customer signature required for Courier/Collection jobs?**

- [ ] Yes, always required
- [ ] Yes, but only for collections (not deliveries)
- [ ] No, photo proof is sufficient
- [ ] Optional (technician decides)

---

### 1.4 Job Type Changes

**1.4.1 Can a job type be changed after creation?**

Example: Technician arrives for "Service" but discovers major issue requiring "Repair"

- [ ] Yes, allow job type change at any stage
- [ ] Yes, but only before technician starts the job
- [ ] Yes, but requires Admin approval
- [ ] No, must create a new job with different type

**1.4.2 If job type can be changed, should the system:**

- [ ] Log the change with timestamp and reason
- [ ] Notify Admin when type is changed
- [ ] Require reason/justification for change
- [ ] All of the above

---

### 1.5 Job Type Summary Confirmation

Please confirm the field requirements for each job type:

| Field | Service | Repair | Slot-In | Checking | Courier |
|-------|---------|--------|---------|----------|---------|
| Hourmeter | ✅ | ✅ | ✅ | ✅ | ❌ |
| Condition Checklist | ✅ | ✅ | ✅ | ✅ | ❌ |
| Parts (from Store) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Parts (from Van Stock) | ❌ | ❌ | ✅ | ❌ | ❌ |
| Customer Signature | ✅ | ✅ | ✅ | ✅ | ? |
| Forklift Selection | ✅ | ✅ | ✅ | ✅ | ❌ |
| POD Photo | ❌ | ❌ | ❌ | ❌ | ✅ |

**Is this correct?** 
- [ ] Yes, confirmed
- [ ] No, please see corrections below:

Corrections: _______________________________________________

---

## Section 2: Parts & Inventory Management

### 2.1 Van Stock (Standby Units)

You mentioned each technician should have **50 Standby Units** in their van for emergency jobs.

**2.1.1 Are the 50 SKUs the same for all technicians/vans?**

- [ ] Yes, standard list for all vans
- [ ] No, varies by technician specialty
- [ ] No, varies by branch (Johor vs Penang)
- [ ] Combination - core standard items + some variation

**2.1.2 Please provide the list of 50 standard SKUs (or attach separately):**

You can provide this as:
- [ ] Attached Excel/CSV file
- [ ] Will provide separately
- [ ] List below:

```
Item Code | Item Name | Standard Quantity
----------|-----------|------------------
          |           |
          |           |
          |           |
(attach full list separately if needed)
```

**2.1.3 What is the maximum VALUE of parts a technician can use from Van Stock without approval?**

- [ ] No limit - any amount for emergency jobs
- [ ] RM _______ per job
- [ ] RM _______ per month per technician
- [ ] Other: _______________

---

### 2.2 Van Stock Usage Rules

**2.2.1 Can technicians use Van Stock for SCHEDULED (non-emergency) jobs?**

- [ ] No, strictly blocked - must request from Store
- [ ] Yes, but flagged for review
- [ ] Yes, but requires Admin approval first
- [ ] Yes, with automatic deduction from next requisition

**2.2.2 What if technician needs parts NOT in their Van Stock during an emergency?**

- [ ] Call Admin to arrange emergency delivery
- [ ] Use parts from nearby technician's van
- [ ] Job cannot proceed - reschedule
- [ ] Other: _______________

---

### 2.3 Van Stock Replenishment

**2.3.1 How is Van Stock physically replenished?**

- [ ] Technician returns to warehouse (daily/weekly)
- [ ] Delivery to technician's home/location
- [ ] Exchange at designated meeting point
- [ ] Technician collects from branch office
- [ ] Other: _______________

**2.3.2 When should replenishment happen?**

- [ ] Every morning before shift
- [ ] End of day for next day
- [ ] Weekly on specific day: _______________
- [ ] When stock falls below minimum level
- [ ] Other: _______________

**2.3.3 For the "Auto-Requisition" feature (Slot-In jobs trigger automatic replenishment):**

Who should receive and process the auto-requisition?
- [ ] Admin 2 (Store) only
- [ ] Admin 1 (Service) reviews first, then Admin 2 processes
- [ ] System creates requisition, any Admin can process
- [ ] Other: _______________

---

### 2.4 Van Stock Auditing

**2.4.1 How often should Van Stock be audited/verified?**

- [ ] Daily
- [ ] Weekly
- [ ] Monthly
- [ ] Quarterly
- [ ] Only when discrepancies are suspected

**2.4.2 Who performs the Van Stock audit?**

- [ ] Technician self-reports
- [ ] Admin 2 (Store) conducts physical check
- [ ] Branch supervisor
- [ ] Other: _______________

---

### 2.5 Parts Visibility for Technicians

**2.5.1 What parts information should technicians see in their app?**

Select all that apply:
- [ ] Item name/description
- [ ] Item code/SKU
- [ ] Quantity issued
- [ ] Quantity requested vs. quantity approved
- [ ] Serial numbers (for warranty tracking)
- [ ] Item specifications/notes
- [ ] Nothing - just confirmation that parts were issued

**2.5.2 Should technicians confirm receipt of issued parts?**

- [ ] Yes, must confirm before collecting
- [ ] Yes, with photo of received items
- [ ] No, Admin issuance is final
- [ ] Optional

**2.5.3 If Admin issues wrong parts, can technician flag/reject?**

- [ ] Yes, technician can reject with reason
- [ ] Yes, but must contact Admin by phone first
- [ ] No, must accept and sort out later
- [ ] Other: _______________

---

### 2.6 Parts Installation Recording

**2.6.1 For warranty tracking - who records serial numbers of parts installed?**

- [ ] Technician records in app during installation
- [ ] Admin enters based on issued parts
- [ ] Not tracked at individual serial number level
- [ ] Other: _______________

**2.6.2 Should the system track which specific part (by serial) was installed on which forklift?**

- [ ] Yes, full traceability required
- [ ] Yes, but only for high-value parts (above RM _____)
- [ ] No, not needed

---

## Section 3: Workflow & Approvals

### 3.1 Dual Admin Roles

You specified two Admin roles:
- **Admin 1 (Service):** Technician arrangement, job assignment
- **Admin 2 (Store):** Spare parts response & items approval

**3.1.1 Can one person hold BOTH Admin 1 and Admin 2 roles?**

- [ ] No, must be separate individuals
- [ ] Yes, for smaller branches with limited staff
- [ ] Yes, but should be avoided where possible

**3.1.2 How many Admin 1 and Admin 2 users do you have per branch?**

| Branch | Admin 1 (Service) | Admin 2 (Store) |
|--------|-------------------|-----------------|
| Johor  |                   |                 |
| Penang |                   |                 |

---

### 3.2 Job Completion Flow

You requested: Tech Completes → Admin 2 Confirms Parts → Admin 1 Closes Job

**3.2.1 What if a job has NO parts used?**

- [ ] Skip Admin 2 confirmation, go directly to Admin 1
- [ ] Admin 2 must still confirm "No parts used"
- [ ] System auto-confirms if parts list is empty

**3.2.2 What is the expected timeframe for Admin 2 to confirm parts?**

- [ ] Immediately (same day)
- [ ] Within 24 hours
- [ ] Within 48 hours
- [ ] No specific timeframe

**3.2.3 Should the system send reminders if Admin 2 hasn't confirmed?**

- [ ] Yes, after _____ hours
- [ ] Yes, escalate to supervisor after _____ hours
- [ ] No reminders needed

**3.2.4 Can Admin 1 override and close the job WITHOUT Admin 2 confirmation?**

- [ ] No, never - strict sequential flow
- [ ] Yes, but only with documented reason
- [ ] Yes, for jobs with no parts only
- [ ] Yes, with supervisor approval

---

### 3.3 Slot-In Jobs Parts Confirmation

**3.3.1 For Slot-In jobs using Van Stock (not Store-issued parts):**

Does Admin 2 still need to confirm parts used?
- [ ] Yes, Admin 2 confirms what Van Stock was consumed
- [ ] No, Van Stock usage auto-logged, no confirmation needed
- [ ] Admin 2 only reviews for replenishment, not confirmation

---

### 3.4 Dashboard & Visibility

**3.4.1 Do you need a dedicated dashboard showing jobs "Pending Parts Confirmation"?**

- [ ] Yes, high priority - need to track this
- [ ] Nice to have but not critical
- [ ] No, existing job filters are sufficient

**3.4.2 Should Admin 1 see which jobs are waiting for Admin 2's confirmation?**

- [ ] Yes, with ability to send reminder
- [ ] Yes, view only
- [ ] No, Admin 1 only sees after Admin 2 confirms

---

## Section 4: Technician App Features

### 4.1 Hourmeter Handling

**4.1.1 Is hourmeter reading MANDATORY for applicable job types?**

- [ ] Yes, cannot complete job without hourmeter
- [ ] Yes, but Admin can override if meter is broken
- [ ] Optional - technician enters if available

**4.1.2 Who can approve hourmeter amendments?**

- [ ] Admin 1 (Service) only
- [ ] Admin 2 (Store) only
- [ ] Either Admin 1 or Admin 2
- [ ] Supervisor/Branch Manager only

**4.1.3 Should there be a tolerance threshold for amendments?**

Example: Small corrections (±10 hours) auto-approved, large changes require supervisor

- [ ] No, all amendments need approval regardless of amount
- [ ] Yes, auto-approve changes up to ±_____ hours
- [ ] Yes, changes exceeding ±_____ hours need supervisor approval

**4.1.4 Should the system flag suspicious hourmeter readings?**

Select all that should trigger alerts:
- [ ] Reading lower than last recorded (impossible decrease)
- [ ] Jump of more than _____ hours since last service
- [ ] Reading doesn't match expected usage pattern
- [ ] None - trust technician input

---

### 4.2 Condition Checklist

**4.2.1 For the "Check All" button - should there be a confirmation prompt?**

- [ ] Yes, require confirmation to prevent accidental bulk checking
- [ ] No, single tap to check all
- [ ] Optional - technician can enable/disable in settings

**4.2.2 Are there any checklist items that CANNOT be bulk-checked?**

Example: Safety-critical items that must be individually verified

- [ ] No, all items can be bulk-checked
- [ ] Yes, the following items require individual checking:
  - Item 1: _______________
  - Item 2: _______________
  - Item 3: _______________

---

### 4.3 Request Management

**4.3.1 Can requests (Helper, Parts, Skilled Tech) be edited AFTER Admin has viewed them?**

- [ ] No, once Admin opens the request it's locked
- [ ] Yes, can edit until Admin responds (approve/reject)
- [ ] Yes, can edit anytime with Admin notification
- [ ] Other: _______________

**4.3.2 What fields can technicians edit on their requests?**

Select all that apply:
- [ ] Quantity
- [ ] Item type/selection
- [ ] Urgency level
- [ ] Notes/description
- [ ] Requested time
- [ ] All fields

**4.3.3 Should editing a request reset its position in the queue?**

- [ ] Yes, edited requests go to back of queue
- [ ] No, maintain original position
- [ ] Only if significant changes made

**4.3.4 Is there a limit to how many times a request can be edited?**

- [ ] No limit
- [ ] Maximum _____ edits
- [ ] No edits after first Admin view

---

## Section 5: Photo & Time Tracking

### 5.1 Photo-Based Job Start

**5.1.1 You requested: "Job starts automatically when forklift photo is taken"**

What should the START photo include/show?
- [ ] Full forklift view
- [ ] Forklift serial number/plate clearly visible
- [ ] Hourmeter reading visible in photo
- [ ] GPS location embedded in photo
- [ ] Timestamp overlay on photo
- [ ] Any photo of the forklift is acceptable

**5.1.2 What if the technician takes an incorrect/blurry start photo?**

- [ ] Allow retake, use new photo as start time
- [ ] Allow retake, but keep original start time
- [ ] Cannot retake - must contact Admin
- [ ] Other: _______________

---

### 5.2 Camera & Photo Rules

**5.2.1 You requested: "Photos must be captured live (no gallery access)"**

We need to inform you that **100% gallery blocking is not technically reliable** across all phone models and Android/iOS versions. 

Alternative approaches:
- [ ] **Option A:** Request camera-only, verify photo timestamp matches job time (flag mismatches)
- [ ] **Option B:** Build custom in-app camera (more development time, potential quality issues)
- [ ] **Option C:** Accept that some techs may use gallery, rely on management oversight
- [ ] **Option D:** Other suggestion: _______________

**5.2.2 What action should be taken if photo timestamp doesn't match job time?**

- [ ] Automatically flag for Admin review
- [ ] Block submission, require new photo
- [ ] Allow but add warning note to job record
- [ ] No action, informational only

---

### 5.3 Completion Photo

**5.3.1 What should the COMPLETION photo include/show?**

- [ ] Completed repair/service work
- [ ] Forklift in working condition
- [ ] Before and after comparison
- [ ] No specific requirement
- [ ] Other: _______________

---

### 5.4 Multi-Day Jobs

**5.4.1 For jobs spanning multiple days, how should photo timing work?**

- [ ] Start photo on Day 1, End photo on final day only
- [ ] Start photo each day technician works on it
- [ ] Start photo Day 1, Progress photos daily, End photo final day
- [ ] Other: _______________

---

### 5.5 Reassigned Jobs

**5.5.1 If a job is reassigned to Technician 2:**

- [ ] Tech 2 takes new start photo (new timing starts)
- [ ] Tech 2 continues without new photo (original timing continues)
- [ ] Tech 2 takes "handover" photo but timing continues from Tech 1
- [ ] Other: _______________

---

### 5.6 GPS/Location

**5.6.1 Is GPS/location tagging required for photos?**

- [ ] Yes, mandatory - block photo if GPS unavailable
- [ ] Yes, but allow bypass if GPS fails (with note)
- [ ] Optional - capture if available
- [ ] No, not needed

**5.6.2 Should the system verify technician is at customer location?**

- [ ] Yes, alert if photo location doesn't match customer address
- [ ] Yes, but just log the discrepancy (no blocking)
- [ ] No location verification needed

---

### 5.7 Camera Fallback

**5.7.1 What if technician's phone camera is broken or malfunctioning?**

- [ ] Allow supervisor override to bypass photo requirement
- [ ] Use another technician's phone to take photos
- [ ] Job cannot proceed without photos
- [ ] Text description accepted as fallback (with Admin approval)
- [ ] Other: _______________

---

### 5.8 Job Duration Alerts

**5.8.1 Should the system flag unusually long jobs?**

- [ ] Yes, alert if job exceeds _____ hours for Service
- [ ] Yes, alert if job exceeds _____ hours for Repair
- [ ] Yes, alert if job exceeds _____ hours for Slot-In
- [ ] No duration alerts needed

---

## Section 6: Offline Operations

### 6.1 Offline Requirements Assessment

**6.1.1 Approximately what percentage of job sites have poor/no connectivity?**

- [ ] Less than 10%
- [ ] 10-25%
- [ ] 25-50%
- [ ] More than 50%

**6.1.2 When offline, how long are technicians typically without connection?**

- [ ] Minutes (brief signal loss)
- [ ] 1-2 hours
- [ ] Half day
- [ ] Full day
- [ ] Multiple days

---

### 6.2 Offline Feature Priority

**6.2.1 Which features MUST work offline?**

Rate each: **Essential / Nice-to-have / Not needed**

| Feature | Essential | Nice-to-have | Not needed |
|---------|-----------|--------------|------------|
| View assigned job details | | | |
| Update job status | | | |
| Take and store photos | | | |
| Complete condition checklist | | | |
| Record hourmeter | | | |
| Record time (start/end) | | | |
| Request spare parts | | | |
| Request helper/skilled tech | | | |
| View customer information | | | |
| View forklift history | | | |

---

### 6.3 Offline Sync Behavior

**6.3.1 When offline data syncs, should the system show:**

- [ ] "Pending Sync" indicator until confirmed
- [ ] Automatic sync without notification
- [ ] Summary of what was synced
- [ ] Alert only if sync fails

**6.3.2 For time tracking while offline, which time should be used?**

- [ ] Device time (phone clock)
- [ ] GPS time if available
- [ ] Server time when synced (may differ from actual)
- [ ] Other: _______________

---

### 6.4 Offline Priority Level

**Note:** Full offline capability requires significant development effort (estimated 4-6 weeks additional). 

**6.4.1 How critical is offline mode for your operations?**

- [ ] **Critical** - Many sites have no connectivity, this is essential
- [ ] **Important** - Would improve operations but can work around it
- [ ] **Nice to have** - Rarely an issue, can wait for future update
- [ ] **Not needed** - All our sites have acceptable connectivity

---

## Section 7: Reporting & Visibility

### 7.1 Pricing Visibility

**7.1.1 Should technicians see ANY cost information?**

- [ ] No, completely hidden
- [ ] Yes, show "High-value part" warning (without actual price) for items above RM _____
- [ ] Yes, show estimated job value range only
- [ ] Other: _______________

**7.1.2 For labour charges - should time-based costs be hidden from technicians?**

- [ ] Yes, technicians should not see any cost calculations
- [ ] No, technicians can see their time translated to cost
- [ ] Only show hours worked, not monetary value

---

### 7.2 Customer-Facing Information

**7.2.1 For digital receipts/job summaries shown to customers on-site:**

What should be visible?
- [ ] Parts used (names and quantities)
- [ ] Parts pricing
- [ ] Labour hours
- [ ] Labour charges
- [ ] Total estimated cost
- [ ] Nothing - customer gets paper invoice later

**7.2.2 Can technicians edit/adjust what customers see?**

- [ ] No, fixed format determined by Admin
- [ ] Yes, can add notes/comments only
- [ ] Yes, full control over customer-facing summary

---

## Section 8: Asset Management (Forklift Dashboard)

### 8.1 Fleet Status Categories

**8.1.1 Please confirm the status categories you want to track:**

| Status | Description | Include? |
|--------|-------------|----------|
| Rented Out | Currently with customers | Yes / No |
| In Service | Under maintenance/repair | Yes / No |
| Service Due | Upcoming scheduled maintenance | Yes / No |
| Available | Ready for rental | Yes / No |
| Awaiting Parts | In service, waiting for spares | Yes / No |
| Out of Service | Decommissioned/major repair | Yes / No |
| Reserved | Allocated for upcoming rental | Yes / No |

**Additional statuses needed:** _______________

---

### 8.2 Dashboard Metrics

**8.2.1 What metrics are most important for the Asset Overview Dashboard?**

Rate each: **Must have / Nice to have / Not needed**

| Metric | Must have | Nice to have | Not needed |
|--------|-----------|--------------|------------|
| Total fleet count | | | |
| Utilization rate (% rented) | | | |
| Units by status breakdown | | | |
| Branch comparison (Johor vs Penang) | | | |
| Service due this week | | | |
| Average rental duration | | | |
| Revenue per unit | | | |
| Most/least utilized units | | | |
| Maintenance cost per unit | | | |
| Units by model/type | | | |

---

### 8.3 Contract Management (Future)

**8.3.1 For future contract management, what information needs to be tracked?**

Select all that apply:
- [ ] Contract start/end dates
- [ ] Rental rate (daily/weekly/monthly)
- [ ] Customer information
- [ ] Terms and conditions
- [ ] Auto-renewal settings
- [ ] Billing schedule
- [ ] Deposit amount
- [ ] Insurance details
- [ ] Penalty clauses
- [ ] Other: _______________

---

## Section 9: Additional Requirements

### 9.1 Integration Requirements

**9.2.1 Besides AutoCount, are there other systems that need integration?**

- [ ] GPS fleet tracking system: _______________
- [ ] Customer portal/website
- [ ] Accounting software (other than AutoCount)
- [ ] HR/Payroll system
- [ ] Other: _______________

---

### 9.2 User Access

**9.3.1 How many users will need system access?**

| Role | Johor | Penang | Total |
|------|-------|--------|-------|
| Admin 1 (Service) | | | |
| Admin 2 (Store) | | | |
| Technicians | | | |
| Supervisors | | | |
| Management (view only) | | | |
| Other: _____________ | | | |

---

### 9.3 Priority Ranking

**9.3.1 Please rank these features by implementation priority (1 = highest):**

| Feature | Priority (1-10) |
|---------|-----------------|
| Job Types (Slot-In, Courier) | |
| Van Stock System | |
| Dual Admin Approval | |
| Photo-Based Time Tracking | |
| Asset Dashboard | |
| Offline Mode | |
| Contract Management | |
| AutoCount Integration | |
| Hourmeter Amendment Flow | |
| Request Edit Functionality | |

---

### 9.4 Timeline Expectations

**9.4.1 When do you expect to go live with the system?**

- [ ] As soon as possible (prioritize speed)
- [ ] Within 1 month
- [ ] Within 3 months
- [ ] Within 6 months
- [ ] No fixed deadline

**9.4.2 Would you prefer:**

- [ ] Full system launch (all features at once)
- [ ] Phased rollout (core features first, then additions)
- [ ] Pilot with one branch first, then expand

---

### 9.5 Additional Comments

**Please share any other requirements, concerns, or context that would help us build the right system for ACWER:**

_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________

---

*Thank you for taking the time to complete this questionnaire. Your detailed responses will ensure we deliver a system that perfectly matches your operational needs.*

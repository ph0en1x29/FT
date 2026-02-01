# FieldPro Customer Feedback Implementation Report

**Date:** 19 January 2026  
**Source:** Customer Troubleshooting Report  
**Priority:** High - Pre-launch Requirements

## Executive Summary

Customer feedback identifies critical gaps in notification systems, workflow dependencies, and role-based feature visibility. This document outlines actionable implementation requirements organized by system component.

---

## 1. NOTIFICATION SYSTEM ISSUES

### 1.1 Dashboard Notification Display
- **Current:** Notifications only appear in bell icon dropdown
- **Required:** Display all notifications on dashboard main view

**Implementation:**
- Add notification feed/list component to Dashboard page
- Query notifications table for current user
- Display with timestamp, type, and action buttons
- Consider pagination or "load more" for history

### 1.2 Request Notification Alerts (Sound/Visual)
**Issue:** No sound or visible notification when:
- Technician requests helper or spare part
- Admin accepts/rejects requests

**Required:**
- Pop-up notification for immediate response capability
- Sound and/or vibration support (where browser permits)
- Real-time push via Supabase Realtime

**Implementation:**
- Ensure Supabase Realtime subscription is active on job_requests and notifications tables
- Add browser Notification API integration with permission prompt
- Add audio notification (use Web Audio API or preloaded audio file)
- Toast notifications (Sonner) as fallback

### 1.3 Job Assignment Notifications
**Issue:** When admin assigns request to Technician B:
- No notification sent
- Job doesn't appear in Technician B's app

**Implementation:**
- Verify job_assignments INSERT triggers notification creation
- Check RLS policy allows technician to see assigned jobs
- Add real-time subscription for job_assignments table changes

### 1.4 Real-Time Update Consistency
- **Status:** Previously inconsistent - marked as "solved" in report
- **Action:** Verify fix is deployed and stable, monitor for regressions

---

## 2. ADMIN WORKFLOW REQUIREMENTS

### 2.1 Multi-Admin Simultaneous Access
**Context:** Two admin roles must work concurrently:
- Admin 1 (Service): Technician arrangement, job finalization
- Admin 2 (Store): Spare parts response, items approval

**Issue:** Error occurs when both admins try to verify same job

**Implementation:**
- Add role-specific verification fields to jobs table:
  - `store_verified_at` (timestamp)
  - `store_verified_by` (user_id)
  - `service_verified_at` (timestamp)
  - `service_verified_by` (user_id)
- Update UI to show each admin's verification status
- Allow concurrent verification without conflict

### 2.2 Verification Dependency (CRITICAL)
**Business Rule:** Parts verification must precede service closure

**Flow:**
1. Technician presses "Complete" → Job status = Awaiting Finalization
2. Admin 2 (Store) verifies spare parts used
3. Only after Admin 2 verification → Admin 1 (Service) can finalize job

**Implementation:**
```
IF Admin1 attempts final verification AND store_verified_at IS NULL:
  SHOW validation message: "Store Verification Pending: Admin 2 must approve parts before final service closure."
  BLOCK action
ENDIF
```
- Add database constraint or RPC function check
- Frontend validation before allowing finalize button

### 2.3 Pre-Job Spare Parts Amendment
- **Current:** Admin 2 cannot amend parts until job started
- **Required:** Allow spare parts modification before job starts

**Proposed Workflow:**
1. Admin 1 creates job in advance (e.g., today for tomorrow)
2. Technician reviews job, submits spare parts request (without starting)
3. Admin 2 views request, prepares/amends parts in advance
4. Parts ready when technician arrives next morning

**Implementation:**
- Remove job_status check constraint on job_parts INSERT/UPDATE
- Or add allowed statuses: New, Assigned, In Progress
- Add "Requested Parts" section visible to Admin 2 before job start

---

## 3. TECHNICIAN APP REQUIREMENTS

### 3.1 Condition Checklist Enhancement
**Requirements:**
- [ ] Add "Check All" button (sets all items to ✓)
- [ ] Binary states only: ✓ (OK) or ✗ (Not OK)
- [ ] Auto-set to ✗ when item unticked
- [ ] No neutral/blank states allowed
- [ ] Checklist mandatory before job proceeds
- [ ] Block job progression if any item incomplete

**Implementation:**
- Update checklist component with forced binary state
- Add "Check All" action button
- Validation on job completion: all items must have explicit state
- Database schema: condition_items with status: 'ok' | 'not_ok' (NOT NULL)

### 3.2 Photo-Based Job Start & Time Tracking
- **Current:** Manual job start
- **Required:** Auto-start job when forklift photo taken

**Rules:**
- Job starts automatically on first photo capture
- Time tracking begins at photo timestamp
- Time stops when job completion photo captured
- Photos must be live capture (no gallery access)
- Same logic for helpers and reassigned technicians

**Implementation:**
- Use capture attribute on file input: `<input type="file" accept="image/*" capture="environment">`
- On photo upload → auto-trigger job start if status is Assigned
- Store started_at timestamp from photo metadata or upload time
- Block gallery picker (mobile browsers respect capture attribute)

### 3.3 Request Edit Capability
**Required:** Add Edit button to submitted requests for:
- Assistant/Helper requests
- Spare Parts requests
- Skilled Technician requests

**Implementation:**
- Add job_requests UPDATE RLS policy for request owner
- Add "Edit" icon/button on pending request cards
- Allow amendment until request is approved/rejected

### 3.4 Remove Pricing from Technician View
**Remove from technician app:**
- Extra charges section
- All pricing/cost information
- Parts pricing in job summary

**Show only:**
- Parts used (names and quantities)
- Items approved by Admin 2

**Implementation:**
- Add role check in JobSummary component
- Filter out price-related fields for technician role
- Update API responses to exclude pricing for technician role

### 3.5 Parts Usage Control
- **Current:** Technicians can add parts
- **Required:** Remove "Parts Used" entry from technician app

**New Flow:**
1. Technician requests parts
2. Admin 2 creates/issues parts record
3. Technician sees only Admin-approved parts in summary

**Implementation:**
- Remove AddPartsUsed component from technician view
- Update job completion flow to show read-only parts list
- Parts reflect job_parts entries created/approved by Admin 2

### 3.6 Hourmeter Handling
**Rules:**
- First assigned technician records hourmeter
- On reassignment, hourmeter value persists
- Second technician does NOT re-enter hourmeter
- Add amendment button for authorized corrections

**Implementation:**
- Store hourmeter_reading at job level (not per assignment)
- Set on first technician's job start
- Make field read-only for subsequent assignees
- Add "Amend Hourmeter" button with confirmation modal
- Log amendments in audit table

---

## 4. DATABASE CHANGES REQUIRED

### New/Modified Fields
```sql
-- Jobs table additions
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS store_verified_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS store_verified_by UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_verified_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_verified_by UUID REFERENCES users(id);

-- Condition checklist enforcement
-- Ensure condition_items.status is NOT NULL with CHECK constraint
```

### RLS Policy Updates
- Allow Admin 2 to INSERT/UPDATE job_parts for jobs in New, Assigned status
- Allow technicians to UPDATE their own job_requests

---

## 5. IMPLEMENTATION PRIORITY

### Phase 1 - Critical (Blocking Launch)
1. Verification dependency (2.2) - prevents workflow errors
2. Real-time notifications (1.2, 1.3) - core functionality
3. Photo-based job start (3.2) - time tracking accuracy

### Phase 2 - High Priority
4. Condition checklist binary states (3.1)
5. Remove pricing from technician view (3.4)
6. Dashboard notification display (1.1)

### Phase 3 - Improvements
7. Pre-job parts amendment (2.3)
8. Request edit capability (3.3)
9. Hourmeter persistence logic (3.6)
10. Parts usage control flow (3.5)

---

## 6. TESTING CHECKLIST

- [ ] Admin 1 cannot finalize without Admin 2 store verification
- [ ] Both admins can verify same job without conflicts
- [ ] Technician receives pop-up + sound on assignment
- [ ] Admin receives notification on helper/parts request
- [ ] Photo capture auto-starts job timer
- [ ] Gallery access blocked on photo capture
- [ ] Checklist blocks completion if any item undefined
- [ ] Technician cannot see pricing anywhere
- [ ] Hourmeter persists through job reassignment
- [ ] Pre-job parts requests visible to Admin 2

---

## Notes for Development

- Project uses React/TypeScript with Supabase backend
- Notifications use Sonner toast library
- Real-time via Supabase Realtime channels
- Follow existing patterns in codebase
- All database changes need idempotent migrations
- Update CHANGELOG.md after implementation
- Malaysia timezone (UTC+8) for all timestamps

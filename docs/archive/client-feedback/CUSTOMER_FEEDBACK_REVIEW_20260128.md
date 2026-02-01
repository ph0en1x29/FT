# Customer Feedback Review Report
**Date:** 2026-01-28
**Reviewer:** Phoenix/Clawdbot
**Source:** Troubleshooting Report / Issues Observed [19/01/2025]

---

## Executive Summary

Total Issues: **15 categories**
- ✅ Already Implemented: 1
- 🔶 Partially Implemented: 4
- ❌ Not Implemented: 10

---

## Issue Analysis

### 1. Dashboard Notifications
**Status:** 🔶 Partially Implemented

**Current:** Notifications appear on bell icon (`NotificationBell.tsx`)
**Requested:** All notifications should be listed on dashboard

**Files Involved:**
- `components/NotificationBell.tsx`
- `components/DashboardNotificationCard.tsx`
- `components/NotificationPanel.tsx`

**Fix Required:**
- Expand `DashboardNotificationCard.tsx` to show full notification list
- Add notification feed section to role dashboards
- **Effort:** Medium (2-3 hours)

---

### 2. Notification Alerts for Requests
**Status:** ❌ Not Implemented

**Issues:**
- No sound/visible notification when technician requests helper or spare part
- No notification when admin accepts/rejects
- No notification when admin assigns to another technician
- No pop-up notifications

**Requested:**
- Pop-up notifications for immediate response
- Sound and/or vibration support

**Fix Required:**
- Implement push notification system (Web Push API or Firebase)
- Add real-time subscription for request status changes
- Add browser notification permissions
- **Effort:** High (8-12 hours)

---

### 3. Real-Time Updates on Technician App
**Status:** 🔶 Partially Implemented

**Current:** Updates are inconsistent
**Requested:** On-the-spot updates when admin approves

**Fix Required:**
- Implement Supabase real-time subscriptions for job updates
- Add optimistic UI updates
- WebSocket connection health monitoring
- **Effort:** Medium (4-6 hours)

---

### 4. Admin Access (Admin 1 & Admin 2 Simultaneous)
**Status:** 🔶 Partially Implemented

**Current:** Error occurs even when both admins verified
**Requested:** Admin 1 (Service) and Admin 2 (Store) must view/respond simultaneously

**Fix Required:**
- Review permission logic for concurrent access
- Add role-based action separation
- Fix race condition issues
- **Effort:** Medium (3-4 hours)

---

### 5. Job Completion & Approval Flow (Verification Dependency)
**Status:** ❌ Not Implemented

**Requested Flow:**
1. Technician presses "Complete"
2. Admin 2 (Store) verifies spare parts
3. Only after Admin 2 verification → Admin 1 (Service) can finalize

**Business Logic:**
```
IF Admin1_Attempts_Finalize AND Admin2_Parts_Verified = FALSE:
    SHOW "Store Verification Pending: Admin 2 must approve parts before final service closure"
```

**Fix Required:**
- Add `admin2_parts_verified` boolean to jobs table
- Add verification step in job completion flow
- Block Admin 1 finalization until Admin 2 verified
- **Effort:** High (6-8 hours)

---

### 6. Spare Parts Before Job Start
**Status:** ✅ IMPLEMENTED (2026-01-28)

**Commit:** `398d56c feat: Allow spare parts recording before job starts`

Admin 2 can now amend spare parts even if technician hasn't started the job.

---

### 7. Condition Checklist Enhancement
**Status:** ❌ Not Implemented

**Requested:**
- "Check All" button
- Only two states: ✓ Tick (OK) or ✗ Cross (Not OK)
- Unticked = automatic Cross
- No blank/neutral states
- Mandatory before job proceeds

**Files Involved:**
- `pages/JobDetail.tsx` (checklist section)

**Fix Required:**
- Add "Check All" button
- Change checklist logic to binary (OK/Not OK)
- Add validation blocking job start if incomplete
- **Effort:** Medium (3-4 hours)

---

### 8. Job Start & Time Tracking (Photo-Based)
**Status:** ❌ Not Implemented

**Requested:**
- Job starts automatically when forklift photo taken
- Live photos only (no gallery access)
- Timer starts from photo metadata timestamp
- Timer stops when completion photo captured
- Same logic for helpers/reassigned technicians

**Fix Required:**
- Implement camera-only photo capture (disable gallery)
- Auto-start job on photo capture
- Extract timestamp from photo metadata
- Auto-stop on completion photo
- **Effort:** High (8-10 hours)

---

### 9. Request Management (Edit Button)
**Status:** ❌ Not Implemented

**Requested:**
- Edit button for Assistant, Spare Parts, Skilled Technician requests
- Allow amendments, corrections, additional requests

**Files Involved:**
- `pages/JobDetail.tsx` (Requests section)

**Fix Required:**
- Add edit functionality to existing request cards
- Update modal to support edit mode
- **Effort:** Low (2-3 hours)

---

### 10. Charges & Pricing Visibility (Tech App)
**Status:** ❌ Not Implemented

**Requested:**
- Remove extra charges from technician's view
- Job summary should exclude pricing (only show parts used)

**Fix Required:**
- Add role-based conditional rendering
- Hide `sell_price`, `totalPartsCost` from technician role
- **Effort:** Low (1-2 hours)

---

### 11. Parts Usage Control
**Status:** ❌ Not Implemented

**Requested:**
- Remove "Parts Used" entry from technician app
- Parts records created/issued by Admin only upon technician request

**Current:** Technicians can add parts directly

**Fix Required:**
- Modify `canAddParts` to exclude technicians completely
- Parts only via request → approval flow
- **Effort:** Low (1-2 hours)

---

### 12. Technician Job Summary
**Status:** 🔶 Partially Implemented

**Requested:**
- Show all items used
- NO pricing shown
- Only parts confirmed by Admin 2 visible

**Fix Required:**
- Filter summary to show only Admin 2 approved parts
- Hide pricing columns for technician role
- **Effort:** Low (2 hours)

---

### 13. Hourmeter Handling
**Status:** ❌ Not Implemented

**Requested:**
- First technician records hourmeter
- Reassigned technician keeps original value (no re-entry)
- Amendment button for corrections

**Fix Required:**
- Add `hourmeter_recorded_by` field
- Lock hourmeter for reassigned technicians
- Add amendment button with audit trail
- **Effort:** Medium (3-4 hours)

---

### 14. On-Call Job Acceptance & Rejection
**Status:** ❌ Not Implemented

**Requested:**
- 15-minute response window
- Accept button → moves to active list
- Reject button → requires reason, goes to Admin for reassignment
- No response → "No Response" alert to Admin after 15 min

**Fix Required:**
- Add `response_deadline` field to job assignments
- Add Accept/Reject UI with reason input
- Background job for timeout monitoring
- Admin notification for no-response
- **Effort:** High (6-8 hours)

---

### 15. Job Deletion Sync
**Status:** ❌ Not Implemented

**Issue:** Deleted jobs remain active in Technician App

**Fix Required:**
- Implement real-time subscription for job deletions
- Add soft delete with status sync
- Force refresh on job list when deletion detected
- **Effort:** Medium (2-3 hours)

---

## Priority Recommendations

### Immediate (Critical for Operations)
1. **Job Completion & Approval Flow** - Verification dependency
2. **Notification Alerts** - Real-time push notifications
3. **On-Call Job Acceptance** - 15-min response system
4. **Job Deletion Sync** - Data consistency

### High Priority (User Experience)
5. **Charges & Pricing Visibility** - Hide from technicians
6. **Parts Usage Control** - Admin-only parts entry
7. **Real-Time Updates** - Supabase subscriptions
8. **Condition Checklist** - Binary states + validation

### Medium Priority (Enhancement)
9. **Request Management Edit** - Edit button
10. **Hourmeter Handling** - First-tech-only
11. **Dashboard Notifications** - Full list on dashboard
12. **Technician Job Summary** - Filtered view

### Lower Priority (Future)
13. **Photo-Based Time Tracking** - Major feature
14. **Mobile Stock Integration** - New system

---

## Estimated Total Effort

| Priority | Items | Effort |
|----------|-------|--------|
| Immediate | 4 | 20-30 hours |
| High | 4 | 10-14 hours |
| Medium | 4 | 10-13 hours |
| Lower | 2 | 12-16 hours |
| **Total** | **14** | **52-73 hours** |

---

## Next Steps

1. Review this report
2. Prioritize based on client urgency
3. Create implementation plan
4. Start with Immediate priority items

---

*Report generated by Phoenix/Clawdbot*

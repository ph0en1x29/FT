# Photo-Based Job Start & Time Tracking Implementation Plan

**Date:** 2026-01-28  
**Priority:** HIGH  
**Source:** Customer Request

---

## Customer Requirements

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Job starts automatically when forklift photo taken | ✅ Implemented |
| 2 | Photos must be captured live (no gallery access) | ✅ Implemented (`capture="environment"`) |
| 3 | Same logic for helpers/reassigned technicians | ✅ Implemented (helpers excluded from timer control) |
| 4 | Timer starts on photo, stops on completion photo | ✅ Implemented ("After" category stops timer) |

**Implementation Date:** 2026-01-28

---

## Current Implementation Analysis

### What's Working ✅

```typescript
// JobDetail.tsx:1099-1127
const isFirstPhoto = job.media.length === 0;
const shouldAutoStart = isFirstPhoto && !job.repair_start_time && !job.started_at;

if (shouldAutoStart) {
  mediaData.is_start_photo = true;
  // Auto-start job timer
  await MockDb.updateJob(job.job_id, {
    repair_start_time: now,
    started_at: now,
    status: JobStatus.IN_PROGRESS,
  });
}
```

### What's Missing ❌

1. **No camera-only enforcement**
   ```html
   <!-- Current -->
   <input type="file" accept="image/*" />
   
   <!-- Needed -->
   <input type="file" accept="image/*" capture="environment" />
   ```

2. **No timer stop on completion photo**

3. **Helper photo affects timer** (shouldn't)

4. **Reassigned tech can restart timer** (shouldn't)

---

## Implementation Plan

### Phase 1: Camera-Only Capture (30 min)

**Goal:** Force live camera capture, block gallery access

**Changes:**

```typescript
// JobDetail.tsx - Update all file inputs
<input 
  type="file" 
  accept="image/*" 
  capture="environment"  // ← Add this
  className="hidden" 
  onChange={handlePhotoUpload} 
/>
```

**Note:** `capture="environment"` uses rear camera (for forklift photos). Use `capture="user"` for selfie/front camera.

**Browser Support:**
- ✅ Chrome Android
- ✅ Safari iOS
- ⚠️ Desktop browsers will show file picker (acceptable fallback)

**Limitation:** Some Android browsers still allow gallery. For strict enforcement, need custom camera UI with `getUserMedia()` API (Phase 2 enhancement).

---

### Phase 2: Completion Photo Stops Timer (1-2 hours)

**Goal:** When technician uploads "After" category photo, auto-stop timer

**Logic:**
```typescript
// In uploadPhotoFile function
const uploadPhotoFile = async (file: File) => {
  // ... existing code ...
  
  // Check if this is completion photo
  const isCompletionPhoto = uploadPhotoCategory === 'after';
  const shouldAutoStop = isCompletionPhoto && job.repair_start_time && !job.repair_end_time;
  
  if (shouldAutoStop) {
    mediaData.is_completion_photo = true;
  }
  
  // After saving media...
  if (shouldAutoStop) {
    await MockDb.updateJob(job.job_id, {
      repair_end_time: now,
    });
    showToast.info('Timer stopped', 'Completion photo captured');
  }
};
```

**UI Update:**
- Add visual indicator when timer is running
- Show "Take completion photo to stop timer" hint
- Highlight "After" category when timer is running

---

### Phase 3: Helper Technician Logic (1 hour)

**Goal:** Helper photos should NOT affect timer

**Current Issue:**
```typescript
// Helper can trigger auto-start (wrong)
const shouldAutoStart = isFirstPhoto && !job.repair_start_time;
```

**Fix:**
```typescript
// Only lead technician can start/stop timer
const isLeadTechnician = job.assigned_technician_id === currentUserId;
const isHelperPhoto = isCurrentUserHelper;

// Auto-start only for lead tech's first photo
const shouldAutoStart = isFirstPhoto && 
                        !job.repair_start_time && 
                        !job.started_at && 
                        isLeadTechnician &&
                        !isHelperPhoto;

// Auto-stop only for lead tech's completion photo
const shouldAutoStop = isCompletionPhoto && 
                       job.repair_start_time && 
                       !job.repair_end_time &&
                       isLeadTechnician &&
                       !isHelperPhoto;
```

---

### Phase 4: Reassigned Technician Logic (1 hour)

**Goal:** Reassigned tech continues existing timer, doesn't restart

**Scenarios:**

| Scenario | Expected Behavior |
|----------|-------------------|
| Tech A starts job, takes photo | Timer starts |
| Job reassigned to Tech B | Timer continues (no restart) |
| Tech B takes "After" photo | Timer stops |
| Tech A had started, Tech B takes first photo | Timer continues (already started) |

**Current Code:** Already handles this correctly because:
```typescript
const shouldAutoStart = isFirstPhoto && !job.repair_start_time && !job.started_at;
//                                       ↑ Only if NOT already started
```

**Enhancement:** Add audit trail for who started/stopped timer

```typescript
// Database fields to add
repair_started_by_id: string;
repair_started_by_name: string;
repair_ended_by_id: string;
repair_ended_by_name: string;
```

---

## Database Changes

```sql
-- Add timer audit fields to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS repair_started_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS repair_started_by_name TEXT,
ADD COLUMN IF NOT EXISTS repair_ended_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS repair_ended_by_name TEXT;

-- Add completion photo tracking to job_media
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS is_completion_photo BOOLEAN DEFAULT FALSE;
```

---

## UI Changes

### 1. Photo Upload Section

```
┌─────────────────────────────────────────────────┐
│ 📷 Photos                          [ZIP] ▼After │
├─────────────────────────────────────────────────┤
│ ⏱️ Timer running: 2h 34m                        │
│                                                 │
│ [All(2)] [Before(2)] [After(0)] ← Highlighted   │
│                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────────────────┐│
│ │ Before  │ │ Before  │ │ 📸 Take completion  ││
│ │  📷     │ │  📷     │ │   photo to stop     ││
│ └─────────┘ └─────────┘ │   timer             ││
│                         └─────────────────────┘│
└─────────────────────────────────────────────────┘
```

### 2. Timer Display Enhancement

```typescript
// Show who started the timer
<p className="text-xs text-[var(--text-muted)]">
  Started by: {job.repair_started_by_name || job.assigned_technician_name}
</p>
```

---

## Implementation Order

| Order | Task | Effort | Impact |
|-------|------|--------|--------|
| 1 | Add `capture="environment"` | 30 min | Enforces camera |
| 2 | Completion photo stops timer | 1-2 hrs | Core feature |
| 3 | Helper photo exclusion | 1 hr | Correctness |
| 4 | Audit fields (who started/stopped) | 30 min | Traceability |
| 5 | UI hints for completion photo | 30 min | UX improvement |

**Total Estimated Effort:** 4-5 hours

---

## Testing Checklist

### Camera Capture
- [ ] Mobile: Opens camera directly (not gallery)
- [ ] Desktop: Falls back to file picker
- [ ] Photo metadata (timestamp, GPS) captured

### Timer Start
- [ ] First photo by lead tech starts timer
- [ ] First photo by helper does NOT start timer
- [ ] Reassigned tech's first photo does NOT restart timer

### Timer Stop
- [ ] "After" photo by lead tech stops timer
- [ ] "After" photo by helper does NOT stop timer
- [ ] Timer shows correct duration

### Edge Cases
- [ ] Job with no photos → Complete button requires photos
- [ ] Job reassigned mid-timer → Timer continues
- [ ] Multiple "After" photos → Only first stops timer

---

## Code Snippets Ready to Implement

### 1. Camera-Only Input (Quick Fix)

```typescript
// JobDetail.tsx - Line ~2346 and ~2396
// Change from:
<input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

// To:
<input 
  type="file" 
  accept="image/*" 
  capture="environment"
  className="hidden" 
  onChange={handlePhotoUpload} 
/>
```

### 2. Completion Photo Logic

```typescript
// Add to uploadPhotoFile function after line ~1099
const isCompletionPhoto = uploadPhotoCategory === 'after';
const isLeadTechnician = job.assigned_technician_id === currentUserId;
const shouldAutoStop = isCompletionPhoto && 
                       job.repair_start_time && 
                       !job.repair_end_time &&
                       isLeadTechnician &&
                       !isCurrentUserHelper;

// In the reader.onloadend callback, after saving media:
if (shouldAutoStop) {
  const endTime = new Date().toISOString();
  await MockDb.updateJob(job.job_id, {
    repair_end_time: endTime,
  });
  showToast.info('Timer stopped', 'Completion photo captured');
}
```

---

## Notes for Development

1. **`capture` attribute behavior varies by browser** — Test on actual devices
2. **Gallery blocking is not 100%** — Some browsers ignore `capture`. For strict enforcement, need custom camera UI.
3. **Timer precision** — Consider timezone handling (Malaysia UTC+8)
4. **Photo categories** — "After" is the trigger for timer stop. Could also add explicit "Completion" category.

---

*Report generated by Phoenix/Clawdbot*

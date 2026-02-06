# FieldPro Database Query Audit Report

**Generated:** 2026-02-06  
**Audited by:** Phoenix (OpenClaw Subagent)  
**Codebase:** /home/jay/FT

---

## Executive Summary

Overall, the FieldPro codebase demonstrates **good query practices** with several optimizations already in place:
- ✅ Query profiles for selective column fetching
- ✅ React Query caching with appropriate stale times
- ✅ Parallel queries replacing massive JOINs
- ✅ Lightweight data fetching variants
- ✅ Core performance indexes created

However, there are **opportunities for improvement** in:
- 🔶 N+1 patterns in notification loops
- 🔶 Missing indexes on frequently filtered columns
- 🔶 Unbounded queries on admin pages
- 🔶 Some RPC functions could be consolidated

**Risk Level:** LOW-MEDIUM  
**Estimated Performance Gain:** 15-30% on affected queries

---

## 1. N+1 Query Patterns

### 🔴 CRITICAL: Notification Creation Loops

**Location:** `/services/notificationService.ts`

```typescript
// notifyPendingFinalization() - Lines 90-115
for (const user of usersToNotify) {
  await createNotification({...});  // ❌ N queries for N users
}

// notifyAdminsOfRequest() - Lines 125-150
for (const admin of admins) {
  await createNotification({...});  // ❌ N queries for N admins
}
```

**Impact:** 5-15 individual INSERT queries per notification event.

**Recommendation:** Use batch insert:
```typescript
// services/notificationService.ts - RECOMMENDED FIX
export const createNotificationsBatch = async (notifications: Partial<Notification>[]): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert(notifications.map(n => ({
        user_id: n.user_id,
        type: n.type,
        title: n.title,
        message: n.message,
        reference_type: n.reference_type,
        reference_id: n.reference_id,
        priority: n.priority || 'normal',
      })));

    return !error;
  } catch (e) {
    return false;
  }
};

// Usage:
export const notifyAdminsOfRequest = async (...) => {
  const admins = await getAdminsAndSupervisors();
  const notifications = admins.map(admin => ({
    user_id: admin.user_id,
    type: type,
    title: title,
    message: message,
    reference_type: 'job',
    reference_id: jobId,
    priority: ...,
  }));
  await createNotificationsBatch(notifications);
};
```

### 🟡 MEDIUM: Service Check Loop

**Location:** `/services/hourmeterService.ts` - `runDailyServiceCheck()`

```typescript
for (const forklift of dueForklifts) {
  // Query to check existing jobs
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('job_id')
    .eq('forklift_id', forklift.forklift_id)...  // ❌ N queries
  
  // Insert job
  await supabase.from('jobs').insert({...});     // ❌ N inserts
  
  // Insert notification  
  await supabase.from('notifications').insert({...}); // ❌ N inserts
}
```

**Impact:** Up to 3N queries for N forklifts due for service.

**Recommendation:** Create an RPC function that handles batch operations:
```sql
-- New RPC function
CREATE OR REPLACE FUNCTION run_daily_service_check()
RETURNS TABLE(jobs_created INT, notifications_created INT) AS $$
DECLARE
  -- Batch processing logic
BEGIN
  -- Single query to get forklifts without open service jobs
  -- Batch insert jobs
  -- Batch insert notifications
END;
$$ LANGUAGE plpgsql;
```

---

## 2. Missing Indexes Analysis

### 🔴 HIGH PRIORITY: `jobs.deleted_at`

**Evidence:** Every job query includes `.is('deleted_at', null)`
```typescript
// Found in: jobService.ts, getJobs(), getJobsLightweight(), getJobById(), etc.
.is('deleted_at', null)
```

**Recommendation:**
```sql
-- Add to migrations
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at 
  ON jobs(deleted_at) 
  WHERE deleted_at IS NULL;
```
**Expected improvement:** 40-60% on job list queries.

### 🟡 MEDIUM PRIORITY: `job_requests.status`

**Evidence:** Filtered in `getPendingRequests()`, `getJobRequests()`
```typescript
.eq('status', 'pending')
```

**Current:** No dedicated index found.

**Recommendation:**
```sql
CREATE INDEX IF NOT EXISTS idx_job_requests_status 
  ON job_requests(status) 
  WHERE status = 'pending';
```

### 🟡 MEDIUM PRIORITY: `job_assignments` composite

**Evidence:** Helper queries filter by job_id + assignment_type + is_active
```typescript
.eq('job_id', jobId)
.eq('assignment_type', 'assistant')
.eq('is_active', true)
```

**Recommendation:**
```sql
CREATE INDEX IF NOT EXISTS idx_job_assignments_active_helpers
  ON job_assignments(job_id, assignment_type, is_active)
  WHERE assignment_type = 'assistant' AND is_active = true;
```

### 🟢 LOW PRIORITY (Nice to have)

```sql
-- For forklift rental lookups
CREATE INDEX IF NOT EXISTS idx_forklift_rentals_active
  ON forklift_rentals(forklift_id, status)
  WHERE status = 'active';

-- For extra charges by job
CREATE INDEX IF NOT EXISTS idx_extra_charges_job
  ON extra_charges(job_id);
```

---

## 3. Large Table Scans Without LIMIT

### 🔴 HIGH: Admin Data Fetches

These queries fetch ALL records and should have pagination or limits:

| Function | Location | Issue |
|----------|----------|-------|
| `getParts()` | inventoryService.ts | Fetches all parts |
| `getCustomers()` | customerService.ts | Fetches all customers |
| `getForklifts()` | forkliftService.ts | Fetches all forklifts |
| `getUsers()` | userService.ts | Fetches all users |

**Current code:**
```typescript
export const getParts = async (): Promise<Part[]> => {
  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .order('category')
    .order('part_name');  // ❌ No LIMIT
```

**Recommendation:** Add pagination or default limits:
```typescript
export const getParts = async (options?: { limit?: number; offset?: number }): Promise<{
  data: Part[];
  total: number;
}> => {
  const limit = options?.limit || 100;
  const offset = options?.offset || 0;
  
  const { data, count, error } = await supabase
    .from('parts')
    .select('*', { count: 'exact' })
    .order('category')
    .order('part_name')
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return { data: data as Part[], total: count || 0 };
};
```

**Note:** The lightweight variants (`getPartsForList`, `getCustomersForList`, etc.) are correctly used in dropdowns and fetch minimal columns. The full-fetch versions are used in admin pages where pagination should be added.

---

## 4. Query Optimization Opportunities

### ✅ GOOD: Parallel Queries in `getJobByIdFast`

Already optimized with `Promise.all()`:
```typescript
const [jobResult, partsResult, mediaResult, chargesResult, helperResult] = await Promise.all([
  jobPromise,
  partsPromise,
  mediaPromise,
  chargesPromise,
  helperPromise
]);
```
**Performance:** Reduced from ~2s to ~200-400ms. ✅

### ✅ GOOD: Query Profiles

`JOB_SELECT` profiles reduce payload significantly:
- LIST: ~500 bytes vs ~10KB per job
- BOARD: Essential fields for job board
- DETAIL: Full data only when needed

### 🟡 OPTIMIZE: `getCustomerFinancialSummary()`

**Location:** `/services/customerService.ts`

Makes 2 sequential queries:
```typescript
const { data: rentals } = await supabase
  .from('forklift_rentals')
  .select(...)
  .eq('customer_id', customerId);

const { data: jobs } = await supabase
  .from('jobs')
  .select(...)
  .eq('customer_id', customerId);
```

**Recommendation:** Parallelize:
```typescript
const [rentalsResult, jobsResult] = await Promise.all([
  supabase.from('forklift_rentals').select(...).eq('customer_id', customerId),
  supabase.from('jobs').select(...).eq('customer_id', customerId),
]);
```

---

## 5. RPC Functions Review

### Current RPC Functions Used:
| Function | Purpose | Status |
|----------|---------|--------|
| `prepare_user_creation` | User creation step 1 | ✅ Good |
| `complete_user_creation` | User creation step 2 | ✅ Good |
| `reserve_part_stock` | Atomic stock reservation | ✅ Good |
| `rollback_part_stock` | Stock rollback | ✅ Good |
| `calculate_predicted_service_date` | Service prediction | ✅ Good |
| `complete_forklift_service` | Service completion | ✅ Good |
| `get_forklift_daily_usage` | Usage calculation | ✅ Good |
| `complete_full_service` | Full service workflow | ✅ Good |

### 🟡 SUGGESTED: New RPC for Batch Notifications

```sql
CREATE OR REPLACE FUNCTION create_notifications_batch(
  p_notifications JSONB
)
RETURNS INT AS $$
DECLARE
  inserted_count INT;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, priority)
  SELECT 
    (item->>'user_id')::UUID,
    item->>'type',
    item->>'title',
    item->>'message',
    item->>'reference_type',
    (item->>'reference_id')::UUID,
    COALESCE(item->>'priority', 'normal')
  FROM jsonb_array_elements(p_notifications) AS item;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. React Query Caching Review

### ✅ Current Caching Strategy (Good)

| Hook | Stale Time | Purpose |
|------|------------|---------|
| `useCustomersForList` | 2 min | Dropdown data |
| `useForkliftsForList` | 2 min | Dropdown data |
| `useTechnicians` | 5 min | Rarely changes |
| `usePartsForList` | 5 min | Rarely changes |
| `useJobFast` | 30 sec | Job details |
| `useNotificationCount` | 10 sec | Needs freshness |
| `useJobsLightweight` | 30 sec | Dashboard lists |

### 🟡 SUGGESTION: Add Query Prefetching

For better UX on job detail pages:
```typescript
// In job list component - prefetch on hover
const queryClient = useQueryClient();

const prefetchJob = (jobId: string) => {
  queryClient.prefetchQuery({
    queryKey: queryKeys.jobFast(jobId),
    queryFn: () => SupabaseDb.getJobByIdFast(jobId),
  });
};
```

---

## 7. Realtime Subscription Efficiency

### ✅ GOOD: Single Channel per User

```typescript
// utils/useRealtimeNotifications.ts
const channelName = `fieldpro-notifications-${currentUser.user_id}`;
```
Properly uses a stable channel name based on user ID.

### ✅ GOOD: Targeted Filters

```typescript
filter: `user_id=eq.${currentUser.user_id}`,
filter: `assigned_technician_id=eq.${currentUser.user_id}`,
```
Filters reduce message volume to relevant updates only.

---

## 8. Priority Action Items

### Immediate (This Week)
1. **Add `idx_jobs_deleted_at` index** - High impact, low effort
2. **Implement batch notification creation** - Eliminates N+1 pattern

### Short-term (Next Sprint)
1. **Add pagination to admin data fetches** - Prevents future scaling issues
2. **Create `idx_job_requests_status` index**
3. **Parallelize `getCustomerFinancialSummary`**

### Medium-term (Backlog)
1. **Create RPC for daily service check** - Consolidate batch operations
2. **Add query prefetching** - UX improvement
3. **Review index usage with `EXPLAIN ANALYZE`** - Validate recommendations

---

## 9. Migration Script: Priority Indexes

```sql
-- File: 20260206_query_optimization_indexes.sql

-- HIGH PRIORITY: Jobs soft-delete filter
CREATE INDEX IF NOT EXISTS idx_jobs_active 
  ON jobs(deleted_at) 
  WHERE deleted_at IS NULL;

-- MEDIUM: Job requests pending status
CREATE INDEX IF NOT EXISTS idx_job_requests_pending
  ON job_requests(status)
  WHERE status = 'pending';

-- MEDIUM: Active helper assignments lookup
CREATE INDEX IF NOT EXISTS idx_job_assignments_active_helpers
  ON job_assignments(job_id)
  WHERE assignment_type = 'assistant' AND is_active = true;

-- LOW: Extra charges by job
CREATE INDEX IF NOT EXISTS idx_extra_charges_job
  ON extra_charges(job_id);

-- LOW: Active forklift rentals
CREATE INDEX IF NOT EXISTS idx_forklift_rentals_active_lookup
  ON forklift_rentals(forklift_id)
  WHERE status = 'active';

-- Analyze tables after index creation
ANALYZE jobs;
ANALYZE job_requests;
ANALYZE job_assignments;
ANALYZE extra_charges;
ANALYZE forklift_rentals;
```

---

## 10. Conclusion

The FieldPro codebase shows evidence of thoughtful performance optimization:

**Strengths:**
- Query profiles reduce data transfer by ~80%
- Parallel queries replaced N+1 in job detail fetching
- React Query caching is well-configured
- Core indexes already exist for common filters

**Areas for Improvement:**
- Notification loops create N+1 patterns
- Some admin pages lack pagination
- A few missing indexes on filtered columns

**Recommended Next Steps:**
1. Apply the priority index migration
2. Refactor notification creation to batch operations
3. Add pagination to unbounded admin queries
4. Monitor query performance with Supabase Dashboard

---

*Report generated by Phoenix for FieldPro project audit.*

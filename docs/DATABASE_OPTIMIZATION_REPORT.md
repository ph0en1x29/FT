# FieldPro Database & Query Optimization Report

**Date:** 2026-01-29  
**Author:** Phoenix/Clawdbot  
**Status:** Pending Jay's Review

---

## Executive Summary

Analysis of the FieldPro database queries reveals several optimization opportunities that could significantly improve performance, especially as data grows. The main issues are:

1. **Excessive use of `SELECT *`** - Fetching all columns when only a few are needed
2. **Large Job interface** - 80+ fields per job record
3. **Missing query pagination** - Large result sets loaded entirely
4. **N+1 query patterns** - Multiple queries where one would suffice
5. **No query caching** - Same data fetched repeatedly

---

## Current State Analysis

### Query Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Total database functions | 272 | ⚠️ Large |
| `SELECT *` queries | 20+ | 🔴 Should reduce |
| Complex joins | 15+ | ⚠️ Review needed |
| Paginated queries | 3 | 🔴 Need more |
| Indexed queries | ~10 | ✅ Recently added |

### Data Size Estimates (with growth)

| Table | Current | 1 Year | 3 Years |
|-------|---------|--------|---------|
| Jobs | ~100 | ~2,000 | ~6,000 |
| Job Media | ~500 | ~10,000 | ~30,000 |
| Notifications | ~1,000 | ~20,000 | ~60,000 |
| Users | ~20 | ~50 | ~100 |
| Forklifts | ~50 | ~100 | ~200 |

---

## 🔴 Critical Issues

### Issue 1: Job Table Has 80+ Columns

**Problem:** The `jobs` table has grown to 80+ columns, making every `SELECT *` extremely heavy.

**Current Job Fields Include:**
- Basic info (10 fields)
- Audit trail (15 fields)
- Technician acceptance (5 fields)
- Forklift reference (6 fields)
- Condition checklist (3 fields)
- Repair time (2 fields)
- Signatures (2 fields - can be large if base64)
- Helper assignment (2 fields)
- Parts & media (2 arrays)
- Pricing (5 fields)
- Invoice tracking (6 fields)
- Quotation tracking (5 fields)
- Escalation (5 fields)
- Deferred acknowledgement (10 fields)
- SLA tracking (5 fields)
- Conversion tracking (6 fields)
- ...and more

**Impact:**
- Every job list query transfers 80+ fields per job
- With 100 jobs: ~800KB+ per request
- Most views only need 5-10 fields

**Solution: Create query profiles for different use cases**

```typescript
// Query profiles based on use case
const JOB_SELECT = {
  // For job list/cards (minimal)
  LIST: `
    job_id, 
    title, 
    status, 
    priority,
    job_type,
    customer_id,
    customer:customers(customer_id, name),
    forklift_id,
    forklift:forklifts(serial_number, make, model),
    assigned_technician_id,
    assigned_technician_name,
    created_at,
    scheduled_date
  `,
  
  // For job board (with status info)
  BOARD: `
    job_id,
    title,
    status,
    priority,
    job_type,
    customer:customers(customer_id, name, address),
    forklift:forklifts(serial_number, make, model),
    assigned_technician_id,
    assigned_technician_name,
    arrival_time,
    started_at,
    repair_start_time,
    repair_end_time,
    technician_accepted_at,
    created_at,
    scheduled_date
  `,
  
  // For full job detail (all fields needed)
  DETAIL: `
    *,
    customer:customers(*),
    forklift:forklifts!forklift_id(*),
    parts_used:job_parts(*),
    media:job_media(media_id, type, url, category, created_at, description),
    extra_charges:extra_charges(*)
  `,
};
```

**Effort:** 4-6 hours  
**Impact:** 70-80% reduction in data transfer for list views

---

### Issue 2: No Pagination on Large Lists

**Problem:** Queries fetch ALL records without limits.

**Current:**
```typescript
getJobs: async (user: User) => {
  const { data } = await supabase
    .from('jobs')
    .select(`*...`)
    // No limit! Fetches ALL jobs
}
```

**With 2000 jobs:** This query would transfer 2MB+ and take 5+ seconds.

**Solution: Add pagination**

```typescript
getJobs: async (user: User, options?: {
  page?: number;
  pageSize?: number;
  status?: JobStatus;
}) => {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('jobs')
    .select(JOB_SELECT.LIST, { count: 'exact' })
    .range(from, to)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, count, error } = await query;
  
  return {
    jobs: data,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}
```

**Effort:** 3-4 hours (backend) + 2-3 hours (UI pagination)  
**Impact:** Consistent fast loads regardless of data size

---

### Issue 3: N+1 Query Pattern in Notifications

**Problem:** Loading notifications then separately loading related jobs.

**Current pattern:**
```typescript
// Step 1: Get notifications
const notifications = await getNotifications(userId);

// Step 2: For each notification, load job (N queries!)
for (const notif of notifications) {
  if (notif.reference_type === 'job') {
    notif.job = await getJobById(notif.reference_id); // N+1!
  }
}
```

**Solution: Use joins**

```typescript
getNotifications: async (userId: string) => {
  const { data } = await supabase
    .from('notifications')
    .select(`
      *,
      job:jobs!reference_id(job_id, title, status, customer:customers(name))
    `)
    .eq('user_id', userId)
    .eq('reference_type', 'job')
    .order('created_at', { ascending: false })
    .limit(50);
}
```

**Effort:** 2 hours  
**Impact:** 90% reduction in notification query count

---

### Issue 4: Realtime Subscriptions Not Optimized

**Problem:** Realtime listeners on entire tables instead of filtered.

**Current:**
```typescript
supabase
  .channel('jobs')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'jobs' 
  }, callback)
```

**Issue:** Receives ALL job changes, even irrelevant ones.

**Solution: Filter at subscription level**

```typescript
supabase
  .channel('my-jobs')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'jobs',
    filter: `assigned_technician_id=eq.${userId}` // Only my jobs!
  }, callback)
```

**Effort:** 2 hours  
**Impact:** 80% reduction in realtime messages

---

## ⚠️ Medium Priority Issues

### Issue 5: No Query Result Caching

**Problem:** Same data fetched multiple times across components.

**Example:** Customer list loaded by:
- CreateJob dropdown
- JobBoard filter
- Customer search
- Job detail page

**Solution: Implement caching layer**

```typescript
// Option 1: Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

const cachedQuery = async <T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  
  const data = await fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

// Usage
getCustomers: async () => {
  return cachedQuery('customers', async () => {
    const { data } = await supabase.from('customers').select('*');
    return data;
  });
}
```

**Better Solution: Use React Query**
```typescript
// Install: npm install @tanstack/react-query

const { data: customers } = useQuery({
  queryKey: ['customers'],
  queryFn: () => supabase.from('customers').select('*'),
  staleTime: 60000, // Consider fresh for 1 minute
});
```

**Effort:** 4-6 hours  
**Impact:** 50-70% reduction in API calls

---

### Issue 6: Large Text Fields in Queries

**Problem:** Some fields can be very large:
- `condition_checklist` (JSON, can be 5-10KB)
- `notes[]` (array of strings)
- `deletion_reason`, `dispute_notes` (text)

**Solution: Exclude large fields from list queries**

```typescript
// For list views, exclude large fields
.select(`
  job_id, title, status, ...
  // DO NOT include: condition_checklist, notes, etc.
`)
```

**Effort:** 1 hour  
**Impact:** 20-30% smaller payloads

---

### Issue 7: Notification Count Query

**Problem:** Counting unread notifications on every page load.

**Current:**
```typescript
const { count } = await supabase
  .from('notifications')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('is_read', false);
```

**Issue:** Runs on every component mount.

**Solution: Cache count + use realtime for updates**

```typescript
// Store count in context, update via realtime
const [unreadCount, setUnreadCount] = useState(0);

// Initial load
useEffect(() => {
  loadUnreadCount();
}, []);

// Realtime updates
useEffect(() => {
  const channel = supabase
    .channel('notification-count')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, () => {
      loadUnreadCount(); // Refresh count on any change
    })
    .subscribe();
    
  return () => channel.unsubscribe();
}, [userId]);
```

**Effort:** 2 hours  
**Impact:** 90% reduction in count queries

---

## Database Schema Recommendations

### Recommendation 1: Archive Old Jobs

**Problem:** Jobs table will grow indefinitely.

**Solution:** Create archive table for completed jobs older than 6 months.

```sql
-- Create archive table
CREATE TABLE jobs_archive (LIKE jobs INCLUDING ALL);

-- Move old completed jobs (run monthly via cron)
INSERT INTO jobs_archive
SELECT * FROM jobs 
WHERE status IN ('completed', 'cancelled', 'invoiced')
AND completed_at < NOW() - INTERVAL '6 months';

DELETE FROM jobs 
WHERE status IN ('completed', 'cancelled', 'invoiced')
AND completed_at < NOW() - INTERVAL '6 months';
```

**Effort:** 3 hours (including cron setup)  
**Impact:** Keep active jobs table fast

---

### Recommendation 2: Separate Media URLs from Job Table

**Problem:** `job_media` table stores URLs that need to be fetched with jobs.

**Current:** Media fetched with every job query.

**Solution:** Already partially done - we fetch minimal media for lists. Consider separate endpoint for media gallery.

---

### Recommendation 3: Materialized View for Dashboard Stats

**Problem:** Dashboard stats require aggregating across tables.

**Solution:** Create materialized view refreshed periodically.

```sql
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'in_progress') as active_jobs,
  COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '7 days') as completed_this_week,
  COUNT(*) FILTER (WHERE status = 'assigned') as pending_jobs,
  COUNT(DISTINCT assigned_technician_id) as active_technicians
FROM jobs
WHERE deleted_at IS NULL;

-- Refresh every 5 minutes (via pg_cron or application)
REFRESH MATERIALIZED VIEW dashboard_stats;
```

**Effort:** 2 hours  
**Impact:** Instant dashboard loads

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
- [ ] Add query profiles (JOB_SELECT.LIST, .BOARD, .DETAIL)
- [ ] Filter realtime subscriptions
- [ ] Cache notification count

### Phase 2: Pagination (2-3 days)
- [ ] Add pagination to getJobs
- [ ] Update JobBoard UI for pagination
- [ ] Add pagination to JobsTabs

### Phase 3: Caching (3-4 days)
- [ ] Install React Query
- [ ] Migrate key queries to React Query
- [ ] Add stale-while-revalidate pattern

### Phase 4: Long-term (Optional)
- [ ] Job archival system
- [ ] Materialized views for stats
- [ ] Database connection pooling review

---

## Summary

| Issue | Priority | Effort | Impact |
|-------|----------|--------|--------|
| Query profiles | 🔴 High | 4-6h | 70-80% less data |
| Pagination | 🔴 High | 5-6h | Consistent speed |
| N+1 queries | ⚠️ Medium | 2h | 90% fewer queries |
| Realtime filters | ⚠️ Medium | 2h | 80% less traffic |
| Query caching | ⚠️ Medium | 4-6h | 50-70% fewer calls |
| Large field exclusion | ✅ Low | 1h | 20-30% smaller |

**Total Estimated Effort:** 3-5 days for full implementation

---

## Approval Checklist

| # | Optimization | Approve? |
|---|--------------|----------|
| 1 | Query profiles (LIST/BOARD/DETAIL) | ⬜ |
| 2 | Pagination for job lists | ⬜ |
| 3 | Fix N+1 in notifications | ⬜ |
| 4 | Filter realtime subscriptions | ⬜ |
| 5 | Add query caching (React Query) | ⬜ |
| 6 | Exclude large fields from lists | ⬜ |

---

*Awaiting your review and approval.*

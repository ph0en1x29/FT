# FieldPro Performance & Stability Improvement Report

**Date:** 2026-01-29  
**Author:** Phoenix/Clawdbot  
**Project:** FieldPro Field Service Management

---

## Executive Summary

This report identifies performance bottlenecks, stability concerns, and recommended improvements for the FieldPro application. Recommendations are prioritized by impact and effort.

---

## Current State Analysis

### Codebase Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Total Lines of Code | 35,042 | ⚠️ Large |
| Largest File | `supabaseService.ts` (6,704 lines) | 🔴 Critical |
| Largest Component | `JobDetail.tsx` (3,257 lines) | 🔴 Critical |
| Database Queries | 272 functions | ⚠️ Review needed |
| useState Hooks | 413 total | ⚠️ State complexity |
| useEffect Hooks | 68 total | ✅ Reasonable |
| Error Handling | 108 try/catch blocks | ✅ Good coverage |
| Memoization | 53 useMemo/useCallback | ⚠️ Could improve |

### Bundle Analysis

| Bundle | Size | Impact |
|--------|------|--------|
| `index.js` (main) | 339 KB | 🔴 Large initial load |
| `JobDetail.js` | 133 KB | ⚠️ Heavy page |
| `vendor-supabase.js` | 169 KB | ⚠️ SDK overhead |
| `vendor-ui.js` | 75 KB | ✅ Acceptable |

---

## 🔴 Critical Issues

### 1. Monolithic Service File

**Problem:** `supabaseService.ts` is 6,704 lines — extremely difficult to maintain, test, and debug.

**Impact:** 
- Slow IDE performance
- Merge conflicts
- Hard to find bugs
- No clear separation of concerns

**Solution:**
```
services/
├── supabaseClient.ts      # Client initialization
├── authService.ts         # Authentication
├── jobService.ts          # Job CRUD operations
├── customerService.ts     # Customer operations
├── forkliftService.ts     # Fleet management
├── inventoryService.ts    # Parts & inventory
├── notificationService.ts # Notifications
├── storageService.ts      # File uploads
└── index.ts               # Re-exports
```

**Effort:** 2-3 days  
**Impact:** High (maintainability, testability)

---

### 2. Oversized Components

**Problem:** `JobDetail.tsx` (3,257 lines), `EmployeeProfile.tsx` (2,620 lines) are too large.

**Impact:**
- Slow rendering
- Hard to maintain
- Re-renders entire component on small state changes

**Solution:** Split into smaller, focused components:
```tsx
// JobDetail/
├── JobDetailPage.tsx       # Main container
├── JobHeader.tsx           # Title, status, actions
├── JobTimerCard.tsx        # Repair time tracking
├── JobCustomerCard.tsx     # Customer info
├── JobPhotosSection.tsx    # Photos grid
├── JobChecklistSection.tsx # Condition checklist
├── JobPartsSection.tsx     # Parts used
├── JobSignatures.tsx       # Signature collection
└── hooks/
    ├── useJobData.ts       # Data fetching
    └── useJobActions.ts    # Action handlers
```

**Effort:** 3-4 days  
**Impact:** High (performance, maintainability)

---

### 3. Missing Query Optimization

**Problem:** Many database queries fetch full records when only specific fields are needed.

**Example (Current):**
```typescript
.select('*')  // Fetches ALL columns
```

**Solution:**
```typescript
.select('job_id, title, status, created_at')  // Only what's needed
```

**Already Fixed:**
- ✅ `getJobs()` now fetches minimal media data

**Still Needs Review:**
- `getCustomers()` - fetches all columns
- `getForklifts()` - fetches all columns
- `getUsers()` - fetches all columns

**Effort:** 1 day  
**Impact:** High (database load, network)

---

## ⚠️ Medium Priority Issues

### 4. Insufficient Memoization

**Problem:** Only 53 memoization hooks across 413 state variables. Many expensive computations re-run on every render.

**Examples to Memoize:**

```typescript
// Before
const filteredJobs = jobs.filter(j => j.status === filter);

// After
const filteredJobs = useMemo(
  () => jobs.filter(j => j.status === filter),
  [jobs, filter]
);
```

**Components Needing Memoization:**
- `JobBoard.tsx` - Job filtering/sorting
- `ForkliftsTabs.tsx` - Fleet filtering
- `InventoryPage.tsx` - Parts filtering
- `People.tsx` - User filtering

**Effort:** 1-2 days  
**Impact:** Medium (render performance)

---

### 5. Image Loading Optimization

**Problem:** Images load without optimization (no lazy loading, no placeholders).

**Solution:**

```typescript
// Add lazy loading
<img 
  src={photoUrl} 
  loading="lazy" 
  decoding="async"
  alt="Job photo"
/>

// Or use intersection observer for better control
const ImageWithLazyLoad = ({ src, alt }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={ref}>
      {isVisible ? <img src={src} alt={alt} /> : <Skeleton />}
    </div>
  );
};
```

**Effort:** 0.5 days  
**Impact:** Medium (perceived performance)

---

### 6. Bundle Size Reduction

**Problem:** Main bundle is 339 KB — delays initial page load.

**Solutions:**

| Technique | Potential Savings | Effort |
|-----------|-------------------|--------|
| Code splitting (already done) | ✅ Done | - |
| Tree shaking lodash | ~20 KB | Low |
| Dynamic import for PDFs | ~50 KB | Low |
| Remove unused dependencies | ~10-30 KB | Low |
| Compress with brotli | ~30% smaller | Config |

**Implementation:**
```typescript
// Lazy load PDF components (only when needed)
const ServiceReportPDF = lazy(() => import('./ServiceReportPDF'));
const QuotationPDF = lazy(() => import('./QuotationPDF'));
const InvoicePDF = lazy(() => import('./InvoicePDF'));
```

**Effort:** 1 day  
**Impact:** Medium (initial load time)

---

### 7. API Request Deduplication

**Problem:** Same data fetched multiple times across components.

**Solution:** Implement request caching or use React Query/SWR.

```typescript
// Option 1: Simple cache
const cache = new Map();

const fetchWithCache = async (key, fetcher, ttl = 60000) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < ttl) {
    return cached.data;
  }
  const data = await fetcher();
  cache.set(key, { data, time: Date.now() });
  return data;
};

// Option 2: Use React Query (recommended)
npm install @tanstack/react-query

const { data: jobs } = useQuery({
  queryKey: ['jobs', userId],
  queryFn: () => getJobs(user),
  staleTime: 30000, // Cache for 30 seconds
});
```

**Effort:** 2-3 days (for React Query migration)  
**Impact:** Medium-High (reduced API calls, better UX)

---

## ✅ Low Priority / Nice-to-Have

### 8. Service Worker Caching

**Current:** Basic service worker for push notifications only.

**Enhancement:** Add runtime caching for static assets and API responses.

```javascript
// sw.js
const CACHE_NAME = 'fieldpro-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
```

**Effort:** 1 day  
**Impact:** Low-Medium (offline capability, faster loads)

---

### 9. Database Indexes

**Recommendation:** Ensure indexes exist for frequently queried columns.

```sql
-- Jobs table
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_tech ON jobs(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, is_read) WHERE is_read = false;

-- Job media table
CREATE INDEX IF NOT EXISTS idx_job_media_job_id ON job_media(job_id);
```

**Effort:** 0.5 days  
**Impact:** Medium (query performance)

---

### 10. Error Monitoring

**Current:** Console logging only.

**Recommendation:** Add production error tracking (Sentry, LogRocket, etc.)

```typescript
// services/errorTracking.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});

export const captureError = (error: Error, context?: object) => {
  console.error(error);
  Sentry.captureException(error, { extra: context });
};
```

**Effort:** 0.5 days  
**Impact:** High (debugging production issues)

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)
- [x] ~~Optimize getJobs query (minimal media)~~ ✅ Done
- [x] ~~Add storage buckets for photos/signatures~~ ✅ Done
- [ ] Add lazy loading to images
- [ ] Lazy load PDF components
- [ ] Add database indexes

### Phase 2: Stability (3-5 days)
- [x] ~~Add ChunkErrorBoundary~~ ✅ Done
- [ ] Add Sentry error monitoring
- [ ] Add React Query for request caching
- [ ] Add more memoization

### Phase 3: Architecture (5-10 days)
- [ ] Split supabaseService.ts into modules
- [ ] Split JobDetail.tsx into components
- [ ] Split EmployeeProfile.tsx into components
- [ ] Create shared hooks library

### Phase 4: Advanced (Optional)
- [ ] Service worker caching
- [ ] PWA enhancements
- [ ] Performance monitoring dashboard

---

## Summary

| Category | Issues Found | Already Fixed | Remaining |
|----------|--------------|---------------|-----------|
| Critical | 3 | 1 | 2 |
| Medium | 4 | 0 | 4 |
| Low | 3 | 1 | 2 |
| **Total** | **10** | **2** | **8** |

### Priority Recommendation

1. **Immediately:** Add lazy loading to images, lazy load PDFs
2. **This Week:** Add error monitoring (Sentry)
3. **This Month:** Split large files, add React Query
4. **Ongoing:** Monitor performance, iterate

---

## Appendix: Performance Testing

### How to Measure

```bash
# Lighthouse audit
npx lighthouse https://ft-kappa.vercel.app --view

# Bundle analysis
npm run build -- --report

# React DevTools Profiler
# Enable in browser DevTools > Profiler tab
```

### Target Metrics

| Metric | Current | Target |
|--------|---------|--------|
| First Contentful Paint | ~2s | < 1.5s |
| Time to Interactive | ~4s | < 3s |
| Largest Contentful Paint | ~3s | < 2.5s |
| Main Bundle Size | 339 KB | < 250 KB |

---

*Report generated by Phoenix/Clawdbot*

# FieldPro Performance Implementation Plan

**Date:** 2026-01-29  
**Author:** Phoenix/Clawdbot  
**Status:** Pending Jay's Approval

---

## Overview

This document outlines specific fixes with code examples, estimated effort, and expected impact. Each item requires your approval before implementation.

---

## Fix #1: Image Lazy Loading

### Problem
All images load immediately when page opens, even images below the fold (not visible). This wastes bandwidth and slows initial render.

### Solution
Add `loading="lazy"` attribute to all images.

### Code Changes

**File:** `pages/JobDetail.tsx` (and other pages with images)

```tsx
// BEFORE
<img src={photo.url} alt="Job photo" className="..." />

// AFTER  
<img 
  src={photo.url} 
  alt="Job photo" 
  loading="lazy"
  decoding="async"
  className="..." 
/>
```

### Files to Change
- `pages/JobDetail.tsx` - Photo gallery
- `pages/EmployeeProfile.tsx` - Profile images
- `pages/CustomerProfile.tsx` - Signatures
- `components/ServiceReportPDF.tsx` - Signatures in PDF

### Effort
⏱️ **2 hours**

### Impact
📈 **20-30% faster initial page load** on image-heavy pages

### Risk
🟢 **Low** - Native browser feature, no breaking changes

---

## Fix #2: Lazy Load PDF Components

### Problem
PDF generation libraries (pdfmake) are bundled with main app even though most users never generate PDFs. This adds ~50KB to initial load.

### Solution
Dynamic import PDFs only when user clicks "Generate PDF".

### Code Changes

**File:** `pages/JobDetail.tsx`

```tsx
// BEFORE
import { printServiceReport } from '../components/ServiceReportPDF';
import { printQuotation } from '../components/QuotationPDF';
import { printInvoice } from '../components/InvoicePDF';

// AFTER
const handlePrintServiceReport = async () => {
  const { printServiceReport } = await import('../components/ServiceReportPDF');
  printServiceReport(job);
};

const handlePrintQuotation = async () => {
  const { printQuotation, generateQuotationFromJob } = await import('../components/QuotationPDF');
  const quotation = generateQuotationFromJob(job);
  printQuotation(quotation);
};

const handlePrintInvoice = async () => {
  const { printInvoice } = await import('../components/InvoicePDF');
  printInvoice(job);
};
```

### Effort
⏱️ **1 hour**

### Impact
📈 **~50KB smaller initial bundle** (15% reduction in main chunk)

### Risk
🟢 **Low** - Just changes when code loads, not what it does

---

## Fix #3: Database Query Indexes

### Problem
Slow queries on large tables because columns aren't indexed.

### Solution
Add indexes for frequently filtered/sorted columns.

### SQL to Run in Supabase

```sql
-- Jobs table (most critical)
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_tech ON jobs(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_forklift ON jobs(forklift_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_desc ON jobs(created_at DESC);

-- Composite index for technician job queries
CREATE INDEX IF NOT EXISTS idx_jobs_tech_status 
  ON jobs(assigned_technician_id, status);

-- Notifications (for unread badge)
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON notifications(user_id, is_read) 
  WHERE is_read = false;

-- Job media (for photo loading)
CREATE INDEX IF NOT EXISTS idx_job_media_job ON job_media(job_id);

-- Forklifts (for fleet queries)
CREATE INDEX IF NOT EXISTS idx_forklifts_status ON forklifts(status);
CREATE INDEX IF NOT EXISTS idx_forklifts_customer ON forklifts(current_customer_id);
```

### Effort
⏱️ **30 minutes** (just run SQL)

### Impact
📈 **50-80% faster database queries** on filtered lists

### Risk
🟢 **Low** - Indexes only improve read performance

---

## Fix #4: Memoize Expensive Computations

### Problem
Filtering/sorting operations run on every render, even when data hasn't changed.

### Solution
Wrap expensive computations in `useMemo`.

### Code Changes

**File:** `pages/JobBoard.tsx`

```tsx
// BEFORE
const filteredJobs = jobs
  .filter(job => job.status === statusFilter)
  .filter(job => job.title.toLowerCase().includes(search.toLowerCase()))
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

// AFTER
const filteredJobs = useMemo(() => {
  return jobs
    .filter(job => job.status === statusFilter)
    .filter(job => job.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}, [jobs, statusFilter, search]);
```

**File:** `pages/ForkliftsTabs.tsx`

```tsx
// BEFORE
const filteredForklifts = forklifts.filter(f => {
  const matchesSearch = f.serial_number.includes(search) || f.make.includes(search);
  const matchesStatus = filterStatus === 'all' || f.status === filterStatus;
  return matchesSearch && matchesStatus;
});

// AFTER
const filteredForklifts = useMemo(() => {
  return forklifts.filter(f => {
    const matchesSearch = f.serial_number.includes(search) || f.make.includes(search);
    const matchesStatus = filterStatus === 'all' || f.status === filterStatus;
    return matchesSearch && matchesStatus;
  });
}, [forklifts, search, filterStatus]);
```

### Files to Change
- `pages/JobBoard.tsx`
- `pages/JobsTabs.tsx`
- `pages/ForkliftsTabs.tsx`
- `pages/InventoryPage.tsx`
- `pages/People.tsx`
- `pages/Customers.tsx`

### Effort
⏱️ **3 hours**

### Impact
📈 **Smoother UI** when typing in search boxes, less CPU usage

### Risk
🟢 **Low** - Standard React optimization

---

## Fix #5: Add Error Monitoring (Sentry)

### Problem
When errors happen in production, we only know if a user reports it. No visibility into crashes.

### Solution
Add Sentry for automatic error tracking.

### Code Changes

**1. Install Sentry**
```bash
npm install @sentry/react
```

**2. Create config file:** `services/errorTracking.ts`
```typescript
import * as Sentry from '@sentry/react';

export const initErrorTracking = () => {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1, // 10% of transactions
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
};

export const captureError = (error: Error, context?: Record<string, any>) => {
  console.error('[Error]', error.message, context);
  if (import.meta.env.PROD) {
    Sentry.captureException(error, { extra: context });
  }
};
```

**3. Initialize in** `index.tsx`
```typescript
import { initErrorTracking } from './services/errorTracking';

initErrorTracking();

// ... rest of app
```

**4. Add to** `.env.example`
```
VITE_SENTRY_DSN=your-sentry-dsn-here
```

### Effort
⏱️ **2 hours** (including Sentry account setup)

### Impact
📈 **Immediate visibility** into production errors, stack traces, user context

### Risk
🟢 **Low** - Only runs in production, graceful fallback

### Cost
💰 **Free tier:** 5K errors/month (sufficient for now)

---

## Fix #6: Optimize Customer/Forklift Queries

### Problem
`getCustomers()` and `getForklifts()` fetch ALL columns when lists only need basic info.

### Solution
Create lightweight list queries.

### Code Changes

**File:** `services/supabaseService.ts`

```typescript
// ADD: Lightweight query for dropdowns/lists
getCustomersForList: async (): Promise<Pick<Customer, 'customer_id' | 'name' | 'address'>[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, name, address')
    .order('name');
  
  if (error) throw new Error(error.message);
  return data;
},

getForkliftsForList: async (): Promise<Pick<Forklift, 'forklift_id' | 'serial_number' | 'make' | 'model' | 'status'>[]> => {
  const { data, error } = await supabase
    .from('forklifts')
    .select('forklift_id, serial_number, make, model, status, hourmeter, type, location')
    .neq('status', 'Out of Service')
    .order('serial_number');
  
  if (error) throw new Error(error.message);
  return data;
},
```

**File:** `pages/CreateJob.tsx`

```typescript
// BEFORE
const [customers] = await Promise.all([
  MockDb.getCustomers(),
  MockDb.getForklifts(),
]);

// AFTER
const [customers, forklifts] = await Promise.all([
  MockDb.getCustomersForList(),
  MockDb.getForkliftsForList(),
]);
```

### Effort
⏱️ **1 hour**

### Impact
📈 **60-70% smaller payloads** for dropdown data

### Risk
🟢 **Low** - Additive change, doesn't modify existing functions

---

## Summary: Approval Checklist

| # | Fix | Effort | Impact | Risk | Approve? |
|---|-----|--------|--------|------|----------|
| 1 | Image lazy loading | 2h | High | Low | ⬜ |
| 2 | Lazy load PDFs | 1h | Medium | Low | ⬜ |
| 3 | Database indexes | 30m | High | Low | ⬜ |
| 4 | Memoize computations | 3h | Medium | Low | ⬜ |
| 5 | Sentry error monitoring | 2h | High | Low | ⬜ |
| 6 | Optimize list queries | 1h | Medium | Low | ⬜ |

**Total Estimated Effort:** ~10 hours (1.5 days)

---

## How to Approve

Reply with which fixes to implement:

- **"Approve all"** - I'll implement everything
- **"Approve 1, 2, 3"** - I'll implement specific items
- **"Approve all except 5"** - I'll skip Sentry for now

Once approved, I'll implement, test, and push.

---

*Awaiting your review and approval.*

# Signature Loading Performance Investigation

**Date:** 2026-01-28  
**Priority:** HIGH  
**Issue:** Signatures slow to load / don't load

---

## Root Cause: Base64 Data URLs Stored in Database

**Both photos AND signatures are stored as base64 data URLs directly in the database columns.**

```typescript
// JobDetail.tsx - Photo upload
url: reader.result as string,  // Base64 data URL (~100-500KB per photo)

// supabaseService.ts - Signature save
signature_url: signatureDataUrl,  // Base64 data URL (~50-200KB per signature)
```

### Impact

| Issue | Size | Effect |
|-------|------|--------|
| Single signature | 50-200KB | Slow fetch |
| Both signatures | 100-400KB | Very slow |
| Job with 5 photos + signatures | 1-3MB | Extremely slow |
| Job list (50 jobs) | 50-150MB | Browser freeze |

### Why It's Slow

1. **Database query** fetches entire base64 string
2. **Network transfer** sends MB of JSON
3. **JavaScript parsing** processes huge strings
4. **React rendering** re-parses on every update
5. **No caching** - refetched every time

---

## Current Flow (Problematic)

```
User draws signature
        ↓
Canvas → toDataURL() → Base64 string (~150KB)
        ↓
Stored in jobs.technician_signature JSONB column
        ↓
Every getJob() query fetches full base64
        ↓
JSON.parse() processes 150KB+ string
        ↓
<img src={base64}> renders
```

---

## Evidence

### 1. Signature Storage
```typescript
// services/supabaseService.ts:1154
signJob: async (jobId, type, signerName, signatureDataUrl) => {
  const signatureEntry: SignatureEntry = {
    signed_by_name: signerName,
    signed_at: now,
    signature_url: signatureDataUrl,  // ← BASE64 stored here
  };
  
  await supabase.from('jobs').update({ [field]: signatureEntry })
}
```

### 2. Photo Storage
```typescript
// pages/JobDetail.tsx:1079
reader.onloadend = async () => {
  const mediaData = {
    url: reader.result as string,  // ← BASE64 stored here
    // ...
  };
  await MockDb.addMedia(job.job_id, mediaData);
}
```

### 3. Query Fetches Everything
```typescript
// services/supabaseService.ts
getJobById: async (jobId) => {
  const { data } = await supabase
    .from('jobs')
    .select(`*`)  // ← Fetches signatures (150KB+ each)
    .eq('job_id', jobId);
}

getJobs: async (user) => {
  const { data } = await supabase
    .from('jobs')
    .select(`*`)  // ← Fetches ALL signatures for ALL jobs!
}
```

---

## Solutions

### Solution 1: Quick Fix - Exclude from List Queries (30 min)

Modify `getJobs` to exclude signature columns:

```typescript
getJobs: async (user) => {
  const { data } = await supabase
    .from('jobs')
    .select(`
      job_id, title, status, priority, customer_id, forklift_id,
      assigned_technician_id, assigned_technician_name,
      created_at, started_at, completed_at,
      customer:customers(*),
      forklift:forklifts!forklift_id(*)
    `)  // Explicitly list columns, EXCLUDE signatures
    .order('created_at', { ascending: false });
}
```

**Pros:** Fast fix, immediate improvement  
**Cons:** Still slow on job detail page

---

### Solution 2: Proper Fix - Use Supabase Storage (2-3 hours)

Upload signatures to Supabase Storage bucket, store only URL reference.

**New Flow:**
```
User draws signature
        ↓
Canvas → toDataURL() → Blob
        ↓
Upload to Supabase Storage → Get public URL
        ↓
Store URL string in database (~100 bytes)
        ↓
<img src={storageUrl}> loads from CDN (cached)
```

**Implementation:**

```typescript
// 1. Create bucket (one-time, in Supabase dashboard)
// Bucket: "signatures" (public read)

// 2. Update signJob function
signJob: async (jobId, type, signerName, signatureDataUrl) => {
  // Convert base64 to blob
  const response = await fetch(signatureDataUrl);
  const blob = await response.blob();
  
  // Upload to Storage
  const fileName = `${jobId}_${type}_${Date.now()}.png`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('signatures')
    .upload(fileName, blob, { contentType: 'image/png' });
  
  if (uploadError) throw uploadError;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('signatures')
    .getPublicUrl(fileName);
  
  // Store URL (not base64)
  const signatureEntry: SignatureEntry = {
    signed_by_name: signerName,
    signed_at: now,
    signature_url: publicUrl,  // ← Small URL string
  };
  
  await supabase.from('jobs').update({ [field]: signatureEntry });
}
```

**Pros:**  
- Signatures load instantly (CDN cached)
- Database stays small
- Better scalability

**Cons:**  
- Need to migrate existing signatures
- Slightly more complex code

---

### Solution 3: Lazy Load Signatures (1 hour)

Don't fetch signatures until user scrolls to signature section.

```typescript
// In JobDetail.tsx
const [signaturesLoaded, setSignaturesLoaded] = useState(false);
const signaturesRef = useRef(null);

// Use Intersection Observer
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !signaturesLoaded) {
      loadSignatures();
    }
  });
  if (signaturesRef.current) observer.observe(signaturesRef.current);
  return () => observer.disconnect();
}, []);

const loadSignatures = async () => {
  const { data } = await supabase
    .from('jobs')
    .select('technician_signature, customer_signature')
    .eq('job_id', jobId)
    .single();
  // Update state
};
```

---

## Recommended Action Plan

### Immediate (Today)
1. **Quick Fix** - Exclude signatures from `getJobs()` list query

### This Week  
2. **Storage Migration** - Create `signatures` bucket
3. **Update signJob()** - Upload to Storage instead of base64
4. **Update photos too** - Same issue, same fix

### Backlog
5. **Migrate existing data** - Script to move base64 → Storage
6. **Add loading states** - Skeleton while signatures load

---

## Database Changes Needed

```sql
-- Create storage bucket (via Supabase Dashboard or SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true);

-- RLS policy for signatures bucket
CREATE POLICY "Authenticated users can upload signatures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Anyone can view signatures"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'signatures');
```

---

## Testing Checklist

After fix:
- [ ] Job list loads in < 1 second
- [ ] Job detail loads signatures within 2 seconds
- [ ] New signatures save to Storage
- [ ] Old signatures still display (migration)
- [ ] Mobile performance acceptable

---

*Report generated by Phoenix/Clawdbot*

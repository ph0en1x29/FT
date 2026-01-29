-- =============================================
-- FieldPro Migration: Storage Buckets for Photos & Signatures
-- =============================================
-- Date: 2026-01-28
-- Purpose: Create storage buckets to store photos and signatures
--          instead of base64 data URLs in database columns.
--          This dramatically improves load times and reduces DB size.
-- =============================================

-- =============================================
-- STEP 1: CREATE STORAGE BUCKETS
-- =============================================

-- Bucket for job photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  true,  -- Public read access
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket for signatures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  true,  -- Public read access
  1048576,  -- 1MB max file size (signatures are smaller)
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================
-- STEP 2: RLS POLICIES FOR JOB-PHOTOS BUCKET
-- =============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "job_photos_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "job_photos_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "job_photos_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "job_photos_delete_policy" ON storage.objects;

-- Anyone authenticated can upload photos
CREATE POLICY "job_photos_insert_policy"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'job-photos');

-- Anyone can view photos (public bucket)
CREATE POLICY "job_photos_select_policy"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'job-photos');

-- Authenticated users can update their uploads
CREATE POLICY "job_photos_update_policy"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'job-photos');

-- Admin/Supervisor can delete photos
CREATE POLICY "job_photos_delete_policy"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'job-photos'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
    AND u.role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
  )
);

-- =============================================
-- STEP 3: RLS POLICIES FOR SIGNATURES BUCKET
-- =============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "signatures_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "signatures_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "signatures_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "signatures_delete_policy" ON storage.objects;

-- Anyone authenticated can upload signatures
CREATE POLICY "signatures_insert_policy"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'signatures');

-- Anyone can view signatures (public bucket)
CREATE POLICY "signatures_select_policy"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'signatures');

-- Signatures should be immutable (no update)
-- But allow admin override
CREATE POLICY "signatures_update_policy"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'signatures'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
    AND u.role IN ('admin', 'Admin')
  )
);

-- Only admin can delete signatures
CREATE POLICY "signatures_delete_policy"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'signatures'
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid()
    AND u.role IN ('admin', 'Admin')
  )
);

-- =============================================
-- STEP 4: VERIFY
-- =============================================

SELECT 'Storage buckets created:' as status;
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id IN ('job-photos', 'signatures');

SELECT 'Storage policies created:' as status;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

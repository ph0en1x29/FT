-- =============================================
-- FieldPro Migration: HR Documents Storage Bucket
-- =============================================
-- Date: 2026-02-03
-- Purpose: Create private storage bucket for HR documents
--          (permits, licenses, profile photos, leave documents)
-- =============================================

-- Create bucket (private - requires signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-documents',
  'hr-documents',
  false,  -- Private - requires signed URLs
  10485760,  -- 10MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for authenticated users
CREATE POLICY "hr_docs_auth_upload" ON storage.objects 
  FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_auth_select" ON storage.objects 
  FOR SELECT TO authenticated 
  USING (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_auth_update" ON storage.objects 
  FOR UPDATE TO authenticated 
  USING (bucket_id = 'hr-documents');

CREATE POLICY "hr_docs_auth_delete" ON storage.objects 
  FOR DELETE TO authenticated 
  USING (bucket_id = 'hr-documents');

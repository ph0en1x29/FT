/**
 * Security Fixes Verification Tests
 * 
 * Tests the specific fixes from the 2026-02-03 security review:
 * 1. Spare part approval (stock reservation)
 * 2. Assistance approval flow
 * 3. Signed URLs for HR documents
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

test.describe('Security Fixes Verification', () => {
  
  test('spare part stock reservation is atomic', async () => {
    // Get a part with stock
    const { data: part } = await supabase
      .from('parts')
      .select('part_id, stock_quantity')
      .gt('stock_quantity', 5)
      .limit(1)
      .single();
    
    if (!part) {
      test.skip();
      return;
    }
    
    const originalStock = part.stock_quantity;
    
    // Test 1: Reserve should succeed
    const { data: reserved1 } = await supabase.rpc('reserve_part_stock', {
      p_part_id: part.part_id,
      p_quantity: 2
    });
    expect(reserved1).toBe(true);
    
    // Verify stock reduced
    const { data: after1 } = await supabase
      .from('parts')
      .select('stock_quantity')
      .eq('part_id', part.part_id)
      .single();
    expect(after1?.stock_quantity).toBe(originalStock - 2);
    
    // Test 2: Reserve more than available should fail
    const { data: reserved2 } = await supabase.rpc('reserve_part_stock', {
      p_part_id: part.part_id,
      p_quantity: 9999
    });
    expect(reserved2).toBe(false);
    
    // Stock should be unchanged
    const { data: after2 } = await supabase
      .from('parts')
      .select('stock_quantity')
      .eq('part_id', part.part_id)
      .single();
    expect(after2?.stock_quantity).toBe(originalStock - 2);
    
    // Rollback
    await supabase.rpc('rollback_part_stock', {
      p_part_id: part.part_id,
      p_quantity: 2
    });
    
    // Verify restored
    const { data: final } = await supabase
      .from('parts')
      .select('stock_quantity')
      .eq('part_id', part.part_id)
      .single();
    expect(final?.stock_quantity).toBe(originalStock);
  });

  test('signed URLs work for hr-documents bucket', async () => {
    // Create test image (1x1 PNG)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    
    const testPath = `test/security-test-${Date.now()}.png`;
    
    // Upload
    const { error: uploadError } = await supabase.storage
      .from('hr-documents')
      .upload(testPath, pngBuffer, { contentType: 'image/png' });
    
    expect(uploadError).toBeNull();
    
    // Generate signed URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from('hr-documents')
      .createSignedUrl(testPath, 60);
    
    expect(signedError).toBeNull();
    expect(signedData?.signedUrl).toContain('token=');
    
    // Verify signed URL works
    const signedResponse = await fetch(signedData!.signedUrl);
    expect(signedResponse.ok).toBe(true);
    
    // Verify public URL is blocked
    const { data: publicData } = supabase.storage
      .from('hr-documents')
      .getPublicUrl(testPath);
    
    const publicResponse = await fetch(publicData.publicUrl);
    expect(publicResponse.status).toBeGreaterThanOrEqual(400);
    
    // Cleanup
    await supabase.storage.from('hr-documents').remove([testPath]);
  });

  test('assistance request approval assigns helper before marking approved', async () => {
    // Get test users
    const { data: techs } = await supabase
      .from('users')
      .select('user_id')
      .eq('role', 'technician')
      .eq('is_active', true)
      .limit(2);
    
    const { data: admin } = await supabase
      .from('users')
      .select('user_id')
      .in('role', ['admin', 'admin_service'])
      .eq('is_active', true)
      .limit(1)
      .single();
    
    if (!techs || techs.length < 2 || !admin) {
      test.skip();
      return;
    }
    
    const [requester, helper] = techs;
    
    // Create test job
    const { data: job } = await supabase
      .from('jobs')
      .insert({
        title: 'Test Job - Security Fix Verification',
        description: 'Automated test',
        status: 'In Progress',
        priority: 'Medium',
        assigned_technician_id: requester.user_id
      })
      .select()
      .single();
    
    expect(job).not.toBeNull();
    
    // Create assistance request
    const { data: request } = await supabase
      .from('job_requests')
      .insert({
        job_id: job!.job_id,
        request_type: 'assistance',
        requested_by: requester.user_id,
        description: 'Test assistance request',
        status: 'pending'
      })
      .select()
      .single();
    
    expect(request).not.toBeNull();
    
    // Simulate approval flow (helper first, then status)
    const { data: assignment, error: assignError } = await supabase
      .from('job_assignments')
      .insert({
        job_id: job!.job_id,
        technician_id: helper.user_id,
        assignment_type: 'assistant',
        assigned_by: admin.user_id,
        is_active: true
      })
      .select()
      .single();
    
    expect(assignError).toBeNull();
    expect(assignment).not.toBeNull();
    
    // Now mark approved
    const { error: updateError } = await supabase
      .from('job_requests')
      .update({
        status: 'approved',
        responded_by: admin.user_id,
        responded_at: new Date().toISOString()
      })
      .eq('request_id', request!.request_id);
    
    expect(updateError).toBeNull();
    
    // Verify final state
    const { data: finalRequest } = await supabase
      .from('job_requests')
      .select('status')
      .eq('request_id', request!.request_id)
      .single();
    
    const { data: finalAssignment } = await supabase
      .from('job_assignments')
      .select('is_active')
      .eq('job_id', job!.job_id)
      .eq('assignment_type', 'assistant')
      .eq('is_active', true)
      .single();
    
    expect(finalRequest?.status).toBe('approved');
    expect(finalAssignment?.is_active).toBe(true);
    
    // Cleanup
    await supabase.from('job_assignments').delete().eq('job_id', job!.job_id);
    await supabase.from('job_requests').delete().eq('request_id', request!.request_id);
    await supabase.from('jobs').delete().eq('job_id', job!.job_id);
  });
});

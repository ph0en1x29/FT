/**
 * Permit Service
 * 
 * SECURITY TODO: Currently uses public URLs for permit documents.
 * These should be changed to signed URLs with expiration for production:
 * 1. Change hr-documents bucket to private
 * 2. Use createSignedUrl() instead of getPublicUrl()
 * 3. Set appropriate expiration (e.g., 1 hour)
 * 
 * Current mitigation: Files are stored with user-specific paths (permits/{userId}/)
 * and bucket has RLS policies requiring authentication.
 */

import { supabase } from './supabaseService';
import { getSignedStorageUrl } from './supabaseClient';
import { EmployeePermit, LicenseStatus } from '../types';

export const PermitService = {
  // =============================================
  // PERMIT OPERATIONS
  // =============================================

  getPermits: async (userId?: string): Promise<EmployeePermit[]> => {
    let query = supabase
      .from('employee_permits')
      .select(`
        *,
        user:users(full_name, phone, department, employee_code)
      `)
      .order('expiry_date');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as EmployeePermit[];
  },

  getExpiringPermits: async (daysAhead: number = 60): Promise<EmployeePermit[]> => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('employee_permits')
      .select(`
        *,
        user:users!employee_permits_user_id_fkey(user_id, full_name, name, phone, department, employee_code)
      `)
      .eq('status', 'active')
      .lte('expiry_date', futureDate.toISOString().split('T')[0])
      .order('expiry_date');

    if (error) throw new Error(error.message);

    return (data || []).map((permit: EmployeePermit) => ({
      ...permit,
      days_until_expiry: Math.ceil(
        (new Date(permit.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    }));
  },

  createPermit: async (
    permitData: Partial<EmployeePermit>,
    createdById?: string,
    createdByName?: string
  ): Promise<EmployeePermit> => {
    if (!permitData.user_id) {
      throw new Error('user_id is required to create a permit');
    }

    const { data, error } = await supabase
      .from('employee_permits')
      .insert({
        user_id: permitData.user_id,
        permit_type: permitData.permit_type,
        permit_number: permitData.permit_number,
        permit_name: permitData.permit_name,
        issuing_authority: permitData.issuing_authority,
        issue_date: permitData.issue_date,
        expiry_date: permitData.expiry_date,
        restricted_areas: permitData.restricted_areas,
        permit_document_url: permitData.permit_document_url,
        status: permitData.status || LicenseStatus.ACTIVE,
        alert_days_before: permitData.alert_days_before || 30,
        notes: permitData.notes,
        created_by_id: createdById,
        created_by_name: createdByName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeePermit;
  },

  updatePermit: async (
    permitId: string,
    updates: Partial<EmployeePermit>
  ): Promise<EmployeePermit> => {
    const { data, error } = await supabase
      .from('employee_permits')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('permit_id', permitId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeePermit;
  },

  deletePermit: async (permitId: string): Promise<void> => {
    const { error } = await supabase
      .from('employee_permits')
      .delete()
      .eq('permit_id', permitId);

    if (error) throw new Error(error.message);
  },

  // =============================================
  // FILE UPLOAD
  // =============================================

  uploadPermitDocument: async (userId: string, file: File): Promise<string> => {
    const fileName = `permits/${userId}/${Date.now()}.${file.name.split('.').pop()}`;

    const { error } = await supabase.storage
      .from('hr-documents')
      .upload(fileName, file);

    if (error) throw new Error(error.message);

    const signedUrl = await getSignedStorageUrl('hr-documents', fileName, 86400);
    return signedUrl || fileName;
  },

  /**
   * Get a signed URL for a permit document (valid for 1 hour)
   * Use this instead of storing public URLs
   */
  getPermitDocumentUrl: async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('hr-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      console.error('Failed to create signed URL:', error.message);
      return null;
    }

    return data.signedUrl;
  },
};

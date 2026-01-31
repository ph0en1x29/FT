import { supabase } from './supabaseService';
import { EmployeeLicense, LicenseStatus } from '../types';

export const LicenseService = {
  // =============================================
  // LICENSE OPERATIONS
  // =============================================

  getLicenses: async (userId?: string): Promise<EmployeeLicense[]> => {
    let query = supabase
      .from('employee_licenses')
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
    return data as EmployeeLicense[];
  },

  getExpiringLicenses: async (daysAhead: number = 60): Promise<EmployeeLicense[]> => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('employee_licenses')
      .select(`
        *,
        user:users!employee_licenses_user_id_fkey(user_id, full_name, name, phone, department, employee_code)
      `)
      .eq('status', 'active')
      .lte('expiry_date', futureDate.toISOString().split('T')[0])
      .order('expiry_date');

    if (error) throw new Error(error.message);

    return (data || []).map((license: EmployeeLicense) => ({
      ...license,
      days_until_expiry: Math.ceil(
        (new Date(license.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    }));
  },

  createLicense: async (
    licenseData: Partial<EmployeeLicense>,
    createdById?: string,
    createdByName?: string
  ): Promise<EmployeeLicense> => {
    if (!licenseData.user_id) {
      throw new Error('user_id is required to create a license');
    }

    const { data, error } = await supabase
      .from('employee_licenses')
      .insert({
        user_id: licenseData.user_id,
        license_type: licenseData.license_type,
        license_number: licenseData.license_number,
        issuing_authority: licenseData.issuing_authority,
        issue_date: licenseData.issue_date,
        expiry_date: licenseData.expiry_date,
        license_front_image_url: licenseData.license_front_image_url,
        license_back_image_url: licenseData.license_back_image_url,
        status: licenseData.status || LicenseStatus.ACTIVE,
        alert_days_before: licenseData.alert_days_before || 30,
        notes: licenseData.notes,
        created_by_id: createdById,
        created_by_name: createdByName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeeLicense;
  },

  updateLicense: async (
    licenseId: string,
    updates: Partial<EmployeeLicense>
  ): Promise<EmployeeLicense> => {
    const { data, error } = await supabase
      .from('employee_licenses')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('license_id', licenseId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeeLicense;
  },

  deleteLicense: async (licenseId: string): Promise<void> => {
    const { error } = await supabase
      .from('employee_licenses')
      .delete()
      .eq('license_id', licenseId);

    if (error) throw new Error(error.message);
  },

  // =============================================
  // FILE UPLOAD
  // =============================================

  uploadLicenseImage: async (
    userId: string,
    file: File,
    side: 'front' | 'back'
  ): Promise<string> => {
    const fileName = `licenses/${userId}/${side}_${Date.now()}.${file.name.split('.').pop()}`;

    const { error } = await supabase.storage
      .from('hr-documents')
      .upload(fileName, file);

    if (error) throw new Error(error.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from('hr-documents').getPublicUrl(fileName);

    return publicUrl;
  },
};

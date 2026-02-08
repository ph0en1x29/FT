import {
EmployeeLicense,
EmployeePermit,
HRAlert,
HRAlertSeverity,
HRAlertType,
} from '../types';
import { supabase } from './supabaseService';

export const HRAlertService = {
  // =============================================
  // HR ALERTS
  // =============================================

  getAlerts: async (userId?: string): Promise<HRAlert[]> => {
    let query = supabase
      .from('hr_alerts')
      .select(`
        *,
        user:users(name, department)
      `)
      .order('scheduled_for', { ascending: false })
      .limit(50);

    if (userId) {
      query = query.contains('recipient_ids', [userId]);
    }

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return data as HRAlert[];
  },

  createExpiryAlert: async (
    type: 'license' | 'permit',
    record: EmployeeLicense | EmployeePermit,
    recipientIds: string[]
  ): Promise<HRAlert | null> => {
    const daysUntilExpiry = Math.ceil(
      (new Date(record.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    let severity: HRAlertSeverity = HRAlertSeverity.INFO;
    if (daysUntilExpiry <= 7) {
      severity = HRAlertSeverity.CRITICAL;
    } else if (daysUntilExpiry <= 14) {
      severity = HRAlertSeverity.WARNING;
    }

    const title = type === 'license' ? `Driving License Expiring` : `Permit Expiring`;
    const message =
      type === 'license'
        ? `${(record as EmployeeLicense).license_type} license (${record.user?.name || 'Employee'}) expires in ${daysUntilExpiry} days on ${new Date(record.expiry_date).toLocaleDateString()}`
        : `${(record as EmployeePermit).permit_type} permit (${record.user?.name || 'Employee'}) expires in ${daysUntilExpiry} days on ${new Date(record.expiry_date).toLocaleDateString()}`;

    const { data, error } = await supabase
      .from('hr_alerts')
      .insert({
        alert_type:
          type === 'license' ? HRAlertType.LICENSE_EXPIRY : HRAlertType.PERMIT_EXPIRY,
        user_id: record.user_id,
        license_id: type === 'license' ? (record as EmployeeLicense).license_id : null,
        permit_id: type === 'permit' ? (record as EmployeePermit).permit_id : null,
        title,
        message,
        severity,
        recipient_ids: recipientIds,
        scheduled_for: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return null;
    }
    return data as HRAlert;
  },

  markAlertAsRead: async (alertId: string, userId: string): Promise<void> => {
    await supabase
      .from('hr_alerts')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        read_by_id: userId,
      })
      .eq('alert_id', alertId);
  },
};

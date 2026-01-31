// =============================================
// COMMON / UTILITY TYPES
// =============================================

// Employment Status & Type (used by both User and HR types)
export enum EmploymentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TERMINATED = 'terminated',
  ON_LEAVE = 'on_leave',
}

export enum EmploymentType {
  FULL_TIME = 'full-time',
  PART_TIME = 'part-time',
  CONTRACT = 'contract',
}

// Checklist item state: OK, Not OK, or not checked
// Supports boolean for backward compatibility with existing data
export type ChecklistItemState = 'ok' | 'not_ok' | boolean | undefined;

// Helper to normalize checklist state (converts legacy boolean to new state)
export const normalizeChecklistState = (value: ChecklistItemState): 'ok' | 'not_ok' | undefined => {
  if (value === true || value === 'ok') return 'ok';
  if (value === false || value === 'not_ok') return 'not_ok';
  return undefined;
};

export type MediaCategory = 'before' | 'after' | 'spare_part' | 'condition' | 'evidence' | 'other';

// Job Assignment Types (for Helper Technician feature)
export type AssignmentType = 'lead' | 'assistant';

export interface SignatureEntry {
  signed_by_name: string;
  signed_at: string;
  signature_url: string;
  department?: string;
  ic_no?: string;
}

// Public Holidays for business day calculations (#7)
export interface PublicHoliday {
  holiday_id: string;
  holiday_date: string; // DATE as ISO string
  name: string;
  year: number;
  created_at?: string;
}

// App Settings for configurable values
export interface AppSetting {
  setting_id: string;
  key: string;
  value: string;
  description?: string;
  updated_at?: string;
  updated_by?: string;
}

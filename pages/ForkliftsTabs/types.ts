import { User } from '../../types';

// ============================================================================
// FORKLIFT TAB TYPES
// ============================================================================

export interface ForkliftsTabsProps {
  currentUser: User;
}

export interface TabProps {
  currentUser: User;
}

export interface ServiceInterval {
  interval_id: string;
  forklift_type: string;
  service_type: string;
  hourmeter_interval: number;
  calendar_interval_days: number | null;
  priority: string;
  checklist_items: string[];
  estimated_duration_hours: number | null;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ForkliftDue {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: string;
  hourmeter: number;
  next_service_due: string | null;
  next_service_hourmeter: number | null;
  days_until_due: number | null;
  hours_until_due: number | null;
  is_overdue: boolean;
  has_open_job: boolean;
  current_customer_id?: string;
}

export type TabType = 'dashboard' | 'fleet' | 'intervals' | 'service-due' | 'hourmeter';

export interface ResultModalState {
  show: boolean;
  type: 'success' | 'error' | 'mixed';
  title: string;
  message: string;
  details?: string[];
}

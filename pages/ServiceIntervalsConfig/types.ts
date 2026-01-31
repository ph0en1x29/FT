import { User } from '../../types';

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

export interface ServiceIntervalFormData {
  forklift_type: string;
  service_type: string;
  hourmeter_interval: number;
  calendar_interval_days: number | null;
  priority: string;
  estimated_duration_hours: number | null;
  name: string;
}

export interface ServiceIntervalsConfigProps {
  currentUser: User;
}

export interface AcwerDefault {
  type: string;
  interval: string;
  hours: number | null;
}

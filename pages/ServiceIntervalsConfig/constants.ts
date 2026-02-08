import { AcwerDefault,ServiceIntervalFormData } from './types';

export const FORKLIFT_TYPES = ['Diesel', 'Electric', 'LPG'];

export const PRIORITIES = ['Low', 'Medium', 'High', 'Emergency'];

export const ACWER_DEFAULTS: AcwerDefault[] = [
  { type: 'Electric', interval: '3 months (calendar)', hours: null },
  { type: 'Diesel', interval: '500 hours', hours: 500 },
  { type: 'LPG', interval: '350 hours', hours: 350 },
];

export const INITIAL_FORM_DATA: ServiceIntervalFormData = {
  forklift_type: 'Diesel',
  service_type: '',
  hourmeter_interval: 500,
  calendar_interval_days: null,
  priority: 'Medium',
  estimated_duration_hours: null,
  name: '',
};

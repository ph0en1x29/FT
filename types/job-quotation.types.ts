// =============================================
// QUOTATION & KPI TYPES
// =============================================

import type { Customer } from './customer.types';
import type { Forklift } from './forklift.types';

// Quotation specific types
export interface QuotationItem {
  item_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  brand?: string;
  model?: string;
  capacity?: string;
  voltage?: string;
  accessory?: string;
  warranty?: string;
}

export interface Quotation {
  quotation_id: string;
  quotation_number: string;
  customer_id: string;
  customer: Customer;
  date: string;
  attention: string;
  reference: string; // RE: line
  items: QuotationItem[];
  sub_total: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  validity: string;
  delivery_site?: string;
  delivery_term: string;
  payment_term: string;
  remark?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  // Reference to job if converted
  job_id?: string;
  forklift_id?: string;
  forklift?: Forklift;
}

// Technician KPI types
export interface TechnicianKPI {
  technician_id: string;
  technician_name: string;
  period_start: string;
  period_end: string;

  // Job metrics
  total_jobs_assigned: number;
  total_jobs_completed: number;
  completion_rate: number;

  // Time metrics (in hours)
  avg_response_time: number; // Time from assignment to arrival
  avg_completion_time: number; // Time from arrival to completion
  total_hours_worked: number;

  // Quality metrics
  jobs_with_callbacks: number; // Jobs that needed follow-up
  customer_satisfaction_avg?: number;

  // Revenue metrics
  total_revenue_generated: number;
  avg_job_value: number;

  // Parts metrics
  total_parts_used: number;

  // Priority breakdown
  emergency_jobs: number;
  high_priority_jobs: number;
  medium_priority_jobs: number;
  low_priority_jobs: number;
}

// Enhanced TechnicianKPI with industry standards
export interface EnhancedTechnicianKPI extends TechnicianKPI {
  // Industry Standard KPIs
  first_time_fix_rate: number; // FTFR - Jobs resolved without return visits (%)
  mean_time_to_repair: number; // MTTR - Average repair time in hours
  technician_utilization: number; // Billable hours / Total hours (%)
  jobs_per_day: number; // Average jobs completed per working day
  repeat_visit_count: number; // Number of callbacks/return visits

  // Job Type Breakdown
  service_jobs: number;
  repair_jobs: number;
  checking_jobs: number;
  slot_in_jobs: number;
  courier_jobs: number;

  // Efficiency Scores (calculated)
  efficiency_score: number; // Overall efficiency rating 0-100
  productivity_score: number; // Jobs completed vs capacity
  quality_score: number; // Based on FTFR and customer satisfaction
}

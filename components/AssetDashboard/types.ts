import React from 'react';
import { User } from '../../types';

export interface AssetDashboardProps {
  currentUser: User;
}

export type OperationalStatus = 
  | 'out_of_service' 
  | 'rented_out' 
  | 'in_service' 
  | 'service_due' 
  | 'awaiting_parts' 
  | 'reserved' 
  | 'available';

/** Rental data from Supabase query */
export interface RentalQueryResult {
  rental_id: string;
  forklift_id: string;
  customer_id: string;
  status: string;
  customers: { name: string } | null;
}

/** Forklift data from getForkliftsWithCustomers */
export interface ForkliftDbRow {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: string;
  hourmeter: number;
  status: string;
  next_service_due: string | null;
  next_service_hourmeter?: number | null;
  current_customer_id?: string | null;
  current_customer?: { name: string } | null;
}

export interface ForkliftWithStatus {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: string;
  hourmeter: number;
  status: string;
  next_service_due: string | null;
  next_service_hourmeter: number | null;
  current_customer_id: string | null;
  current_customer_name: string | null;
  rental_customer_id: string | null;
  rental_customer_name: string | null;
  has_open_job: boolean;
  open_job_id: string | null;
  operational_status: OperationalStatus;
  secondary_badges: string[];
}

export interface StatusCounts {
  out_of_service: number;
  rented_out: number;
  in_service: number;
  service_due: number;
  awaiting_parts: number;
  reserved: number;
  available: number;
  total: number;
}

export interface DashboardMetrics {
  jobs_completed_30d: number;
  avg_job_duration_hours: number;
}

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  description: string;
}

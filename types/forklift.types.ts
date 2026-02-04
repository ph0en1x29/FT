// =============================================
// FORKLIFT / RENTAL / SERVICE TYPES
// =============================================

import type { Customer } from './customer.types';
import type { ChecklistItemState } from './common.types';
import type { JobPriority, Job } from './job.types';

// Forklift/Asset types
export enum ForkliftType {
  ELECTRIC = 'Electric',
  DIESEL = 'Diesel',
  LPG = 'LPG',
  PETROL = 'Petrol',
}

export enum ForkliftStatus {
  // Primary statuses
  AVAILABLE = 'Available',           // Ready for use/rent
  RENTED_OUT = 'Rented Out',         // Currently rented to customer
  IN_SERVICE = 'In Service',         // Currently being serviced (job in progress)
  SERVICE_DUE = 'Service Due',       // PM service coming up
  AWAITING_PARTS = 'Awaiting Parts', // Waiting for parts to complete repair
  OUT_OF_SERVICE = 'Out of Service', // Not operational
  RESERVED = 'Reserved',             // Reserved for upcoming rental/job

  // Legacy statuses (for backwards compatibility)
  ACTIVE = 'Active',                 // @deprecated - use AVAILABLE
  MAINTENANCE = 'Under Maintenance', // @deprecated - use IN_SERVICE
  INACTIVE = 'Inactive',             // @deprecated - use OUT_OF_SERVICE
}

// Forklift Ownership Type
export enum ForkliftOwnership {
  COMPANY = 'company',   // ACWER-owned forklift
  CUSTOMER = 'customer', // Customer-owned forklift (Van Stock usage requires approval)
}

// Forklift Condition Checklist Items
export interface ForkliftConditionChecklist {
  // Drive System
  drive_front_axle?: ChecklistItemState;
  drive_rear_axle?: ChecklistItemState;
  drive_motor_engine?: ChecklistItemState;
  drive_controller_transmission?: ChecklistItemState;

  // Hydraulic System
  hydraulic_pump?: ChecklistItemState;
  hydraulic_control_valve?: ChecklistItemState;
  hydraulic_hose?: ChecklistItemState;
  hydraulic_oil_level?: ChecklistItemState;

  // Safety Devices
  safety_overhead_guard?: ChecklistItemState;
  safety_cabin_body?: ChecklistItemState;
  safety_backrest?: ChecklistItemState;
  safety_seat_belt?: ChecklistItemState;

  // Steering System
  steering_wheel_valve?: ChecklistItemState;
  steering_cylinder?: ChecklistItemState;
  steering_motor?: ChecklistItemState;
  steering_knuckle?: ChecklistItemState;

  // Load Handling System
  load_fork?: ChecklistItemState;
  load_mast_roller?: ChecklistItemState;
  load_chain_wheel?: ChecklistItemState;
  load_cylinder?: ChecklistItemState;

  // Lighting
  lighting_beacon_light?: ChecklistItemState;
  lighting_horn?: ChecklistItemState;
  lighting_buzzer?: ChecklistItemState;
  lighting_rear_view_mirror?: ChecklistItemState;

  // Braking System
  braking_brake_pedal?: ChecklistItemState;
  braking_parking_brake?: ChecklistItemState;
  braking_fluid_pipe?: ChecklistItemState;
  braking_master_pump?: ChecklistItemState;

  // Diesel/LPG/Petrol
  fuel_engine_oil_level?: ChecklistItemState;
  fuel_line_leaks?: ChecklistItemState;
  fuel_radiator?: ChecklistItemState;
  fuel_exhaust_piping?: ChecklistItemState;

  // Tyres
  tyres_front?: ChecklistItemState;
  tyres_rear?: ChecklistItemState;
  tyres_rim?: ChecklistItemState;
  tyres_screw_nut?: ChecklistItemState;

  // Electrical System
  electrical_ignition?: ChecklistItemState;
  electrical_battery?: ChecklistItemState;
  electrical_wiring?: ChecklistItemState;
  electrical_instruments?: ChecklistItemState;

  // Transmission
  transmission_fluid_level?: ChecklistItemState;
  transmission_inching_valve?: ChecklistItemState;
  transmission_air_cleaner?: ChecklistItemState;
  transmission_lpg_regulator?: ChecklistItemState;

  // Wheels
  wheels_drive?: ChecklistItemState;
  wheels_load?: ChecklistItemState;
  wheels_support?: ChecklistItemState;
  wheels_hub_nut?: ChecklistItemState;
}

export interface Forklift {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: ForkliftType;
  hourmeter: number;
  year?: number;
  capacity_kg?: number;
  location?: string;
  status: ForkliftStatus;
  last_service_date?: string;
  next_service_due?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Ownership - determines Van Stock approval requirements
  ownership: ForkliftOwnership; // 'company' = ACWER-owned, 'customer' = customer-owned
  // Customer relationship for rental tracking
  customer_id?: string;
  forklift_no?: string; // Internal forklift number (e.g., FLT 5)
  // Current rental assignment (denormalized for quick lookup)
  current_customer_id?: string;
  current_customer?: Customer; // Populated when fetched with joins
  // Hourmeter-based service prediction (for Diesel/LPG/Petrol)
  last_service_hourmeter?: number; // Hourmeter reading after last service
  service_interval_hours?: number; // Hours between services (default 500)
}

// Rental Status
export enum RentalStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  SCHEDULED = 'scheduled',
}

// Forklift Rental/Assignment
export interface ForkliftRental {
  rental_id: string;
  forklift_id: string;
  customer_id: string;
  start_date: string;
  end_date?: string;
  status: RentalStatus;
  rental_location?: string;
  notes?: string;
  monthly_rental_rate?: number;
  currency?: string;
  created_at: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_at: string;
  ended_at?: string;
  ended_by_id?: string;
  ended_by_name?: string;
  // Populated relations
  forklift?: Forklift;
  customer?: Customer;
}

// Forklift service history entry (includes cancelled jobs)
export interface ForkliftServiceEntry extends Job {
  is_cancelled: boolean; // True if the job was deleted/cancelled
}

// Predictive Maintenance types
export interface ServiceInterval {
  interval_id: string;
  forklift_type: ForkliftType;
  service_type: string; // e.g., "PM Service", "Oil Change", "Full Inspection"
  hourmeter_interval: number; // Every X hours
  calendar_interval_days?: number; // Or every X days
  priority: JobPriority;
  checklist_items?: string[];
  estimated_duration_hours?: number;
  is_active: boolean;
}

export interface ScheduledService {
  scheduled_id: string;
  forklift_id: string;
  forklift?: Forklift;
  service_interval_id?: string;
  service_interval?: ServiceInterval;
  service_type: string;
  due_date: string;
  due_hourmeter?: number;
  estimated_hours?: number;
  status: 'pending' | 'scheduled' | 'completed' | 'overdue' | 'cancelled';
  priority: string;
  assigned_technician_id?: string;
  assigned_technician_name?: string;
  job_id?: string; // Linked job if created
  auto_create_job?: boolean;
  notes?: string;
  created_at: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_at?: string;
  completed_at?: string;
}

// Rental Financial Tracking
export interface RentalFinancials {
  rental_id: string;
  monthly_rental_rate: number;
  currency: string;
  total_rental_revenue: number; // Calculated from rate * months
  total_service_costs: number; // Sum of all service job costs
  net_profit: number; // Revenue - Costs
  rental_months: number;
}

// =============================================
// FLEET DASHBOARD METRICS (per questionnaire)
// =============================================

export interface FleetDashboardMetrics {
  // Must Have metrics
  total_fleet_count: number;
  units_by_status: {
    available: number;
    rented_out: number;
    in_service: number;
    service_due: number;
    awaiting_parts: number;
    out_of_service: number;
    reserved: number;
  };
  service_due_this_week: number;
  jobs_completed_this_month: number;

  // Nice to Have metrics
  average_job_duration_hours?: number;
  most_active_forklifts?: {
    forklift_id: string;
    serial_number: string;
    job_count: number;
  }[];
}

// =============================================
// HOURMETER SERVICE PREDICTION TYPES
// =============================================

/**
 * Individual hourmeter reading record
 */
export interface HourmeterReading {
  reading_id: string;
  forklift_id: string;
  hourmeter_value: number;
  reading_date: string;
  recorded_by_id?: string;
  recorded_by_name?: string;
  job_id?: string;
  is_service_reading: boolean;
  notes?: string;
  created_at: string;
}

/**
 * Service prediction calculation result
 */
export interface ServicePrediction {
  forklift_id: string;
  predicted_date: string;
  days_remaining: number;
  hours_until_service: number;
  avg_daily_hours: number;
  next_service_hourmeter: number;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Service urgency levels for UI display
 */
export type ServiceUrgency = 'overdue' | 'due_soon' | 'upcoming' | 'ok';

/**
 * Forklift with service prediction data (from view)
 */
export interface ForkliftWithPrediction extends Forklift {
  last_service_hourmeter: number;
  service_interval_hours: number;
  predicted_date?: string;
  days_remaining?: number;
  hours_until_service?: number;
  avg_daily_hours?: number;
  next_service_hourmeter?: number;
  confidence?: 'low' | 'medium' | 'high';
  service_urgency?: ServiceUrgency;
}

/**
 * Dashboard widget data for service predictions
 */
export interface ServicePredictionDashboard {
  overdue: ForkliftWithPrediction[];
  due_this_week: ForkliftWithPrediction[];
  upcoming_two_weeks: ForkliftWithPrediction[];
  total_engine_forklifts: number;
}

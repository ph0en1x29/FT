// =============================================
// INVENTORY / PARTS / VAN STOCK TYPES
// =============================================

import type { User } from './user.types';

export interface Part {
  part_id: string;
  part_name: string;
  part_code: string;
  category: string;
  cost_price: number;
  sell_price: number;
  warranty_months: number;
  stock_quantity: number;
  // New fields for inventory tracking
  last_updated_by?: string;
  last_updated_by_name?: string;
  updated_at?: string;
  min_stock_level?: number;
  supplier?: string;
  location?: string;
}

export interface JobPartUsed {
  job_part_id: string;
  job_id: string;
  part_id: string;
  part_name: string;
  quantity: number;
  sell_price_at_time: number;
  // Van Stock tracking
  from_van_stock?: boolean; // True if part came from Van Stock
  van_stock_item_id?: string; // Reference to VanStockItem if from Van Stock
}

// =============================================
// VAN STOCK SYSTEM
// =============================================

// Van Stock Assignment - Links technician to their Van Stock inventory
export type VanStatus = 'active' | 'in_service' | 'decommissioned';
export type VanAccessRequestStatus = 'pending' | 'approved' | 'rejected';
export type VanAuditAction = 'status_change' | 'temp_assigned' | 'temp_removed' | 'request_submitted' | 'request_approved' | 'request_rejected' | 'van_created' | 'van_updated';

export interface VanStock {
  van_stock_id: string;
  technician_id: string;
  technician_name?: string;
  technician?: User;

  // Van identification
  van_code?: string; // Internal van identifier (e.g., "Van A")
  van_plate?: string; // License plate number
  notes?: string; // Optional notes about this van

  // Fleet management
  van_status: VanStatus;
  temporary_tech_id?: string | null;
  temporary_tech_name?: string | null;
  temp_assigned_at?: string | null;

  // Configuration
  max_items: number; // Default 50 SKUs
  is_active: boolean;

  // Metadata
  created_at: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_at: string;
  last_audit_at?: string;
  next_audit_due?: string;

  // Populated on fetch
  items?: VanStockItem[];
  total_value?: number;
}

// Individual item in a technician's Van Stock
export interface VanStockItem {
  item_id: string;
  van_stock_id: string;
  part_id: string;
  part?: Part;

  // Quantities
  quantity: number;
  min_quantity: number; // Trigger replenishment when below this
  max_quantity: number; // Maximum to carry

  // Tracking
  last_replenished_at?: string;
  last_used_at?: string;

  // For specialty variation
  is_core_item: boolean; // True = standard item, False = specialty variation

  // Metadata
  created_at: string;
  updated_at: string;
}

// Van Stock usage record (when technician uses parts from Van Stock)
export interface VanStockUsage {
  usage_id: string;
  van_stock_item_id: string;
  job_id: string;
  job_part_id?: string;

  quantity_used: number;
  used_at: string;
  used_by_id: string;
  used_by_name: string;

  // For customer-owned forklifts - approval tracking
  requires_approval: boolean;
  approved_by_id?: string;
  approved_by_name?: string;
  approved_at?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;

  // Relations (populated on fetch)
  van_stock_item?: VanStockItem;
  job?: { job_id: string; title: string };
}

// Replenishment request status
export type ReplenishmentStatus = 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled';

// Van Stock Replenishment Request
export interface VanStockReplenishment {
  replenishment_id: string;
  van_stock_id: string;
  technician_id: string;
  technician_name?: string;

  // Request details
  status: ReplenishmentStatus;
  request_type: 'manual' | 'auto_slot_in' | 'low_stock'; // auto_slot_in = triggered by Slot-In job
  triggered_by_job_id?: string; // If auto-triggered by Slot-In

  // Items to replenish
  items: VanStockReplenishmentItem[];

  // Workflow
  requested_at: string;
  requested_by_id?: string;
  requested_by_name?: string;

  // Admin 2 (Store) approval
  approved_by_id?: string;
  approved_by_name?: string;
  approved_at?: string;

  // Fulfillment
  fulfilled_at?: string;
  fulfilled_by_id?: string;
  fulfilled_by_name?: string;

  // Technician confirmation
  confirmed_by_technician: boolean;
  confirmed_at?: string;
  confirmation_photo_url?: string;

  // Notes
  notes?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// Individual item in a replenishment request
export interface VanStockReplenishmentItem {
  item_id: string;
  replenishment_id: string;
  van_stock_item_id: string;
  part_id: string;
  part_name: string;
  part_code: string;

  quantity_requested: number;
  quantity_issued: number;

  // Serial numbers for warranty tracking
  serial_numbers?: string[];

  // Rejection tracking
  is_rejected: boolean;
  rejection_reason?: string;
}

// Van Stock Audit
export type AuditStatus = 'scheduled' | 'in_progress' | 'completed' | 'discrepancy_found';

export interface VanStockAudit {
  audit_id: string;
  van_stock_id: string;
  technician_id: string;
  technician_name?: string;

  // Schedule
  scheduled_date: string;
  status: AuditStatus;

  // Audit details
  started_at?: string;
  completed_at?: string;
  audited_by_id?: string; // Admin 2 (Store)
  audited_by_name?: string;

  // Results
  items_audited: VanStockAuditItem[];
  total_expected_value: number;
  total_actual_value: number;
  discrepancy_value: number;

  // Resolution
  discrepancy_notes?: string;
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by_id?: string;
  resolved_by_name?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// Individual item in an audit
export interface VanStockAuditItem {
  audit_item_id: string;
  audit_id: string;
  van_stock_item_id: string;
  part_id: string;
  part_name: string;

  expected_quantity: number;
  actual_quantity: number;
  discrepancy: number; // actual - expected

  notes?: string;
}

// Van access request (tech requesting temp access to another van)
export interface VanAccessRequest {
  request_id: string;
  van_stock_id: string;
  requester_id: string;
  requester_name: string;
  reason: string;
  status: VanAccessRequestStatus;
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  created_at: string;
  // Joined fields
  van_plate?: string;
  van_code?: string;
  van_tech_name?: string;
}

// Van audit log entry
export interface VanAuditLogEntry {
  id: string;
  van_stock_id: string;
  action: VanAuditAction;
  performed_by_id: string;
  performed_by_name: string;
  target_tech_id?: string;
  target_tech_name?: string;
  reason?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

// Fleet overview item (lightweight van info for admin panel)
export interface VanFleetItem {
  van_stock_id: string;
  van_code?: string;
  van_plate?: string;
  van_status: VanStatus;
  technician_id: string;
  technician_name?: string;
  temporary_tech_id?: string | null;
  temporary_tech_name?: string | null;
  item_count: number;
  is_active: boolean;
}

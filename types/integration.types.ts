// =============================================
// AUTOCOUNT INTEGRATION (Invoice Export Only)
// =============================================

export type AutoCountExportStatus = 'pending' | 'exported' | 'failed' | 'cancelled';

// AutoCount invoice export record
export interface AutoCountExport {
  export_id: string;
  job_id: string;

  // Export details
  export_type: 'invoice' | 'credit_note';
  autocount_invoice_number?: string; // Invoice number in AutoCount after export
  status: AutoCountExportStatus;

  // Invoice data snapshot (at time of export)
  customer_code?: string;          // AutoCount customer code
  customer_name: string;
  invoice_date: string;
  due_date?: string;
  total_amount: number;
  tax_amount?: number;
  currency: string;                // Default: MYR

  // Line items
  line_items: AutoCountLineItem[];

  // Export tracking
  exported_at?: string;
  exported_by_id?: string;
  exported_by_name?: string;
  export_error?: string;

  // Retry tracking
  retry_count: number;
  last_retry_at?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// AutoCount line item for export
export interface AutoCountLineItem {
  item_code?: string;              // AutoCount item code (if mapped)
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_code?: string;               // AutoCount tax code

  // Source tracking
  source_type: 'labor' | 'part' | 'extra_charge';
  source_id?: string;              // job_part_id or extra_charge reference
}

// AutoCount customer mapping (for syncing customer codes)
export interface AutoCountCustomerMapping {
  mapping_id: string;
  customer_id: string;             // FieldPro customer ID
  autocount_customer_code: string; // AutoCount customer code
  autocount_customer_name?: string;
  is_active: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// AutoCount item mapping (for syncing part codes)
export interface AutoCountItemMapping {
  mapping_id: string;
  part_id: string;                 // FieldPro part ID
  autocount_item_code: string;     // AutoCount item code
  autocount_item_name?: string;
  is_active: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// AutoCount export settings
export interface AutoCountSettings {
  is_enabled: boolean;
  api_endpoint?: string;
  company_code?: string;
  default_tax_code?: string;
  default_currency: string;
  auto_export_on_finalize: boolean; // Auto-export when job is finalized
  labor_item_code?: string;         // Default item code for labor charges
  extra_charge_item_code?: string;  // Default item code for extra charges
  updated_at: string;
  updated_by_id?: string;
  updated_by_name?: string;
}

// Default AutoCount settings
export const DEFAULT_AUTOCOUNT_SETTINGS: Partial<AutoCountSettings> = {
  is_enabled: false,
  default_currency: 'MYR',
  auto_export_on_finalize: false,
};

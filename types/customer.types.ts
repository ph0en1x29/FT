// =============================================
// CUSTOMER TYPES
// =============================================

export interface Customer {
  customer_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  contact_person?: string; // Attention person
  account_number?: string; // A/C No
  registration_no?: string; // SSM registration number
  tax_entity_id?: string; // Malaysian Tax ID
  credit_term?: string; // e.g. '30 DAYS', 'C.O.D.', 'CASH'
  agent?: string; // Sales agent code
  phone_secondary?: string; // Secondary phone
}

// Customer Acknowledgement for deferred completion (#8)
export interface CustomerAcknowledgement {
  ack_id: string;
  job_id: string;
  customer_id: string;
  status: 'pending' | 'acknowledged' | 'disputed' | 'auto_completed';
  access_token?: string;
  token_expires_at?: string;
  responded_at?: string;
  response_method?: 'portal' | 'email' | 'phone' | 'auto';
  response_notes?: string;
  customer_signature?: string;
  signed_at?: string;
  created_at: string;
  updated_at: string;
}

// Customer Financial Summary
export interface CustomerFinancialSummary {
  customer_id: string;
  customer_name: string;
  total_rental_revenue: number;
  total_service_revenue: number;
  total_parts_revenue: number;
  total_labor_revenue: number;
  total_extra_charges: number;
  grand_total: number;
  active_rentals: number;
  total_forklifts_rented: number;
}

// Customer Contacts (PICs - Persons In Charge)
export interface CustomerContact {
  contact_id: string;
  customer_id: string;
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  is_primary: boolean;
  created_at?: string;
  updated_at?: string;
}

// Customer Sites
export interface CustomerSite {
  site_id: string;
  customer_id: string;
  site_name: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerAlias {
  alias_id: string;
  customer_id: string;
  source_system: string;
  alias_name: string;
  normalized_alias: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerSiteAlias {
  alias_id: string;
  site_id: string;
  source_system: string;
  alias_name: string;
  normalized_alias: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

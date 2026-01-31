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

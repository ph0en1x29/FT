/**
 * Customer Service
 * 
 * Handles customer CRUD operations
 */

import type { Customer, CustomerContact, CustomerSite, ExtraCharge, Job, JobPartUsed } from '../types';
import { supabase } from './supabaseClient';

export interface CustomersPageFilters {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomersPage {
  customers: Customer[];
  total: number;
  page: number;
  pageSize: number;
}

const CUSTOMERS_SELECT = 'customer_id, name, phone, email, address, notes, contact_person, account_number, registration_no, tax_entity_id, credit_term, agent, phone_secondary';
const CUSTOMERS_PAGE_SIZE = 50;

// Database row types for query results
interface RentalRow {
  monthly_rental_rate?: number;
  start_date: string;
  end_date?: string;
  status?: string;
}

interface JobWithRelations extends Omit<Job, 'parts_used' | 'extra_charges'> {
  parts_used?: JobPartUsed[];
  extra_charges?: ExtraCharge[];
  deleted_at?: string | null;
}

/**
 * Get all customers
 */
export const getCustomers = async (): Promise<Customer[]> => {
  // Supabase default limit is 1000 — fetch all with pagination
  const PAGE_SIZE = 1000;
  const allCustomers: Customer[] = [];
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select('customer_id, name, phone, email, address, notes, contact_person, account_number, registration_no, tax_entity_id, credit_term, agent, phone_secondary')
      .eq('is_active', true)
      .order('name')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    allCustomers.push(...(data as Customer[]));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  
  return allCustomers;
};

/**
 * Get customers for dropdown lists (lightweight)
 */
export const getCustomersForList = async (): Promise<Pick<Customer, 'customer_id' | 'name' | 'address'>[]> => {
  const PAGE_SIZE = 1000;
  const all: Pick<Customer, 'customer_id' | 'name' | 'address'>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select('customer_id, name, address')
      .eq('is_active', true)
      .order('name')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    all.push(...(data as Pick<Customer, 'customer_id' | 'name' | 'address'>[]));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
};

/**
 * Get a single customer by ID
 */
export const getCustomerById = async (customerId: string): Promise<Customer | null> => {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMERS_SELECT)
    .eq('customer_id', customerId)
    .single();

  if (error) return null;
  return data as Customer;
};

/**
 * Search customers by name (server-side, lightweight)
 * Returns customer_id + name + is_active — use for dropdown search.
 * Includes inactive customers so admins can create jobs for them;
 * callers should append "(Inactive)" to the label when is_active is false.
 */
export const searchCustomers = async (
  query: string,
  limit = 20
): Promise<Pick<Customer, 'customer_id' | 'name' | 'is_active'>[]> => {
  const escaped = query.trim().replace(/[%_]/g, '');
  if (!escaped) {
    const { data, error } = await supabase
      .from('customers')
      .select('customer_id, name, is_active')
      .order('is_active', { ascending: false }) // active first
      .order('name')
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []) as Pick<Customer, 'customer_id' | 'name' | 'is_active'>[];
  }

  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, name, is_active')
    .ilike('name', `%${escaped}%`)
    .order('is_active', { ascending: false }) // active first
    .order('name')
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as Pick<Customer, 'customer_id' | 'name' | 'is_active'>[];
};

/**
 * Get a paginated page of customers with server-side search
 */
export const getCustomersPage = async (filters: CustomersPageFilters = {}): Promise<CustomersPage> => {
  const page = Math.max(filters.page || 1, 1);
  const pageSize = Math.max(filters.pageSize || CUSTOMERS_PAGE_SIZE, 1);
  const searchQuery = filters.searchQuery?.trim() || '';

  let query = supabase
    .from('customers')
    .select(CUSTOMERS_SELECT, { count: 'exact' })
    .eq('is_active', true)
    .order('name')
    .range((page - 1) * pageSize, (page * pageSize) - 1);

  if (searchQuery) {
    const escaped = searchQuery.replace(/[%_,]/g, '');
    query = query.or(
      `name.ilike.%${escaped}%,address.ilike.%${escaped}%,email.ilike.%${escaped}%,account_number.ilike.%${escaped}%,agent.ilike.%${escaped}%,phone.ilike.%${escaped}%,phone_secondary.ilike.%${escaped}%,registration_no.ilike.%${escaped}%,tax_entity_id.ilike.%${escaped}%,credit_term.ilike.%${escaped}%,contact_person.ilike.%${escaped}%,notes.ilike.%${escaped}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    customers: (data || []) as Customer[],
    total: count || 0,
    page,
    pageSize,
  };
};

/**
 * Create a new customer
 */
export const createCustomer = async (customerData: Partial<Customer>): Promise<Customer> => {
  const { data, error } = await supabase
    .from('customers')
    .insert(customerData)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Customer;
};

/**
 * Update an existing customer
 */
export const updateCustomer = async (customerId: string, updates: Partial<Customer>): Promise<Customer> => {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('customer_id', customerId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Customer;
};

/**
 * Delete a customer (only if no active jobs)
 */
export const deleteCustomer = async (customerId: string): Promise<void> => {
  // Check for active (non-deleted) jobs only
  const { data: activeJobs } = await supabase
    .from('jobs')
    .select('job_id')
    .eq('customer_id', customerId)
    .is('deleted_at', null);
  
  if (activeJobs && activeJobs.length > 0) {
    throw new Error('Cannot delete customer with existing jobs. Delete the jobs first.');
  }

  // Check for rented forklifts
  const { data: rentedForklifts } = await supabase
    .from('forklifts')
    .select('forklift_id')
    .eq('current_customer_id', customerId);

  if (rentedForklifts && rentedForklifts.length > 0) {
    throw new Error('Cannot delete customer with active rentals. Return all forklifts first.');
  }

  // Get ALL jobs for this customer (including soft-deleted ones)
  const { data: allJobs } = await supabase
    .from('jobs')
    .select('job_id')
    .eq('customer_id', customerId);

  // Delete FK-dependent records for each job
  if (allJobs && allJobs.length > 0) {
    const jobIds = allJobs.map(j => j.job_id);

    // Delete from all FK-dependent tables
    await Promise.all([
      supabase.from('hourmeter_history').delete().in('job_id', jobIds),
      supabase.from('job_inventory_usage').delete().in('job_id', jobIds),
      supabase.from('job_invoice_extra_charges').delete().in('job_id', jobIds),
      supabase.from('job_invoices').delete().in('job_id', jobIds),
      supabase.from('job_service_records').delete().in('job_id', jobIds),
      supabase.from('job_status_history').delete().in('job_id', jobIds),
      supabase.from('job_audit_log').delete().in('job_id', jobIds),
      supabase.from('job_parts').delete().in('job_id', jobIds),
      supabase.from('job_media').delete().in('job_id', jobIds),
      supabase.from('extra_charges').delete().in('job_id', jobIds),
      supabase.from('notifications').delete().in('reference_id', jobIds),
    ]);

    // Now delete all jobs
    await supabase.from('jobs').delete().in('job_id', jobIds);
  }

  // Delete customer child records
  await supabase.from('customer_contacts').delete().eq('customer_id', customerId);
  await supabase.from('customer_sites').delete().eq('customer_id', customerId);

  // Finally delete the customer
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('customer_id', customerId);

  if (error) throw new Error(error.message);
};

/**
 * Get customer financial summary
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getCustomerFinancialSummary = async (customerId: string): Promise<any> => {
  try {
    // Get all rentals for customer
    const { data: rentals, error: rentalsError } = await supabase
      .from('forklift_rentals')
      .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*)`)
      .eq('customer_id', customerId);
    
    if (rentalsError) {
      /* Silently ignore */
    }
    
    // Get all jobs for customer
    const { data: jobs } = await supabase
      .from('jobs')
      .select(`*, parts_used:job_parts(*), extra_charges:extra_charges(*)`)
      .eq('customer_id', customerId);

    // Calculate rental revenue
    let totalRentalRevenue = 0;
    ((rentals || []) as RentalRow[]).forEach((rental) => {
      const rate = rental.monthly_rental_rate || 0;
      if (rate > 0) {
        const startDate = new Date(rental.start_date);
        const endDate = rental.end_date ? new Date(rental.end_date) : new Date();
        const months = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        totalRentalRevenue += rate * months;
      }
    });

    // Calculate service revenue
    let totalServiceRevenue = 0;
    let totalPartsRevenue = 0;
    let totalLaborRevenue = 0;
    let totalExtraCharges = 0;

    ((jobs || []) as JobWithRelations[]).forEach((job) => {
      // Skip parts in pending_return / returned — they were never billable.
      const partsTotal = (job.parts_used || []).reduce((sum: number, p: JobPartUsed) =>
        (p.return_status === 'pending_return' || p.return_status === 'returned')
          ? sum
          : sum + (p.sell_price_at_time * p.quantity), 0);
      const laborCost = job.labor_cost || 0;
      const extraCharges = (job.extra_charges || []).reduce((sum: number, c: ExtraCharge) => 
        sum + c.amount, 0);

      totalPartsRevenue += partsTotal;
      totalLaborRevenue += laborCost;
      totalExtraCharges += extraCharges;
      totalServiceRevenue += partsTotal + laborCost + extraCharges;
    });

    return {
      customer_id: customerId,
      total_rental_revenue: totalRentalRevenue,
      total_service_revenue: totalServiceRevenue,
      total_parts_revenue: totalPartsRevenue,
      total_labor_revenue: totalLaborRevenue,
      total_extra_charges: totalExtraCharges,
      grand_total: totalRentalRevenue + totalServiceRevenue,
      active_rentals: ((rentals || []) as RentalRow[]).filter((r) => r.status === 'active').length,
      total_jobs: (jobs || []).length,
    };
  } catch (_e) {
    return null;
  }
};

/**
 * Get customer jobs including cancelled ones
 */
export const getCustomerJobsWithCancelled = async (customerId: string): Promise<(Job & { is_cancelled: boolean })[]> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
        forklift:forklifts!forklift_id(*),
        parts_used:job_parts(*),
        media:job_media!job_media_job_id_fkey(*),
        extra_charges:extra_charges(*)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return ((data || []) as JobWithRelations[]).map((job) => ({
      ...job,
      is_cancelled: job.deleted_at !== null,
    })) as (Job & { is_cancelled: boolean })[];
  } catch (_e) {
    return [];
  }
};

/**
 * Get customer contacts (PICs)
 */
export const getCustomerContacts = async (customerId: string): Promise<CustomerContact[]> => {
  const { data, error } = await supabase
    .from('customer_contacts')
    .select('contact_id, customer_id, name, phone, email, role, is_primary, created_at, updated_at')
    .eq('customer_id', customerId)
    .order('is_primary', { ascending: false })
    .order('name');
  if (error) throw new Error(error.message);
  return data as CustomerContact[];
};

/**
 * Add a new customer contact
 */
export const addCustomerContact = async (contact: Omit<CustomerContact, 'contact_id' | 'created_at' | 'updated_at'>): Promise<CustomerContact> => {
  const { data, error } = await supabase
    .from('customer_contacts')
    .insert(contact)
    .select('contact_id, customer_id, name, phone, email, role, is_primary, created_at, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as CustomerContact;
};

/**
 * Update a customer contact
 */
export const updateCustomerContact = async (contactId: string, updates: Partial<CustomerContact>): Promise<CustomerContact> => {
  const { data, error } = await supabase
    .from('customer_contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('contact_id', contactId)
    .select('contact_id, customer_id, name, phone, email, role, is_primary, created_at, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as CustomerContact;
};

/**
 * Delete a customer contact
 */
export const deleteCustomerContact = async (contactId: string): Promise<void> => {
  const { error } = await supabase.from('customer_contacts').delete().eq('contact_id', contactId);
  if (error) throw new Error(error.message);
};

/**
 * Get customer sites
 */
export const getCustomerSites = async (customerId: string): Promise<CustomerSite[]> => {
  const { data, error } = await supabase
    .from('customer_sites')
    .select('site_id, customer_id, site_name, address, notes, is_active, created_at, updated_at')
    .eq('customer_id', customerId)
    .order('site_name');
  if (error) throw new Error(error.message);
  return data as CustomerSite[];
};

/**
 * Add a new customer site
 */
export const addCustomerSite = async (site: Omit<CustomerSite, 'site_id' | 'created_at' | 'updated_at'>): Promise<CustomerSite> => {
  const { data, error } = await supabase
    .from('customer_sites')
    .insert(site)
    .select('site_id, customer_id, site_name, address, notes, is_active, created_at, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as CustomerSite;
};

/**
 * Update a customer site
 */
export const updateCustomerSite = async (siteId: string, updates: Partial<CustomerSite>): Promise<CustomerSite> => {
  const { data, error } = await supabase
    .from('customer_sites')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('site_id', siteId)
    .select('site_id, customer_id, site_name, address, notes, is_active, created_at, updated_at')
    .single();
  if (error) throw new Error(error.message);
  return data as CustomerSite;
};

/**
 * Delete a customer site
 */
export const deleteCustomerSite = async (siteId: string): Promise<void> => {
  const { error } = await supabase.from('customer_sites').delete().eq('site_id', siteId);
  if (error) throw new Error(error.message);
};

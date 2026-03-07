/**
 * Customer Service
 * 
 * Handles customer CRUD operations
 */

import type { Customer, CustomerContact, CustomerSite, ExtraCharge, Job, JobPartUsed } from '../types';
import { supabase } from './supabaseClient';

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
  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, name, phone, email, address, notes, contact_person, account_number')
    .order('name');

  if (error) throw new Error(error.message);
  return data as Customer[];
};

/**
 * Get customers for dropdown lists (lightweight)
 */
export const getCustomersForList = async (): Promise<Pick<Customer, 'customer_id' | 'name' | 'address'>[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('customer_id, name, address')
    .order('name');

  if (error) throw new Error(error.message);
  return data as Pick<Customer, 'customer_id' | 'name' | 'address'>[];
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
      const partsTotal = (job.parts_used || []).reduce((sum: number, p: JobPartUsed) => 
        sum + (p.sell_price_at_time * p.quantity), 0);
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
        media:job_media(*),
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

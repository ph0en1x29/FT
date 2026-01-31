/**
 * Customer Service
 * 
 * Handles customer CRUD operations
 */

import { supabase } from './supabaseClient';
import type { Customer } from '../types';

/**
 * Get all customers
 */
export const getCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
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
  const { data: jobs } = await supabase
    .from('jobs')
    .select('job_id')
    .eq('customer_id', customerId)
    .is('deleted_at', null);
  
  if (jobs && jobs.length > 0) {
    throw new Error('Cannot delete customer with existing jobs. Delete the jobs first.');
  }

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('customer_id', customerId);

  if (error) throw new Error(error.message);
};

/**
 * Get customer financial summary
 */
export const getCustomerFinancialSummary = async (customerId: string): Promise<any> => {
  try {
    // Get all rentals for customer
    const { data: rentals, error: rentalsError } = await supabase
      .from('forklift_rentals')
      .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*)`)
      .eq('customer_id', customerId);
    
    if (rentalsError) {
      console.warn('Failed to get customer rentals:', rentalsError.message);
    }
    
    // Get all jobs for customer
    const { data: jobs } = await supabase
      .from('jobs')
      .select(`*, parts_used:job_parts(*), extra_charges:extra_charges(*)`)
      .eq('customer_id', customerId);

    // Calculate rental revenue
    let totalRentalRevenue = 0;
    (rentals || []).forEach((rental: any) => {
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

    (jobs || []).forEach((job: any) => {
      const partsTotal = (job.parts_used || []).reduce((sum: number, p: any) => 
        sum + (p.sell_price_at_time * p.quantity), 0);
      const laborCost = job.labor_cost || 0;
      const extraCharges = (job.extra_charges || []).reduce((sum: number, c: any) => 
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
      active_rentals: (rentals || []).filter((r: any) => r.status === 'active').length,
      total_jobs: (jobs || []).length,
    };
  } catch (e) {
    console.warn('Failed to get customer financial summary:', e);
    return null;
  }
};

/**
 * Get customer jobs including cancelled ones
 */
export const getCustomerJobsWithCancelled = async (customerId: string): Promise<any[]> => {
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
      console.warn('Customer jobs with cancelled query failed:', error.message);
      return [];
    }

    return (data || []).map((job: any) => ({
      ...job,
      is_cancelled: job.deleted_at !== null,
    }));
  } catch (e) {
    console.warn('Customer jobs with cancelled not available:', e);
    return [];
  }
};

/**
 * Rental Service
 * 
 * Handles forklift rental operations: assign, end, extend, bulk operations
 */

import { supabase } from './supabaseClient';
import type { ForkliftRental, RentalStatus } from '../types';

// =====================
// RENTAL QUERIES
// =====================

export const getActiveRentalForForklift = async (forkliftId: string): Promise<{
  rental_id: string;
  customer_id: string;
  customer_name: string;
  customer_address: string;
  rental_location: string;
  start_date: string;
  end_date?: string;
} | null> => {
  try {
    const { data, error } = await supabase
      .from('forklift_rentals')
      .select(`
        rental_id,
        customer_id,
        rental_location,
        start_date,
        end_date,
        customers (name, address)
      `)
      .eq('forklift_id', forkliftId)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) return null;

    const customer = data.customers as { name: string; address: string } | null;
    return {
      rental_id: data.rental_id,
      customer_id: data.customer_id,
      customer_name: customer?.name || 'Unknown',
      customer_address: customer?.address || '',
      rental_location: data.rental_location || '',
      start_date: data.start_date,
      end_date: data.end_date,
    };
  } catch (e) {
    return null;
  }
};

export const getRentals = async (filters?: { forklift_id?: string; customer_id?: string; status?: RentalStatus }): Promise<ForkliftRental[]> => {
  try {
    let query = supabase
      .from('forklift_rentals')
      .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*), customer:customers(*)`)
      .order('created_at', { ascending: false });

    if (filters?.forklift_id) query = query.eq('forklift_id', filters.forklift_id);
    if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return data as ForkliftRental[];
  } catch (e) {
    return [];
  }
};

export const getForkliftRentals = async (forkliftId: string): Promise<ForkliftRental[]> => {
  try {
    const { data, error } = await supabase
      .from('forklift_rentals')
      .select(`*, customer:customers(*)`)
      .eq('forklift_id', forkliftId)
      .order('start_date', { ascending: false });

    if (error) {
      return [];
    }
    return data as ForkliftRental[];
  } catch (e) {
    return [];
  }
};

export const getCustomerRentals = async (customerId: string): Promise<ForkliftRental[]> => {
  try {
    const { data, error } = await supabase
      .from('forklift_rentals')
      .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*)`)
      .eq('customer_id', customerId)
      .order('start_date', { ascending: false });

    if (error) {
      return [];
    }
    return data as ForkliftRental[];
  } catch (e) {
    return [];
  }
};

export const getCustomerActiveRentals = async (customerId: string): Promise<ForkliftRental[]> => {
  try {
    const { data, error } = await supabase
      .from('forklift_rentals')
      .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*)`)
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('start_date', { ascending: false });

    if (error) {
      return [];
    }
    return data as ForkliftRental[];
  } catch (e) {
    return [];
  }
};

// =====================
// RENTAL MUTATIONS
// =====================

export const assignForkliftToCustomer = async (
  forkliftId: string, 
  customerId: string, 
  startDate: string, 
  endDate?: string,
  notes?: string,
  createdById?: string,
  createdByName?: string,
  monthlyRentalRate?: number
): Promise<ForkliftRental> => {
  const { data: existingRental } = await supabase
    .from('forklift_rentals')
    .select('rental_id')
    .eq('forklift_id', forkliftId)
    .eq('status', 'active')
    .single();

  if (existingRental) {
    throw new Error('Forklift is already assigned to a customer. End the current rental first.');
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('address')
    .eq('customer_id', customerId)
    .single();

  const { data, error } = await supabase
    .from('forklift_rentals')
    .insert({
      forklift_id: forkliftId,
      customer_id: customerId,
      start_date: startDate,
      end_date: endDate || null,
      status: 'active',
      notes: notes || null,
      rental_location: customer?.address || null,
      created_by_id: createdById || null,
      created_by_name: createdByName || null,
      monthly_rental_rate: monthlyRentalRate || 0,
      currency: 'RM',
    })
    .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*), customer:customers(*)`)
    .single();

  if (error) throw new Error(error.message);

  await supabase
    .from('forklifts')
    .update({
      current_customer_id: customerId,
      location: customer?.address || null,
      updated_at: new Date().toISOString(),
    })
    .eq('forklift_id', forkliftId);

  return data as ForkliftRental;
};

export const endRental = async (
  rentalId: string, 
  endDate?: string,
  endedById?: string,
  endedByName?: string
): Promise<ForkliftRental> => {
  const { data: rental } = await supabase
    .from('forklift_rentals')
    .select('forklift_id')
    .eq('rental_id', rentalId)
    .single();

  const { data, error } = await supabase
    .from('forklift_rentals')
    .update({
      status: 'ended',
      end_date: endDate || new Date().toISOString().split('T')[0],
      ended_at: new Date().toISOString(),
      ended_by_id: endedById || null,
      ended_by_name: endedByName || null,
      updated_at: new Date().toISOString(),
    })
    .eq('rental_id', rentalId)
    .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*), customer:customers(*)`)
    .single();

  if (error) throw new Error(error.message);

  if (rental?.forklift_id) {
    await supabase
      .from('forklifts')
      .update({
        current_customer_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('forklift_id', rental.forklift_id);
  }

  return data as ForkliftRental;
};

export const updateRental = async (rentalId: string, updates: { start_date?: string; end_date?: string; notes?: string; monthly_rental_rate?: number }): Promise<ForkliftRental> => {
  const { data, error } = await supabase
    .from('forklift_rentals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('rental_id', rentalId)
    .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*), customer:customers(*)`)
    .single();

  if (error) throw new Error(error.message);
  return data as ForkliftRental;
};

export const updateRentalRate = async (rentalId: string, monthlyRate: number, currency: string = 'RM'): Promise<ForkliftRental | null> => {
  try {
    const { data, error } = await supabase
      .from('forklift_rentals')
      .update({
        monthly_rental_rate: monthlyRate,
        currency: currency,
        updated_at: new Date().toISOString(),
      })
      .eq('rental_id', rentalId)
      .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*), customer:customers(*)`)
      .single();

    if (error) {
      return null;
    }
    return data as ForkliftRental;
  } catch (e) {
    return null;
  }
};

// =====================
// BULK RENTAL OPERATIONS
// =====================

export const bulkAssignForkliftsToCustomer = async (
  forkliftIds: string[],
  customerId: string,
  startDate: string,
  endDate?: string,
  notes?: string,
  createdById?: string,
  createdByName?: string,
  monthlyRentalRate?: number
): Promise<{ success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] }> => {
  const results: { success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] } = {
    success: [],
    failed: []
  };

  const { data: customer } = await supabase
    .from('customers')
    .select('address')
    .eq('customer_id', customerId)
    .single();

  for (const forkliftId of forkliftIds) {
    try {
      const { data: existingRental } = await supabase
        .from('forklift_rentals')
        .select('rental_id')
        .eq('forklift_id', forkliftId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingRental) {
        results.failed.push({ forkliftId, error: 'Already rented to another customer' });
        continue;
      }

      const { data, error } = await supabase
        .from('forklift_rentals')
        .insert({
          forklift_id: forkliftId,
          customer_id: customerId,
          start_date: startDate,
          end_date: endDate || null,
          status: 'active',
          notes: notes || null,
          rental_location: customer?.address || null,
          created_by_id: createdById || null,
          created_by_name: createdByName || null,
          monthly_rental_rate: monthlyRentalRate || 0,
          currency: 'RM',
        })
        .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*), customer:customers(*)`)
        .single();

      if (error) {
        results.failed.push({ forkliftId, error: error.message });
        continue;
      }

      await supabase
        .from('forklifts')
        .update({
          current_customer_id: customerId,
          location: customer?.address || null,
          updated_at: new Date().toISOString(),
        })
        .eq('forklift_id', forkliftId);

      results.success.push(data as ForkliftRental);
    } catch (e) {
      results.failed.push({ forkliftId, error: (e as Error).message });
    }
  }

  return results;
};

export const bulkEndRentals = async (
  forkliftIds: string[],
  endDate?: string,
  endedById?: string,
  endedByName?: string
): Promise<{ success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] }> => {
  const results: { success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] } = {
    success: [],
    failed: []
  };

  for (const forkliftId of forkliftIds) {
    try {
      const { data: activeRental, error: findError } = await supabase
        .from('forklift_rentals')
        .select('rental_id')
        .eq('forklift_id', forkliftId)
        .eq('status', 'active')
        .maybeSingle();

      if (findError || !activeRental) {
        results.failed.push({ forkliftId, error: 'No active rental found' });
        continue;
      }

      const { data, error } = await supabase
        .from('forklift_rentals')
        .update({
          status: 'ended',
          end_date: endDate || new Date().toISOString().split('T')[0],
          ended_at: new Date().toISOString(),
          ended_by_id: endedById || null,
          ended_by_name: endedByName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('rental_id', activeRental.rental_id)
        .select(`*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*), customer:customers(*)`)
        .single();

      if (error) {
        results.failed.push({ forkliftId, error: error.message });
        continue;
      }

      await supabase
        .from('forklifts')
        .update({ current_customer_id: null, updated_at: new Date().toISOString() })
        .eq('forklift_id', forkliftId);

      results.success.push(data as ForkliftRental);
    } catch (e) {
      results.failed.push({ forkliftId, error: (e as Error).message });
    }
  }

  return results;
};

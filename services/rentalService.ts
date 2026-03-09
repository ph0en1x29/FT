/* eslint-disable max-lines */
/**
 * Rental Service
 * 
 * Handles forklift rental operations: assign, end, extend, bulk operations
 */

import type { ForkliftRental,RentalStatus } from '../types';
import { supabase } from './supabaseClient';

const RENTAL_WITH_RELATIONS_SELECT = '*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*), customer:customers(*)';
const ACTIVE_RENTAL_SELECT = `
  rental_id,
  customer_id,
  rental_location,
  site,
  site_id,
  start_date,
  end_date,
  customers (name, address)
`;
const ACTIVE_RENTAL_SELECT_LEGACY = `
  rental_id,
  customer_id,
  rental_location,
  site,
  start_date,
  end_date,
  customers (name, address)
`;

const isMissingColumnError = (error: { message?: string } | null | undefined) =>
  /column .* does not exist/i.test(error?.message || '') ||
  /Could not find the '.*' column/i.test(error?.message || '');

const updateForkliftAssignment = async (
  forkliftId: string,
  updates: {
    current_customer_id: string | null;
    current_site_id: string | null;
    site?: string | null;
    status: string;
    updated_at: string;
  }
) => {
  const { error } = await supabase
    .from('forklifts')
    .update(updates)
    .eq('forklift_id', forkliftId);

  if (!error) return;
  if (!isMissingColumnError(error)) throw new Error(error.message);

  const { current_site_id: _currentSiteId, ...legacyUpdates } = updates;
  const { error: legacyError } = await supabase
    .from('forklifts')
    .update(legacyUpdates)
    .eq('forklift_id', forkliftId);

  if (legacyError) throw new Error(legacyError.message);
};

// =====================
// RENTAL QUERIES
// =====================

export const getActiveRentalForForklift = async (forkliftId: string): Promise<{
  rental_id: string;
  customer_id: string;
  customer_name: string;
  customer_address: string;
  rental_location: string;
  site?: string;
  site_id?: string;
  start_date: string;
  end_date?: string;
} | null> => {
  try {
    let { data, error } = await supabase
      .from('forklift_rentals')
      .select(ACTIVE_RENTAL_SELECT)
      .eq('forklift_id', forkliftId)
      .eq('status', 'active')
      .maybeSingle();

    if (error && isMissingColumnError(error)) {
      ({ data, error } = await supabase
        .from('forklift_rentals')
        .select(ACTIVE_RENTAL_SELECT_LEGACY)
        .eq('forklift_id', forkliftId)
        .eq('status', 'active')
        .maybeSingle());
    }

    if (error || !data) return null;

    const customersData = data.customers;
    const customer = (Array.isArray(customersData) ? customersData[0] : customersData) as { name: string; address: string } | null;
    return {
      rental_id: data.rental_id,
      customer_id: data.customer_id,
      customer_name: customer?.name || 'Unknown',
      customer_address: customer?.address || '',
      rental_location: data.rental_location || '',
      site: data.site || undefined,
      site_id: data.site_id || undefined,
      start_date: data.start_date,
      end_date: data.end_date,
    };
  } catch (_e) {
    return null;
  }
};

export const getRentals = async (filters?: { forklift_id?: string; customer_id?: string; status?: RentalStatus }): Promise<ForkliftRental[]> => {
  try {
    let query = supabase
      .from('forklift_rentals')
      .select(RENTAL_WITH_RELATIONS_SELECT)
      .order('created_at', { ascending: false });

    if (filters?.forklift_id) query = query.eq('forklift_id', filters.forklift_id);
    if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return data as ForkliftRental[];
  } catch (_e) {
    return [];
  }
};

export const getForkliftRentals = async (forkliftId: string): Promise<ForkliftRental[]> => {
  try {
    const { data, error } = await supabase
      .from('forklift_rentals')
      .select('*, customer:customers(*)')
      .eq('forklift_id', forkliftId)
      .order('start_date', { ascending: false });

    if (error) {
      return [];
    }
    return data as ForkliftRental[];
  } catch (_e) {
    return [];
  }
};

export const getCustomerRentals = async (customerId: string): Promise<ForkliftRental[]> => {
  try {
    const { data, error } = await supabase
      .from('forklift_rentals')
      .select('*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*)')
      .eq('customer_id', customerId)
      .order('start_date', { ascending: false });

    if (error) {
      return [];
    }
    return data as ForkliftRental[];
  } catch (_e) {
    return [];
  }
};

export const getCustomerActiveRentals = async (customerId: string): Promise<ForkliftRental[]> => {
  try {
    const { data, error } = await supabase
      .from('forklift_rentals')
      .select('*, forklift:forklifts!forklift_rentals_forklift_id_fkey(*)')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .order('start_date', { ascending: false });

    if (error) {
      return [];
    }
    return data as ForkliftRental[];
  } catch (_e) {
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
  monthlyRentalRate?: number,
  site?: string,
  siteId?: string
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
    .select('name, address')
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
      site: site || null,
      site_id: siteId || null,
      created_by_id: createdById || null,
      created_by_name: createdByName || null,
      monthly_rental_rate: monthlyRentalRate || 0,
      currency: 'RM',
    })
    .select(RENTAL_WITH_RELATIONS_SELECT)
    .single();

  let rentalData = data;
  let rentalError = error;
  if (rentalError && isMissingColumnError(rentalError)) {
    ({ data: rentalData, error: rentalError } = await supabase
      .from('forklift_rentals')
      .insert({
        forklift_id: forkliftId,
        customer_id: customerId,
        start_date: startDate,
        end_date: endDate || null,
        status: 'active',
        notes: notes || null,
        rental_location: customer?.address || null,
        site: site || null,
        created_by_id: createdById || null,
        created_by_name: createdByName || null,
        monthly_rental_rate: monthlyRentalRate || 0,
        currency: 'RM',
      })
      .select(RENTAL_WITH_RELATIONS_SELECT)
      .single());
  }

  if (rentalError) throw new Error(rentalError.message);

  await updateForkliftAssignment(forkliftId, {
    current_customer_id: customerId,
    current_site_id: siteId || null,
    site: site || customer?.name || null,
    status: 'Rented Out',
    updated_at: new Date().toISOString(),
  });

  return rentalData as ForkliftRental;
};

export const endRental = async (
  rentalId: string, 
  endDate?: string,
  endedById?: string,
  endedByName?: string
): Promise<ForkliftRental> => {
  // Get forklift_id FIRST — must succeed before we end the rental
  const { data: rental, error: rentalError } = await supabase
    .from('forklift_rentals')
    .select('forklift_id')
    .eq('rental_id', rentalId)
    .single();

  if (rentalError || !rental?.forklift_id) {
    throw new Error('Could not find rental record or forklift association');
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
    .eq('rental_id', rentalId)
    .select(RENTAL_WITH_RELATIONS_SELECT)
    .single();

  if (error) throw new Error(error.message);

  // Always reset forklift status — guaranteed to have forklift_id from above
  await updateForkliftAssignment(rental.forklift_id, {
    current_customer_id: null,
    current_site_id: null,
    status: 'Available',
    updated_at: new Date().toISOString(),
  });

  return data as ForkliftRental;
};

export const updateRental = async (
  rentalId: string,
  updates: {
    start_date?: string;
    end_date?: string;
    notes?: string;
    monthly_rental_rate?: number;
    site?: string | null;
    site_id?: string | null;
  }
): Promise<ForkliftRental> => {
  const { data, error } = await supabase
    .from('forklift_rentals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('rental_id', rentalId)
    .select(RENTAL_WITH_RELATIONS_SELECT)
    .single();

  if (!error) return data as ForkliftRental;
  if (!isMissingColumnError(error)) throw new Error(error.message);

  const { site_id: _siteId, ...legacyUpdates } = updates;
  const { data: legacyData, error: legacyError } = await supabase
    .from('forklift_rentals')
    .update({ ...legacyUpdates, updated_at: new Date().toISOString() })
    .eq('rental_id', rentalId)
    .select(RENTAL_WITH_RELATIONS_SELECT)
    .single();

  if (legacyError) throw new Error(legacyError.message);
  return legacyData as ForkliftRental;
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
      .select(RENTAL_WITH_RELATIONS_SELECT)
      .single();

    if (error) {
      return null;
    }
    return data as ForkliftRental;
  } catch (_e) {
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
  monthlyRentalRate?: number,
  site?: string,
  siteId?: string
): Promise<{ success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] }> => {
  const results: { success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] } = {
    success: [],
    failed: []
  };

  const { data: customer } = await supabase
    .from('customers')
    .select('name, address')
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

      let { data, error } = await supabase
        .from('forklift_rentals')
        .insert({
          forklift_id: forkliftId,
          customer_id: customerId,
          start_date: startDate,
          end_date: endDate || null,
          status: 'active',
          notes: notes || null,
          rental_location: customer?.address || null,
          site: site || null,
          site_id: siteId || null,
          created_by_id: createdById || null,
          created_by_name: createdByName || null,
          monthly_rental_rate: monthlyRentalRate || 0,
          currency: 'RM',
        })
        .select(RENTAL_WITH_RELATIONS_SELECT)
        .single();

      if (error && isMissingColumnError(error)) {
        ({ data, error } = await supabase
          .from('forklift_rentals')
          .insert({
            forklift_id: forkliftId,
            customer_id: customerId,
            start_date: startDate,
            end_date: endDate || null,
            status: 'active',
            notes: notes || null,
            rental_location: customer?.address || null,
            site: site || null,
            created_by_id: createdById || null,
            created_by_name: createdByName || null,
            monthly_rental_rate: monthlyRentalRate || 0,
            currency: 'RM',
          })
          .select(RENTAL_WITH_RELATIONS_SELECT)
          .single());
      }

      if (error) {
        results.failed.push({ forkliftId, error: error.message });
        continue;
      }

      await updateForkliftAssignment(forkliftId, {
        current_customer_id: customerId,
        current_site_id: siteId || null,
        site: site || customer?.name || null,
        status: 'Rented Out',
        updated_at: new Date().toISOString(),
      });

      results.success.push(data as ForkliftRental);
    } catch (_e) {
      results.failed.push({ forkliftId, error: (_e as Error).message });
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

      await updateForkliftAssignment(forkliftId, {
        current_customer_id: null,
        current_site_id: null,
        status: 'Available',
        updated_at: new Date().toISOString(),
      });

      results.success.push(data as ForkliftRental);
    } catch (_e) {
      results.failed.push({ forkliftId, error: (_e as Error).message });
    }
  }

  return results;
};

/**
 * Forklift/Fleet Service
 * 
 * Handles forklift CRUD, rentals, hourmeter tracking, and service scheduling
 */

import { supabase, logDebug } from './supabaseClient';
import type { 
  Forklift, 
  ForkliftRental, 
  ForkliftStatus, 
  RentalStatus, 
  ScheduledService,
  HourmeterAmendment,
  HourmeterAmendmentStatus,
  HourmeterFlagReason,
  Job,
  JobPriority,
  JobType,
  JobStatus
} from '../types';
import { ForkliftStatus as ForkliftStatusEnum } from '../types';

// =====================
// FORKLIFT CRUD
// =====================

export const getForklifts = async (): Promise<Forklift[]> => {
  const { data, error } = await supabase
    .from('forklifts')
    .select('*')
    .order('serial_number');

  if (error) throw new Error(error.message);
  return data as Forklift[];
};

export const getForkliftsForList = async (): Promise<Pick<Forklift, 'forklift_id' | 'serial_number' | 'make' | 'model' | 'type' | 'status' | 'hourmeter' | 'location'>[]> => {
  const { data, error } = await supabase
    .from('forklifts')
    .select('forklift_id, serial_number, make, model, type, status, hourmeter, location')
    .neq('status', 'Out of Service')
    .neq('status', 'Inactive')
    .order('serial_number');

  if (error) throw new Error(error.message);
  return data as Pick<Forklift, 'forklift_id' | 'serial_number' | 'make' | 'model' | 'type' | 'status' | 'hourmeter' | 'location'>[];
};

export const getForkliftById = async (forkliftId: string): Promise<Forklift | null> => {
  const { data, error } = await supabase
    .from('forklifts')
    .select('*')
    .eq('forklift_id', forkliftId)
    .single();

  if (error) {
    console.error('Error fetching forklift:', error);
    return null;
  }
  return data as Forklift;
};

export const getForkliftWithCustomer = async (forkliftId: string): Promise<Forklift | null> => {
  try {
    const { data, error } = await supabase
      .from('forklifts')
      .select(`*, current_customer:customers!forklifts_current_customer_id_fkey(*)`)
      .eq('forklift_id', forkliftId)
      .single();

    if (error) {
      console.warn('Forklift with customer query failed, falling back:', error.message);
      const { data: basicData, error: basicError } = await supabase
        .from('forklifts')
        .select('*')
        .eq('forklift_id', forkliftId)
        .single();
      
      if (basicError) return null;
      return basicData as Forklift;
    }
    return data as Forklift;
  } catch (e) {
    console.error('Error fetching forklift:', e);
    return null;
  }
};

export const getForkliftsWithCustomers = async (): Promise<Forklift[]> => {
  try {
    const { data: forklifts, error: forkliftError } = await supabase
      .from('forklifts')
      .select('*')
      .order('serial_number');

    if (forkliftError) throw new Error(forkliftError.message);

    const { data: activeRentals, error: rentalError } = await supabase
      .from('forklift_rentals')
      .select(`forklift_id, customer_id, monthly_rental_rate, customer:customers(*)`)
      .eq('status', 'active');

    if (rentalError) {
      console.warn('Active rentals query failed:', rentalError.message);
      return forklifts as Forklift[];
    }

    const rentalMap = new Map();
    (activeRentals || []).forEach(rental => {
      rentalMap.set(rental.forklift_id, {
        current_customer_id: rental.customer_id,
        current_customer: rental.customer,
        monthly_rental_rate: rental.monthly_rental_rate,
      });
    });

    const forkliftsWithCustomers = (forklifts || []).map(forklift => {
      const rentalInfo = rentalMap.get(forklift.forklift_id);
      if (rentalInfo) {
        return { ...forklift, ...rentalInfo };
      }
      return forklift;
    });

    return forkliftsWithCustomers as Forklift[];
  } catch (e) {
    console.error('Error fetching forklifts:', e);
    const { data, error } = await supabase
      .from('forklifts')
      .select('*')
      .order('serial_number');
    
    if (error) throw new Error(error.message);
    return data as Forklift[];
  }
};

export const createForklift = async (forkliftData: Partial<Forklift>): Promise<Forklift> => {
  const { data, error } = await supabase
    .from('forklifts')
    .insert({
      serial_number: forkliftData.serial_number,
      make: forkliftData.make,
      model: forkliftData.model,
      type: forkliftData.type,
      hourmeter: forkliftData.hourmeter || 0,
      year: forkliftData.year,
      capacity_kg: forkliftData.capacity_kg,
      location: forkliftData.location,
      status: forkliftData.status || ForkliftStatusEnum.ACTIVE,
      notes: forkliftData.notes,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Forklift;
};

export const updateForklift = async (
  forkliftId: string,
  updates: Partial<Forklift>,
  userContext?: { userId: string; userName: string }
): Promise<Forklift> => {
  let previousHourmeter: number | null = null;
  if (updates.hourmeter !== undefined && userContext) {
    const { data: current } = await supabase
      .from('forklifts')
      .select('hourmeter')
      .eq('forklift_id', forkliftId)
      .single();
    previousHourmeter = current?.hourmeter ?? null;
  }

  const { data, error } = await supabase
    .from('forklifts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('forklift_id', forkliftId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (updates.hourmeter !== undefined && userContext && previousHourmeter !== updates.hourmeter) {
    try {
      await supabase
        .from('hourmeter_history')
        .insert({
          forklift_id: forkliftId,
          reading: updates.hourmeter,
          previous_reading: previousHourmeter,
          hours_since_last: previousHourmeter ? updates.hourmeter - previousHourmeter : null,
          recorded_by_id: userContext.userId,
          recorded_by_name: userContext.userName,
          source: 'manual',
        });
    } catch (historyError) {
      console.warn('Failed to create hourmeter history:', historyError);
    }
  }

  return data as Forklift;
};

export const deleteForklift = async (forkliftId: string): Promise<void> => {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('job_id')
    .eq('forklift_id', forkliftId)
    .is('deleted_at', null);
  
  if (jobs && jobs.length > 0) {
    throw new Error('Cannot delete forklift with existing service records. Set status to Inactive instead.');
  }

  const { error } = await supabase
    .from('forklifts')
    .delete()
    .eq('forklift_id', forkliftId);

  if (error) throw new Error(error.message);
};

export const updateForkliftHourmeter = async (forkliftId: string, newHourmeter: number): Promise<Forklift> => {
  const { data, error } = await supabase
    .from('forklifts')
    .update({
      hourmeter: newHourmeter,
      last_service_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('forklift_id', forkliftId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Forklift;
};

// =====================
// RENTAL OPERATIONS
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

    const customer = data.customers as any;
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
    console.warn('Failed to get active rental:', e);
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
      console.warn('Rentals query failed:', error.message);
      return [];
    }
    return data as ForkliftRental[];
  } catch (e) {
    console.warn('Rentals not available:', e);
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
      console.warn('Forklift rentals query failed:', error.message);
      return [];
    }
    return data as ForkliftRental[];
  } catch (e) {
    console.warn('Forklift rentals not available:', e);
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
      console.warn('Customer rentals query failed:', error.message);
      return [];
    }
    return data as ForkliftRental[];
  } catch (e) {
    console.warn('Customer rentals not available:', e);
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
      console.warn('Active rentals query failed:', error.message);
      return [];
    }
    return data as ForkliftRental[];
  } catch (e) {
    console.warn('Active rentals not available:', e);
    return [];
  }
};

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
      console.warn('Failed to update rental rate:', error.message);
      return null;
    }
    return data as ForkliftRental;
  } catch (e) {
    console.warn('Rental rate update failed:', e);
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

// =====================
// SERVICE HISTORY
// =====================

export const getForkliftServiceHistory = async (forkliftId: string): Promise<Job[]> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`*, customer:customers(*), parts_used:job_parts(*), media:job_media(*), extra_charges:extra_charges(*)`)
      .eq('forklift_id', forkliftId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Forklift service history query failed:', error.message);
      return [];
    }
    return data as Job[];
  } catch (e) {
    console.warn('Forklift service history not available:', e);
    return [];
  }
};

export const getForkliftServiceHistoryWithCancelled = async (forkliftId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`*, customer:customers(*), parts_used:job_parts(*), media:job_media(*), extra_charges:extra_charges(*)`)
      .eq('forklift_id', forkliftId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Forklift service history with cancelled query failed:', error.message);
      return [];
    }

    return (data || []).map((job: any) => ({
      ...job,
      is_cancelled: job.deleted_at !== null,
    }));
  } catch (e) {
    console.warn('Forklift service history with cancelled not available:', e);
    return [];
  }
};

// =====================
// HOURMETER HISTORY & AMENDMENTS
// =====================

export const getForkliftHourmeterHistory = async (forkliftId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('hourmeter_history')
      .select(`*, job:jobs(job_id, title, job_type)`)
      .eq('forklift_id', forkliftId)
      .order('recorded_at', { ascending: false });

    if (error) {
      console.warn('Hourmeter history query failed:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn('Hourmeter history not available:', e);
    return [];
  }
};

export const getHourmeterAmendments = async (statusFilter?: HourmeterAmendmentStatus): Promise<HourmeterAmendment[]> => {
  try {
    let query = supabase
      .from('hourmeter_amendments')
      .select(`
        *,
        job:jobs(job_id, title, job_type, scheduled_date),
        forklift:forklifts(forklift_id, serial_number, model, make)
      `)
      .order('requested_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Hourmeter amendments query failed:', error.message);
      return [];
    }
    return (data || []) as HourmeterAmendment[];
  } catch (e) {
    console.warn('Hourmeter amendments not available:', e);
    return [];
  }
};

export const createHourmeterAmendment = async (
  jobId: string,
  forkliftId: string,
  originalReading: number,
  amendedReading: number,
  reason: string,
  flagReasons: HourmeterFlagReason[],
  requestedById: string,
  requestedByName: string
): Promise<HourmeterAmendment> => {
  const { data, error } = await supabase
    .from('hourmeter_amendments')
    .insert({
      job_id: jobId,
      forklift_id: forkliftId,
      original_reading: originalReading,
      amended_reading: amendedReading,
      reason,
      flag_reasons: flagReasons,
      requested_by_id: requestedById,
      requested_by_name: requestedByName,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as HourmeterAmendment;
};

export const approveHourmeterAmendment = async (
  amendmentId: string,
  reviewedById: string,
  reviewedByName: string,
  reviewNotes?: string
): Promise<HourmeterAmendment> => {
  const { data: amendment, error: fetchError } = await supabase
    .from('hourmeter_amendments')
    .select('job_id, forklift_id, amended_reading')
    .eq('amendment_id', amendmentId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  await supabase
    .from('jobs')
    .update({
      hourmeter_reading: amendment.amended_reading,
      hourmeter_flagged: false,
      hourmeter_flag_reasons: [],
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', amendment.job_id);

  const { data: forklift } = await supabase
    .from('forklifts')
    .select('hourmeter')
    .eq('forklift_id', amendment.forklift_id)
    .single();

  if (forklift && amendment.amended_reading > (forklift.hourmeter || 0)) {
    await supabase
      .from('forklifts')
      .update({
        hourmeter: amendment.amended_reading,
        updated_at: new Date().toISOString(),
      })
      .eq('forklift_id', amendment.forklift_id);
  }

  const { data, error } = await supabase
    .from('hourmeter_amendments')
    .update({
      status: 'approved',
      reviewed_by_id: reviewedById,
      reviewed_by_name: reviewedByName,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('amendment_id', amendmentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as HourmeterAmendment;
};

export const rejectHourmeterAmendment = async (
  amendmentId: string,
  reviewedById: string,
  reviewedByName: string,
  reviewNotes: string
): Promise<HourmeterAmendment> => {
  const { data, error } = await supabase
    .from('hourmeter_amendments')
    .update({
      status: 'rejected',
      reviewed_by_id: reviewedById,
      reviewed_by_name: reviewedByName,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('amendment_id', amendmentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as HourmeterAmendment;
};

export const getJobHourmeterAmendment = async (jobId: string): Promise<HourmeterAmendment | null> => {
  try {
    const { data, error } = await supabase
      .from('hourmeter_amendments')
      .select('*')
      .eq('job_id', jobId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.warn('Hourmeter amendment query failed:', error.message);
      return null;
    }
    return data as HourmeterAmendment;
  } catch (e) {
    return null;
  }
};

export const flagJobHourmeter = async (jobId: string, flagReasons: HourmeterFlagReason[]): Promise<void> => {
  await supabase
    .from('jobs')
    .update({
      hourmeter_flagged: true,
      hourmeter_flag_reasons: flagReasons,
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId);
};

export const validateHourmeterReading = async (
  forkliftId: string,
  newReading: number
): Promise<{ isValid: boolean; flags: HourmeterFlagReason[] }> => {
  const flags: HourmeterFlagReason[] = [];

  const { data: forklift } = await supabase
    .from('forklifts')
    .select('hourmeter, avg_daily_usage')
    .eq('forklift_id', forkliftId)
    .single();

  if (!forklift) {
    return { isValid: true, flags: [] };
  }

  const currentHourmeter = forklift.hourmeter || 0;
  const avgDailyUsage = forklift.avg_daily_usage || 8;

  if (newReading < currentHourmeter) {
    flags.push('lower_than_previous');
  }

  const difference = newReading - currentHourmeter;
  const excessiveThreshold = avgDailyUsage * 30;
  if (difference > excessiveThreshold) {
    flags.push('excessive_jump');
  }

  return { isValid: flags.length === 0, flags };
};

// =====================
// SCHEDULED SERVICES
// =====================

export const getScheduledServices = async (filters?: { forklift_id?: string; status?: string }): Promise<ScheduledService[]> => {
  try {
    let query = supabase
      .from('scheduled_services')
      .select(`*, forklift:forklifts!forklift_id(*)`)
      .order('due_date', { ascending: true });

    if (filters?.forklift_id) query = query.eq('forklift_id', filters.forklift_id);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) {
      console.warn('Scheduled services query failed:', error.message);
      return [];
    }
    return data as ScheduledService[];
  } catch (e) {
    console.warn('Scheduled services not available:', e);
    return [];
  }
};

export const getUpcomingServices = async (daysAhead: number = 30): Promise<ScheduledService[]> => {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('scheduled_services')
      .select(`*, forklift:forklifts!forklift_id(*)`)
      .in('status', ['pending', 'scheduled'])
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    if (error) {
      console.warn('Upcoming services query failed:', error.message);
      return [];
    }
    return data as ScheduledService[];
  } catch (e) {
    console.warn('Upcoming services not available:', e);
    return [];
  }
};

export const createScheduledService = async (
  service: Partial<ScheduledService>,
  createdById?: string,
  createdByName?: string
): Promise<ScheduledService | null> => {
  try {
    const { data, error } = await supabase
      .from('scheduled_services')
      .insert({
        forklift_id: service.forklift_id,
        service_type: service.service_type,
        due_date: service.due_date,
        due_hourmeter: service.due_hourmeter,
        estimated_hours: service.estimated_hours,
        priority: service.priority || 'Medium',
        notes: service.notes,
        auto_create_job: service.auto_create_job ?? true,
        created_by_id: createdById,
        created_by_name: createdByName,
      })
      .select(`*, forklift:forklifts!forklift_id(*)`)
      .single();

    if (error) {
      console.warn('Failed to create scheduled service:', error.message);
      return null;
    }
    return data as ScheduledService;
  } catch (e) {
    console.warn('Scheduled service creation failed:', e);
    return null;
  }
};

export const updateScheduledService = async (
  scheduledId: string,
  updates: Partial<ScheduledService>
): Promise<ScheduledService | null> => {
  try {
    const { data, error } = await supabase
      .from('scheduled_services')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('scheduled_id', scheduledId)
      .select(`*, forklift:forklifts!forklift_id(*)`)
      .single();

    if (error) {
      console.warn('Failed to update scheduled service:', error.message);
      return null;
    }
    return data as ScheduledService;
  } catch (e) {
    console.warn('Scheduled service update failed:', e);
    return null;
  }
};

// =====================
// SERVICE INTERVALS
// =====================

export const getServiceIntervals = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('service_intervals')
      .select('*')
      .order('forklift_type', { ascending: true })
      .order('hourmeter_interval', { ascending: true });

    if (error) {
      console.error('Failed to fetch service intervals:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('Service intervals fetch error:', e);
    return [];
  }
};

export const getServiceIntervalsByType = async (forkliftType: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('service_intervals')
      .select('*')
      .eq('forklift_type', forkliftType)
      .eq('is_active', true)
      .order('hourmeter_interval', { ascending: true });

    if (error) {
      console.error('Failed to fetch service intervals by type:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('Service intervals by type fetch error:', e);
    return [];
  }
};

export const createServiceInterval = async (interval: {
  forklift_type: string;
  service_type: string;
  hourmeter_interval: number;
  calendar_interval_days?: number;
  priority?: string;
  checklist_items?: string[];
  estimated_duration_hours?: number;
  name?: string;
}): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from('service_intervals')
      .insert({
        forklift_type: interval.forklift_type,
        service_type: interval.service_type,
        hourmeter_interval: interval.hourmeter_interval,
        calendar_interval_days: interval.calendar_interval_days || null,
        priority: interval.priority || 'Medium',
        checklist_items: interval.checklist_items || [],
        estimated_duration_hours: interval.estimated_duration_hours || null,
        name: interval.name || interval.service_type,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create service interval:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Service interval create error:', e);
    return null;
  }
};

export const updateServiceInterval = async (
  intervalId: string,
  updates: {
    forklift_type?: string;
    service_type?: string;
    hourmeter_interval?: number;
    calendar_interval_days?: number | null;
    priority?: string;
    checklist_items?: string[];
    estimated_duration_hours?: number | null;
    name?: string;
    is_active?: boolean;
  }
): Promise<any | null> => {
  try {
    const { data, error } = await supabase
      .from('service_intervals')
      .update(updates)
      .eq('interval_id', intervalId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update service interval:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Service interval update error:', e);
    return null;
  }
};

export const deleteServiceInterval = async (intervalId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('service_intervals')
      .update({ is_active: false })
      .eq('interval_id', intervalId);

    if (error) {
      console.error('Failed to delete service interval:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Service interval delete error:', e);
    return false;
  }
};

export const hardDeleteServiceInterval = async (intervalId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('service_intervals')
      .delete()
      .eq('interval_id', intervalId);

    if (error) {
      console.error('Failed to hard delete service interval:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Service interval hard delete error:', e);
    return false;
  }
};

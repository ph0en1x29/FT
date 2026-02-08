/**
 * Forklift/Fleet Service
 * 
 * Core forklift CRUD operations
 * Re-exports from specialized services for backward compatibility
 */

import type { Forklift } from '../types';
import { ForkliftStatus as ForkliftStatusEnum } from '../types';
import { supabase } from './supabaseClient';

// =====================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// =====================

// Rental operations
export {
assignForkliftToCustomer,bulkAssignForkliftsToCustomer,
bulkEndRentals,endRental,getActiveRentalForForklift,getCustomerActiveRentals,getCustomerRentals,getForkliftRentals,getRentals,updateRental,
updateRentalRate
} from './rentalService';

// Hourmeter operations
export {
approveHourmeterAmendment,createHourmeterAmendment,flagJobHourmeter,getForkliftHourmeterHistory,
// Service prediction
getForkliftsDueForService,getForkliftServicePredictions,getHourmeterAmendments,getJobHourmeterAmendment,getServicePredictionDashboard,rejectHourmeterAmendment,runDailyServiceCheck,validateHourmeterReading
} from './hourmeterService';

// Service schedule operations
export {
createScheduledService,createServiceInterval,deleteServiceInterval,getForkliftServiceHistory,
getForkliftServiceHistoryWithCancelled,getScheduledServices,getServiceIntervals,
getServiceIntervalsByType,getUpcomingServices,hardDeleteServiceInterval,updateScheduledService,updateServiceInterval
} from './serviceScheduleService';

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

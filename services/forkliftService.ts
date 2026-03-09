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
// PAGINATION TYPES
// =====================

export interface ForkliftsPageFilters {
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  filterType?: string;
  filterStatus?: string;
  filterMake?: string;
  filterAssigned?: string;
}

export interface ForkliftsPage {
  forklifts: Forklift[];
  total: number;
  page: number;
  pageSize: number;
}

const FORKLIFT_SELECT = 'forklift_id, serial_number, make, model, type, hourmeter, year, capacity_kg, location, site, current_site_id, status, last_service_date, next_service_due, notes, created_at, updated_at, ownership, customer_id, forklift_no, customer_forklift_no, current_customer_id, delivery_date, source_item_group, last_service_hourmeter, service_interval_hours, last_serviced_hourmeter, next_target_service_hour, last_hourmeter_update';
const LEGACY_FORKLIFT_SELECT = 'forklift_id, serial_number, make, model, type, hourmeter, year, capacity_kg, location, site, status, last_service_date, next_service_due, notes, created_at, updated_at, ownership, customer_id, forklift_no, customer_forklift_no, current_customer_id, last_service_hourmeter, service_interval_hours, last_serviced_hourmeter, next_target_service_hour, last_hourmeter_update';

const isMissingColumnError = (error: { message?: string } | null | undefined) =>
  /column .* does not exist/i.test(error?.message || '') ||
  /Could not find the '.*' column/i.test(error?.message || '');

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
  const initial = await supabase
    .from('forklifts')
    .select(FORKLIFT_SELECT)
    .order('serial_number');

  let resultData = (initial.data as Forklift[] | null) || null;
  let resultError = initial.error;

  if (resultError && isMissingColumnError(resultError)) {
    const fallback = await supabase
      .from('forklifts')
      .select(LEGACY_FORKLIFT_SELECT)
      .order('serial_number');
    resultData = (fallback.data as Forklift[] | null) || null;
    resultError = fallback.error;
  }

  if (resultError) throw new Error(resultError.message);
  return resultData || [];
};

export const getForkliftsForList = async (): Promise<Pick<Forklift, 'forklift_id' | 'serial_number' | 'make' | 'model' | 'type' | 'status' | 'hourmeter' | 'location' | 'current_customer_id'>[]> => {
  const { data, error } = await supabase
    .from('forklifts')
    .select('forklift_id, serial_number, make, model, type, status, hourmeter, location, current_customer_id')
    .neq('status', 'Out of Service')
    .neq('status', 'Inactive')
    .order('serial_number');

  if (error) throw new Error(error.message);
  return data as Pick<Forklift, 'forklift_id' | 'serial_number' | 'make' | 'model' | 'type' | 'status' | 'hourmeter' | 'location' | 'current_customer_id'>[];
};

export const getForkliftById = async (forkliftId: string): Promise<Forklift | null> => {
  const initial = await supabase
    .from('forklifts')
    .select(FORKLIFT_SELECT)
    .eq('forklift_id', forkliftId)
    .single();

  let resultData = (initial.data as Forklift | null) || null;
  let resultError = initial.error;

  if (resultError && isMissingColumnError(resultError)) {
    const fallback = await supabase
      .from('forklifts')
      .select(LEGACY_FORKLIFT_SELECT)
      .eq('forklift_id', forkliftId)
      .single();
    resultData = (fallback.data as Forklift | null) || null;
    resultError = fallback.error;
  }

  if (resultError) {
    console.error('Error fetching forklift:', resultError);
    return null;
  }
  return resultData;
};

export const getForkliftWithCustomer = async (forkliftId: string): Promise<Forklift | null> => {
  try {
    const { data, error } = await supabase
      .from('forklifts')
      .select(`${FORKLIFT_SELECT}, current_customer:customers!forklifts_current_customer_id_fkey(customer_id, name, phone, email, address, notes, contact_person, account_number)`)
      .eq('forklift_id', forkliftId)
      .single();

    if (error && !isMissingColumnError(error)) {
      console.warn('Forklift with customer query failed, falling back:', error.message);
    }

    if (error) {
      const { data: basicData, error: basicError } = await supabase
        .from('forklifts')
        .select(LEGACY_FORKLIFT_SELECT)
        .eq('forklift_id', forkliftId)
        .single();
      
      if (basicError) return null;
      return basicData as Forklift;
    }
    return data as unknown as Forklift;
  } catch (e) {
    console.error('Error fetching forklift:', e);
    return null;
  }
};

export const getForkliftsWithCustomers = async (): Promise<Forklift[]> => {
  try {
    const { data: forklifts, error: forkliftError } = await supabase
      .from('forklifts')
      .select(FORKLIFT_SELECT)
      .order('serial_number');

    let resolvedForklifts = (forklifts as Forklift[] | null) || null;
    let resolvedForkliftError = forkliftError;
    if (resolvedForkliftError && isMissingColumnError(resolvedForkliftError)) {
      const fallback = await supabase
        .from('forklifts')
        .select(LEGACY_FORKLIFT_SELECT)
        .order('serial_number');
      resolvedForklifts = (fallback.data as Forklift[] | null) || null;
      resolvedForkliftError = fallback.error;
    }

    if (resolvedForkliftError) throw new Error(resolvedForkliftError.message);

    const { data: activeRentals, error: rentalError } = await supabase
      .from('forklift_rentals')
      .select(`forklift_id, customer_id, monthly_rental_rate, customer:customers(customer_id, name, phone, email, address, notes, contact_person, account_number)`)
      .eq('status', 'active');

    if (rentalError) {
      console.warn('Active rentals query failed:', rentalError.message);
      return (resolvedForklifts || []) as Forklift[];
    }

    const rentalMap = new Map();
    (activeRentals || []).forEach(rental => {
      rentalMap.set(rental.forklift_id, {
        current_customer_id: rental.customer_id,
        current_customer: rental.customer,
        monthly_rental_rate: rental.monthly_rental_rate,
      });
    });

    const forkliftsWithCustomers = (resolvedForklifts || []).map(forklift => {
      const rentalInfo = rentalMap.get(forklift.forklift_id);
      if (rentalInfo) {
        return { ...forklift, ...rentalInfo };
      }
      return forklift;
    });

    return forkliftsWithCustomers as Forklift[];
  } catch (e) {
    console.error('Error fetching forklifts:', e);
    const initial = await supabase
      .from('forklifts')
      .select(FORKLIFT_SELECT)
      .order('serial_number');

    let resultData = (initial.data as Forklift[] | null) || null;
    let resultError = initial.error;

    if (resultError && isMissingColumnError(resultError)) {
      const fallback = await supabase
        .from('forklifts')
        .select(LEGACY_FORKLIFT_SELECT)
        .order('serial_number');
      resultData = (fallback.data as Forklift[] | null) || null;
      resultError = fallback.error;
    }
    
    if (resultError) throw new Error(resultError.message);
    return resultData || [];
  }
};

/**
 * Get a paginated page of forklifts with server-side search + filters.
 * Enriches each page with active rental / customer data (2nd query, at most pageSize rows).
 */
export const getForkliftsPage = async (filters: ForkliftsPageFilters = {}): Promise<ForkliftsPage> => {
  const page = Math.max(filters.page || 1, 1);
  const pageSize = Math.max(filters.pageSize || 50, 1);
  const searchQuery = filters.searchQuery?.trim() || '';
  const filterType = filters.filterType || 'all';
  const filterStatus = filters.filterStatus || 'all';
  const filterMake = filters.filterMake || 'all';
  const filterAssigned = filters.filterAssigned || 'all';

  // Pre-resolve customer IDs when search text was typed — lets us OR across customer name
  let matchingCustomerIds: string[] = [];
  if (searchQuery) {
    const escaped = searchQuery.replace(/[%_]/g, '\\$&');
    const { data: matchedCx } = await supabase
      .from('customers')
      .select('customer_id')
      .ilike('name', `%${escaped}%`);
    matchingCustomerIds = (matchedCx || []).map((c: { customer_id: string }) => c.customer_id);
  }

  const selectStr = FORKLIFT_SELECT;
  let query = supabase
    .from('forklifts')
    .select(selectStr, { count: 'exact' })
    .order('serial_number')
    .range((page - 1) * pageSize, page * pageSize - 1);

  // Server-side search
  if (searchQuery) {
    const escaped = searchQuery.replace(/[%_]/g, '\\$&');
    const orParts = [
      `serial_number.ilike.%${escaped}%`,
      `make.ilike.%${escaped}%`,
      `model.ilike.%${escaped}%`,
      `forklift_no.ilike.%${escaped}%`,
      `site.ilike.%${escaped}%`,
    ];
    if (matchingCustomerIds.length > 0) {
      orParts.push(`current_customer_id.in.(${matchingCustomerIds.join(',')})`);
    }
    query = query.or(orParts.join(','));
  }

  // Server-side filters
  if (filterType !== 'all') query = query.eq('type', filterType);
  if (filterStatus !== 'all') query = query.eq('status', filterStatus);
  if (filterMake !== 'all') query = query.eq('make', filterMake);
  if (filterAssigned === 'assigned') query = query.not('current_customer_id', 'is', null);
  if (filterAssigned === 'unassigned') query = query.is('current_customer_id', null);

  const { data, error, count } = await query;

  // Fallback to legacy column set on schema mismatch
  if (error && isMissingColumnError(error)) {
    let legacyQuery = supabase
      .from('forklifts')
      .select(LEGACY_FORKLIFT_SELECT, { count: 'exact' })
      .order('serial_number')
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (searchQuery) {
      const escaped = searchQuery.replace(/[%_]/g, '\\$&');
      const orParts = [
        `serial_number.ilike.%${escaped}%`,
        `make.ilike.%${escaped}%`,
        `model.ilike.%${escaped}%`,
        `forklift_no.ilike.%${escaped}%`,
        `site.ilike.%${escaped}%`,
      ];
      if (matchingCustomerIds.length > 0) {
        orParts.push(`current_customer_id.in.(${matchingCustomerIds.join(',')})`);
      }
      legacyQuery = legacyQuery.or(orParts.join(','));
    }
    if (filterType !== 'all') legacyQuery = legacyQuery.eq('type', filterType);
    if (filterStatus !== 'all') legacyQuery = legacyQuery.eq('status', filterStatus);
    if (filterMake !== 'all') legacyQuery = legacyQuery.eq('make', filterMake);
    if (filterAssigned === 'assigned') legacyQuery = legacyQuery.not('current_customer_id', 'is', null);
    if (filterAssigned === 'unassigned') legacyQuery = legacyQuery.is('current_customer_id', null);

    const { data: legacyData, error: legacyError, count: legacyCount } = await legacyQuery;
    if (legacyError) throw new Error(legacyError.message);
    return enrichWithRentals((legacyData || []) as Forklift[], legacyCount || 0, page, pageSize);
  }

  if (error) throw new Error(error.message);
  return enrichWithRentals((data || []) as Forklift[], count || 0, page, pageSize);
};

/** Fetch active rentals for a page of forklifts and merge customer data in. */
async function enrichWithRentals(
  forklifts: Forklift[],
  total: number,
  page: number,
  pageSize: number,
): Promise<ForkliftsPage> {
  if (forklifts.length === 0) return { forklifts, total, page, pageSize };

  const ids = forklifts.map((f) => f.forklift_id);
  const { data: activeRentals } = await supabase
    .from('forklift_rentals')
    .select('forklift_id, customer_id, monthly_rental_rate, customer:customers(customer_id, name, phone, email, address, notes, contact_person, account_number)')
    .eq('status', 'active')
    .in('forklift_id', ids);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rentalMap = new Map<string, Record<string, any>>();
  (activeRentals || []).forEach((r: { forklift_id: string; customer_id: string; monthly_rental_rate?: number; customer?: unknown }) => {
    rentalMap.set(r.forklift_id, {
      current_customer_id: r.customer_id,
      current_customer: r.customer,
      monthly_rental_rate: r.monthly_rental_rate,
    });
  });

  const enriched = forklifts.map((f) => {
    const rental = rentalMap.get(f.forklift_id);
    return rental ? { ...f, ...rental } : f;
  });

  return { forklifts: enriched as Forklift[], total, page, pageSize };
}

/**
 * Get all unique forklift makes (lightweight query for filter dropdown).
 */
export const getForkliftUniqueMakes = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('forklifts')
    .select('make')
    .not('make', 'is', null)
    .order('make');
  if (error) throw new Error(error.message);
  return [...new Set((data || []).map((f: { make: string }) => f.make).filter(Boolean))].sort();
};

export const createForklift = async (forkliftData: Partial<Forklift>): Promise<Forklift> => {
  const payload = {
    serial_number: forkliftData.serial_number,
    make: forkliftData.make,
    model: forkliftData.model,
    type: forkliftData.type,
    hourmeter: forkliftData.hourmeter || 0,
    last_service_hourmeter: forkliftData.last_service_hourmeter || forkliftData.hourmeter || 0,
    last_serviced_hourmeter: forkliftData.last_service_hourmeter || forkliftData.hourmeter || 0,
    next_target_service_hour: (forkliftData.last_service_hourmeter || forkliftData.hourmeter || 0) + (forkliftData.service_interval_hours || 500),
    year: forkliftData.year,
    capacity_kg: forkliftData.capacity_kg,
    location: forkliftData.location,
    site: forkliftData.site,
    current_site_id: forkliftData.current_site_id,
    status: forkliftData.status || ForkliftStatusEnum.ACTIVE,
    ownership: forkliftData.ownership,
    customer_id: forkliftData.customer_id,
    forklift_no: forkliftData.forklift_no,
    customer_forklift_no: forkliftData.customer_forklift_no,
    current_customer_id: forkliftData.current_customer_id,
    delivery_date: forkliftData.delivery_date,
    source_item_group: forkliftData.source_item_group,
    notes: forkliftData.notes,
  };

  let { data, error } = await supabase
    .from('forklifts')
    .insert(payload)
    .select()
    .single();

  if (error && isMissingColumnError(error)) {
    const { current_site_id: _currentSiteId, delivery_date: _deliveryDate, source_item_group: _sourceItemGroup, ...legacyPayload } = payload;
    ({ data, error } = await supabase
      .from('forklifts')
      .insert(legacyPayload)
      .select()
      .single());
  }

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

  // Keep both hourmeter columns in sync
  const syncedUpdates = { ...updates };
  if (syncedUpdates.last_service_hourmeter !== undefined) {
    (syncedUpdates as Record<string, unknown>).last_serviced_hourmeter = syncedUpdates.last_service_hourmeter;
  }

  const { data, error } = await supabase
    .from('forklifts')
    .update({
      ...syncedUpdates,
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

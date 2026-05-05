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

const FORKLIFT_SELECT = 'forklift_id, serial_number, make, model, type, hourmeter, year, capacity_kg, location, site, current_site_id, status, last_service_date, next_service_due, notes, created_at, updated_at, ownership, customer_id, forklift_no, customer_forklift_no, current_customer_id, delivery_date, source_item_group, last_service_hourmeter, service_interval_hours, last_serviced_hourmeter, next_target_service_hour, last_hourmeter_update, ownership_type, acquisition_source, original_fleet_forklift_id, service_management_status, sold_to_customer_at, sold_price';
const LEGACY_FORKLIFT_SELECT = 'forklift_id, serial_number, make, model, type, hourmeter, year, capacity_kg, location, site, status, last_service_date, next_service_due, notes, created_at, updated_at, ownership, customer_id, forklift_no, customer_forklift_no, current_customer_id, last_service_hourmeter, service_interval_hours, last_serviced_hourmeter, next_target_service_hour, last_hourmeter_update, ownership_type';

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

export const getForkliftsForList = async (): Promise<Pick<Forklift, 'forklift_id' | 'serial_number' | 'forklift_no' | 'make' | 'model' | 'type' | 'status' | 'hourmeter' | 'location' | 'current_customer_id' | 'current_site_id' | 'ownership_type'>[]> => {
  const { data, error } = await supabase
    .from('forklifts')
    .select('forklift_id, serial_number, forklift_no, make, model, type, status, hourmeter, location, current_customer_id, current_site_id, ownership_type')
    .neq('status', 'Out of Service')
    .neq('status', 'Inactive')
    .order('serial_number');

  if (error) throw new Error(error.message);
  return data as Pick<Forklift, 'forklift_id' | 'serial_number' | 'forklift_no' | 'make' | 'model' | 'type' | 'status' | 'hourmeter' | 'location' | 'current_customer_id' | 'current_site_id' | 'ownership_type'>[];
};

/**
 * Forklifts currently linked to a customer (by `current_customer_id`).
 * Used by Phase 2 service-contract creation modal to populate the
 * "covered forklifts" multi-select. Returns [] on error.
 */
export const getForkliftsByCustomerId = async (customerId: string): Promise<Forklift[]> => {
  if (!customerId) return [];
  const { data, error } = await supabase
    .from('forklifts')
    .select(FORKLIFT_SELECT)
    .eq('current_customer_id', customerId)
    .order('forklift_no', { ascending: true, nullsFirst: false });
  if (error || !data) return [];
  return data as Forklift[];
};

/**
 * Customer-owned forklifts that Acwer is responsible for servicing.
 * Used by the cross-customer Serviced Externals tab AND by the per-customer
 * profile section. Optional customerId narrows to one customer.
 *
 * `includeDormant` defaults to false — the Serviced Externals tab wants to
 * hide dormant rows to keep the dashboard tight, but the customer profile
 * wants to see the full historical relationship (including dormant units
 * the customer can revive).
 */
export const getExternalServicedForklifts = async (
  customerId?: string,
  options?: { includeDormant?: boolean }
): Promise<Forklift[]> => {
  let query = supabase
    .from('forklifts')
    .select(FORKLIFT_SELECT)
    .eq('ownership', 'customer')
    .order('serial_number');
  if (!options?.includeDormant) {
    query = query.neq('service_management_status', 'dormant');
  }
  if (customerId) {
    query = query.eq('current_customer_id', customerId);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as Forklift[];
};

/**
 * Sold-fleet transition. Atomic flip via the
 * acwer_transition_fleet_to_customer Postgres RPC. Returns the updated
 * forklift row.
 */
export const transitionFleetToCustomer = async (
  forkliftId: string,
  customerId: string,
  saleDate: string,
  options?: {
    salePrice?: number;
    customerAssetNo?: string;
    actorId?: string;
    actorName?: string;
    reason?: string;
  }
): Promise<Forklift> => {
  const { data, error } = await supabase.rpc('acwer_transition_fleet_to_customer', {
    p_forklift_id: forkliftId,
    p_customer_id: customerId,
    p_sale_date: saleDate,
    p_sale_price: options?.salePrice ?? null,
    p_customer_asset_no: options?.customerAssetNo ?? null,
    p_actor_id: options?.actorId ?? null,
    p_actor_name: options?.actorName ?? null,
    p_reason: options?.reason ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Forklift;
};

/**
 * Append-only audit log for a forklift. Newest first.
 */
export const getForkliftHistory = async (
  forkliftId: string
): Promise<import('../types').ForkliftHistoryEvent[]> => {
  const { data, error } = await supabase
    .from('forklift_history')
    .select('history_id, forklift_id, event_type, event_data, actor_id, actor_name, created_at')
    .eq('forklift_id', forkliftId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as import('../types').ForkliftHistoryEvent[];
};

/**
 * Admin correction RPC: edit sale_date / sale_price / customer_asset_no on a
 * customer-owned forklift. Pass undefined to leave a field unchanged; pass
 * `clearSalePrice: true` or `clearAssetNo: true` to explicitly NULL it.
 * Writes an `ownership_edited` history row when anything changes.
 */
export const editOwnershipDetails = async (
  forkliftId: string,
  options: {
    saleDate?: string;
    salePrice?: number;
    customerAssetNo?: string;
    clearSalePrice?: boolean;
    clearAssetNo?: boolean;
    actorId?: string;
    actorName?: string;
    correctionReason?: string;
  }
): Promise<Forklift> => {
  const { data, error } = await supabase.rpc('acwer_edit_ownership_details', {
    p_forklift_id: forkliftId,
    p_sale_date: options.saleDate ?? null,
    p_sale_price: options.salePrice ?? null,
    p_customer_asset_no: options.customerAssetNo ?? null,
    p_actor_id: options.actorId ?? null,
    p_actor_name: options.actorName ?? null,
    p_correction_reason: options.correctionReason ?? null,
    p_clear_sale_price: options.clearSalePrice ?? false,
    p_clear_asset_no: options.clearAssetNo ?? false,
  });
  if (error) throw new Error(error.message);
  return data as Forklift;
};

/**
 * Admin RPC: undo a sold_from_fleet sale. Flips the forklift back to
 * company-owned, clears sale fields, status returns to Available. Refuses
 * BYO and any non-sold-from-fleet customer-owned record.
 */
export const reverseSaleToFleet = async (
  forkliftId: string,
  options?: {
    actorId?: string;
    actorName?: string;
    reason?: string;
  }
): Promise<Forklift> => {
  const { data, error } = await supabase.rpc('acwer_reverse_sale_to_fleet', {
    p_forklift_id: forkliftId,
    p_actor_id: options?.actorId ?? null,
    p_actor_name: options?.actorName ?? null,
    p_reason: options?.reason ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Forklift;
};

/**
 * Admin RPC: change owner of a customer-owned forklift from one customer to
 * another (Acwer keeps servicing). Active service_contracts and
 * recurring_schedules pinned to the old customer are NOT auto-moved — the
 * call to {@link countOrphanedObligations} powers the warning the modal
 * shows before the admin commits.
 */
export const transferBetweenCustomers = async (
  forkliftId: string,
  newCustomerId: string,
  transferDate: string,
  options?: {
    newCustomerAssetNo?: string;
    clearAssetNo?: boolean;
    actorId?: string;
    actorName?: string;
    reason?: string;
  }
): Promise<Forklift> => {
  const { data, error } = await supabase.rpc('acwer_transfer_between_customers', {
    p_forklift_id: forkliftId,
    p_new_customer_id: newCustomerId,
    p_transfer_date: transferDate,
    p_actor_id: options?.actorId ?? null,
    p_actor_name: options?.actorName ?? null,
    p_reason: options?.reason ?? null,
    p_new_customer_asset_no: options?.newCustomerAssetNo ?? null,
    p_clear_asset_no: options?.clearAssetNo ?? false,
  });
  if (error) throw new Error(error.message);
  return data as Forklift;
};

/**
 * Read-only preflight for transferBetweenCustomers: how many active contracts
 * and recurring schedules are pinned to the current owner that cover the
 * given forklift. The admin will need to manually reassign these after the
 * transfer.
 */
export const countOrphanedObligations = async (
  forkliftId: string,
  customerId: string
): Promise<{ activeContracts: number; activeSchedules: number }> => {
  const { data, error } = await supabase.rpc('acwer_count_orphaned_obligations', {
    p_forklift_id: forkliftId,
    p_customer_id: customerId,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    activeContracts: Number(row?.active_contracts ?? 0),
    activeSchedules: Number(row?.active_schedules ?? 0),
  };
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

/**
 * Lightweight forklift fetch for dashboards — only essential fields + customer name.
 * ~12 fields vs ~30 in the full select. Use this for count/display widgets.
 */
export interface ForkliftDashboardRow {
  forklift_id: string;
  serial_number: string;
  forklift_no: string | null;
  make: string;
  model: string;
  type: string;
  hourmeter: number;
  status: string;
  next_service_due: string | null;
  next_service_hourmeter: number | null;
  current_customer_id: string | null;
  current_customer: { name: string } | null;
}

export const getForkliftsLightweightForDashboard = async (): Promise<ForkliftDashboardRow[]> => {
  const { data, error } = await supabase
    .from('forklifts')
    .select('forklift_id, serial_number, forklift_no, make, model, type, hourmeter, status, next_service_due, next_service_hourmeter, current_customer_id, current_customer:customers!forklifts_current_customer_id_fkey(name)')
    .order('serial_number')
    .limit(2000); // safety cap — well above current fleet size

  if (error) throw new Error(error.message);
  return (data || []) as unknown as ForkliftDashboardRow[];
};

/**
 * Fleet status counts from RPC — bypasses PostgREST max_rows limit.
 * Use for dashboard header counts where accuracy > 1000 is required.
 */
export interface FleetStatusCounts {
  total: number;
  rented_out: number;
  available: number;
  out_of_service: number;
  awaiting_parts: number;
  reserved: number;
}

export const getFleetStatusCounts = async (): Promise<FleetStatusCounts> => {
  const { data, error } = await supabase.rpc('get_fleet_status_counts');
  
  if (error) throw new Error(error.message);
  return data as FleetStatusCounts;
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
    
    if (resultError) throw new Error(resultError.message, { cause: e });
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
      .eq('is_active', true)
      .ilike('name', `%${escaped}%`);
    matchingCustomerIds = (matchedCx || []).map((c: { customer_id: string }) => c.customer_id);
  }

  const selectStr = FORKLIFT_SELECT;
  let query = supabase
    .from('forklifts')
    .select(selectStr, { count: 'exact' })
    .eq('ownership_type', 'fleet')
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
      .eq('ownership_type', 'fleet')
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
    delivery_date: forkliftData.delivery_date || null,
    source_item_group: forkliftData.source_item_group,
    ownership_type: forkliftData.ownership_type || 'fleet',
    notes: forkliftData.notes,
  };

  // Sanitize empty strings to null for timestamp/date columns
  for (const field of ['delivery_date', 'last_service_date'] as const) {
    if ((payload as Record<string, unknown>)[field] === '') {
      (payload as Record<string, unknown>)[field] = null;
    }
  }

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

  if (error) {
    if (error.code === '23505' && error.message.includes('forklift_no')) {
      throw new Error(`Forklift number "${forkliftData.forklift_no}" already exists. Please use a unique number.`);
    }
    throw new Error(error.message);
  }
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

  // Sanitize empty strings to null for timestamp/date columns (Postgres rejects "" for timestamptz)
  const timestampFields = ['last_service_date', 'next_service_due', 'delivery_date', 'last_hourmeter_update', 'created_at', 'updated_at'] as const;
  for (const field of timestampFields) {
    if ((syncedUpdates as Record<string, unknown>)[field] === '') {
      (syncedUpdates as Record<string, unknown>)[field] = null;
    }
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

  if (error) {
    if (error.code === '23505' && error.message.includes('forklift_no')) {
      throw new Error(`Forklift number "${updates.forklift_no}" already exists. Please use a unique number.`);
    }
    throw new Error(error.message);
  }

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

/* eslint-disable max-lines */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../services/supabaseClient';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { getForkliftsPage, getForkliftUniqueMakes } from '../../../services/forkliftService';
import { getCustomersForList } from '../../../services/customerService';
import { showToast } from '../../../services/toastService';
import { Customer, Forklift, ForkliftStatus, ForkliftType, User, UserRole } from '../../../types';
import { ResultModalState } from '../types';

const PAGE_SIZE = 50;

const initialFormData = {
  serial_number: '',
  forklift_no: '',
  customer_forklift_no: '',
  make: '',
  model: '',
  type: ForkliftType.DIESEL,
  hourmeter: 0,
  last_hourmeter_update: new Date().toISOString().split('T')[0],
  last_service_hourmeter: 0,
  last_service_date: '',
  year: null,
  capacity_kg: 0,
  site: '',
  status: ForkliftStatus.ACTIVE,
  notes: '',
};

export function useFleetManagement(currentUser: User, displayRole: UserRole) {
  const queryClient = useQueryClient();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMake, setFilterMake] = useState<string>('all');
  const [filterAssigned, setFilterAssigned] = useState<string>('all');

  // Debounce search → reset to page 1 on change
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchQuery]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, filterType, filterStatus, filterMake, filterAssigned]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingForklift, setEditingForklift] = useState<Forklift | null>(null);
  const [assigningForklift, setAssigningForklift] = useState<Forklift | null>(null);
  const [returningForklift, setReturningForklift] = useState<Forklift | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  // Selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedForkliftIds, setSelectedForkliftIds] = useState<Set<string>>(new Set());
  const [showBulkRentModal, setShowBulkRentModal] = useState(false);
  const [showBulkEndRentalModal, setShowBulkEndRentalModal] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showBulkServiceResetModal, setShowBulkServiceResetModal] = useState(false);
  const [bulkRentedForklifts, setBulkRentedForklifts] = useState<any[]>([]);

  // Result modal
  const [resultModal, setResultModal] = useState<ResultModalState>({
    show: false, type: 'success', title: '', message: '',
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; forklift: Forklift | null }>({ show: false, forklift: null });

  // Form data
  const [formData, setFormData] = useState(initialFormData);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [rentalSite, setRentalSite] = useState('');
  const [monthlyRentalRate, setMonthlyRentalRate] = useState('');
  const [lastServiceHourmeter, setLastServiceHourmeter] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Paginated fleet query ─────────────────────────────────────────────────
  const fleetQueryKey = ['forklifts', 'page', debouncedSearch, currentPage, filterType, filterStatus, filterMake, filterAssigned] as const;
  const { data: fleetData, isLoading: fleetLoading, isFetching: fleetFetching } = useQuery({
    queryKey: fleetQueryKey,
    queryFn: () => getForkliftsPage({
      searchQuery: debouncedSearch,
      page: currentPage,
      pageSize: PAGE_SIZE,
      filterType,
      filterStatus,
      filterMake,
      filterAssigned,
    }),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });

  const forklifts = fleetData?.forklifts ?? [];
  const totalCount = fleetData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const loading = fleetLoading;
  const isFetching = fleetFetching;

  // ── Unique makes for filter dropdown ─────────────────────────────────────
  const { data: uniqueMakesData } = useQuery({
    queryKey: ['forklifts', 'makes'],
    queryFn: getForkliftUniqueMakes,
    staleTime: 10 * 60 * 1000,
  });
  const uniqueMakes = uniqueMakesData ?? [];

  // ── Customers — lazy-loaded when a modal opens ────────────────────────────
  const customersEnabled = showAssignModal || showBulkRentModal;
  const { data: customersData } = useQuery({
    queryKey: ['customers', 'list'],
    queryFn: () => getCustomersForList(),
    staleTime: 5 * 60 * 1000,
    enabled: customersEnabled,
  });
  const customers = (customersData ?? []) as Customer[];

  // ── Helper to refresh fleet after mutations ───────────────────────────────
  const invalidateFleet = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['forklifts', 'page'] });
  }, [queryClient]);

  // Permission check
  const canEditForklifts = [
    UserRole.ADMIN, UserRole.ADMIN_SERVICE, UserRole.ADMIN_STORE, UserRole.SUPERVISOR,
  ].includes(displayRole);

  // ── Derived / computed ────────────────────────────────────────────────────
  const filteredForklifts = forklifts; // server already applied filters

  const selectedForklifts = useMemo(
    () => filteredForklifts.filter((f) => selectedForkliftIds.has(f.forklift_id)),
    [filteredForklifts, selectedForkliftIds]
  );
  const availableSelectedForklifts = useMemo(
    () => selectedForklifts.filter((f) => !f.current_customer_id),
    [selectedForklifts]
  );
  const rentedSelectedForklifts = useMemo(
    () => selectedForklifts.filter((f) => !!f.current_customer_id),
    [selectedForklifts]
  );

  const hasFilters = debouncedSearch || filterType !== 'all' || filterStatus !== 'all' || filterMake !== 'all' || filterAssigned !== 'all';

  // ── Form helpers ──────────────────────────────────────────────────────────
  const resetForm = useCallback(() => setFormData(initialFormData), []);

  const handleAddNew = useCallback(() => {
    resetForm();
    setEditingForklift(null);
    setShowAddModal(true);
  }, [resetForm]);

  const handleEdit = useCallback((forklift: Forklift, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({
      serial_number: forklift.serial_number,
      forklift_no: forklift.forklift_no || '',
      customer_forklift_no: forklift.customer_forklift_no || '',
      make: forklift.make,
      model: forklift.model,
      type: forklift.type,
      hourmeter: forklift.hourmeter,
      last_hourmeter_update: forklift.last_hourmeter_update ? forklift.last_hourmeter_update.split('T')[0] : new Date().toISOString().split('T')[0],
      last_service_hourmeter: forklift.last_service_hourmeter || 0,
      last_service_date: forklift.last_service_date ? forklift.last_service_date.split('T')[0] : '',
      year: forklift.year || new Date().getFullYear(),
      capacity_kg: forklift.capacity_kg || 0,
      site: forklift.site || forklift.location || '',
      status: forklift.status,
      notes: forklift.notes || '',
    });
    setEditingForklift(forklift);
    setShowAddModal(true);
  }, []);

  const handleAssign = useCallback((forklift: Forklift, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssigningForklift(forklift);
    setSelectedCustomerId('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setRentalNotes('');
    setRentalSite('');
    setLastServiceHourmeter('');
    setShowAssignModal(true);
  }, []);

  const handleReturn = useCallback((forklift: Forklift, e: React.MouseEvent) => {
    e.stopPropagation();
    setReturningForklift(forklift);
  }, []);

  const handleReturnSubmit = useCallback(async (data: {
    returnDate: string;
    hourmeter: number;
    condition: string;
    notes: string;
  }) => {
    if (!returningForklift) return;

    setIsReturning(true);
    try {
      const { getActiveRentalForForklift, endRental } = await import('../../../services/forkliftService');

      const rental = await getActiveRentalForForklift(returningForklift.forklift_id);
      if (!rental) throw new Error('No active rental found for this forklift');

      await endRental(rental.rental_id, data.returnDate, currentUser?.user_id, currentUser?.name);

      const conditionNote = `Condition: ${data.condition}`;
      const finalNotes = data.notes ? `${conditionNote}\n${data.notes}` : conditionNote;

      await supabase
        .from('forklift_rentals')
        .update({
          hourmeter_at_end: data.hourmeter,
          notes: finalNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('rental_id', rental.rental_id);

      const newStatus = (data.condition === 'Requires Service' || data.condition === 'Damaged')
        ? 'Service Due'
        : 'Available';

      await supabase
        .from('forklifts')
        .update({
          hourmeter: data.hourmeter,
          last_hourmeter_update: new Date().toISOString(),
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('forklift_id', returningForklift.forklift_id);

      setReturningForklift(null);
      invalidateFleet();

      setResultModal({
        show: true,
        type: 'success',
        title: 'Forklift Returned Successfully',
        message: `${returningForklift.make} ${returningForklift.model} (${returningForklift.serial_number}) has been returned.`,
        details: [
          `✓ Final hourmeter: ${data.hourmeter} hours`,
          `✓ Condition: ${data.condition}`,
          `✓ Status: ${newStatus}`,
        ],
      });
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message,
      });
    } finally {
      setIsReturning(false);
    }
  }, [returningForklift, currentUser, invalidateFleet]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serial_number || !formData.make || !formData.model) {
      setResultModal({ show: true, type: 'error', title: 'Validation Error', message: 'Please fill in Serial Number, Make, and Model' });
      return;
    }

    try {
      if (editingForklift) {
        await MockDb.updateForklift(editingForklift.forklift_id, formData, { userId: currentUser.user_id, userName: currentUser.name });
      } else {
        await MockDb.createForklift(formData);
      }
      invalidateFleet();
      queryClient.invalidateQueries({ queryKey: ['forklifts', 'makes'] });
      setShowAddModal(false);
      resetForm();
      setEditingForklift(null);
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: 'Error saving forklift: ' + (error as Error).message });
    }
  }, [formData, editingForklift, currentUser, invalidateFleet, queryClient, resetForm]);

  const handleAssignSubmit = useCallback(async () => {
    if (!assigningForklift || !selectedCustomerId || !startDate) {
      setResultModal({ show: true, type: 'error', title: 'Validation Error', message: 'Please select a customer and start date' });
      return;
    }

    try {
      await MockDb.assignForkliftToCustomer(
        assigningForklift.forklift_id, selectedCustomerId, startDate,
        endDate || undefined, rentalNotes || undefined,
        currentUser?.user_id, currentUser?.name,
        monthlyRentalRate ? parseFloat(monthlyRentalRate) : undefined,
        rentalSite || undefined
      );

      if (lastServiceHourmeter) {
        const newHm = parseInt(lastServiceHourmeter);
        if (!isNaN(newHm) && newHm > 0) {
          const interval = assigningForklift.service_interval_hours || 500;
          await supabase
            .from('forklifts')
            .update({
              last_service_hourmeter: newHm,
              last_serviced_hourmeter: newHm,
              next_target_service_hour: newHm + interval,
              last_service_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('forklift_id', assigningForklift.forklift_id);
        }
      }

      const customer = customers.find((c) => c.customer_id === selectedCustomerId);
      setShowAssignModal(false);
      setAssigningForklift(null);
      setMonthlyRentalRate('');
      setRentalSite('');
      invalidateFleet();

      setResultModal({
        show: true, type: 'success', title: 'Forklift Rented Successfully',
        message: `${assigningForklift.make} ${assigningForklift.model} (${assigningForklift.serial_number}) has been rented to ${customer?.name || 'customer'}.`,
        details: [
          `✓ Rental created successfully`,
          `✓ Start date: ${new Date(startDate).toLocaleDateString()}`,
          monthlyRentalRate ? `✓ Monthly rate: RM${parseFloat(monthlyRentalRate).toLocaleString()}` : '',
        ].filter(Boolean),
      });
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: (error as Error).message });
    }
  }, [assigningForklift, selectedCustomerId, startDate, endDate, rentalNotes, monthlyRentalRate, customers, currentUser, invalidateFleet]);

  const handleDelete = useCallback((forklift: Forklift, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ show: true, forklift });
  }, []);

  const confirmDelete = useCallback(async () => {
    const forklift = deleteConfirm.forklift;
    if (!forklift) return;
    setDeleteConfirm({ show: false, forklift: null });
    try {
      await MockDb.deleteForklift(forklift.forklift_id);
      invalidateFleet();
      queryClient.invalidateQueries({ queryKey: ['forklifts', 'makes'] });
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: (error as Error).message });
    }
  }, [deleteConfirm.forklift, invalidateFleet, queryClient]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm({ show: false, forklift: null });
  }, []);

  // ── Selection handlers ────────────────────────────────────────────────────
  const toggleSelectionMode = useCallback(() => {
    if (isSelectionMode) setSelectedForkliftIds(new Set());
    setIsSelectionMode(!isSelectionMode);
  }, [isSelectionMode]);

  const toggleForkliftSelection = useCallback((forkliftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedForkliftIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(forkliftId)) newSet.delete(forkliftId);
      else newSet.add(forkliftId);
      return newSet;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedForkliftIds(new Set(filteredForklifts.map((f) => f.forklift_id)));
  }, [filteredForklifts]);

  const deselectAll = useCallback(() => setSelectedForkliftIds(new Set()), []);

  // ── Bulk operations ───────────────────────────────────────────────────────
  const handleBulkRentOut = useCallback(async () => {
    if (availableSelectedForklifts.length === 0 || !selectedCustomerId || !startDate) {
      setResultModal({
        show: true, type: 'error', title: 'Validation Error',
        message: availableSelectedForklifts.length === 0 ? 'No available forklifts selected' : 'Please select a customer and start date',
      });
      return;
    }

    setBulkProcessing(true);
    try {
      const forkliftIds = availableSelectedForklifts.map((f) => f.forklift_id);
      const result = await MockDb.bulkAssignForkliftsToCustomer(
        forkliftIds, selectedCustomerId, startDate, endDate || undefined,
        rentalNotes || undefined, currentUser?.user_id, currentUser?.name,
        monthlyRentalRate ? parseFloat(monthlyRentalRate) : undefined,
        rentalSite || undefined
      );

      const customer = customers.find((c) => c.customer_id === selectedCustomerId);
      const details: string[] = [];
      result.success.forEach((r) => details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rented successfully`));
      result.failed.forEach((f) => {
        const fl = availableSelectedForklifts.find((x) => x.forklift_id === f.forkliftId);
        details.push(`✗ ${fl?.serial_number || f.forkliftId} - ${f.error}`);
      });

      if (result.success.length > 0) {
        const successIds = result.success.map((r) => r.forklift_id);
        setBulkRentedForklifts(availableSelectedForklifts.filter((f) => successIds.includes(f.forklift_id)));
        setShowBulkServiceResetModal(true);
      }

      setResultModal({
        show: true,
        type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
        title: result.failed.length === 0 ? 'Forklifts Rented Successfully' : 'Bulk Rent Out Complete',
        message: `Successfully rented out ${result.success.length} forklift(s) to ${customer?.name || 'customer'}${result.failed.length > 0 ? `. ${result.failed.length} failed.` : '.'}`,
        details,
      });

      setShowBulkRentModal(false);
      setSelectedForkliftIds(new Set());
      setIsSelectionMode(false);
      setSelectedCustomerId('');
      setMonthlyRentalRate('');
      setRentalNotes('');
      setRentalSite('');
      invalidateFleet();
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: (error as Error).message });
    } finally {
      setBulkProcessing(false);
    }
  }, [availableSelectedForklifts, selectedCustomerId, startDate, endDate, rentalNotes, monthlyRentalRate, customers, currentUser, invalidateFleet]);

  const handleBulkEndRental = useCallback(async () => {
    if (rentedSelectedForklifts.length === 0) {
      setResultModal({ show: true, type: 'error', title: 'No Forklifts Selected', message: 'No rented forklifts selected' });
      return;
    }

    setBulkProcessing(true);
    try {
      const forkliftIds = rentedSelectedForklifts.map((f) => f.forklift_id);
      const result = await MockDb.bulkEndRentals(forkliftIds, bulkEndDate || undefined, currentUser?.user_id, currentUser?.name);

      const details: string[] = [];
      result.success.forEach((r) => details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rental ended`));
      result.failed.forEach((f) => {
        const fl = rentedSelectedForklifts.find((x) => x.forklift_id === f.forkliftId);
        details.push(`✗ ${fl?.serial_number || f.forkliftId} - ${f.error}`);
      });

      setResultModal({
        show: true,
        type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
        title: result.failed.length === 0 ? 'Rentals Ended Successfully' : 'Bulk End Rental Complete',
        message: `Successfully ended ${result.success.length} rental(s)${result.failed.length > 0 ? `. ${result.failed.length} failed.` : '.'}`,
        details,
      });

      setShowBulkEndRentalModal(false);
      setSelectedForkliftIds(new Set());
      setIsSelectionMode(false);
      invalidateFleet();
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: (error as Error).message });
    } finally {
      setBulkProcessing(false);
    }
  }, [rentedSelectedForklifts, bulkEndDate, currentUser, invalidateFleet]);

  const openBulkRentModal = useCallback(() => {
    setSelectedCustomerId('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setRentalNotes('');
    setRentalSite('');
    setMonthlyRentalRate('');
    setShowBulkRentModal(true);
  }, []);

  const openBulkEndRentalModal = useCallback(() => {
    setBulkEndDate(new Date().toISOString().split('T')[0]);
    setShowBulkEndRentalModal(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    setEditingForklift(null);
    resetForm();
  }, [resetForm]);

  const closeAssignModal = useCallback(() => {
    setShowAssignModal(false);
    setAssigningForklift(null);
  }, []);

  const closeResultModal = useCallback(() => {
    setResultModal(prev => ({ ...prev, show: false }));
  }, []);

  return {
    // Data
    forklifts, customers, loading, isFetching, filteredForklifts, uniqueMakes,
    // Pagination
    currentPage, setCurrentPage, totalCount, totalPages,
    // Filters
    searchQuery, setSearchQuery, filterType, setFilterType,
    filterStatus, setFilterStatus, filterMake, setFilterMake,
    filterAssigned, setFilterAssigned, hasFilters,
    // Selection
    isSelectionMode, selectedForkliftIds, availableSelectedForklifts, rentedSelectedForklifts,
    toggleSelectionMode, toggleForkliftSelection, selectAllFiltered, deselectAll,
    // Modals
    showAddModal, showAssignModal, showBulkRentModal, showBulkEndRentalModal,
    editingForklift, assigningForklift, resultModal, bulkProcessing,
    closeAddModal, closeAssignModal, closeResultModal,
    setShowBulkRentModal, setShowBulkEndRentalModal,
    showBulkServiceResetModal, setShowBulkServiceResetModal, bulkRentedForklifts,
    returningForklift, setReturningForklift, isReturning,
    // Forms
    formData, setFormData, selectedCustomerId, setSelectedCustomerId,
    startDate, setStartDate, endDate, setEndDate,
    rentalNotes, setRentalNotes, rentalSite, setRentalSite,
    monthlyRentalRate, setMonthlyRentalRate,
    lastServiceHourmeter, setLastServiceHourmeter,
    bulkEndDate, setBulkEndDate,
    // Handlers
    canEditForklifts, handleAddNew, handleEdit, handleAssign, handleReturn,
    handleSubmit, handleAssignSubmit, handleDelete, deleteConfirm, confirmDelete, cancelDelete,
    handleBulkRentOut, handleBulkEndRental, handleReturnSubmit,
    openBulkRentModal, openBulkEndRentalModal,
  };
}

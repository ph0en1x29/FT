import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Forklift, ForkliftType, ForkliftStatus, Customer, UserRole, User } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { ResultModalState } from '../types';

const initialFormData = {
  serial_number: '',
  make: '',
  model: '',
  type: ForkliftType.DIESEL,
  hourmeter: 0,
  year: new Date().getFullYear(),
  capacity_kg: 0,
  location: '',
  status: ForkliftStatus.ACTIVE,
  notes: '',
};

export function useFleetManagement(currentUser: User, displayRole: UserRole) {
  // Core data
  const [forklifts, setForklifts] = useState<Forklift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMake, setFilterMake] = useState<string>('all');
  const [filterAssigned, setFilterAssigned] = useState<string>('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingForklift, setEditingForklift] = useState<Forklift | null>(null);
  const [assigningForklift, setAssigningForklift] = useState<Forklift | null>(null);

  // Selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedForkliftIds, setSelectedForkliftIds] = useState<Set<string>>(new Set());
  const [showBulkRentModal, setShowBulkRentModal] = useState(false);
  const [showBulkEndRentalModal, setShowBulkEndRentalModal] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Result modal
  const [resultModal, setResultModal] = useState<ResultModalState>({
    show: false, type: 'success', title: '', message: '',
  });

  // Form data
  const [formData, setFormData] = useState(initialFormData);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [monthlyRentalRate, setMonthlyRentalRate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Permission check
  const canEditForklifts = [
    UserRole.ADMIN, UserRole.ADMIN_SERVICE, UserRole.ADMIN_STORE, UserRole.SUPERVISOR,
  ].includes(displayRole);

  // Data loading
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [forkliftData, customerData] = await Promise.all([
        MockDb.getForkliftsWithCustomers(),
        MockDb.getCustomers(),
      ]);
      setForklifts(forkliftData);
      setCustomers(customerData);
    } catch (error) {
      showToast.error('Failed to load forklifts');
      try {
        const data = await MockDb.getForklifts();
        setForklifts(data);
      } catch {
        showToast.error('Failed to load forklifts fallback');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Computed values
  const uniqueMakes = useMemo(() => {
    return [...new Set(forklifts.map((f) => f.make))].filter(Boolean).sort();
  }, [forklifts]);

  const filteredForklifts = useMemo(() => {
    return forklifts.filter((forklift) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        forklift.serial_number.toLowerCase().includes(searchLower) ||
        forklift.make.toLowerCase().includes(searchLower) ||
        forklift.model.toLowerCase().includes(searchLower) ||
        (forklift.location || '').toLowerCase().includes(searchLower) ||
        (forklift.current_customer?.name || '').toLowerCase().includes(searchLower);

      const matchesType = filterType === 'all' || forklift.type === filterType;
      const matchesStatus = filterStatus === 'all' || forklift.status === filterStatus;
      const matchesMake = filterMake === 'all' || forklift.make === filterMake;
      const hasCustomer = !!forklift.current_customer_id;
      const matchesAssigned =
        filterAssigned === 'all' ||
        (filterAssigned === 'assigned' && hasCustomer) ||
        (filterAssigned === 'unassigned' && !hasCustomer);

      return matchesSearch && matchesType && matchesStatus && matchesMake && matchesAssigned;
    });
  }, [forklifts, searchQuery, filterType, filterStatus, filterMake, filterAssigned]);

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

  const hasFilters = searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterMake !== 'all' || filterAssigned !== 'all';

  // Form helpers
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
      make: forklift.make,
      model: forklift.model,
      type: forklift.type,
      hourmeter: forklift.hourmeter,
      year: forklift.year || new Date().getFullYear(),
      capacity_kg: forklift.capacity_kg || 0,
      location: forklift.location || '',
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
    setShowAssignModal(true);
  }, []);

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
      await loadData();
      setShowAddModal(false);
      resetForm();
      setEditingForklift(null);
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: 'Error saving forklift: ' + (error as Error).message });
    }
  }, [formData, editingForklift, currentUser, loadData, resetForm]);

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
        monthlyRentalRate ? parseFloat(monthlyRentalRate) : undefined
      );

      const customer = customers.find((c) => c.customer_id === selectedCustomerId);
      setShowAssignModal(false);
      setAssigningForklift(null);
      setMonthlyRentalRate('');
      await loadData();

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
  }, [assigningForklift, selectedCustomerId, startDate, endDate, rentalNotes, monthlyRentalRate, customers, currentUser, loadData]);

  const handleDelete = useCallback(async (forklift: Forklift, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete forklift ${forklift.serial_number}?\n\nThis cannot be undone.`)) return;
    try {
      await MockDb.deleteForklift(forklift.forklift_id);
      await loadData();
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: (error as Error).message });
    }
  }, [loadData]);

  // Selection handlers
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

  // Bulk operations
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
        monthlyRentalRate ? parseFloat(monthlyRentalRate) : undefined
      );

      const customer = customers.find((c) => c.customer_id === selectedCustomerId);
      const details: string[] = [];
      result.success.forEach((r) => details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rented successfully`));
      result.failed.forEach((f) => {
        const forklift = forklifts.find((fl) => fl.forklift_id === f.forkliftId);
        details.push(`✗ ${forklift?.serial_number || f.forkliftId} - ${f.error}`);
      });

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
      await loadData();
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: (error as Error).message });
    } finally {
      setBulkProcessing(false);
    }
  }, [availableSelectedForklifts, selectedCustomerId, startDate, endDate, rentalNotes, monthlyRentalRate, customers, forklifts, currentUser, loadData]);

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
        const forklift = forklifts.find((fl) => fl.forklift_id === f.forkliftId);
        details.push(`✗ ${forklift?.serial_number || f.forkliftId} - ${f.error}`);
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
      await loadData();
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: (error as Error).message });
    } finally {
      setBulkProcessing(false);
    }
  }, [rentedSelectedForklifts, bulkEndDate, forklifts, currentUser, loadData]);

  const openBulkRentModal = useCallback(() => {
    setSelectedCustomerId('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setRentalNotes('');
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
    forklifts, customers, loading, filteredForklifts, uniqueMakes,
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
    // Forms
    formData, setFormData, selectedCustomerId, setSelectedCustomerId,
    startDate, setStartDate, endDate, setEndDate,
    rentalNotes, setRentalNotes, monthlyRentalRate, setMonthlyRentalRate,
    bulkEndDate, setBulkEndDate,
    // Handlers
    canEditForklifts, handleAddNew, handleEdit, handleAssign,
    handleSubmit, handleAssignSubmit, handleDelete,
    handleBulkRentOut, handleBulkEndRental,
    openBulkRentModal, openBulkEndRentalModal,
  };
}

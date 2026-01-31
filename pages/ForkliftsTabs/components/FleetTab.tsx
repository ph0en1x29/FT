import React, { useState, useEffect, useMemo } from 'react';
import { Forklift, ForkliftType, ForkliftStatus, Customer, UserRole } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Plus, Square, CheckSquare, Loader2 } from 'lucide-react';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { TabProps, ResultModalState } from '../types';
import ForkliftGrid from './ForkliftGrid';
import ForkliftFilters from './ForkliftFilters';
import BulkActionsBar from './BulkActionsBar';
import BulkEndRentalModal from './BulkEndRentalModal';
import AddEditForkliftModal from './AddEditForkliftModal';
import AssignForkliftModal from './AssignForkliftModal';
import ResultModal from './ResultModal';

const FleetTab: React.FC<TabProps> = ({ currentUser }) => {
  const [forklifts, setForklifts] = useState<Forklift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { displayRole } = useDevModeContext();

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMake, setFilterMake] = useState<string>('all');
  const [filterAssigned, setFilterAssigned] = useState<string>('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingForklift, setEditingForklift] = useState<Forklift | null>(null);
  const [assigningForklift, setAssigningForklift] = useState<Forklift | null>(null);

  // Multi-select states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedForkliftIds, setSelectedForkliftIds] = useState<Set<string>>(new Set());
  const [showBulkRentModal, setShowBulkRentModal] = useState(false);
  const [showBulkEndRentalModal, setShowBulkEndRentalModal] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Result modal state
  const [resultModal, setResultModal] = useState<ResultModalState>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  // Form data for add/edit
  const [formData, setFormData] = useState({
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
  });

  // Assign form data
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [monthlyRentalRate, setMonthlyRentalRate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Permission check
  const canEditForklifts = [
    UserRole.ADMIN,
    UserRole.ADMIN_SERVICE,
    UserRole.ADMIN_STORE,
    UserRole.SUPERVISOR,
  ].includes(displayRole);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
      } catch (fallbackError) {
        showToast.error('Failed to load forklifts fallback');
      }
    } finally {
      setLoading(false);
    }
  };

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

  const hasFilters =
    searchQuery ||
    filterType !== 'all' ||
    filterStatus !== 'all' ||
    filterMake !== 'all' ||
    filterAssigned !== 'all';

  const resetForm = () => {
    setFormData({
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
    });
  };

  const handleAddNew = () => {
    resetForm();
    setEditingForklift(null);
    setShowAddModal(true);
  };

  const handleEdit = (forklift: Forklift, e: React.MouseEvent) => {
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
  };

  const handleAssign = (forklift: Forklift, e: React.MouseEvent) => {
    e.stopPropagation();
    setAssigningForklift(forklift);
    setSelectedCustomerId('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setRentalNotes('');
    setShowAssignModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serial_number || !formData.make || !formData.model) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Validation Error',
        message: 'Please fill in Serial Number, Make, and Model',
      });
      return;
    }

    try {
      if (editingForklift) {
        await MockDb.updateForklift(editingForklift.forklift_id, formData, {
          userId: currentUser.user_id,
          userName: currentUser.name,
        });
      } else {
        await MockDb.createForklift(formData);
      }
      await loadData();
      setShowAddModal(false);
      resetForm();
      setEditingForklift(null);
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: 'Error saving forklift: ' + (error as Error).message,
      });
    }
  };

  const handleAssignSubmit = async () => {
    if (!assigningForklift || !selectedCustomerId || !startDate) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Validation Error',
        message: 'Please select a customer and start date',
      });
      return;
    }

    try {
      await MockDb.assignForkliftToCustomer(
        assigningForklift.forklift_id,
        selectedCustomerId,
        startDate,
        endDate || undefined,
        rentalNotes || undefined,
        currentUser?.user_id,
        currentUser?.name,
        monthlyRentalRate ? parseFloat(monthlyRentalRate) : undefined
      );

      const customer = customers.find((c) => c.customer_id === selectedCustomerId);
      setShowAssignModal(false);
      setAssigningForklift(null);
      setMonthlyRentalRate('');
      await loadData();

      setResultModal({
        show: true,
        type: 'success',
        title: 'Forklift Rented Successfully',
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
  };

  const handleDelete = async (forklift: Forklift, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete forklift ${forklift.serial_number}?\n\nThis cannot be undone.`)) return;
    try {
      await MockDb.deleteForklift(forklift.forklift_id);
      await loadData();
    } catch (error) {
      setResultModal({ show: true, type: 'error', title: 'Error', message: (error as Error).message });
    }
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) setSelectedForkliftIds(new Set());
    setIsSelectionMode(!isSelectionMode);
  };

  const toggleForkliftSelection = (forkliftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedForkliftIds);
    if (newSelected.has(forkliftId)) newSelected.delete(forkliftId);
    else newSelected.add(forkliftId);
    setSelectedForkliftIds(newSelected);
  };

  const handleBulkRentOut = async () => {
    if (availableSelectedForklifts.length === 0 || !selectedCustomerId || !startDate) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Validation Error',
        message: availableSelectedForklifts.length === 0 ? 'No available forklifts selected' : 'Please select a customer and start date',
      });
      return;
    }

    setBulkProcessing(true);
    try {
      const forkliftIds = availableSelectedForklifts.map((f) => f.forklift_id);
      const result = await MockDb.bulkAssignForkliftsToCustomer(
        forkliftIds,
        selectedCustomerId,
        startDate,
        endDate || undefined,
        rentalNotes || undefined,
        currentUser?.user_id,
        currentUser?.name,
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
  };

  const handleBulkEndRental = async () => {
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
  };

  const openBulkRentModal = () => {
    setSelectedCustomerId('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setRentalNotes('');
    setMonthlyRentalRate('');
    setShowBulkRentModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-theme-muted">
          {filteredForklifts.length} of {forklifts.length} units
          {isSelectionMode && selectedForkliftIds.size > 0 && (
            <span className="ml-2 text-blue-600 font-medium">• {selectedForkliftIds.size} selected</span>
          )}
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={toggleSelectionMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isSelectionMode ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isSelectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {isSelectionMode ? 'Exit Selection' : 'Multi-Select'}
          </button>
          {canEditForklifts && (
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Forklift
            </button>
          )}
        </div>
      </div>

      {isSelectionMode && (
        <BulkActionsBar
          totalCount={filteredForklifts.length}
          selectedCount={selectedForkliftIds.size}
          availableCount={availableSelectedForklifts.length}
          rentedCount={rentedSelectedForklifts.length}
          onSelectAll={() => setSelectedForkliftIds(new Set(filteredForklifts.map((f) => f.forklift_id)))}
          onDeselectAll={() => setSelectedForkliftIds(new Set())}
          onBulkRent={openBulkRentModal}
          onBulkEndRental={() => {
            setBulkEndDate(new Date().toISOString().split('T')[0]);
            setShowBulkEndRentalModal(true);
          }}
        />
      )}

      <ForkliftFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterType={filterType}
        setFilterType={setFilterType}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterAssigned={filterAssigned}
        setFilterAssigned={setFilterAssigned}
        filterMake={filterMake}
        setFilterMake={setFilterMake}
        uniqueMakes={uniqueMakes}
      />

      <ForkliftGrid
        forklifts={filteredForklifts}
        isSelectionMode={isSelectionMode}
        selectedForkliftIds={selectedForkliftIds}
        canEdit={canEditForklifts}
        hasFilters={!!hasFilters}
        onToggleSelection={toggleForkliftSelection}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAssign={handleAssign}
      />

      {showAddModal && (
        <AddEditForkliftModal
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingForklift(null); resetForm(); }}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          isEditing={!!editingForklift}
        />
      )}

      {showAssignModal && assigningForklift && (
        <AssignForkliftModal
          isOpen={showAssignModal}
          onClose={() => { setShowAssignModal(false); setAssigningForklift(null); }}
          forklift={assigningForklift}
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          rentalNotes={rentalNotes}
          setRentalNotes={setRentalNotes}
          monthlyRentalRate={monthlyRentalRate}
          setMonthlyRentalRate={setMonthlyRentalRate}
          onSubmit={handleAssignSubmit}
        />
      )}

      {showBulkRentModal && (
        <AssignForkliftModal
          isOpen={showBulkRentModal}
          onClose={() => setShowBulkRentModal(false)}
          forklift={null}
          bulkCount={availableSelectedForklifts.length}
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          rentalNotes={rentalNotes}
          setRentalNotes={setRentalNotes}
          monthlyRentalRate={monthlyRentalRate}
          setMonthlyRentalRate={setMonthlyRentalRate}
          onSubmit={handleBulkRentOut}
          isProcessing={bulkProcessing}
        />
      )}

      <BulkEndRentalModal
        isOpen={showBulkEndRentalModal}
        onClose={() => setShowBulkEndRentalModal(false)}
        count={rentedSelectedForklifts.length}
        endDate={bulkEndDate}
        setEndDate={setBulkEndDate}
        onSubmit={handleBulkEndRental}
        isProcessing={bulkProcessing}
      />

      <ResultModal
        isOpen={resultModal.show}
        onClose={() => setResultModal({ ...resultModal, show: false })}
        type={resultModal.type}
        title={resultModal.title}
        message={resultModal.message}
        details={resultModal.details}
      />
    </div>
  );
};

export default FleetTab;

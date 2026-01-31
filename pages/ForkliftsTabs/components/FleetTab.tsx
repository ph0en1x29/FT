import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Forklift, ForkliftType, ForkliftStatus, Customer, UserRole } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import {
  Plus, Search, Filter, Truck, Edit2, Trash2, X, Save,
  Gauge, Calendar, MapPin, CheckCircle, AlertCircle, Clock,
  Building2, ChevronRight, Square, CheckSquare, CircleOff, Loader2
} from 'lucide-react';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { TabProps, ResultModalState } from '../types';
import ForkliftCard from './ForkliftCard';
import AddEditForkliftModal from './AddEditForkliftModal';
import AssignForkliftModal from './AssignForkliftModal';
import ResultModal from './ResultModal';

const FleetTab: React.FC<TabProps> = ({ currentUser }) => {
  const navigate = useNavigate();
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
    show: false, type: 'success', title: '', message: '' 
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

  // Bulk end rental form
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
        MockDb.getCustomers()
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

  // Get unique makes for filter dropdown
  const uniqueMakes = useMemo(() => {
    const makes = [...new Set(forklifts.map(f => f.make))].filter(Boolean).sort();
    return makes;
  }, [forklifts]);

  // Filtered and searched forklifts
  const filteredForklifts = useMemo(() => {
    return forklifts.filter(forklift => {
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
      const matchesAssigned = filterAssigned === 'all' || 
        (filterAssigned === 'assigned' && hasCustomer) ||
        (filterAssigned === 'unassigned' && !hasCustomer);

      return matchesSearch && matchesType && matchesStatus && matchesMake && matchesAssigned;
    });
  }, [forklifts, searchQuery, filterType, filterStatus, filterMake, filterAssigned]);

  // Selection helpers
  const selectedForklifts = useMemo(() => {
    return filteredForklifts.filter(f => selectedForkliftIds.has(f.forklift_id));
  }, [filteredForklifts, selectedForkliftIds]);

  const availableSelectedForklifts = useMemo(() => {
    return selectedForklifts.filter(f => !f.current_customer_id);
  }, [selectedForklifts]);

  const rentedSelectedForklifts = useMemo(() => {
    return selectedForklifts.filter(f => !!f.current_customer_id);
  }, [selectedForklifts]);

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
        message: 'Please fill in Serial Number, Make, and Model'
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
        message: 'Error saving forklift: ' + (error as Error).message
      });
    }
  };

  const handleAssignSubmit = async () => {
    if (!assigningForklift || !selectedCustomerId || !startDate) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Validation Error',
        message: 'Please select a customer and start date'
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
      
      const customer = customers.find(c => c.customer_id === selectedCustomerId);
      
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
          monthlyRentalRate ? `✓ Monthly rate: RM${parseFloat(monthlyRentalRate).toLocaleString()}` : ''
        ].filter(Boolean)
      });
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message
      });
    }
  };

  const handleDelete = async (forklift: Forklift, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete forklift ${forklift.serial_number}?\n\nThis cannot be undone.`)) return;
    
    try {
      await MockDb.deleteForklift(forklift.forklift_id);
      await loadData();
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message
      });
    }
  };

  // Selection mode handlers
  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedForkliftIds(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const toggleForkliftSelection = (forkliftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedForkliftIds);
    if (newSelected.has(forkliftId)) {
      newSelected.delete(forkliftId);
    } else {
      newSelected.add(forkliftId);
    }
    setSelectedForkliftIds(newSelected);
  };

  const selectAllFiltered = () => {
    const allIds = new Set(filteredForklifts.map(f => f.forklift_id));
    setSelectedForkliftIds(allIds);
  };

  const deselectAll = () => {
    setSelectedForkliftIds(new Set());
  };

  // Bulk operations
  const handleBulkRentOut = async () => {
    if (availableSelectedForklifts.length === 0) {
      setResultModal({ show: true, type: 'error', title: 'No Forklifts Selected', message: 'No available (unrented) forklifts selected' });
      return;
    }

    if (!selectedCustomerId || !startDate) {
      setResultModal({ show: true, type: 'error', title: 'Validation Error', message: 'Please select a customer and start date' });
      return;
    }

    setBulkProcessing(true);
    try {
      const forkliftIds = availableSelectedForklifts.map(f => f.forklift_id);
      const result = await MockDb.bulkAssignForkliftsToCustomer(
        forkliftIds, selectedCustomerId, startDate, endDate || undefined,
        rentalNotes || undefined, currentUser?.user_id, currentUser?.name,
        monthlyRentalRate ? parseFloat(monthlyRentalRate) : undefined
      );

      const customer = customers.find(c => c.customer_id === selectedCustomerId);
      const details: string[] = [];
      result.success.forEach(r => details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rented successfully`));
      result.failed.forEach(f => {
        const forklift = forklifts.find(fl => fl.forklift_id === f.forkliftId);
        details.push(`✗ ${forklift?.serial_number || f.forkliftId} - ${f.error}`);
      });

      setResultModal({
        show: true,
        type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
        title: result.failed.length === 0 ? 'Forklifts Rented Successfully' : 'Bulk Rent Out Complete',
        message: `Successfully rented out ${result.success.length} forklift(s) to ${customer?.name || 'customer'}${result.failed.length > 0 ? `. ${result.failed.length} failed.` : '.'}`,
        details
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
      const forkliftIds = rentedSelectedForklifts.map(f => f.forklift_id);
      const result = await MockDb.bulkEndRentals(forkliftIds, bulkEndDate || undefined, currentUser?.user_id, currentUser?.name);

      const details: string[] = [];
      result.success.forEach(r => details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rental ended`));
      result.failed.forEach(f => {
        const forklift = forklifts.find(fl => fl.forklift_id === f.forkliftId);
        details.push(`✗ ${forklift?.serial_number || f.forkliftId} - ${f.error}`);
      });

      setResultModal({
        show: true,
        type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
        title: result.failed.length === 0 ? 'Rentals Ended Successfully' : 'Bulk End Rental Complete',
        message: `Successfully ended ${result.success.length} rental(s)${result.failed.length > 0 ? `. ${result.failed.length} failed.` : '.'}`,
        details
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

  const openBulkEndRentalModal = () => {
    setBulkEndDate(new Date().toISOString().split('T')[0]);
    setShowBulkEndRentalModal(true);
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
              isSelectionMode 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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

      {/* Selection Actions Bar */}
      {isSelectionMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              <button onClick={selectAllFiltered} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Select All ({filteredForklifts.length})
              </button>
              <span className="text-slate-300">|</span>
              <button onClick={deselectAll} className="text-sm text-slate-600 hover:text-slate-800 font-medium">
                Deselect All
              </button>
            </div>
            
            {selectedForkliftIds.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <div className="text-sm text-slate-600 mr-2 self-center">
                  <span className="font-medium">{availableSelectedForklifts.length}</span> available, 
                  <span className="font-medium ml-1">{rentedSelectedForklifts.length}</span> rented
                </div>
                
                {availableSelectedForklifts.length > 0 && (
                  <button onClick={openBulkRentModal} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm">
                    <Building2 className="w-4 h-4" /> Rent Out ({availableSelectedForklifts.length})
                  </button>
                )}
                
                {rentedSelectedForklifts.length > 0 && (
                  <button onClick={openBulkEndRentalModal} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm">
                    <CircleOff className="w-4 h-4" /> End Rental ({rentedSelectedForklifts.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by S/N, make, model, location, customer..."
              className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme placeholder-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-theme-muted" />
              <select className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">All Types</option>
                {Object.values(ForkliftType).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <select className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              {Object.values(ForkliftStatus).map(status => <option key={status} value={status}>{status}</option>)}
            </select>

            <select className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme" value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)}>
              <option value="all">All Rentals</option>
              <option value="assigned">Rented</option>
              <option value="unassigned">Available</option>
            </select>

            {uniqueMakes.length > 0 && (
              <select className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme" value={filterMake} onChange={(e) => setFilterMake(e.target.value)}>
                <option value="all">All Makes</option>
                {uniqueMakes.map(make => <option key={make} value={make}>{make}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Forklifts Grid */}
      {filteredForklifts.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <Truck className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No forklifts found</h3>
          <p className="text-sm text-theme-muted">
            {searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterMake !== 'all' || filterAssigned !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Add your first forklift to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForklifts.map(forklift => (
            <ForkliftCard
              key={forklift.forklift_id}
              forklift={forklift}
              isSelectionMode={isSelectionMode}
              isSelected={selectedForkliftIds.has(forklift.forklift_id)}
              canEdit={canEditForklifts}
              onSelect={(id, e) => toggleForkliftSelection(id, e)}
              onClick={() => {
                if (isSelectionMode) {
                  const newSelected = new Set(selectedForkliftIds);
                  if (newSelected.has(forklift.forklift_id)) newSelected.delete(forklift.forklift_id);
                  else newSelected.add(forklift.forklift_id);
                  setSelectedForkliftIds(newSelected);
                } else {
                  navigate(`/forklifts/${forklift.forklift_id}`);
                }
              }}
              onEdit={(f, e) => handleEdit(f, e)}
              onDelete={(f, e) => handleDelete(f, e)}
              onAssign={(f, e) => handleAssign(f, e)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
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

      {/* Bulk Rent Modal */}
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

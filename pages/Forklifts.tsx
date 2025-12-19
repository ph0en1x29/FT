import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Forklift, ForkliftType, ForkliftStatus, Customer, User } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { 
  Plus, Search, Filter, Truck, Edit2, Trash2, X, Save, 
  Gauge, Calendar, MapPin, CheckCircle, AlertCircle, Clock,
  Building2, Eye, ChevronRight, Square, CheckSquare, XCircle,
  CircleOff, Loader2
} from 'lucide-react';

interface ForkliftsProps {
  currentUser?: User;
}

const Forklifts: React.FC<ForkliftsProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [forklifts, setForklifts] = useState<Forklift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
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
  const [resultModal, setResultModal] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'mixed';
    title: string;
    message: string;
    details?: string[];
  }>({ show: false, type: 'success', title: '', message: '' });

  // Form data
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
      console.error('Error loading data:', error);
      // Fallback to basic forklift load
      const data = await MockDb.getForklifts();
      setForklifts(data);
    }
    setLoading(false);
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
        ((forklift as any).current_customer?.name || '').toLowerCase().includes(searchLower);

      const matchesType = filterType === 'all' || forklift.type === filterType;
      const matchesStatus = filterStatus === 'all' || forklift.status === filterStatus;
      const matchesMake = filterMake === 'all' || forklift.make === filterMake;
      
      // Assignment filter
      const hasCustomer = !!(forklift as any).current_customer_id;
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
    return selectedForklifts.filter(f => !(f as any).current_customer_id);
  }, [selectedForklifts]);

  const rentedSelectedForklifts = useMemo(() => {
    return selectedForklifts.filter(f => !!(f as any).current_customer_id);
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
        await MockDb.updateForklift(editingForklift.forklift_id, formData);
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
      setResultModal({
        show: true,
        type: 'error',
        title: 'No Forklifts Selected',
        message: 'No available (unrented) forklifts selected'
      });
      return;
    }

    if (!selectedCustomerId || !startDate) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Validation Error',
        message: 'Please select a customer and start date'
      });
      return;
    }

    setBulkProcessing(true);
    try {
      const forkliftIds = availableSelectedForklifts.map(f => f.forklift_id);
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

      const customer = customers.find(c => c.customer_id === selectedCustomerId);
      const details: string[] = [];
      
      result.success.forEach(r => {
        details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rented successfully`);
      });
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
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkEndRental = async () => {
    if (rentedSelectedForklifts.length === 0) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'No Forklifts Selected',
        message: 'No rented forklifts selected'
      });
      return;
    }

    setBulkProcessing(true);
    try {
      const forkliftIds = rentedSelectedForklifts.map(f => f.forklift_id);
      const result = await MockDb.bulkEndRentals(
        forkliftIds,
        bulkEndDate || undefined,
        currentUser?.user_id,
        currentUser?.name
      );

      const details: string[] = [];
      result.success.forEach(r => {
        details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rental ended`);
      });
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
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message
      });
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

  const getStatusIcon = (status: ForkliftStatus) => {
    switch (status) {
      case ForkliftStatus.ACTIVE:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case ForkliftStatus.MAINTENANCE:
        return <Clock className="w-4 h-4 text-amber-500" />;
      case ForkliftStatus.INACTIVE:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: ForkliftStatus) => {
    const styles = {
      [ForkliftStatus.ACTIVE]: 'bg-green-100 text-green-700',
      [ForkliftStatus.MAINTENANCE]: 'bg-amber-100 text-amber-700',
      [ForkliftStatus.INACTIVE]: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  const getTypeBadge = (type: ForkliftType) => {
    const styles = {
      [ForkliftType.ELECTRIC]: 'bg-blue-100 text-blue-700',
      [ForkliftType.DIESEL]: 'bg-slate-100 text-slate-700',
      [ForkliftType.LPG]: 'bg-purple-100 text-purple-700',
      [ForkliftType.PETROL]: 'bg-orange-100 text-orange-700',
    };
    return styles[type] || 'bg-slate-100 text-slate-700';
  };

  const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading forklifts...</div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme">Forklifts</h1>
          <p className="text-sm text-theme-muted mt-1">
            {filteredForklifts.length} of {forklifts.length} units
            {isSelectionMode && selectedForkliftIds.size > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                • {selectedForkliftIds.size} selected
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Selection Mode Toggle */}
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
          
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Forklift
          </button>
        </div>
      </div>

      {/* Selection Actions Bar */}
      {isSelectionMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={selectAllFiltered}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Select All ({filteredForklifts.length})
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={deselectAll}
                className="text-sm text-slate-600 hover:text-slate-800 font-medium"
              >
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
                  <button
                    onClick={openBulkRentModal}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm"
                  >
                    <Building2 className="w-4 h-4" />
                    Rent Out ({availableSelectedForklifts.length})
                  </button>
                )}
                
                {rentedSelectedForklifts.length > 0 && (
                  <button
                    onClick={openBulkEndRentalModal}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm"
                  >
                    <CircleOff className="w-4 h-4" />
                    End Rental ({rentedSelectedForklifts.length})
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
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by S/N, make, model, location, customer..."
              className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme placeholder-slate-400 theme-transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-theme-muted" />
              <select
                className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                {Object.values(ForkliftType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <select
              className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              {Object.values(ForkliftStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
              value={filterAssigned}
              onChange={(e) => setFilterAssigned(e.target.value)}
            >
              <option value="all">All Rentals</option>
              <option value="assigned">Rented</option>
              <option value="unassigned">Available</option>
            </select>

            {uniqueMakes.length > 0 && (
              <select
                className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
                value={filterMake}
                onChange={(e) => setFilterMake(e.target.value)}
              >
                <option value="all">All Makes</option>
                {uniqueMakes.map(make => (
                  <option key={make} value={make}>{make}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Forklifts Grid */}
      {filteredForklifts.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center theme-transition">
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
          {filteredForklifts.map(forklift => {
            const currentCustomer = (forklift as any).current_customer;
            const isSelected = selectedForkliftIds.has(forklift.forklift_id);
            
            return (
              <div
                key={forklift.forklift_id}
                onClick={() => {
                  if (isSelectionMode) {
                    const newSelected = new Set(selectedForkliftIds);
                    if (newSelected.has(forklift.forklift_id)) {
                      newSelected.delete(forklift.forklift_id);
                    } else {
                      newSelected.add(forklift.forklift_id);
                    }
                    setSelectedForkliftIds(newSelected);
                  } else {
                    navigate(`/forklifts/${forklift.forklift_id}`);
                  }
                }}
                className={`card-theme rounded-xl overflow-hidden cursor-pointer group transition-all theme-transition ${
                  isSelected 
                    ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
                    : 'hover:shadow-theme hover:border-blue-300'
                }`}
              >
                {/* Header */}
                <div className="p-4 border-b border-theme">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {isSelectionMode && (
                        <button
                          onClick={(e) => toggleForkliftSelection(forklift.forklift_id, e)}
                          className="mt-1"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-theme-muted" />
                          )}
                        </button>
                      )}
                      <div>
                        <h3 className="font-bold text-theme group-hover:text-blue-600 transition-colors">
                          {forklift.make} {forklift.model}
                        </h3>
                        <p className="text-sm text-theme-muted font-mono">{forklift.serial_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(forklift.status)}
                      {!isSelectionMode && (
                        <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-blue-500 transition-colors" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Current Customer Badge */}
                {currentCustomer && (
                  <div className="px-4 py-2 bg-green-50 border-b border-green-100">
                    <div className="flex items-center gap-2 text-green-700">
                      <Building2 className="w-4 h-4" />
                      <span className="text-sm font-medium truncate">{currentCustomer.name}</span>
                    </div>
                  </div>
                )}

                {/* Details */}
                <div className="p-4 space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadge(forklift.type)}`}>
                      {forklift.type}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(forklift.status)}`}>
                      {forklift.status}
                    </span>
                    {currentCustomer && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        🔴 Rented
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-theme-muted">
                      <Gauge className="w-4 h-4 opacity-60" />
                      <span>{forklift.hourmeter.toLocaleString()} hrs</span>
                    </div>
                    {forklift.year && (
                      <div className="flex items-center gap-2 text-theme-muted">
                        <Calendar className="w-4 h-4 opacity-60" />
                        <span>{forklift.year}</span>
                      </div>
                    )}
                    {forklift.location && (
                      <div className="flex items-center gap-2 text-theme-muted col-span-2">
                        <MapPin className="w-4 h-4 opacity-60" />
                        <span className="truncate">{forklift.location}</span>
                      </div>
                    )}
                  </div>

                  {forklift.capacity_kg && forklift.capacity_kg > 0 && (
                    <div className="text-xs text-theme-muted">
                      Capacity: {forklift.capacity_kg.toLocaleString()} kg
                    </div>
                  )}

                  {forklift.last_service_date && (
                    <div className="text-xs text-theme-muted">
                      Last serviced: {new Date(forklift.last_service_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isSelectionMode && (
                  <div className="px-4 py-3 bg-theme-surface-2 border-t border-theme flex justify-between items-center theme-transition">
                    {!currentCustomer && (
                      <button
                        onClick={(e) => handleAssign(forklift, e)}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <Building2 className="w-4 h-4" /> Rent Out
                      </button>
                    )}
                    {currentCustomer && <div />}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleEdit(forklift, e)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(forklift, e)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}


      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
              <h3 className="font-bold text-lg text-slate-800">
                {editingForklift ? 'Edit Forklift' : 'Add New Forklift'}
              </h3>
              <button 
                onClick={() => { setShowAddModal(false); setEditingForklift(null); resetForm(); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Serial Number *</label>
                <input
                  type="text"
                  className={inputClassName}
                  value={formData.serial_number}
                  onChange={e => setFormData({...formData, serial_number: e.target.value})}
                  placeholder="e.g., FL-001234"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Make *</label>
                  <input
                    type="text"
                    className={inputClassName}
                    value={formData.make}
                    onChange={e => setFormData({...formData, make: e.target.value})}
                    placeholder="e.g., Toyota"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Model *</label>
                  <input
                    type="text"
                    className={inputClassName}
                    value={formData.model}
                    onChange={e => setFormData({...formData, model: e.target.value})}
                    placeholder="e.g., 8FGU25"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type *</label>
                  <select
                    className={inputClassName}
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as ForkliftType})}
                  >
                    {Object.values(ForkliftType).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    className={inputClassName}
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as ForkliftStatus})}
                  >
                    {Object.values(ForkliftStatus).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hourmeter (hrs)</label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.hourmeter}
                    onChange={e => setFormData({...formData, hourmeter: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year</label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.year}
                    onChange={e => setFormData({...formData, year: parseInt(e.target.value) || new Date().getFullYear()})}
                    min="1980"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capacity (kg)</label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.capacity_kg}
                    onChange={e => setFormData({...formData, capacity_kg: parseInt(e.target.value) || 0})}
                    min="0"
                    placeholder="e.g., 2500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                  <input
                    type="text"
                    className={inputClassName}
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="e.g., Warehouse A"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea
                  className={`${inputClassName} h-20 resize-none`}
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingForklift(null); resetForm(); }}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingForklift ? 'Update' : 'Add Forklift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rent Out Modal (Single) */}
      {showAssignModal && assigningForklift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Rent Forklift to Customer</h3>
              <button 
                onClick={() => { setShowAssignModal(false); setAssigningForklift(null); }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">
                  {assigningForklift.make} {assigningForklift.model}
                </p>
                <p className="text-xs text-blue-600">{assigningForklift.serial_number}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Customer *</label>
                <select
                  className={inputClassName}
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rental Rate (RM)</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClassName}
                  value={monthlyRentalRate}
                  onChange={(e) => setMonthlyRentalRate(e.target.value)}
                  placeholder="e.g., 2500.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental Start Date *</label>
                <input
                  type="date"
                  className={inputClassName}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental End Date (Optional)</label>
                <input
                  type="date"
                  className={inputClassName}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty for ongoing rental</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea
                  className={`${inputClassName} h-20 resize-none`}
                  value={rentalNotes}
                  onChange={(e) => setRentalNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowAssignModal(false); setAssigningForklift(null); }}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignSubmit}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  Rent Forklift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Rent Out Modal */}
      {showBulkRentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-green-50 sticky top-0">
              <h3 className="font-bold text-lg text-green-800">
                Bulk Rent Out ({availableSelectedForklifts.length} Forklifts)
              </h3>
              <button 
                onClick={() => setShowBulkRentModal(false)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Selected Forklifts Preview */}
              <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Selected Forklifts:</p>
                <div className="space-y-1">
                  {availableSelectedForklifts.map(f => (
                    <div key={f.forklift_id} className="text-sm text-slate-700 flex items-center gap-2">
                      <Truck className="w-3 h-3 text-slate-400" />
                      <span className="font-medium">{f.serial_number}</span>
                      <span className="text-slate-400">- {f.make} {f.model}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Customer *</label>
                <select
                  className={inputClassName}
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => (
                    <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rental Rate (RM) - Per Unit</label>
                <input
                  type="number"
                  step="0.01"
                  className={inputClassName}
                  value={monthlyRentalRate}
                  onChange={(e) => setMonthlyRentalRate(e.target.value)}
                  placeholder="e.g., 2500.00 (same for all)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental Start Date *</label>
                <input
                  type="date"
                  className={inputClassName}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental End Date (Optional)</label>
                <input
                  type="date"
                  className={inputClassName}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Leave empty for ongoing rental</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes (Applied to All)</label>
                <textarea
                  className={`${inputClassName} h-20 resize-none`}
                  value={rentalNotes}
                  onChange={(e) => setRentalNotes(e.target.value)}
                  placeholder="Optional notes for all rentals..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkRentModal(false)}
                  disabled={bulkProcessing}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkRentOut}
                  disabled={bulkProcessing || !selectedCustomerId || !startDate}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                  {bulkProcessing ? 'Processing...' : `Rent Out ${availableSelectedForklifts.length} Forklifts`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk End Rental Modal */}
      {showBulkEndRentalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50 sticky top-0">
              <h3 className="font-bold text-lg text-red-800">
                End Rentals ({rentedSelectedForklifts.length} Forklifts)
              </h3>
              <button 
                onClick={() => setShowBulkEndRentalModal(false)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Selected Forklifts Preview */}
              <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Rentals to End:</p>
                <div className="space-y-2">
                  {rentedSelectedForklifts.map(f => {
                    const customer = (f as any).current_customer;
                    return (
                      <div key={f.forklift_id} className="text-sm p-2 bg-white rounded border border-slate-200">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Truck className="w-3 h-3 text-slate-400" />
                          <span className="font-medium">{f.serial_number}</span>
                          <span className="text-slate-400">- {f.make} {f.model}</span>
                        </div>
                        {customer && (
                          <div className="flex items-center gap-2 mt-1 text-xs text-green-600">
                            <Building2 className="w-3 h-3" />
                            <span>{customer.name}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Warning:</strong> This will end all {rentedSelectedForklifts.length} rental(s). 
                  The forklifts will become available for new rentals.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental End Date</label>
                <input
                  type="date"
                  className={inputClassName}
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkEndRentalModal(false)}
                  disabled={bulkProcessing}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkEndRental}
                  disabled={bulkProcessing}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CircleOff className="w-4 h-4" />
                  )}
                  {bulkProcessing ? 'Processing...' : `End ${rentedSelectedForklifts.length} Rentals`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className={`px-6 py-4 border-b flex justify-between items-center ${
              resultModal.type === 'success' ? 'bg-green-50 border-green-100' :
              resultModal.type === 'error' ? 'bg-red-50 border-red-100' :
              'bg-amber-50 border-amber-100'
            }`}>
              <h3 className={`font-bold text-lg flex items-center gap-2 ${
                resultModal.type === 'success' ? 'text-green-800' :
                resultModal.type === 'error' ? 'text-red-800' :
                'text-amber-800'
              }`}>
                {resultModal.type === 'success' && <CheckCircle className="w-5 h-5" />}
                {resultModal.type === 'error' && <AlertCircle className="w-5 h-5" />}
                {resultModal.type === 'mixed' && <AlertCircle className="w-5 h-5" />}
                {resultModal.title}
              </h3>
              <button 
                onClick={() => setResultModal({ ...resultModal, show: false })} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-700">{resultModal.message}</p>
              
              {resultModal.details && resultModal.details.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-1 text-sm font-mono">
                    {resultModal.details.map((detail, idx) => (
                      <p key={idx} className={
                        detail.startsWith('✓') ? 'text-green-600' :
                        detail.startsWith('✗') ? 'text-red-600' :
                        'text-slate-600'
                      }>
                        {detail}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setResultModal({ ...resultModal, show: false })}
                  className={`w-full py-2.5 rounded-lg font-medium shadow-sm ${
                    resultModal.type === 'success' ? 'bg-green-600 text-white hover:bg-green-700' :
                    resultModal.type === 'error' ? 'bg-red-600 text-white hover:bg-red-700' :
                    'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Forklifts;

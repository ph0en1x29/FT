import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Forklift, ForkliftType, ForkliftStatus, Customer, User } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import { 
  Plus, Search, Filter, Truck, Edit2, Trash2, X, Save, 
  Gauge, Calendar, MapPin, CheckCircle, AlertCircle, Clock,
  Building2, Eye, ChevronRight, Square, CheckSquare, XCircle,
  CircleOff, Loader2, Settings, Wrench, RefreshCw, Play,
  Fuel, Battery, Flame, AlertTriangle, LayoutDashboard
} from 'lucide-react';
import AssetDashboard from '../components/AssetDashboard';

// ============================================================================
// TYPES
// ============================================================================

interface ForkliftsTabsProps {
  currentUser: User;
}

interface ServiceInterval {
  interval_id: string;
  forklift_type: string;
  service_type: string;
  hourmeter_interval: number;
  calendar_interval_days: number | null;
  priority: string;
  checklist_items: string[];
  estimated_duration_hours: number | null;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

interface ForkliftDue {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: string;
  hourmeter: number;
  next_service_due: string | null;
  next_service_hourmeter: number | null;
  days_until_due: number | null;
  hours_until_due: number | null;
  is_overdue: boolean;
  has_open_job: boolean;
  current_customer_id?: string;
}

type TabType = 'dashboard' | 'fleet' | 'intervals' | 'service-due';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ForkliftsTabs: React.FC<ForkliftsTabsProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const isAdmin = currentUser.role === 'admin';
  const isAdminOrSupervisor = currentUser.role === 'admin' || currentUser.role === 'supervisor';

  // Default tab based on role: dashboard for admin/supervisor, fleet for others
  const defaultTab = isAdminOrSupervisor ? 'dashboard' : 'fleet';
  const urlTab = searchParams.get('tab') as TabType;
  // If URL has dashboard tab but user doesn't have access, fallback to fleet
  const initialTab = (urlTab === 'dashboard' && !isAdminOrSupervisor) ? 'fleet' : (urlTab || defaultTab);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs = [
    ...(isAdminOrSupervisor ? [{ id: 'dashboard' as TabType, label: 'Overview', icon: LayoutDashboard }] : []),
    { id: 'fleet' as TabType, label: 'Fleet', icon: Truck },
    ...(isAdmin ? [{ id: 'intervals' as TabType, label: 'Service Intervals', icon: Settings }] : []),
    { id: 'service-due' as TabType, label: 'Service Due', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme">Forklifts</h1>
            <p className="text-sm text-theme-muted mt-1">Manage fleet, service intervals, and maintenance schedules</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-theme">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-theme-muted hover:text-theme hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && isAdminOrSupervisor && <AssetDashboard currentUser={currentUser} />}
      {activeTab === 'fleet' && <FleetTab currentUser={currentUser} />}
      {activeTab === 'intervals' && isAdmin && <ServiceIntervalsTab currentUser={currentUser} />}
      {activeTab === 'service-due' && <ServiceDueTab currentUser={currentUser} />}
    </div>
  );
};

// ============================================================================
// FLEET TAB (Original Forklifts content)
// ============================================================================

const FleetTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
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
      showToast.error('Failed to load forklifts');
      try {
        const data = await MockDb.getForklifts();
        setForklifts(data);
      } catch (fallbackError) {
        console.error('Error loading forklifts fallback:', fallbackError);
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
        ((forklift as any).current_customer?.name || '').toLowerCase().includes(searchLower);

      const matchesType = filterType === 'all' || forklift.type === filterType;
      const matchesStatus = filterStatus === 'all' || forklift.status === filterStatus;
      const matchesMake = filterMake === 'all' || forklift.make === filterMake;
      
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

  const getStatusIcon = (status: ForkliftStatus) => {
    switch (status) {
      case ForkliftStatus.ACTIVE: return <CheckCircle className="w-4 h-4 text-green-500" />;
      case ForkliftStatus.MAINTENANCE: return <Clock className="w-4 h-4 text-amber-500" />;
      case ForkliftStatus.INACTIVE: return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
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
          {filteredForklifts.map(forklift => {
            const currentCustomer = (forklift as any).current_customer;
            const isSelected = selectedForkliftIds.has(forklift.forklift_id);
            
            return (
              <div
                key={forklift.forklift_id}
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
                className={`card-theme rounded-xl overflow-hidden cursor-pointer group transition-all ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' : 'hover:shadow-theme hover:border-blue-300'
                }`}
              >
                {/* Header */}
                <div className="p-4 border-b border-theme">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {isSelectionMode && (
                        <button onClick={(e) => toggleForkliftSelection(forklift.forklift_id, e)} className="mt-1">
                          {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-theme-muted" />}
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
                      {!isSelectionMode && <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-blue-500" />}
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeBadge(forklift.type)}`}>{forklift.type}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(forklift.status)}`}>{forklift.status}</span>
                    {currentCustomer && <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">🔴 Rented</span>}
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
                    <div className="text-xs text-theme-muted">Capacity: {forklift.capacity_kg.toLocaleString()} kg</div>
                  )}
                </div>

                {/* Actions */}
                {!isSelectionMode && (
                  <div className="px-4 py-3 bg-theme-surface-2 border-t border-theme flex justify-between items-center">
                    {!currentCustomer && (
                      <button onClick={(e) => handleAssign(forklift, e)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
                        <Building2 className="w-4 h-4" /> Rent Out
                      </button>
                    )}
                    {currentCustomer && <div />}
                    <div className="flex gap-2">
                      <button onClick={(e) => handleEdit(forklift, e)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => handleDelete(forklift, e)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
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

      {/* Modals would go here - keeping them minimal for now */}
      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 sticky top-0">
              <h3 className="font-bold text-lg text-slate-800">{editingForklift ? 'Edit Forklift' : 'Add New Forklift'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingForklift(null); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Serial Number *</label>
                <input type="text" className={inputClassName} value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} placeholder="e.g., FL-001234" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Make *</label>
                  <input type="text" className={inputClassName} value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} placeholder="e.g., Toyota" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Model *</label>
                  <input type="text" className={inputClassName} value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="e.g., 8FGU25" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type *</label>
                  <select className={inputClassName} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as ForkliftType})}>
                    {Object.values(ForkliftType).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select className={inputClassName} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as ForkliftStatus})}>
                    {Object.values(ForkliftStatus).map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hourmeter (hrs)</label>
                  <input type="number" className={inputClassName} value={formData.hourmeter} onChange={e => setFormData({...formData, hourmeter: parseInt(e.target.value) || 0})} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year</label>
                  <input type="number" className={inputClassName} value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value) || new Date().getFullYear()})} min="1980" max={new Date().getFullYear() + 1} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capacity (kg)</label>
                  <input type="number" className={inputClassName} value={formData.capacity_kg} onChange={e => setFormData({...formData, capacity_kg: parseInt(e.target.value) || 0})} min="0" placeholder="e.g., 2500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                  <input type="text" className={inputClassName} value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g., Warehouse A" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea className={`${inputClassName} h-20 resize-none`} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Additional notes..." />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingForklift(null); resetForm(); }} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {editingForklift ? 'Update' : 'Add Forklift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && assigningForklift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Rent Forklift to Customer</h3>
              <button onClick={() => { setShowAssignModal(false); setAssigningForklift(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800">{assigningForklift.make} {assigningForklift.model}</p>
                <p className="text-xs text-blue-600">{assigningForklift.serial_number}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Customer *</label>
                <select className={inputClassName} value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rental Rate (RM)</label>
                <input type="number" step="0.01" className={inputClassName} value={monthlyRentalRate} onChange={(e) => setMonthlyRentalRate(e.target.value)} placeholder="e.g., 2500.00" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental Start Date *</label>
                <input type="date" className={inputClassName} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental End Date (Optional)</label>
                <input type="date" className={inputClassName} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Leave empty for ongoing rental</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea className={`${inputClassName} h-20 resize-none`} value={rentalNotes} onChange={(e) => setRentalNotes(e.target.value)} placeholder="Optional notes..." />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setShowAssignModal(false); setAssigningForklift(null); }} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                  Cancel
                </button>
                <button type="button" onClick={handleAssignSubmit} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2">
                  <Building2 className="w-4 h-4" /> Rent Forklift
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
              <button onClick={() => setResultModal({ ...resultModal, show: false })} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-700">{resultModal.message}</p>
              
              {resultModal.details && resultModal.details.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-1 text-sm font-mono">
                    {resultModal.details.map((detail, idx) => (
                      <p key={idx} className={detail.startsWith('✓') ? 'text-green-600' : detail.startsWith('✗') ? 'text-red-600' : 'text-slate-600'}>
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

// ============================================================================
// SERVICE INTERVALS TAB
// ============================================================================

const ServiceIntervalsTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [intervals, setIntervals] = useState<ServiceInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInterval, setEditingInterval] = useState<ServiceInterval | null>(null);

  const [formData, setFormData] = useState({
    forklift_type: 'Diesel',
    service_type: '',
    hourmeter_interval: 500,
    calendar_interval_days: null as number | null,
    priority: 'Medium',
    estimated_duration_hours: null as number | null,
    name: '',
  });

  const FORKLIFT_TYPES = ['Diesel', 'Electric', 'LPG'];
  const PRIORITIES = ['Low', 'Medium', 'High', 'Emergency'];

  useEffect(() => {
    loadIntervals();
  }, []);

  const loadIntervals = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getServiceIntervals();
      setIntervals(data);
    } catch (e) {
      showToast.error('Failed to load service intervals');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Diesel': return <Fuel className="w-4 h-4 text-amber-500" />;
      case 'Electric': return <Battery className="w-4 h-4 text-green-500" />;
      case 'LPG': return <Flame className="w-4 h-4 text-orange-500" />;
      default: return <Wrench className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      case 'Low': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const filteredIntervals = selectedType === 'all' 
    ? intervals 
    : intervals.filter(i => i.forklift_type === selectedType);

  const resetForm = () => {
    setFormData({
      forklift_type: 'Diesel',
      service_type: '',
      hourmeter_interval: 500,
      calendar_interval_days: null,
      priority: 'Medium',
      estimated_duration_hours: null,
      name: '',
    });
  };

  const handleAdd = async () => {
    if (!formData.service_type) {
      showToast.error('Service type is required');
      return;
    }

    try {
      await MockDb.createServiceInterval({
        forklift_type: formData.forklift_type,
        service_type: formData.service_type,
        hourmeter_interval: formData.hourmeter_interval,
        calendar_interval_days: formData.calendar_interval_days,
        priority: formData.priority,
        estimated_duration_hours: formData.estimated_duration_hours,
        name: formData.name || null,
        checklist_items: [],
      });
      showToast.success('Service interval created');
      setShowAddModal(false);
      resetForm();
      await loadIntervals();
    } catch (e) {
      showToast.error('Failed to create service interval');
    }
  };

  const handleUpdate = async () => {
    if (!editingInterval) return;
    
    try {
      await MockDb.updateServiceInterval(editingInterval.interval_id, {
        forklift_type: formData.forklift_type,
        service_type: formData.service_type,
        hourmeter_interval: formData.hourmeter_interval,
        calendar_interval_days: formData.calendar_interval_days,
        priority: formData.priority,
        estimated_duration_hours: formData.estimated_duration_hours,
        name: formData.name || null,
      });
      showToast.success('Service interval updated');
      setEditingInterval(null);
      resetForm();
      await loadIntervals();
    } catch (e) {
      showToast.error('Failed to update service interval');
    }
  };

  const handleDelete = async (interval: ServiceInterval) => {
    if (!confirm(`Delete service interval "${interval.service_type}"?`)) return;
    
    try {
      await MockDb.deleteServiceInterval(interval.interval_id);
      showToast.success('Service interval deleted');
      await loadIntervals();
    } catch (e) {
      showToast.error('Failed to delete service interval');
    }
  };

  const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400";

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
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedType === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All
          </button>
          {FORKLIFT_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${selectedType === type ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {getTypeIcon(type)} {type}
            </button>
          ))}
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add Interval
        </button>
      </div>

      {/* ACWER Defaults Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">ACWER Service Defaults</h4>
        <div className="grid grid-cols-3 gap-4 text-sm text-blue-700">
          <div className="flex items-center gap-2"><Battery className="w-4 h-4 text-green-500" /> Electric: Every 3 months</div>
          <div className="flex items-center gap-2"><Fuel className="w-4 h-4 text-amber-500" /> Diesel: Every 500 hours</div>
          <div className="flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> LPG: Every 350 hours</div>
        </div>
      </div>

      {/* Intervals List */}
      {filteredIntervals.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <Settings className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No service intervals</h3>
          <p className="text-sm text-theme-muted">Add service intervals to track maintenance schedules</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Service</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Interval</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Priority</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredIntervals.map(interval => (
                <tr key={interval.interval_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(interval.forklift_type)}
                      <span className="text-sm font-medium">{interval.forklift_type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{interval.service_type}</span>
                    {interval.name && <span className="text-xs text-slate-500 ml-2">({interval.name})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {interval.hourmeter_interval > 0 && <span>{interval.hourmeter_interval} hrs</span>}
                      {interval.calendar_interval_days && (
                        <span className="text-slate-500 ml-2">/ {interval.calendar_interval_days} days</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(interval.priority)}`}>
                      {interval.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setFormData({
                          forklift_type: interval.forklift_type,
                          service_type: interval.service_type,
                          hourmeter_interval: interval.hourmeter_interval,
                          calendar_interval_days: interval.calendar_interval_days,
                          priority: interval.priority,
                          estimated_duration_hours: interval.estimated_duration_hours,
                          name: interval.name || '',
                        });
                        setEditingInterval(interval);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(interval)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingInterval) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">
                {editingInterval ? 'Edit Service Interval' : 'Add Service Interval'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setEditingInterval(null); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forklift Type</label>
                <select className={inputClassName} value={formData.forklift_type} onChange={e => setFormData({...formData, forklift_type: e.target.value})}>
                  {FORKLIFT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Service Type *</label>
                <input type="text" className={inputClassName} value={formData.service_type} onChange={e => setFormData({...formData, service_type: e.target.value})} placeholder="e.g., Regular Maintenance" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hourmeter Interval</label>
                  <input type="number" className={inputClassName} value={formData.hourmeter_interval} onChange={e => setFormData({...formData, hourmeter_interval: parseInt(e.target.value) || 0})} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Calendar Days</label>
                  <input type="number" className={inputClassName} value={formData.calendar_interval_days || ''} onChange={e => setFormData({...formData, calendar_interval_days: e.target.value ? parseInt(e.target.value) : null})} min="0" placeholder="Optional" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                <select className={inputClassName} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingInterval(null); resetForm(); }} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                  Cancel
                </button>
                <button type="button" onClick={editingInterval ? handleUpdate : handleAdd} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  {editingInterval ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SERVICE DUE TAB
// ============================================================================

const ServiceDueTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dueForklifts, setDueForklifts] = useState<ForkliftDue[]>([]);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'due_soon' | 'job_created'>('all');
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'supervisor';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const forklifts = await MockDb.getForkliftsDueForService(30);
      setDueForklifts(forklifts);
    } catch (e) {
      console.error('Failed to load service due data:', e);
      showToast.error('Failed to load service due data');
    } finally {
      setLoading(false);
    }
  };

  const runDailyCheck = async () => {
    setRunning(true);
    setLastResult(null);
    
    try {
      const result = await MockDb.runDailyServiceCheck();
      setLastResult(`Created ${result.jobs_created} jobs, ${result.notifications_created} notifications`);
      showToast.success(`Created ${result.jobs_created} jobs`);
      await loadData();
    } catch (e: any) {
      setLastResult(`Error: ${e.message}`);
      showToast.error('Daily service check failed');
    } finally {
      setRunning(false);
    }
  };

  const filteredForklifts = dueForklifts.filter(f => {
    if (filter === 'overdue') return f.is_overdue;
    if (filter === 'due_soon') return !f.is_overdue && !f.has_open_job;
    if (filter === 'job_created') return f.has_open_job;
    return true;
  });

  const stats = {
    overdue: dueForklifts.filter(f => f.is_overdue).length,
    dueSoon: dueForklifts.filter(f => !f.is_overdue && !f.has_open_job).length,
    jobCreated: dueForklifts.filter(f => f.has_open_job).length,
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setFilter('overdue')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'overdue' ? 'border-red-500 bg-red-50' : 'border-transparent bg-white hover:border-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              <p className="text-sm text-slate-600">Overdue</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('due_soon')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'due_soon' ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-white hover:border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.dueSoon}</p>
              <p className="text-sm text-slate-600">Due Soon</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('job_created')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'job_created' ? 'border-green-500 bg-green-50' : 'border-transparent bg-white hover:border-green-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.jobCreated}</p>
              <p className="text-sm text-slate-600">Jobs Created</p>
            </div>
          </div>
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setFilter('all')}
          className={`text-sm font-medium ${filter === 'all' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Show All ({dueForklifts.length})
        </button>

        {isAdmin && (
          <div className="flex items-center gap-3">
            {lastResult && (
              <span className={`text-sm ${lastResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {lastResult}
              </span>
            )}
            <button
              onClick={runDailyCheck}
              disabled={running}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Service Check
            </button>
          </div>
        )}
      </div>

      {/* Forklifts List */}
      {filteredForklifts.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">All caught up!</h3>
          <p className="text-sm text-theme-muted">No forklifts due for service in this category</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Forklift</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Hourmeter</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredForklifts.map(forklift => (
                <tr key={forklift.forklift_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{forklift.make} {forklift.model}</p>
                      <p className="text-sm text-slate-500 font-mono">{forklift.serial_number}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{forklift.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <p>{forklift.hourmeter.toLocaleString()} hrs</p>
                      {forklift.hours_until_due !== null && (
                        <p className={`text-xs ${forklift.hours_until_due < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {forklift.hours_until_due < 0 ? `${Math.abs(forklift.hours_until_due)} hrs overdue` : `${forklift.hours_until_due} hrs until due`}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {forklift.has_open_job ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Job Created</span>
                    ) : forklift.is_overdue ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Overdue</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Due Soon</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/forklifts/${forklift.forklift_id}`)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 ml-auto"
                    >
                      View <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ForkliftsTabs;

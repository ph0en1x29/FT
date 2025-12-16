import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Forklift, ForkliftType, ForkliftStatus, Customer, User } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { 
  Plus, Search, Filter, Truck, Edit2, Trash2, X, Save, 
  Gauge, Calendar, MapPin, CheckCircle, AlertCircle, Clock,
  Building2, Eye, ChevronRight
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
      alert('Please fill in Serial Number, Make, and Model');
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
      alert('Error saving forklift: ' + (error as Error).message);
    }
  };

  const handleAssignSubmit = async () => {
    if (!assigningForklift || !selectedCustomerId || !startDate) {
      alert('Please select a customer and start date');
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
      
      setShowAssignModal(false);
      setAssigningForklift(null);
      setMonthlyRentalRate('');
      await loadData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleDelete = async (forklift: Forklift, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete forklift ${forklift.serial_number}?\n\nThis cannot be undone.`)) return;
    
    try {
      await MockDb.deleteForklift(forklift.forklift_id);
      await loadData();
    } catch (error) {
      alert((error as Error).message);
    }
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
          <h1 className="text-2xl font-bold text-slate-900">Forklifts</h1>
          <p className="text-sm text-slate-500 mt-1">
            {filteredForklifts.length} of {forklifts.length} units
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Forklift
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by S/N, make, model, location, customer..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              {Object.values(ForkliftStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={filterAssigned}
              onChange={(e) => setFilterAssigned(e.target.value)}
            >
              <option value="all">All Rentals</option>
              <option value="assigned">Rented</option>
              <option value="unassigned">Available</option>
            </select>

            {uniqueMakes.length > 0 && (
              <select
                className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">No forklifts found</h3>
          <p className="text-sm text-slate-400">
            {searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterMake !== 'all' || filterAssigned !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Add your first forklift to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForklifts.map(forklift => {
            const currentCustomer = (forklift as any).current_customer;
            
            return (
              <div
                key={forklift.forklift_id}
                onClick={() => navigate(`/forklifts/${forklift.forklift_id}`)}
                className="bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-200 transition-all overflow-hidden cursor-pointer group"
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {forklift.make} {forklift.model}
                      </h3>
                      <p className="text-sm text-slate-500 font-mono">{forklift.serial_number}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(forklift.status)}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
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
                    <div className="flex items-center gap-2 text-slate-600">
                      <Gauge className="w-4 h-4 text-slate-400" />
                      <span>{forklift.hourmeter.toLocaleString()} hrs</span>
                    </div>
                    {forklift.year && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span>{forklift.year}</span>
                      </div>
                    )}
                    {forklift.location && (
                      <div className="flex items-center gap-2 text-slate-600 col-span-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="truncate">{forklift.location}</span>
                      </div>
                    )}
                  </div>

                  {forklift.capacity_kg && forklift.capacity_kg > 0 && (
                    <div className="text-xs text-slate-500">
                      Capacity: {forklift.capacity_kg.toLocaleString()} kg
                    </div>
                  )}

                  {forklift.last_service_date && (
                    <div className="text-xs text-slate-400">
                      Last serviced: {new Date(forklift.last_service_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
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

      {/* Rent Out Modal */}
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
    </div>
  );
};

export default Forklifts;

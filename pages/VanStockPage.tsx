import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  UserRole,
  VanStock,
  VanStockItem,
  VanStockReplenishment,
} from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import {
  Package,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronRight,
  Users,
  TrendingDown,
  Calendar,
  RefreshCw,
  X,
  Filter,
  Truck,
  Plus,
  UserPlus,
  Edit2,
  Trash2,
  ArrowRightLeft,
  MoreVertical,
} from 'lucide-react';
import { Part } from '../types';

interface VanStockPageProps {
  currentUser: User;
  hideHeader?: boolean;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'low_stock' | 'pending_audit' | 'pending_replenishment';

export default function VanStockPage({ currentUser, hideHeader = false }: VanStockPageProps) {
  const navigate = useNavigate();
  const [vanStocks, setVanStocks] = useState<VanStock[]>([]);
  const [replenishments, setReplenishments] = useState<VanStockReplenishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedVanStock, setSelectedVanStock] = useState<VanStock | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // New state for assign/add modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [availableTechnicians, setAvailableTechnicians] = useState<User[]>([]);
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemMinQty, setItemMinQty] = useState(1);
  const [itemMaxQty, setItemMaxQty] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  // Van code and notes for assign modal
  const [vanCode, setVanCode] = useState('');
  const [vanNotes, setVanNotes] = useState('');

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editVanCode, setEditVanCode] = useState('');
  const [editVanNotes, setEditVanNotes] = useState('');
  const [editMaxItems, setEditMaxItems] = useState(50);
  const [editTechnicianId, setEditTechnicianId] = useState('');
  const [allTechnicians, setAllTechnicians] = useState<User[]>([]);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<'deactivate' | 'delete'>('deactivate');

  // Transfer modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [selectedItemsForTransfer, setSelectedItemsForTransfer] = useState<Set<string>>(new Set());

  // Action menu state
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const isAdmin = [
    UserRole.ADMIN,
    UserRole.ADMIN_SERVICE,
    UserRole.ADMIN_STORE,
    UserRole.SUPERVISOR,
  ].includes(currentUser.role);

  useEffect(() => {
    loadData();
  }, []);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (actionMenuOpen) {
        setActionMenuOpen(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [actionMenuOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stocksData, replenishmentsData] = await Promise.all([
        MockDb.getAllVanStocks(),
        MockDb.getReplenishmentRequests({ status: 'pending' }),
      ]);

      // Technicians can only see their own van stock
      const isTechnician = currentUser.role === UserRole.TECHNICIAN;
      const filteredStocks = isTechnician
        ? stocksData.filter(vs => vs.technician_id === currentUser.user_id)
        : stocksData;

      setVanStocks(filteredStocks);
      setReplenishments(replenishmentsData);
    } catch (error) {
      console.error('Error loading van stocks:', error);
      showToast.error('Failed to load Van Stock data');
    }
    setLoading(false);
  };

  // Calculate stats
  const stats = useMemo(() => {
    const totalTechnicians = vanStocks.length;
    const totalItems = vanStocks.reduce((sum, vs) => sum + (vs.items?.length || 0), 0);
    const totalValue = vanStocks.reduce((sum, vs) => sum + (vs.total_value || 0), 0);
    const lowStockCount = vanStocks.reduce((sum, vs) => {
      const lowItems = vs.items?.filter(item => item.quantity <= item.min_quantity) || [];
      return sum + lowItems.length;
    }, 0);
    const pendingAudits = vanStocks.filter(vs => {
      if (!vs.next_audit_due) return false;
      return new Date(vs.next_audit_due) <= new Date();
    }).length;
    const pendingReplenishments = replenishments.length;

    return {
      totalTechnicians,
      totalItems,
      totalValue,
      lowStockCount,
      pendingAudits,
      pendingReplenishments,
    };
  }, [vanStocks, replenishments]);

  // Filter and search
  const filteredVanStocks = useMemo(() => {
    let result = vanStocks;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(vs =>
        vs.technician_name?.toLowerCase().includes(query) ||
        vs.technician?.email?.toLowerCase().includes(query) ||
        vs.van_code?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType === 'low_stock') {
      result = result.filter(vs => {
        const lowItems = vs.items?.filter(item => item.quantity <= item.min_quantity) || [];
        return lowItems.length > 0;
      });
    } else if (filterType === 'pending_audit') {
      result = result.filter(vs => {
        if (!vs.next_audit_due) return true; // Never audited
        return new Date(vs.next_audit_due) <= new Date();
      });
    } else if (filterType === 'pending_replenishment') {
      const techsWithPending = new Set(replenishments.map(r => r.technician_id));
      result = result.filter(vs => techsWithPending.has(vs.technician_id));
    }

    return result;
  }, [vanStocks, searchQuery, filterType, replenishments]);

  const getLowStockItems = (items: VanStockItem[] | undefined): VanStockItem[] => {
    if (!items) return [];
    return items.filter(item => item.quantity <= item.min_quantity);
  };

  const getStockStatusColor = (item: VanStockItem) => {
    if (item.quantity === 0) return 'text-red-600 bg-red-50';
    if (item.quantity <= item.min_quantity) return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
  };

  const handleViewDetails = (vs: VanStock) => {
    setSelectedVanStock(vs);
    setShowDetailModal(true);
  };

  const handleScheduleAudit = async (vs: VanStock) => {
    try {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      await MockDb.scheduleVanStockAudit(
        vs.van_stock_id,
        vs.technician_id,
        vs.technician_name || '',
        nextWeek.toISOString().split('T')[0]
      );
      showToast.success('Audit scheduled', `Scheduled for ${nextWeek.toLocaleDateString()}`);
      loadData();
    } catch (error) {
      showToast.error('Failed to schedule audit', (error as Error).message);
    }
  };

  // Open assign modal and load available technicians
  const handleOpenAssignModal = async () => {
    try {
      const technicians = await MockDb.getTechnicians();
      // Filter out technicians who already have van stock
      const existingTechIds = new Set(vanStocks.map(vs => vs.technician_id));
      const available = technicians.filter(t => !existingTechIds.has(t.user_id));
      setAvailableTechnicians(available);
      setSelectedTechnicianId('');
      setVanCode('');
      setVanNotes('');
      setShowAssignModal(true);
    } catch (error) {
      showToast.error('Failed to load technicians', (error as Error).message);
    }
  };

  // Assign van stock to a technician
  const handleAssignVanStock = async () => {
    if (!selectedTechnicianId) {
      showToast.error('Please select a technician');
      return;
    }
    if (!vanCode.trim()) {
      showToast.error('Please enter a van code');
      return;
    }
    setSubmitting(true);
    try {
      const technician = availableTechnicians.find(t => t.user_id === selectedTechnicianId);
      await MockDb.createVanStock(
        selectedTechnicianId,
        technician?.name || 'Unknown',
        vanCode.trim(),
        currentUser.user_id,
        currentUser.name,
        vanNotes.trim() || undefined
      );
      showToast.success('Van Stock assigned', `Assigned to ${technician?.name} (${vanCode})`);
      setShowAssignModal(false);
      loadData();
    } catch (error) {
      showToast.error('Failed to assign Van Stock', (error as Error).message);
    }
    setSubmitting(false);
  };

  // Open add item modal and load parts
  const handleOpenAddItemModal = async () => {
    try {
      const parts = await MockDb.getParts();
      // Filter out parts already in the van stock
      const existingPartIds = new Set(selectedVanStock?.items?.map(i => i.part_id) || []);
      const available = parts.filter(p => !existingPartIds.has(p.part_id));
      setAvailableParts(available);
      setSelectedPartId('');
      setItemQuantity(1);
      setItemMinQty(1);
      setItemMaxQty(5);
      setShowAddItemModal(true);
    } catch (error) {
      showToast.error('Failed to load parts', (error as Error).message);
    }
  };

  // Add item to van stock
  const handleAddItem = async () => {
    if (!selectedPartId || !selectedVanStock) {
      showToast.error('Please select a part');
      return;
    }
    setSubmitting(true);
    try {
      await MockDb.addVanStockItem(
        selectedVanStock.van_stock_id,
        selectedPartId,
        itemQuantity,
        itemMinQty,
        itemMaxQty,
        true // is_core_item
      );
      const part = availableParts.find(p => p.part_id === selectedPartId);
      showToast.success('Item added', `Added ${part?.part_name}`);
      setShowAddItemModal(false);
      setShowDetailModal(false);
      loadData();
    } catch (error) {
      showToast.error('Failed to add item', (error as Error).message);
    }
    setSubmitting(false);
  };

  // Open edit modal
  const handleOpenEditModal = async () => {
    console.log('[VanStock] Opening edit modal, selectedVanStock:', selectedVanStock);
    if (!selectedVanStock) return;

    // Load all technicians for the dropdown
    try {
      const technicians = await MockDb.getTechnicians();
      console.log('[VanStock] Loaded technicians:', technicians);
      setAllTechnicians(technicians);
    } catch (error) {
      console.error('Failed to load technicians:', error);
      // Fallback: at least show current technician
      if (selectedVanStock.technician) {
        setAllTechnicians([selectedVanStock.technician]);
      }
    }

    setEditVanCode(selectedVanStock.van_code || '');
    setEditVanNotes(selectedVanStock.notes || '');
    setEditMaxItems(selectedVanStock.max_items || 50);
    setEditTechnicianId(selectedVanStock.technician_id);
    setShowEditModal(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!selectedVanStock) return;
    if (!editVanCode.trim()) {
      showToast.error('Van code is required');
      return;
    }
    if (!editTechnicianId) {
      showToast.error('Technician is required');
      return;
    }
    setSubmitting(true);
    try {
      const updates: { van_code: string; notes?: string; max_items: number; technician_id?: string } = {
        van_code: editVanCode.trim(),
        notes: editVanNotes.trim() || undefined,
        max_items: editMaxItems,
      };

      // Only include technician_id if it changed
      if (editTechnicianId !== selectedVanStock.technician_id) {
        updates.technician_id = editTechnicianId;
      }

      await MockDb.updateVanStock(selectedVanStock.van_stock_id, updates);
      showToast.success('Van Stock updated');
      setShowEditModal(false);
      setShowDetailModal(false);
      loadData();
    } catch (error) {
      showToast.error('Failed to update', (error as Error).message);
    }
    setSubmitting(false);
  };

  // Open delete confirmation
  const handleOpenDeleteConfirm = (type: 'deactivate' | 'delete') => {
    setDeleteType(type);
    setShowDeleteConfirm(true);
  };

  // Confirm delete/deactivate
  const handleConfirmDelete = async () => {
    if (!selectedVanStock) return;
    setSubmitting(true);
    try {
      await MockDb.deleteVanStock(selectedVanStock.van_stock_id, deleteType === 'delete');
      showToast.success(
        deleteType === 'delete' ? 'Van Stock deleted' : 'Van Stock deactivated',
        `${selectedVanStock.technician_name}'s van stock has been ${deleteType === 'delete' ? 'removed' : 'deactivated'}`
      );
      setShowDeleteConfirm(false);
      setShowDetailModal(false);
      loadData();
    } catch (error) {
      showToast.error('Operation failed', (error as Error).message);
    }
    setSubmitting(false);
  };

  // Open transfer modal
  const handleOpenTransferModal = () => {
    setTransferTargetId('');
    setSelectedItemsForTransfer(new Set());
    setShowTransferModal(true);
  };

  // Toggle item selection for transfer
  const toggleItemForTransfer = (itemId: string) => {
    const newSet = new Set(selectedItemsForTransfer);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItemsForTransfer(newSet);
  };

  // Confirm transfer
  const handleConfirmTransfer = async () => {
    if (!selectedVanStock || !transferTargetId || selectedItemsForTransfer.size === 0) {
      showToast.error('Please select items and target van stock');
      return;
    }
    setSubmitting(true);
    try {
      await MockDb.transferVanStockItems(
        selectedVanStock.van_stock_id,
        transferTargetId,
        Array.from(selectedItemsForTransfer)
      );
      const targetVan = vanStocks.find(vs => vs.van_stock_id === transferTargetId);
      showToast.success(
        'Items transferred',
        `${selectedItemsForTransfer.size} items moved to ${targetVan?.technician_name}'s van`
      );
      setShowTransferModal(false);
      setShowDetailModal(false);
      loadData();
    } catch (error) {
      showToast.error('Transfer failed', (error as Error).message);
    }
    setSubmitting(false);
  };

  // Get other active van stocks for transfer target
  const transferTargets = vanStocks.filter(
    vs => vs.van_stock_id !== selectedVanStock?.van_stock_id && vs.is_active
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading Van Stock data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-theme flex items-center gap-2">
              <Truck className="w-7 h-7" />
              {currentUser.role === UserRole.TECHNICIAN ? 'My Van Stock' : 'Van Stock Management'}
            </h1>
            <p className="text-sm text-theme-muted mt-1">
              {currentUser.role === UserRole.TECHNICIAN
                ? (vanStocks.length > 0 ? `${vanStocks[0]?.van_code || 'Your van stock'}` : 'No van stock assigned')
                : `${filteredVanStocks.length} of ${vanStocks.length} technicians`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {isAdmin && (
              <button
                onClick={handleOpenAssignModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                <UserPlus className="w-4 h-4" /> Assign Van Stock
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-theme">{stats.totalTechnicians}</div>
          <div className="text-xs text-theme-muted">Technicians</div>
        </div>

        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-theme">{stats.totalItems}</div>
          <div className="text-xs text-theme-muted">Total Items</div>
        </div>

        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-600">
            RM {stats.totalValue.toLocaleString()}
          </div>
          <div className="text-xs text-green-700">Total Value</div>
        </div>

        <button
          className={`rounded-xl p-4 border-2 cursor-pointer transition-all text-left ${
            filterType === 'low_stock'
              ? 'bg-amber-100 border-amber-500 ring-2 ring-offset-2 ring-amber-500'
              : stats.lowStockCount > 0
              ? 'bg-amber-50 border-amber-200 hover:border-amber-300 hover:shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
          }`}
          onClick={() => setFilterType(filterType === 'low_stock' ? 'all' : 'low_stock')}
        >
          <div className={`text-2xl font-bold ${filterType === 'low_stock' ? 'text-amber-600' : stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {stats.lowStockCount}
          </div>
          <div className={`text-xs ${filterType === 'low_stock' ? 'text-amber-700' : stats.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
            Low Stock Items
          </div>
        </button>

        <button
          className={`rounded-xl p-4 border-2 cursor-pointer transition-all text-left ${
            filterType === 'pending_audit'
              ? 'bg-purple-100 border-purple-500 ring-2 ring-offset-2 ring-purple-500'
              : stats.pendingAudits > 0
              ? 'bg-purple-50 border-purple-200 hover:border-purple-300 hover:shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
          }`}
          onClick={() => setFilterType(filterType === 'pending_audit' ? 'all' : 'pending_audit')}
        >
          <div className={`text-2xl font-bold ${filterType === 'pending_audit' ? 'text-purple-600' : stats.pendingAudits > 0 ? 'text-purple-600' : 'text-slate-400'}`}>
            {stats.pendingAudits}
          </div>
          <div className={`text-xs ${filterType === 'pending_audit' ? 'text-purple-700' : stats.pendingAudits > 0 ? 'text-purple-700' : 'text-slate-500'}`}>
            Audits Due
          </div>
        </button>

        <button
          className={`rounded-xl p-4 border-2 cursor-pointer transition-all text-left ${
            filterType === 'pending_replenishment'
              ? 'bg-orange-100 border-orange-500 ring-2 ring-offset-2 ring-orange-500'
              : stats.pendingReplenishments > 0
              ? 'bg-orange-50 border-orange-200 hover:border-orange-300 hover:shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
          }`}
          onClick={() => setFilterType(filterType === 'pending_replenishment' ? 'all' : 'pending_replenishment')}
        >
          <div className={`text-2xl font-bold ${filterType === 'pending_replenishment' ? 'text-orange-600' : stats.pendingReplenishments > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
            {stats.pendingReplenishments}
          </div>
          <div className={`text-xs ${filterType === 'pending_replenishment' ? 'text-orange-700' : stats.pendingReplenishments > 0 ? 'text-orange-700' : 'text-slate-500'}`}>
            Pending Requests
          </div>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by technician name, email, or van code..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className={`w-4 h-4 ${filterType !== 'all' ? 'text-blue-600' : 'text-slate-400'}`} />
              <select
                className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors ${
                  filterType !== 'all'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200'
                }`}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
              >
                <option value="all">All Technicians</option>
                <option value="low_stock">With Low Stock</option>
                <option value="pending_audit">Audit Due</option>
                <option value="pending_replenishment">Pending Requests</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Van Stock Grid */}
      {filteredVanStocks.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center theme-transition">
          <Truck className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No Van Stocks Found</h3>
          <p className="text-sm text-theme-muted">
            {searchQuery || filterType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'No technicians have Van Stock assigned yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVanStocks.map((vs) => {
            const lowItems = getLowStockItems(vs.items);
            const pendingRequest = replenishments.find(r => r.technician_id === vs.technician_id);

            return (
              <div
                key={vs.van_stock_id}
                className="card-theme rounded-xl overflow-hidden theme-transition hover:shadow-lg cursor-pointer"
                onClick={() => handleViewDetails(vs)}
              >
                {/* Header */}
                <div className="p-4 border-b border-theme">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {vs.technician_name?.charAt(0) || 'T'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-theme">{vs.technician_name || 'Unknown'}</h3>
                        <div className="flex items-center gap-2">
                          {vs.van_code && (
                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              {vs.van_code}
                            </span>
                          )}
                          <span className="text-xs text-theme-muted">{vs.items?.length || 0} items</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-theme-muted" />
                  </div>
                </div>

                {/* Stats */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-theme-surface-2 rounded-lg">
                      <div className="text-lg font-bold text-theme">{vs.items?.length || 0}</div>
                      <div className="text-xs text-theme-muted">Total Items</div>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">
                        RM {(vs.total_value || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-green-700">Value</div>
                    </div>
                  </div>

                  {/* Indicators */}
                  <div className="flex flex-wrap gap-2">
                    {lowItems.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        {lowItems.length} Low Stock
                      </span>
                    )}
                    {pendingRequest && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                        <Clock className="w-3 h-3" />
                        Request Pending
                      </span>
                    )}
                    {vs.last_audit_at && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                        <Calendar className="w-3 h-3" />
                        Audited {new Date(vs.last_audit_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 pb-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScheduleAudit(vs);
                    }}
                    className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Schedule Audit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedVanStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">
                    {selectedVanStock.technician_name?.charAt(0) || 'T'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-lg">{selectedVanStock.technician_name}</h2>
                    {selectedVanStock.van_code && (
                      <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {selectedVanStock.van_code}
                      </span>
                    )}
                    {!selectedVanStock.is_active && (
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {selectedVanStock.notes || 'Van Stock Details'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(actionMenuOpen ? null : 'detail');
                      }}
                      className="p-2 hover:bg-slate-100 rounded-lg"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {actionMenuOpen === 'detail' && (
                      <div
                        className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 z-[60]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuOpen(null);
                            handleOpenEditModal();
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" /> Edit Van Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuOpen(null);
                            handleOpenTransferModal();
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        >
                          <ArrowRightLeft className="w-4 h-4" /> Transfer Items
                        </button>
                        <hr className="my-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuOpen(null);
                            handleOpenDeleteConfirm('deactivate');
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-amber-600"
                        >
                          <Trash2 className="w-4 h-4" /> Deactivate
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuOpen(null);
                            handleOpenDeleteConfirm('delete');
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Permanently
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">
                    {selectedVanStock.items?.length || 0}
                  </div>
                  <div className="text-xs text-slate-600">Total Items</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    RM {(selectedVanStock.total_value || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-green-700">Total Value</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">
                    {getLowStockItems(selectedVanStock.items).length}
                  </div>
                  <div className="text-xs text-amber-700">Low Stock</div>
                </div>
              </div>

              {/* Items Table */}
              <h3 className="font-semibold mb-3">Stock Items</h3>
              <div className="border border-theme rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-theme-surface-2">
                    <tr>
                      <th className="text-left p-3 text-theme-muted">Part</th>
                      <th className="text-center p-3 text-theme-muted">Qty</th>
                      <th className="text-center p-3 text-theme-muted">Min</th>
                      <th className="text-center p-3 text-theme-muted">Max</th>
                      <th className="text-center p-3 text-theme-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme">
                    {(selectedVanStock.items || []).map((item) => (
                      <tr key={item.item_id} className="clickable-row">
                        <td className="p-3">
                          <div className="font-medium">{item.part?.part_name || 'Unknown'}</div>
                          <div className="text-xs text-slate-500">{item.part?.part_code}</div>
                        </td>
                        <td className="p-3 text-center font-semibold">{item.quantity}</td>
                        <td className="p-3 text-center text-slate-500">{item.min_quantity}</td>
                        <td className="p-3 text-center text-slate-500">{item.max_quantity}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStockStatusColor(item)}`}>
                            {item.quantity === 0 ? (
                              <>
                                <TrendingDown className="w-3 h-3" /> Out
                              </>
                            ) : item.quantity <= item.min_quantity ? (
                              <>
                                <AlertTriangle className="w-3 h-3" /> Low
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3" /> OK
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Audit Info */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <h4 className="font-medium mb-2">Audit Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Last Audit:</span>{' '}
                    <span className="font-medium">
                      {selectedVanStock.last_audit_at
                        ? new Date(selectedVanStock.last_audit_at).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Next Audit Due:</span>{' '}
                    <span className="font-medium">
                      {selectedVanStock.next_audit_due
                        ? new Date(selectedVanStock.next_audit_due).toLocaleDateString()
                        : 'Not scheduled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex justify-between">
              <button
                onClick={handleOpenAddItemModal}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => handleScheduleAudit(selectedVanStock)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Schedule Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Van Stock Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-lg">Assign Van Stock</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Technician <span className="text-red-500">*</span>
                </label>
                {availableTechnicians.length === 0 ? (
                  <p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
                    All technicians already have Van Stock assigned.
                  </p>
                ) : (
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedTechnicianId}
                    onChange={(e) => setSelectedTechnicianId(e.target.value)}
                  >
                    <option value="">-- Select a technician --</option>
                    {availableTechnicians.map((tech) => (
                      <option key={tech.user_id} value={tech.user_id}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Van Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., VAN-001 or ABC1234"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={vanCode}
                  onChange={(e) => setVanCode(e.target.value.toUpperCase())}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Unique identifier (license plate, van number, etc.)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  placeholder="Additional notes about this van..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  value={vanNotes}
                  onChange={(e) => setVanNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignVanStock}
                disabled={!selectedTechnicianId || !vanCode.trim() || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-lg">Add Item to Van Stock</h2>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Part
                </label>
                {availableParts.length === 0 ? (
                  <p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
                    No parts available to add.
                  </p>
                ) : (
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedPartId}
                    onChange={(e) => setSelectedPartId(e.target.value)}
                  >
                    <option value="">-- Select a part --</option>
                    {availableParts.map((part) => (
                      <option key={part.part_id} value={part.part_id}>
                        {part.part_name} ({part.part_code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Min Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={itemMinQty}
                    onChange={(e) => setItemMinQty(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Max Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={itemMaxQty}
                    onChange={(e) => setItemMaxQty(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowAddItemModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={!selectedPartId || submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Van Stock Modal */}
      {showEditModal && selectedVanStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-lg">Edit Van Details</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assigned Technician <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editTechnicianId}
                  onChange={(e) => setEditTechnicianId(e.target.value)}
                >
                  <option value="">-- Select a technician --</option>
                  {allTechnicians.map((tech) => (
                    <option key={tech.user_id} value={tech.user_id}>
                      {tech.name}
                    </option>
                  ))}
                </select>
                {editTechnicianId !== selectedVanStock.technician_id && (
                  <p className="text-xs text-amber-600 mt-1">
                    Warning: Changing technician will reassign the van and all its items
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Van Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., VAN-001 or ABC1234"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editVanCode}
                  onChange={(e) => setEditVanCode(e.target.value.toUpperCase())}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Max Items
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editMaxItems}
                  onChange={(e) => setEditMaxItems(parseInt(e.target.value) || 50)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes
                </label>
                <textarea
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  value={editVanNotes}
                  onChange={(e) => setEditVanNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editVanCode.trim() || !editTechnicianId || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedVanStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-lg text-red-600">
                {deleteType === 'delete' ? 'Delete Van Stock?' : 'Deactivate Van Stock?'}
              </h2>
            </div>
            <div className="p-4">
              {deleteType === 'delete' ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    This will permanently delete <strong>{selectedVanStock.technician_name}'s</strong> van stock
                    {selectedVanStock.van_code && <> (<strong>{selectedVanStock.van_code}</strong>)</>}
                    {' '}and all its items.
                  </p>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 font-medium">
                      This action cannot be undone!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    This will deactivate <strong>{selectedVanStock.technician_name}'s</strong> van stock
                    {selectedVanStock.van_code && <> (<strong>{selectedVanStock.van_code}</strong>)</>}.
                  </p>
                  <p className="text-sm text-slate-500">
                    The van stock will be hidden but can be reactivated later.
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={submitting}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  deleteType === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {submitting
                  ? 'Processing...'
                  : deleteType === 'delete'
                  ? 'Delete Permanently'
                  : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Items Modal */}
      {showTransferModal && selectedVanStock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Transfer Items</h2>
                <p className="text-sm text-slate-500">
                  From {selectedVanStock.technician_name}'s van
                  {selectedVanStock.van_code && ` (${selectedVanStock.van_code})`}
                </p>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Transfer To <span className="text-red-500">*</span>
                </label>
                {transferTargets.length === 0 ? (
                  <p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
                    No other active van stocks available for transfer.
                  </p>
                ) : (
                  <select
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                  >
                    <option value="">-- Select destination --</option>
                    {transferTargets.map((vs) => (
                      <option key={vs.van_stock_id} value={vs.van_stock_id}>
                        {vs.technician_name} {vs.van_code && `(${vs.van_code})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Items to Transfer
                </label>
                {(selectedVanStock.items || []).length === 0 ? (
                  <p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
                    No items in this van stock.
                  </p>
                ) : (
                  <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                    {(selectedVanStock.items || []).map((item) => (
                      <label
                        key={item.item_id}
                        className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedItemsForTransfer.has(item.item_id)}
                          onChange={() => toggleItemForTransfer(item.item_id)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.part?.part_name}</div>
                          <div className="text-xs text-slate-500">{item.part?.part_code}</div>
                        </div>
                        <div className="text-sm text-slate-600">
                          Qty: {item.quantity}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {selectedItemsForTransfer.size > 0 && (
                  <p className="text-sm text-blue-600 mt-2">
                    {selectedItemsForTransfer.size} item(s) selected
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                disabled={!transferTargetId || selectedItemsForTransfer.size === 0 || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {submitting ? 'Transferring...' : 'Transfer Items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

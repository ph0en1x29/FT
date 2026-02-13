/* eslint-disable max-lines */
/**
 * VanStockPage - Main container component
 * Manages van stock inventory for technicians
 */
import { useState } from 'react';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { Part,User,UserRole,VanStock } from '../../types';
import {
AddItemModal,
AssignVanStockModal,
DeleteConfirmModal,
EditVanStockModal,
TransferItemsModal,
VanFleetOverview,
VanStockDetailModal,
VanStockFilters,
VanStockGrid,
VanStockHeader,
VanStockStatsCards,
} from './components';
import { useVanStockData } from './hooks/useVanStockData';
import { VanStockPageProps } from './types';

export default function VanStockPageMain({ currentUser, hideHeader = false }: VanStockPageProps) {
  // Data hook
  const {
    vanStocks,
    replenishments,
    loading,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    stats,
    filteredVanStocks,
    loadData,
  } = useVanStockData({ currentUser });

  // Selected van stock for modals
  const [selectedVanStock, setSelectedVanStock] = useState<VanStock | null>(null);

  // Modal visibility state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Form state for Assign modal
  const [availableTechnicians, setAvailableTechnicians] = useState<User[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('');
  const [vanPlate, setVanPlate] = useState('');
  const [vanCode, setVanCode] = useState('');
  const [vanNotes, setVanNotes] = useState('');

  // Form state for Add Item modal
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemMinQty, setItemMinQty] = useState(1);
  const [itemMaxQty, setItemMaxQty] = useState(5);

  // Form state for Edit modal
  const [editVanPlate, setEditVanPlate] = useState('');
  const [editVanCode, setEditVanCode] = useState('');
  const [editVanNotes, setEditVanNotes] = useState('');
  const [editMaxItems, setEditMaxItems] = useState(50);
  const [editTechnicianId, setEditTechnicianId] = useState('');
  const [allTechnicians, setAllTechnicians] = useState<User[]>([]);

  // Form state for Delete modal
  const [deleteType, setDeleteType] = useState<'deactivate' | 'delete'>('deactivate');

  // Form state for Transfer modal
  const [transferTargetId, setTransferTargetId] = useState('');
  const [selectedItemsForTransfer, setSelectedItemsForTransfer] = useState<Set<string>>(new Set());

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  // Check admin permissions
  const isAdmin = [
    UserRole.ADMIN,
    UserRole.ADMIN_SERVICE,
    UserRole.ADMIN_STORE,
    UserRole.SUPERVISOR,
  ].includes(currentUser.role);

  // Get transfer targets (other active van stocks)
  const transferTargets = vanStocks.filter(
    vs => vs.van_stock_id !== selectedVanStock?.van_stock_id && vs.is_active
  );

  // Event handlers
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

  // Assign modal handlers
  const handleOpenAssignModal = async () => {
    try {
      const technicians = await MockDb.getTechnicians();
      const existingTechIds = new Set(vanStocks.map(vs => vs.technician_id));
      const available = technicians.filter(t => !existingTechIds.has(t.user_id));
      setAvailableTechnicians(available);
      setSelectedTechnicianId('');
      setVanPlate('');
      setVanCode('');
      setVanNotes('');
      setShowAssignModal(true);
    } catch (error) {
      showToast.error('Failed to load technicians', (error as Error).message);
    }
  };

  const handleAssignVanStock = async () => {
    if (!selectedTechnicianId || !vanPlate.trim() || !vanCode.trim()) {
      showToast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const technician = availableTechnicians.find(t => t.user_id === selectedTechnicianId);
      await MockDb.createVanStock(
        selectedTechnicianId,
        technician?.name || 'Unknown',
        vanCode.trim(),
        vanPlate.trim(),
        currentUser.user_id,
        currentUser.name,
        vanNotes.trim() || undefined
      );
      showToast.success('Van Stock assigned', `Assigned to ${technician?.name} (${vanPlate})`);
      setShowAssignModal(false);
      loadData();
    } catch (error) {
      showToast.error('Failed to assign Van Stock', (error as Error).message);
    }
    setSubmitting(false);
  };

  // Add Item modal handlers
  const handleOpenAddItemModal = async () => {
    try {
      const parts = await MockDb.getParts();
      // Only exclude parts that already exist in van with qty > 0
      const existingPartIdsWithStock = new Set(
        (selectedVanStock?.items || [])
          .filter(i => i.quantity > 0)
          .map(i => i.part_id)
      );
      const available = parts.filter(p => !existingPartIdsWithStock.has(p.part_id));
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

  const handleAddItem = async () => {
    if (!selectedPartId || !selectedVanStock) {
      showToast.error('Please select a part');
      return;
    }
    setSubmitting(true);
    try {
      // Check if item already exists in van (qty 0 / out of stock)
      const existingItem = selectedVanStock.items?.find(i => i.part_id === selectedPartId);
      if (existingItem) {
        // Restock: atomic increment to avoid stale read race condition
        await MockDb.incrementVanStockItemQuantity(existingItem.item_id, itemQuantity);
        const part = availableParts.find(p => p.part_id === selectedPartId);
        showToast.success('Item restocked', `${part?.part_name} qty increased by ${itemQuantity}`);
      } else {
        // New item: insert
        await MockDb.addVanStockItem(
          selectedVanStock.van_stock_id,
          selectedPartId,
          itemQuantity,
          itemMinQty,
          itemMaxQty,
          true
        );
        const part = availableParts.find(p => p.part_id === selectedPartId);
        showToast.success('Item added', `Added ${part?.part_name}`);
      }
      setShowAddItemModal(false);
      setShowDetailModal(false);
      loadData();
    } catch (error) {
      showToast.error('Failed to add item', (error as Error).message);
    }
    setSubmitting(false);
  };

  // Edit modal handlers
  const handleOpenEditModal = async () => {
    if (!selectedVanStock) return;
    try {
      const technicians = await MockDb.getTechnicians();
      setAllTechnicians(technicians);
    } catch (_error) {
      if (selectedVanStock.technician) {
        setAllTechnicians([selectedVanStock.technician]);
      }
    }
    setEditVanPlate(selectedVanStock.van_plate || '');
    setEditVanCode(selectedVanStock.van_code || '');
    setEditVanNotes(selectedVanStock.notes || '');
    setEditMaxItems(selectedVanStock.max_items || 50);
    setEditTechnicianId(selectedVanStock.technician_id);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedVanStock || !editVanCode.trim() || !editTechnicianId) {
      showToast.error('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const updates: { van_plate?: string; van_code?: string; notes?: string; max_items?: number; technician_id?: string } = {
        van_plate: editVanPlate.trim() || undefined,
        van_code: editVanCode.trim(),
        notes: editVanNotes.trim() || '',
        max_items: editMaxItems,
      };
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

  // Delete/Deactivate handlers
  const handleOpenDeleteConfirm = (type: 'deactivate' | 'delete') => {
    setDeleteType(type);
    setShowDeleteConfirm(true);
  };

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

  // Transfer handlers
  const handleOpenTransferModal = () => {
    setTransferTargetId('');
    setSelectedItemsForTransfer(new Set());
    setShowTransferModal(true);
  };

  const toggleItemForTransfer = (itemId: string) => {
    const newSet = new Set(selectedItemsForTransfer);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItemsForTransfer(newSet);
  };

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

  // Loading state
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
        <VanStockHeader
          currentUser={currentUser}
          vanStocks={vanStocks}
          filteredCount={filteredVanStocks.length}
          totalCount={vanStocks.length}
          isAdmin={isAdmin}
          onRefresh={loadData}
          onAssign={handleOpenAssignModal}
        />
      )}

      {/* Fleet Overview — Admin/Supervisor only */}
      {isAdmin && (
        <VanFleetOverview
          currentUser={currentUser}
          onRefresh={loadData}
        />
      )}

      {/* Stats Cards */}
      <VanStockStatsCards
        stats={stats}
        filterType={filterType}
        onFilterChange={setFilterType}
      />

      {/* Search and Filters */}
      <VanStockFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterType={filterType}
        onFilterChange={setFilterType}
      />

      {/* Van Stock Grid */}
      <VanStockGrid
        vanStocks={filteredVanStocks}
        replenishments={replenishments}
        hasFilters={!!searchQuery || filterType !== 'all'}
        onViewDetails={handleViewDetails}
        onScheduleAudit={handleScheduleAudit}
      />

      {/* Modals */}
      <VanStockDetailModal
        isOpen={showDetailModal}
        vanStock={selectedVanStock}
        isAdmin={isAdmin}
        onClose={() => setShowDetailModal(false)}
        onAddItem={handleOpenAddItemModal}
        onEdit={handleOpenEditModal}
        onTransfer={handleOpenTransferModal}
        onDeactivate={() => handleOpenDeleteConfirm('deactivate')}
        onDelete={() => handleOpenDeleteConfirm('delete')}
        onScheduleAudit={handleScheduleAudit}
      />

      <AssignVanStockModal
        isOpen={showAssignModal}
        availableTechnicians={availableTechnicians}
        selectedTechnicianId={selectedTechnicianId}
        vanPlate={vanPlate}
        vanCode={vanCode}
        vanNotes={vanNotes}
        submitting={submitting}
        onClose={() => setShowAssignModal(false)}
        onTechnicianChange={setSelectedTechnicianId}
        onVanPlateChange={setVanPlate}
        onVanCodeChange={setVanCode}
        onNotesChange={setVanNotes}
        onSubmit={handleAssignVanStock}
      />

      <AddItemModal
        isOpen={showAddItemModal}
        availableParts={availableParts}
        selectedPartId={selectedPartId}
        itemQuantity={itemQuantity}
        itemMinQty={itemMinQty}
        itemMaxQty={itemMaxQty}
        submitting={submitting}
        onClose={() => setShowAddItemModal(false)}
        onPartChange={setSelectedPartId}
        onQuantityChange={setItemQuantity}
        onMinQtyChange={setItemMinQty}
        onMaxQtyChange={setItemMaxQty}
        onSubmit={handleAddItem}
      />

      <EditVanStockModal
        isOpen={showEditModal}
        vanStock={selectedVanStock}
        editVanPlate={editVanPlate}
        editVanCode={editVanCode}
        editVanNotes={editVanNotes}
        editMaxItems={editMaxItems}
        editTechnicianId={editTechnicianId}
        allTechnicians={allTechnicians}
        submitting={submitting}
        onClose={() => setShowEditModal(false)}
        onVanPlateChange={setEditVanPlate}
        onVanCodeChange={setEditVanCode}
        onNotesChange={setEditVanNotes}
        onMaxItemsChange={setEditMaxItems}
        onTechnicianChange={setEditTechnicianId}
        onSubmit={handleSaveEdit}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        vanStock={selectedVanStock}
        deleteType={deleteType}
        submitting={submitting}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
      />

      <TransferItemsModal
        isOpen={showTransferModal}
        sourceVanStock={selectedVanStock}
        transferTargets={transferTargets}
        transferTargetId={transferTargetId}
        selectedItemsForTransfer={selectedItemsForTransfer}
        submitting={submitting}
        onClose={() => setShowTransferModal(false)}
        onTargetChange={setTransferTargetId}
        onToggleItem={toggleItemForTransfer}
        onConfirm={handleConfirmTransfer}
      />
    </div>
  );
}

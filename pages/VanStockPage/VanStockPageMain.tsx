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
import VanLedgerTab from './components/VanLedgerTab';
import FlaggedMovementsTab from './components/FlaggedMovementsTab';
import { VanStockPageProps } from './types';

export default function VanStockPageMain({ currentUser, hideHeader = false }: VanStockPageProps) {
  // Tab state
  const [vanActiveTab, setVanActiveTab] = useState<'stock' | 'ledger' | 'flagged'>('stock');

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

  // New design is now the default (legacy removed)

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

  // Audit scheduling with date picker
  const [auditTargets, setAuditTargets] = useState<VanStock[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditDate, setAuditDate] = useState('');

  const handleScheduleAudit = (vs: VanStock) => {
    setAuditTargets([vs]);
    // Default to 1 week from now
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setAuditDate(nextWeek.toISOString().split('T')[0]);
    setShowAuditModal(true);
  };

  const handleBulkScheduleAudit = (vans: VanStock[]) => {
    setAuditTargets(vans);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setAuditDate(nextWeek.toISOString().split('T')[0]);
    setShowAuditModal(true);
  };

  const handleConfirmAudit = async () => {
    if (!auditDate || auditTargets.length === 0) return;
    setSubmitting(true);
    try {
      for (const vs of auditTargets) {
        await MockDb.scheduleVanStockAudit(
          vs.van_stock_id,
          vs.technician_id,
          vs.technician_name || '',
          auditDate
        );
      }
      const dateStr = new Date(auditDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (auditTargets.length === 1) {
        showToast.success('Audit scheduled', `${auditTargets[0].technician_name} — ${dateStr}`);
      } else {
        showToast.success('Audits scheduled', `${auditTargets.length} vans — ${dateStr}`);
      }
      setShowAuditModal(false);
      setAuditTargets([]);
      loadData();
    } catch (error) {
      showToast.error('Failed to schedule audit', (error as Error).message);
    }
    setSubmitting(false);
  };

  const setQuickDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setAuditDate(d.toISOString().split('T')[0]);
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
          .filter(i => (i.quantity > 0) || (i.container_quantity || 0) > 0 || (i.bulk_quantity || 0) > 0)
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
      {/* Van Stock Sub-Tabs */}
      <div className="border-b border-theme">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Van stock tabs">
          {[
            { id: 'stock' as const, label: 'Van Stock' },
            { id: 'ledger' as const, label: 'Ledger' },
            ...(isAdmin ? [{ id: 'flagged' as const, label: '⚠️ Flagged' }] : []),
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setVanActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                vanActiveTab === tab.id
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-theme-muted hover:text-theme hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {vanActiveTab === 'flagged' && isAdmin && (
        <FlaggedMovementsTab />
      )}

      {vanActiveTab === 'ledger' && (
        <VanLedgerTab currentUser={currentUser} />
      )}

      {vanActiveTab === 'stock' && (
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
        onBulkScheduleAudit={handleBulkScheduleAudit}
        currentUser={currentUser}
        onStatusChange={loadData}
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
        currentUserId={currentUser.user_id}
        currentUserName={currentUser.name}
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

      {/* Schedule Audit Date Picker Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAuditModal(false)}>
          <div className="bg-theme-surface rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-theme mb-1">Schedule Audit</h3>
            <p className="text-xs text-theme-muted mb-4">
              {auditTargets.length === 1
                ? `${auditTargets[0].technician_name} — ${auditTargets[0].van_plate || auditTargets[0].van_code}`
                : `${auditTargets.length} vans selected`}
            </p>

            {/* Quick options */}
            <div className="flex gap-2 mb-3">
              <button onClick={() => setQuickDate(7)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  auditDate === new Date(Date.now() + 7*86400000).toISOString().split('T')[0]
                    ? 'bg-blue-50 text-blue-700 border-blue-200' : 'border-theme text-theme-muted hover:bg-theme-surface-2'
                }`}>
                1 Week
              </button>
              <button onClick={() => setQuickDate(14)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  auditDate === new Date(Date.now() + 14*86400000).toISOString().split('T')[0]
                    ? 'bg-blue-50 text-blue-700 border-blue-200' : 'border-theme text-theme-muted hover:bg-theme-surface-2'
                }`}>
                2 Weeks
              </button>
              <button onClick={() => setQuickDate(30)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  auditDate === new Date(Date.now() + 30*86400000).toISOString().split('T')[0]
                    ? 'bg-blue-50 text-blue-700 border-blue-200' : 'border-theme text-theme-muted hover:bg-theme-surface-2'
                }`}>
                1 Month
              </button>
            </div>

            {/* Custom date */}
            <label className="block text-xs font-medium text-theme-muted mb-1">Or pick a date</label>
            <input
              type="date"
              value={auditDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setAuditDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-theme rounded-lg bg-theme-surface text-theme text-sm mb-4 focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAuditModal(false)}
                className="px-4 py-2 border border-theme rounded-lg text-sm text-theme-muted hover:bg-theme-surface-2">
                Cancel
              </button>
              <button onClick={handleConfirmAudit} disabled={!auditDate || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      )}
    </div>
  );
}

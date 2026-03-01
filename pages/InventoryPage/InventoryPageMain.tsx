import { AlertTriangle,BookOpen,ClipboardList,Package,RotateCcw,Settings2,Truck } from 'lucide-react';
import React,{ useEffect,useMemo,useState } from 'react';
import { checkStockMismatch } from '../../services/liquidInventoryService';
import { useSearchParams } from 'react-router-dom';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { Part,ROLE_PERMISSIONS,User,UserRole } from '../../types';
import VanStockPage from '../VanStockPage';
import AddPartModal from './components/AddPartModal';
import AdjustStockModal from './components/AdjustStockModal';
import InventoryFilters from './components/InventoryFilters';
import InventoryStats from './components/InventoryStats';
import PartsHeader from './components/PartsHeader';
import PartsTable from './components/PartsTable';
import PendingAdjustmentsTab from './components/PendingAdjustmentsTab';
import TabNavigation,{ Tab,TabType } from './components/TabNavigation';
import ReplenishmentsTab from './components/ReplenishmentsTab';
import InventoryLedgerTab from './components/InventoryLedgerTab';
import ImportPartsModal from './components/ImportPartsModal';
import BatchReceiveStockModal from './components/BatchReceiveStockModal';
import StocktakeTab from './components/StocktakeTab';
import { useInventoryData } from './hooks/useInventoryData';
import { supabase } from '../../services/supabaseClient';

interface InventoryPageProps {
  currentUser: User;
}

const InventoryPageMain: React.FC<InventoryPageProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'parts';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showBatchReceive, setShowBatchReceive] = useState(false);
  const [expiryWarnings, setExpiryWarnings] = useState<any[]>([]);

  // Use dev mode context for role-based permissions
  const { displayRole } = useDevModeContext();

  const isAdmin = displayRole === UserRole.ADMIN;
  const isAdminOrSupervisor = [
    UserRole.ADMIN,
    UserRole.ADMIN_SERVICE,
    UserRole.ADMIN_STORE,
    UserRole.SUPERVISOR
  ].includes(displayRole);
  const canViewVanStock = isAdminOrSupervisor;
  
  // Get pricing visibility from role permissions (hidden from technicians)
  const canViewPricing = ROLE_PERMISSIONS[displayRole]?.canViewPricing ?? false;

  // Inventory data hook
  const {
    parts,
    loading,
    searchQuery,
    filterCategory,
    filterStock,
    showModal,
    editingPart,
    formData,
    categories,
    filteredParts,
    groupedParts,
    stats,
    setSearchQuery,
    setFilterCategory,
    setFilterStock,
    setFormData,
    loadParts,
    handleAddNew,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleExportCSV,
    closeModal,
  } = useInventoryData(currentUser);

  // Sync tab with URL
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabType;
    if (tabFromUrl && ['parts', 'vanstock', 'replenishments', 'ledger', 'pending-adjustments', 'stocktake'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Load parts when parts tab is active
  useEffect(() => {
    if (activeTab === 'parts') {
      loadParts();
    }
  }, [activeTab, loadParts]);

  // Fetch expiring stock within 30 days
  useEffect(() => {
    const fetchExpiryWarnings = async () => {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data } = await supabase
        .from('purchase_batches')
        .select('batch_id, batch_label, expires_at, part_id, parts(part_name)')
        .gte('expires_at', today)
        .lte('expires_at', thirtyDaysFromNow)
        .limit(10);
      if (data) setExpiryWarnings(data);
    };
    fetchExpiryWarnings();
  }, []);

  // Build available tabs based on permissions
  const tabs: Tab[] = [
    { id: 'parts', label: 'Parts Catalog', icon: Package, show: true },
    { id: 'vanstock', label: 'Van Stock', icon: Truck, show: canViewVanStock },
    { id: 'replenishments', label: 'Replenishments', icon: RotateCcw, show: canViewVanStock },
    { id: 'ledger', label: 'Ledger', icon: BookOpen, show: canViewVanStock },
    { id: 'pending-adjustments' as TabType, label: 'Pending Adjustments', icon: ClipboardList, show: isAdmin },
    { id: 'stocktake' as TabType, label: 'Stocktake', icon: ClipboardList, show: isAdmin },
  ];

  return (
    <div className="space-y-4 md:space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-theme">Inventory</h1>
          <p className="text-xs md:text-sm text-theme-muted mt-1">
            Manage parts catalog and van stock
          </p>
        </div>
        {/* Action buttons — admin only */}
        {isAdmin && (
          <div className="flex gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowBatchReceive(true)}
              className="btn-premium btn-premium-primary flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              Receive Stock
            </button>
            <button
              onClick={() => setShowAdjustModal(true)}
              className="btn-premium btn-premium-secondary flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4" />
              Stock Adjustment
            </button>
          </div>
        )}
      </div>

      {/* Expiry Warning Banners */}
      {expiryWarnings.map((w) => (
        <div key={w.batch_id} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-700">
            <span className="font-semibold">⚠️ {(w.parts as any)?.part_name || 'Unknown Part'}</span> has stock expiring on{' '}
            <span className="font-medium">{new Date(w.expires_at).toLocaleDateString()}</span>
            {' '}(Batch: {w.batch_label || w.batch_id})
          </div>
        </div>
      ))}

      {/* Tab Navigation */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Tab Content */}
      {activeTab === 'parts' && (
        <>
          <PartsHeader
            filteredCount={filteredParts.length}
            totalCount={parts.length}
            isAdmin={isAdmin}
            onExport={handleExportCSV}
            onAddNew={handleAddNew}
            onImport={() => setShowImportModal(true)}
          />

          {/* Low Stock Alert */}
          {parts.filter(p => p.stock_quantity <= (p.min_stock_level || 0) && (p.min_stock_level || 0) > 0).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm text-red-700">
                <span className="font-semibold">Low stock alert</span> — {parts.filter(p => p.stock_quantity <= (p.min_stock_level || 0) && (p.min_stock_level || 0) > 0).length} item(s) at or below reorder level.
                {' '}
                <button onClick={() => setFilterStock('low')} className="underline font-medium">View low stock items</button>
              </div>
            </div>
          )}

          {/* Stock Mismatch Alert */}
          {parts.filter(p => p.is_liquid && checkStockMismatch(p).hasMismatch).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-700">
                <span className="font-semibold">Stock mismatch detected</span> — {parts.filter(p => p.is_liquid && checkStockMismatch(p).hasMismatch).length} liquid item(s) have discrepancies between container/bulk quantities and legacy stock. Review and adjust.
              </div>
            </div>
          )}

          <InventoryStats stats={stats} canViewPricing={canViewPricing} />

          <InventoryFilters
            searchQuery={searchQuery}
            filterCategory={filterCategory}
            filterStock={filterStock}
            categories={categories}
            onSearchChange={setSearchQuery}
            onCategoryChange={setFilterCategory}
            onStockChange={setFilterStock}
          />

          <PartsTable
            groupedParts={groupedParts}
            loading={loading}
            isAdmin={isAdmin}
            canViewPricing={canViewPricing}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          <AddPartModal
            show={showModal}
            editingPart={editingPart}
            formData={formData}
            categories={categories}
            onClose={closeModal}
            onSubmit={handleSubmit}
            onFormChange={setFormData}
          />

          <ImportPartsModal
            show={showImportModal}
            onClose={() => setShowImportModal(false)}
            onImportComplete={() => { setShowImportModal(false); loadParts(); }}
            currentUser={{ user_id: currentUser.user_id, name: currentUser.name }}
            existingPartCodes={parts.map(p => p.part_code)}
          />
        </>
      )}

      {activeTab === 'vanstock' && canViewVanStock && (
        <VanStockPage currentUser={currentUser} hideHeader />
      )}

      {activeTab === 'replenishments' && canViewVanStock && (
        <ReplenishmentsTab currentUser={currentUser} />
      )}

      {activeTab === 'ledger' && canViewVanStock && (
        <InventoryLedgerTab />
      )}

      {activeTab === ('pending-adjustments' as TabType) && isAdmin && (
        <PendingAdjustmentsTab currentUser={currentUser} />
      )}

      {activeTab === ('stocktake' as TabType) && isAdmin && (
        <StocktakeTab currentUser={currentUser} />
      )}

      {/* Batch Receive Stock Modal */}
      <BatchReceiveStockModal
        show={showBatchReceive}
        parts={parts}
        currentUser={{ user_id: currentUser.user_id, name: currentUser.name }}
        onClose={() => setShowBatchReceive(false)}
        onSuccess={() => { setShowBatchReceive(false); loadParts(); }}
      />

      {/* Adjust Stock Modal — accessible from all tabs */}
      <AdjustStockModal
        show={showAdjustModal}
        parts={parts}
        currentUser={{ user_id: currentUser.user_id, name: currentUser.name }}
        onClose={() => setShowAdjustModal(false)}
        onSuccess={() => { setShowAdjustModal(false); loadParts(); }}
      />
    </div>
  );
};

export default InventoryPageMain;

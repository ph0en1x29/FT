import { AlertTriangle,BookOpen,ClipboardList,Package,RotateCcw,Settings2,Truck } from 'lucide-react';
import React,{ Suspense,lazy,useEffect,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { ROLE_PERMISSIONS,User,UserRole } from '../../types';
import InventoryFilters from './components/InventoryFilters';
import InventoryStats from './components/InventoryStats';
import PartsHeader from './components/PartsHeader';
import PartsTable from './components/PartsTable';
import TabNavigation,{ Tab,TabType } from './components/TabNavigation';
import { useInventoryData } from './hooks/useInventoryData';
import { supabase } from '../../services/supabaseClient';

const VanStockPage = lazy(() => import('../VanStockPage'));
const AddPartModal = lazy(() => import('./components/AddPartModal'));
const AdjustStockModal = lazy(() => import('./components/AdjustStockModal'));
const PendingAdjustmentsTab = lazy(() => import('./components/PendingAdjustmentsTab'));
const ReplenishmentsTab = lazy(() => import('./components/ReplenishmentsTab'));
const InventoryLedgerTab = lazy(() => import('./components/InventoryLedgerTab'));
const ImportPartsModal = lazy(() => import('./components/ImportPartsModal'));
const BatchReceiveStockModal = lazy(() => import('./components/BatchReceiveStockModal'));
const StocktakeTab = lazy(() => import('./components/StocktakeTab'));

interface ExpiryWarning {
  batch_id: string;
  batch_label: string | null;
  expires_at: string;
  parts: { part_name: string | null } | null;
}

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
  const [expiryWarnings, setExpiryWarnings] = useState<ExpiryWarning[]>([]);

  // Use dev mode context for role-based permissions
  const { displayRole, hasPermission } = useDevModeContext();

  const isAdmin = displayRole === UserRole.ADMIN;
  const canEditInventory = hasPermission('canEditInventory');
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
    isFetching,
    searchQuery,
    filterCategory,
    filterStock,
    currentPage,
    pageSize,
    showModal,
    editingPart,
    formData,
    categories,
    filteredParts,
    groupedParts,
    stats,
    statsLoading,
    totalCount,
    totalPages,
    canGoPrev,
    canGoNext,
    importPartCodes,
    setSearchQuery,
    setFilterCategory,
    setFilterStock,
    setCurrentPage,
    setFormData,
    loadParts,
    handleAddNew,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleExportCSV,
    closeModal,
  } = useInventoryData(currentUser, {
    enabled: activeTab === 'parts',
    shouldLoadImportSupport: activeTab === 'parts' && showImportModal,
  });

  const lowStockCount = stats.lowStock;
  const stockMismatchCount = stats.liquidMismatch;

  // Sync tab with URL
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabType;
    if (tabFromUrl && ['parts', 'vanstock', 'replenishments', 'ledger', 'pending-adjustments', 'stocktake'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams);
  };

  // Load parts when parts tab is active
  useEffect(() => {
    if (activeTab === 'parts') {
      loadParts();
    }
  }, [activeTab, loadParts]);

  useEffect(() => {
    if (activeTab !== 'parts') return;

    setSearchQuery(searchParams.get('search') || '');
    setFilterCategory(searchParams.get('category') || 'all');

    const stockParam = searchParams.get('stock');
    if (stockParam === 'low' || stockParam === 'out') {
      setFilterStock(stockParam);
    } else {
      setFilterStock('all');
    }
  }, [activeTab, searchParams, setFilterCategory, setFilterStock, setSearchQuery]);

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
      if (data) setExpiryWarnings(data as unknown as ExpiryWarning[]);
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
        {canEditInventory && (
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
            <span className="font-semibold">⚠️ {w.parts?.part_name || 'Unknown Part'}</span> has stock expiring on{' '}
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
            totalCount={totalCount}
            isAdmin={canEditInventory}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={totalPages}
            isRefreshing={isFetching}
            onPreviousPage={() => setCurrentPage(currentPage - 1)}
            onNextPage={() => setCurrentPage(currentPage + 1)}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onExport={handleExportCSV}
            onAddNew={handleAddNew}
            onImport={() => setShowImportModal(true)}
          />

          {/* Low Stock Alert */}
          {lowStockCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm text-red-700">
                <span className="font-semibold">Low stock alert</span> — {lowStockCount} item(s) at or below reorder level.
                {' '}
                <button onClick={() => setFilterStock('low')} className="underline font-medium">View low stock items</button>
              </div>
            </div>
          )}

          {/* Stock Mismatch Alert */}
          {stockMismatchCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-700">
                <span className="font-semibold">Stock mismatch detected</span> — {stockMismatchCount} liquid item(s) have discrepancies between container/bulk quantities and legacy stock. Review and adjust.
              </div>
            </div>
          )}

          <InventoryStats stats={stats} canViewPricing={canViewPricing} loading={statsLoading} />

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
            isAdmin={canEditInventory}
            canViewPricing={canViewPricing}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          <Suspense fallback={null}>
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
              existingPartCodes={importPartCodes}
            />
          </Suspense>
        </>
      )}

      {activeTab === 'vanstock' && canViewVanStock && (
        <Suspense fallback={<div className="card-theme rounded-xl p-6 text-sm text-theme-muted">Loading van stock…</div>}>
          <VanStockPage currentUser={currentUser} hideHeader />
        </Suspense>
      )}

      {activeTab === 'replenishments' && canViewVanStock && (
        <Suspense fallback={<div className="card-theme rounded-xl p-6 text-sm text-theme-muted">Loading replenishments…</div>}>
          <ReplenishmentsTab currentUser={currentUser} />
        </Suspense>
      )}

      {activeTab === 'ledger' && canViewVanStock && (
        <Suspense fallback={<div className="card-theme rounded-xl p-6 text-sm text-theme-muted">Loading ledger…</div>}>
          <InventoryLedgerTab />
        </Suspense>
      )}

      {activeTab === ('pending-adjustments' as TabType) && isAdmin && (
        <Suspense fallback={<div className="card-theme rounded-xl p-6 text-sm text-theme-muted">Loading adjustments…</div>}>
          <PendingAdjustmentsTab currentUser={currentUser} />
        </Suspense>
      )}

      {activeTab === ('stocktake' as TabType) && isAdmin && (
        <Suspense fallback={<div className="card-theme rounded-xl p-6 text-sm text-theme-muted">Loading stocktake…</div>}>
          <StocktakeTab currentUser={currentUser} />
        </Suspense>
      )}

      {/* Batch Receive Stock Modal */}
      <Suspense fallback={null}>
        <BatchReceiveStockModal
          show={showBatchReceive}
          currentUser={{ user_id: currentUser.user_id, name: currentUser.name }}
          onClose={() => setShowBatchReceive(false)}
          onSuccess={() => { setShowBatchReceive(false); loadParts(); }}
        />

        {/* Adjust Stock Modal — accessible from all tabs */}
        <AdjustStockModal
          show={showAdjustModal}
          currentUser={{ user_id: currentUser.user_id, name: currentUser.name }}
          onClose={() => setShowAdjustModal(false)}
          onSuccess={() => { setShowAdjustModal(false); loadParts(); }}
        />
      </Suspense>
    </div>
  );
};

export default InventoryPageMain;

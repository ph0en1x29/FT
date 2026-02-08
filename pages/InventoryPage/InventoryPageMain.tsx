import { CheckSquare,Package,Truck } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { ROLE_PERMISSIONS,User,UserRole } from '../../types';
import PendingConfirmations from '../PendingConfirmations';
import VanStockPage from '../VanStockPage';
import AddPartModal from './components/AddPartModal';
import InventoryFilters from './components/InventoryFilters';
import InventoryStats from './components/InventoryStats';
import PartsHeader from './components/PartsHeader';
import PartsTable from './components/PartsTable';
import TabNavigation,{ Tab,TabType } from './components/TabNavigation';
import { useInventoryData } from './hooks/useInventoryData';

interface InventoryPageProps {
  currentUser: User;
}

const InventoryPageMain: React.FC<InventoryPageProps> = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'parts';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

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
  const canViewConfirmations = isAdminOrSupervisor;
  
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
    if (tabFromUrl && ['parts', 'vanstock', 'confirmations'].includes(tabFromUrl)) {
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

  // Build available tabs based on permissions
  const tabs: Tab[] = [
    { id: 'parts', label: 'Parts Catalog', icon: Package, show: true },
    { id: 'vanstock', label: 'Van Stock', icon: Truck, show: canViewVanStock },
    { id: 'confirmations', label: 'Confirmations', icon: CheckSquare, show: canViewConfirmations },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme">Inventory</h1>
          <p className="text-sm text-theme-muted mt-1">
            Manage parts catalog, van stock, and confirmations
          </p>
        </div>
      </div>

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
          />

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
        </>
      )}

      {activeTab === 'vanstock' && canViewVanStock && (
        <VanStockPage currentUser={currentUser} hideHeader />
      )}

      {activeTab === 'confirmations' && canViewConfirmations && (
        <PendingConfirmations currentUser={currentUser} hideHeader />
      )}
    </div>
  );
};

export default InventoryPageMain;

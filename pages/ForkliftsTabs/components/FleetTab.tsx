import { AlertTriangle, CheckSquare, Plus, Square, Truck } from 'lucide-react';
import React from 'react';
import { Skeleton, SkeletonCard } from '../../../components/Skeleton';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { ForkliftStatus } from '../../../types';
import { TabProps } from '../types';
import AddEditForkliftModal from './AddEditForkliftModal';
import AssignForkliftModal from './AssignForkliftModal';
import BulkActionsBar from './BulkActionsBar';
import BulkEndRentalModal from './BulkEndRentalModal';
import BulkServiceResetModal from './BulkServiceResetModal';
import ForkliftFilters from './ForkliftFilters';
import ForkliftGrid from './ForkliftGrid';
import ResultModal from './ResultModal';
import ReturnForkliftModal from './ReturnForkliftModal';
import { useFleetManagement } from './useFleetManagement';

const FleetTab: React.FC<TabProps> = ({ currentUser }) => {
  const { displayRole } = useDevModeContext();
  const fleet = useFleetManagement(currentUser, displayRole);
  const rentedCount = fleet.forklifts.filter(forklift => !!forklift.current_customer_id).length;
  const availableCount = fleet.forklifts.filter(forklift => !forklift.current_customer_id).length;
  const attentionCount = fleet.forklifts.filter(forklift => [
    ForkliftStatus.SERVICE_DUE,
    ForkliftStatus.AWAITING_PARTS,
    ForkliftStatus.OUT_OF_SERVICE,
    ForkliftStatus.IN_SERVICE,
    ForkliftStatus.MAINTENANCE,
    ForkliftStatus.INACTIVE,
  ].includes(forklift.status)).length;

  if (fleet.loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <Skeleton variant="text" width="42%" height={12} className="mb-3" />
              <Skeleton variant="text" width="28%" height={30} className="mb-2" />
              <Skeleton variant="text" width="60%" height={12} />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <Skeleton variant="rounded" height={44} className="mb-3" />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} lines={4} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-muted">Fleet Size</p>
              <p className="mt-2 text-3xl font-bold text-theme">{fleet.forklifts.length}</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-sm text-theme-muted">All units currently tracked in FieldPro.</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Available</p>
          <p className="mt-2 text-3xl font-bold text-theme">{availableCount}</p>
          <p className="mt-2 text-sm text-theme-muted">Ready to rent out or schedule for service work.</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">On Rent</p>
          <p className="mt-2 text-3xl font-bold text-theme">{rentedCount}</p>
          <p className="mt-2 text-sm text-theme-muted">Units currently deployed at customer sites.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Needs Attention</p>
              <p className="mt-2 text-3xl font-bold text-theme">{attentionCount}</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <p className="mt-2 text-sm text-theme-muted">Service due, parts blocked, or out-of-service units.</p>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-theme">
            Showing {fleet.filteredForklifts.length} of {fleet.forklifts.length} units
          </p>
          <p className="text-xs text-theme-muted">
            Search by serial, make, model, customer, or location to move through the fleet faster.
          </p>
          {fleet.isSelectionMode && fleet.selectedForkliftIds.size > 0 && (
            <span className="mt-1 inline-block text-blue-600 font-medium">
              • {fleet.selectedForkliftIds.size} selected
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={fleet.toggleSelectionMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              fleet.isSelectionMode
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {fleet.isSelectionMode ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {fleet.isSelectionMode ? 'Exit Selection' : 'Multi-Select'}
          </button>
          {fleet.canEditForklifts && (
            <button
              onClick={fleet.handleAddNew}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Forklift
            </button>
          )}
        </div>
      </div>

      {fleet.isSelectionMode && (
        <BulkActionsBar
          totalCount={fleet.filteredForklifts.length}
          selectedCount={fleet.selectedForkliftIds.size}
          availableCount={fleet.availableSelectedForklifts.length}
          rentedCount={fleet.rentedSelectedForklifts.length}
          onSelectAll={fleet.selectAllFiltered}
          onDeselectAll={fleet.deselectAll}
          onBulkRent={fleet.openBulkRentModal}
          onBulkEndRental={fleet.openBulkEndRentalModal}
        />
      )}

      <ForkliftFilters
        searchQuery={fleet.searchQuery}
        setSearchQuery={fleet.setSearchQuery}
        filterType={fleet.filterType}
        setFilterType={fleet.setFilterType}
        filterStatus={fleet.filterStatus}
        setFilterStatus={fleet.setFilterStatus}
        filterAssigned={fleet.filterAssigned}
        setFilterAssigned={fleet.setFilterAssigned}
        filterMake={fleet.filterMake}
        setFilterMake={fleet.setFilterMake}
        uniqueMakes={fleet.uniqueMakes}
        filteredCount={fleet.filteredForklifts.length}
        totalCount={fleet.forklifts.length}
        hasFilters={!!fleet.hasFilters}
        onClearFilters={() => {
          fleet.setSearchQuery('');
          fleet.setFilterType('all');
          fleet.setFilterStatus('all');
          fleet.setFilterAssigned('all');
          fleet.setFilterMake('all');
        }}
      />

      <ForkliftGrid
        forklifts={fleet.filteredForklifts}
        isSelectionMode={fleet.isSelectionMode}
        selectedForkliftIds={fleet.selectedForkliftIds}
        canEdit={fleet.canEditForklifts}
        hasFilters={!!fleet.hasFilters}
        onToggleSelection={fleet.toggleForkliftSelection}
        onEdit={fleet.handleEdit}
        onDelete={fleet.handleDelete}
        onAssign={fleet.handleAssign}
        onReturn={fleet.handleReturn}
      />

      {fleet.showAddModal && (
        <AddEditForkliftModal
          isOpen={fleet.showAddModal}
          onClose={fleet.closeAddModal}
          formData={fleet.formData}
          setFormData={fleet.setFormData}
          onSubmit={fleet.handleSubmit}
          isEditing={!!fleet.editingForklift}
        />
      )}

      {fleet.showAssignModal && fleet.assigningForklift && (
        <AssignForkliftModal
          isOpen={fleet.showAssignModal}
          onClose={fleet.closeAssignModal}
          forklift={fleet.assigningForklift}
          customers={fleet.customers}
          selectedCustomerId={fleet.selectedCustomerId}
          setSelectedCustomerId={fleet.setSelectedCustomerId}
          startDate={fleet.startDate}
          setStartDate={fleet.setStartDate}
          endDate={fleet.endDate}
          setEndDate={fleet.setEndDate}
          rentalNotes={fleet.rentalNotes}
          setRentalNotes={fleet.setRentalNotes}
          rentalSite={fleet.rentalSite}
          setRentalSite={fleet.setRentalSite}
          monthlyRentalRate={fleet.monthlyRentalRate}
          setMonthlyRentalRate={fleet.setMonthlyRentalRate}
          lastServiceHourmeter={fleet.lastServiceHourmeter}
          setLastServiceHourmeter={fleet.setLastServiceHourmeter}
          onSubmit={fleet.handleAssignSubmit}
        />
      )}

      {fleet.returningForklift && (
        <ReturnForkliftModal
          isOpen
          forklift={fleet.returningForklift}
          onClose={() => fleet.setReturningForklift(null)}
          onSubmit={fleet.handleReturnSubmit}
          isProcessing={fleet.isReturning}
        />
      )}

      {fleet.showBulkRentModal && (
        <AssignForkliftModal
          isOpen={fleet.showBulkRentModal}
          onClose={() => fleet.setShowBulkRentModal(false)}
          forklift={null}
          bulkCount={fleet.availableSelectedForklifts.length}
          customers={fleet.customers}
          selectedCustomerId={fleet.selectedCustomerId}
          setSelectedCustomerId={fleet.setSelectedCustomerId}
          startDate={fleet.startDate}
          setStartDate={fleet.setStartDate}
          endDate={fleet.endDate}
          setEndDate={fleet.setEndDate}
          rentalNotes={fleet.rentalNotes}
          setRentalNotes={fleet.setRentalNotes}
          rentalSite={fleet.rentalSite}
          setRentalSite={fleet.setRentalSite}
          monthlyRentalRate={fleet.monthlyRentalRate}
          setMonthlyRentalRate={fleet.setMonthlyRentalRate}
          lastServiceHourmeter={fleet.lastServiceHourmeter}
          setLastServiceHourmeter={fleet.setLastServiceHourmeter}
          onSubmit={fleet.handleBulkRentOut}
          isProcessing={fleet.bulkProcessing}
        />
      )}

      <BulkEndRentalModal
        isOpen={fleet.showBulkEndRentalModal}
        onClose={() => fleet.setShowBulkEndRentalModal(false)}
        count={fleet.rentedSelectedForklifts.length}
        endDate={fleet.bulkEndDate}
        setEndDate={fleet.setBulkEndDate}
        onSubmit={fleet.handleBulkEndRental}
        isProcessing={fleet.bulkProcessing}
      />

      <BulkServiceResetModal
        isOpen={fleet.showBulkServiceResetModal}
        onClose={() => fleet.setShowBulkServiceResetModal(false)}
        forklifts={fleet.bulkRentedForklifts}
      />

      <ResultModal
        isOpen={fleet.resultModal.show}
        onClose={fleet.closeResultModal}
        type={fleet.resultModal.type}
        title={fleet.resultModal.title}
        message={fleet.resultModal.message}
        details={fleet.resultModal.details}
      />
    </div>
  );
};

export default FleetTab;

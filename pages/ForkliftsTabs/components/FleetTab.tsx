import { CheckSquare,Loader2,Plus,Square } from 'lucide-react';
import React from 'react';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { TabProps } from '../types';
import AddEditForkliftModal from './AddEditForkliftModal';
import AssignForkliftModal from './AssignForkliftModal';
import BulkActionsBar from './BulkActionsBar';
import BulkEndRentalModal from './BulkEndRentalModal';
import ForkliftFilters from './ForkliftFilters';
import ForkliftGrid from './ForkliftGrid';
import ResultModal from './ResultModal';
import { useFleetManagement } from './useFleetManagement';

const FleetTab: React.FC<TabProps> = ({ currentUser }) => {
  const { displayRole } = useDevModeContext();
  const fleet = useFleetManagement(currentUser, displayRole);

  if (fleet.loading) {
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
          {fleet.filteredForklifts.length} of {fleet.forklifts.length} units
          {fleet.isSelectionMode && fleet.selectedForkliftIds.size > 0 && (
            <span className="ml-2 text-blue-600 font-medium">
              • {fleet.selectedForkliftIds.size} selected
            </span>
          )}
        </p>
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
          monthlyRentalRate={fleet.monthlyRentalRate}
          setMonthlyRentalRate={fleet.setMonthlyRentalRate}
          onSubmit={fleet.handleAssignSubmit}
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
          monthlyRentalRate={fleet.monthlyRentalRate}
          setMonthlyRentalRate={fleet.setMonthlyRentalRate}
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

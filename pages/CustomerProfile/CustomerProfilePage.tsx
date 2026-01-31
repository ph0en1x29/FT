import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SupabaseDb as MockDb } from '../../services/supabaseService';

import { CustomerProfileProps, RentalTab, ServiceTab } from './types';
import {
  useCustomerData,
  useAIAnalysis,
  useRentalSelection,
  useBulkEndRentals,
  useRentForklifts,
  useResultModal,
  useRentalActions,
} from './hooks';
import {
  CustomerHeader,
  CustomerKPIStrip,
  RentalsSection,
  ServiceHistory,
  InsightsSidebar,
  EditRentalModal,
  BulkEndRentalModal,
  RentForkliftModal,
  ResultModal,
} from './components';

const CustomerProfilePage: React.FC<CustomerProfileProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Load customer data via hook
  const {
    customer,
    jobs,
    availableForklifts,
    loading,
    stats,
    activeRentals,
    pastRentals,
    activeJobs,
    cancelledJobs,
    openJobs,
    completedJobs,
    loadCustomerData,
    loadAvailableForklifts,
  } = useCustomerData(id);

  // Tab states
  const [rentalTab, setRentalTab] = useState<RentalTab>('active');
  const [serviceTab, setServiceTab] = useState<ServiceTab>('all');
  const [showCancelledJobs, setShowCancelledJobs] = useState(false);
  
  // Role checks
  const isAdmin = currentUser.role.toString().toLowerCase() === 'admin';
  const isSupervisor = currentUser.role.toString().toLowerCase() === 'supervisor';
  const canViewCancelled = isAdmin || isSupervisor;

  // Result modal
  const { resultModal, setResultModal, closeResultModal } = useResultModal();

  // AI Analysis
  const { aiAnalysis, generatingAI, handleGenerateAnalysis, clearAnalysis } = 
    useAIAnalysis(customer, jobs);

  // Rental selection (multi-select)
  const {
    isSelectionMode,
    selectedRentalIds,
    selectedRentals,
    toggleSelectionMode,
    toggleRentalSelection,
    selectAllActiveRentals,
    deselectAll,
    resetSelection,
  } = useRentalSelection(activeRentals);

  // Bulk end rentals
  const {
    showBulkEndModal,
    bulkEndDate,
    bulkProcessing,
    setBulkEndDate,
    openBulkEndModal,
    closeBulkEndModal,
    handleBulkEndRentals,
  } = useBulkEndRentals(selectedRentals, currentUser, loadCustomerData, resetSelection, setResultModal);

  // Rent forklifts
  const {
    showRentModal,
    selectedForkliftIds,
    rentStartDate,
    rentEndDate,
    rentNotes,
    rentMonthlyRate,
    forkliftSearchQuery,
    rentProcessing,
    setRentStartDate,
    setRentEndDate,
    setRentNotes,
    setRentMonthlyRate,
    setForkliftSearchQuery,
    toggleForkliftForRent,
    openRentModal,
    closeRentModal,
    handleRentForklifts,
  } = useRentForklifts(customer, availableForklifts, currentUser, loadAvailableForklifts, loadCustomerData, setResultModal);

  // Individual rental actions
  const { editingRental, setEditingRental, handleEndRental, handleSaveRentalEdit } = 
    useRentalActions(currentUser, loadCustomerData);

  // Filtered jobs based on tab
  const filteredJobs = useMemo(() => {
    switch (serviceTab) {
      case 'open': return openJobs;
      case 'completed': return completedJobs;
      default: return activeJobs;
    }
  }, [serviceTab, activeJobs, openJobs, completedJobs]);

  // Customer deletion handler
  const handleDeleteCustomer = async () => {
    if (!customer) return;
    
    const confirmed = confirm(`Are you sure you want to delete customer: "${customer.name}"?\n\nThis action cannot be undone.`);
    if (!confirmed) return;
    
    try {
      await MockDb.deleteCustomer(customer.customer_id);
      navigate('/customers');
    } catch (e) {
      alert('Could not delete customer: ' + (e as Error).message);
    }
  };

  // Loading / not found states
  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>;
  }

  if (!customer) {
    return <div className="p-8 text-center text-red-500">Customer not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <CustomerHeader
        customer={customer}
        isAdmin={isAdmin}
        isSupervisor={isSupervisor}
        onNavigateBack={() => navigate(-1)}
        onRentForklift={openRentModal}
        onCreateJob={() => navigate(`/jobs/new?customer_id=${customer.customer_id}`)}
        onEditCustomer={() => navigate(`/customers/${customer.customer_id}/edit`)}
        onDeleteCustomer={handleDeleteCustomer}
      />

      <CustomerKPIStrip
        totalJobs={stats.totalJobs}
        activeRentalsCount={stats.activeRentalsCount}
        totalServiceRevenue={stats.totalServiceRevenue}
        totalRentalRevenue={stats.totalRentalRevenue}
        totalRevenue={stats.totalRevenue}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <RentalsSection
            activeRentals={activeRentals}
            pastRentals={pastRentals}
            rentalTab={rentalTab}
            setRentalTab={(tab) => { setRentalTab(tab); resetSelection(); }}
            isSelectionMode={isSelectionMode}
            selectedRentalIds={selectedRentalIds}
            isAdmin={isAdmin}
            onToggleSelectionMode={toggleSelectionMode}
            onToggleRentalSelection={toggleRentalSelection}
            onSelectAllActiveRentals={selectAllActiveRentals}
            onDeselectAll={deselectAll}
            onOpenBulkEndModal={openBulkEndModal}
            onEditRental={setEditingRental}
            onEndRental={handleEndRental}
            onNavigateToForklift={(forkliftId) => navigate(`/forklifts/${forkliftId}`)}
          />
        </div>

        <div className="lg:col-span-5">
          <ServiceHistory
            activeJobs={activeJobs}
            openJobs={openJobs}
            completedJobs={completedJobs}
            cancelledJobs={cancelledJobs}
            filteredJobs={filteredJobs}
            serviceTab={serviceTab}
            setServiceTab={setServiceTab}
            showCancelledJobs={showCancelledJobs}
            setShowCancelledJobs={setShowCancelledJobs}
            canViewCancelled={canViewCancelled}
            onNavigateToJob={(jobId) => navigate(`/jobs/${jobId}`)}
          />
        </div>

        <div className="lg:col-span-3">
          <InsightsSidebar
            completedJobsCount={stats.completedJobsCount}
            avgResponseTime={stats.avgResponseTime}
            avgJobValue={stats.avgJobValue}
            topIssues={stats.topIssues}
            aiAnalysis={aiAnalysis}
            generatingAI={generatingAI}
            hasJobs={jobs.length > 0}
            onGenerateAnalysis={handleGenerateAnalysis}
            onClearAnalysis={clearAnalysis}
          />
        </div>
      </div>

      {/* Modals */}
      {editingRental && (
        <EditRentalModal
          rental={editingRental}
          isAdmin={isAdmin}
          onClose={() => setEditingRental(null)}
          onSave={handleSaveRentalEdit}
        />
      )}

      {showBulkEndModal && (
        <BulkEndRentalModal
          selectedRentals={selectedRentals}
          bulkEndDate={bulkEndDate}
          setBulkEndDate={setBulkEndDate}
          bulkProcessing={bulkProcessing}
          onClose={closeBulkEndModal}
          onConfirm={handleBulkEndRentals}
        />
      )}

      {showRentModal && (
        <RentForkliftModal
          customerName={customer.name}
          availableForklifts={availableForklifts}
          selectedForkliftIds={selectedForkliftIds}
          rentStartDate={rentStartDate}
          rentEndDate={rentEndDate}
          rentNotes={rentNotes}
          rentMonthlyRate={rentMonthlyRate}
          forkliftSearchQuery={forkliftSearchQuery}
          rentProcessing={rentProcessing}
          isAdmin={isAdmin}
          onClose={closeRentModal}
          onToggleForklift={toggleForkliftForRent}
          onSetStartDate={setRentStartDate}
          onSetEndDate={setRentEndDate}
          onSetNotes={setRentNotes}
          onSetMonthlyRate={setRentMonthlyRate}
          onSetSearchQuery={setForkliftSearchQuery}
          onConfirm={handleRentForklifts}
        />
      )}

      <ResultModal
        show={resultModal.show}
        type={resultModal.type}
        title={resultModal.title}
        message={resultModal.message}
        details={resultModal.details}
        onClose={closeResultModal}
      />
    </div>
  );
};

export default CustomerProfilePage;

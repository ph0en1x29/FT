import React,{ useMemo,useState } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import {
BulkEndRentalModal,
CustomerHeader,CustomerKPIStrip,
EditRentalModal,
InsightsSidebar,
RentalsSection,
RentForkliftModal,ResultModal,
ServiceHistory,
} from './components';
import {
useBulkEndRentals,
useCustomerData,
useRentalActions,
useRentalSelection,
useRentForklifts,useResultModal,
} from './hooks';
import { CustomerProfileProps,RentalTab,ServiceTab } from './types';

const CustomerProfilePage: React.FC<CustomerProfileProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Core data
  const customerData = useCustomerData(id);
  const { customer, jobs: _jobs, availableForklifts, loading, stats, loadCustomerData, loadAvailableForklifts } = customerData;
  const { activeRentals, pastRentals, activeJobs, cancelledJobs, openJobs, completedJobs } = customerData;

  // Tab states
  const [rentalTab, setRentalTab] = useState<RentalTab>('active');
  const [serviceTab, setServiceTab] = useState<ServiceTab>('all');
  const [showCancelledJobs, setShowCancelledJobs] = useState(false);
  
  // Role checks
  const isAdmin = currentUser.role.toString().toLowerCase() === 'admin';
  const isSupervisor = currentUser.role.toString().toLowerCase() === 'supervisor';
  const canViewCancelled = isAdmin || isSupervisor;

  // Hooks
  const { resultModal, setResultModal, closeResultModal } = useResultModal();
  const rentalSelection = useRentalSelection(activeRentals);
  const bulkEnd = useBulkEndRentals(
    rentalSelection.selectedRentals, currentUser, loadCustomerData, 
    rentalSelection.resetSelection, setResultModal
  );
  const rentForklifts = useRentForklifts(
    customer, availableForklifts, currentUser, 
    loadAvailableForklifts, loadCustomerData, setResultModal
  );
  const rentalActions = useRentalActions(currentUser, loadCustomerData);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    switch (serviceTab) {
      case 'open': return openJobs;
      case 'completed': return completedJobs;
      default: return activeJobs;
    }
  }, [serviceTab, activeJobs, openJobs, completedJobs]);

  // Handlers
  const handleDeleteCustomer = async () => {
    if (!customer) return;
    if (!confirm(`Are you sure you want to delete customer: "${customer.name}"?\n\nThis action cannot be undone.`)) return;
    try {
      await MockDb.deleteCustomer(customer.customer_id);
      navigate('/customers');
    } catch (e) {
      alert('Could not delete customer: ' + (e as Error).message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>;
  if (!customer) return <div className="p-8 text-center text-red-500">Customer not found</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <CustomerHeader
        customer={customer}
        isAdmin={isAdmin}
        isSupervisor={isSupervisor}
        onNavigateBack={() => navigate(-1)}
        onRentForklift={rentForklifts.openRentModal}
        onCreateJob={() => navigate(`/jobs/new?customer_id=${customer.customer_id}`)}
        onEditCustomer={() => navigate(`/customers/${customer.customer_id}/edit`)}
        onDeleteCustomer={handleDeleteCustomer}
      />

      <CustomerKPIStrip {...stats} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <RentalsSection
            activeRentals={activeRentals}
            pastRentals={pastRentals}
            rentalTab={rentalTab}
            setRentalTab={(tab) => { setRentalTab(tab); rentalSelection.resetSelection(); }}
            isSelectionMode={rentalSelection.isSelectionMode}
            selectedRentalIds={rentalSelection.selectedRentalIds}
            isAdmin={isAdmin}
            onToggleSelectionMode={rentalSelection.toggleSelectionMode}
            onToggleRentalSelection={rentalSelection.toggleRentalSelection}
            onSelectAllActiveRentals={rentalSelection.selectAllActiveRentals}
            onDeselectAll={rentalSelection.deselectAll}
            onOpenBulkEndModal={bulkEnd.openBulkEndModal}
            onEditRental={rentalActions.setEditingRental}
            onEndRental={rentalActions.handleEndRental}
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
          />
        </div>
      </div>

      {rentalActions.editingRental && (
        <EditRentalModal
          rental={rentalActions.editingRental}
          isAdmin={isAdmin}
          onClose={() => rentalActions.setEditingRental(null)}
          onSave={rentalActions.handleSaveRentalEdit}
        />
      )}

      {bulkEnd.showBulkEndModal && (
        <BulkEndRentalModal
          selectedRentals={rentalSelection.selectedRentals}
          bulkEndDate={bulkEnd.bulkEndDate}
          setBulkEndDate={bulkEnd.setBulkEndDate}
          bulkProcessing={bulkEnd.bulkProcessing}
          onClose={bulkEnd.closeBulkEndModal}
          onConfirm={bulkEnd.handleBulkEndRentals}
        />
      )}

      {rentForklifts.showRentModal && (
        <RentForkliftModal
          customerName={customer.name}
          availableForklifts={availableForklifts}
          selectedForkliftIds={rentForklifts.selectedForkliftIds}
          rentStartDate={rentForklifts.rentStartDate}
          rentEndDate={rentForklifts.rentEndDate}
          rentNotes={rentForklifts.rentNotes}
          rentMonthlyRate={rentForklifts.rentMonthlyRate}
          forkliftSearchQuery={rentForklifts.forkliftSearchQuery}
          rentProcessing={rentForklifts.rentProcessing}
          isAdmin={isAdmin}
          onClose={rentForklifts.closeRentModal}
          onToggleForklift={rentForklifts.toggleForkliftForRent}
          onSetStartDate={rentForklifts.setRentStartDate}
          onSetEndDate={rentForklifts.setRentEndDate}
          onSetNotes={rentForklifts.setRentNotes}
          onSetMonthlyRate={rentForklifts.setRentMonthlyRate}
          onSetSearchQuery={rentForklifts.setForkliftSearchQuery}
          onConfirm={rentForklifts.handleRentForklifts}
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

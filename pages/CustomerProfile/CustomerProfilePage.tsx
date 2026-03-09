import React,{ useMemo,useState } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import {
AddEditContactModal,
AddEditSiteModal,
BulkEndRentalModal,
ContactsSection,
CustomerHeader,
CustomerKPIStrip,
EditCustomerModal,
EditRentalModal,
InsightsSidebar,
RentalsSection,
RentForkliftModal,
ResultModal,
ServiceHistory,
SitesSection,
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
  
  // Edit customer modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Delete confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Role checks
  const isAdmin = currentUser.role.toString().toLowerCase() === 'admin';
  const isAdminService = currentUser.role.toString().toLowerCase() === 'admin_service';
  const isSupervisor = currentUser.role.toString().toLowerCase() === 'supervisor';
  const canViewCancelled = isAdmin || isAdminService || isSupervisor;

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
  const handleSaveCustomerEdit = async (data: any) => {
    if (!customer) return;
    setSavingCustomer(true);
    try {
      const { updateCustomer } = await import('../../services/customerService');
      await updateCustomer(customer.customer_id, {
        name: data.name,
        address: data.address,
        phone: data.phone,
        email: data.email,
        notes: data.notes,
        contact_person: data.contact_person,
        account_number: data.account_number,
        registration_no: data.registration_no,
        tax_entity_id: data.tax_entity_id,
        credit_term: data.credit_term,
        agent: data.agent,
        phone_secondary: data.phone_secondary
      });

            setShowEditModal(false);
      await loadCustomerData();
      setResultModal({
        show: true,
        type: 'success',
        title: 'Customer Updated',
        message: 'Customer information has been successfully updated.',
      });
    } catch (e) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update customer: ' + (e as Error).message,
      });
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customer) return;
    setShowDeleteConfirm(false);
    try {
      await MockDb.deleteCustomer(customer.customer_id);
      navigate('/customers');
    } catch (e) {
      showToast.error('Could not delete customer: ' + (e as Error).message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>;
  if (!customer) return <div className="p-8 text-center text-red-500">Customer not found</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-8">
      <CustomerHeader
        customer={customer}
        isAdmin={isAdmin || isAdminService}
        isSupervisor={isSupervisor}
        onNavigateBack={() => navigate(-1)}
        onRentForklift={rentForklifts.openRentModal}
        onCreateJob={() => navigate(`/jobs/new?customer_id=${customer.customer_id}`)}
        onEditCustomer={() => setShowEditModal(true)}
        onDeleteCustomer={() => setShowDeleteConfirm(true)}
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
            isAdmin={isAdmin || isAdminService}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ContactsSection customerId={customer.customer_id} />
        <SitesSection customerId={customer.customer_id} />
      </div>

      {rentalActions.editingRental && (
        <EditRentalModal
          rental={rentalActions.editingRental}
          isAdmin={isAdmin || isAdminService}
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
          isAdmin={isAdmin || isAdminService}
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

      {showEditModal && customer && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveCustomerEdit}
          saving={savingCustomer}
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && customer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            style={{ 
              backgroundColor: 'var(--surface)', 
              color: 'var(--text)',
              borderColor: 'var(--border)'
            }}
          >
            <div className="flex items-start gap-3">
              <div 
                className="rounded-full p-2 flex-shrink-0"
                style={{ backgroundColor: 'var(--error-bg)' }}
              >
                <svg className="w-6 h-6" style={{ color: 'var(--error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-1">Delete Customer</h3>
                <p style={{ color: 'var(--text-muted)' }} className="text-sm">
                  Are you sure you want to delete customer: <strong className="font-semibold" style={{ color: 'var(--text)' }}>"{customer.name}"</strong>?
                </p>
                <p style={{ color: 'var(--text-muted)' }} className="text-sm mt-2">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ 
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCustomer}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-90"
                style={{ 
                  backgroundColor: 'var(--error)',
                  color: 'white'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerProfilePage;

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ForkliftRental } from '../../types';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { generateCustomerAnalysis } from '../../services/geminiService';
import { showToast } from '../../services/toastService';

import { CustomerProfileProps, RentalTab, ServiceTab, ResultModalState } from './types';
import { useCustomerData } from './hooks';
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

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showCancelledJobs, setShowCancelledJobs] = useState(false);
  
  // Tab states
  const [rentalTab, setRentalTab] = useState<RentalTab>('active');
  const [serviceTab, setServiceTab] = useState<ServiceTab>('all');
  
  // Edit rental modal state
  const [editingRental, setEditingRental] = useState<ForkliftRental | null>(null);

  // Multi-select for ending rentals
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRentalIds, setSelectedRentalIds] = useState<Set<string>>(new Set());
  const [showBulkEndModal, setShowBulkEndModal] = useState(false);
  const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Result modal
  const [resultModal, setResultModal] = useState<ResultModalState>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  // Rent forklift modal states
  const [showRentModal, setShowRentModal] = useState(false);
  const [selectedForkliftIds, setSelectedForkliftIds] = useState<Set<string>>(new Set());
  const [rentStartDate, setRentStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rentEndDate, setRentEndDate] = useState('');
  const [rentNotes, setRentNotes] = useState('');
  const [rentMonthlyRate, setRentMonthlyRate] = useState('');
  const [forkliftSearchQuery, setForkliftSearchQuery] = useState('');
  const [rentProcessing, setRentProcessing] = useState(false);

  // Role checks
  const isAdmin = currentUser.role.toString().toLowerCase() === 'admin';
  const isSupervisor = currentUser.role.toString().toLowerCase() === 'supervisor';
  const canViewCancelled = isAdmin || isSupervisor;

  // Filtered jobs based on tab
  const filteredJobs = useMemo(() => {
    switch (serviceTab) {
      case 'open': return openJobs;
      case 'completed': return completedJobs;
      default: return activeJobs;
    }
  }, [serviceTab, activeJobs, openJobs, completedJobs]);

  // Selected rentals for bulk operations
  const selectedRentals = useMemo(() => {
    return activeRentals.filter(r => selectedRentalIds.has(r.rental_id));
  }, [activeRentals, selectedRentalIds]);

  // ========== HANDLERS ==========

  const openRentModal = async () => {
    await loadAvailableForklifts();
    setSelectedForkliftIds(new Set());
    setRentStartDate(new Date().toISOString().split('T')[0]);
    setRentEndDate('');
    setRentNotes('');
    setRentMonthlyRate('');
    setForkliftSearchQuery('');
    setShowRentModal(true);
  };

  const handleGenerateAnalysis = async () => {
    if (!customer || jobs.length === 0) return;
    
    setGeneratingAI(true);
    try {
      const analysis = await generateCustomerAnalysis(customer, jobs);
      setAiAnalysis(analysis);
    } catch (error) {
      setAiAnalysis('Unable to generate analysis at this time.');
      showToast.error('AI analysis failed');
    } finally {
      setGeneratingAI(false);
    }
  };

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

  const handleEndRental = async (rentalId: string) => {
    if (!confirm('End this rental? The forklift will be marked as available.')) return;
    
    try {
      await MockDb.endRental(rentalId, undefined, currentUser.user_id, currentUser.name);
      await loadCustomerData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleSaveRentalEdit = async (data: {
    startDate: string;
    endDate: string;
    notes: string;
    monthlyRate: string;
  }) => {
    if (!editingRental) return;
    
    try {
      await MockDb.updateRental(editingRental.rental_id, {
        start_date: data.startDate,
        end_date: data.endDate || undefined,
        notes: data.notes || undefined,
        monthly_rental_rate: parseFloat(data.monthlyRate) || 0,
      });
      setEditingRental(null);
      await loadCustomerData();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedRentalIds(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const toggleRentalSelection = (rentalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedRentalIds);
    if (newSelected.has(rentalId)) {
      newSelected.delete(rentalId);
    } else {
      newSelected.add(rentalId);
    }
    setSelectedRentalIds(newSelected);
  };

  const selectAllActiveRentals = () => {
    setSelectedRentalIds(new Set(activeRentals.map(r => r.rental_id)));
  };

  const deselectAll = () => {
    setSelectedRentalIds(new Set());
  };

  const openBulkEndModal = () => {
    setBulkEndDate(new Date().toISOString().split('T')[0]);
    setShowBulkEndModal(true);
  };

  const handleBulkEndRentals = async () => {
    if (selectedRentals.length === 0) return;

    setBulkProcessing(true);
    try {
      const forkliftIds = selectedRentals.map(r => r.forklift_id);
      
      const result = await MockDb.bulkEndRentals(
        forkliftIds,
        bulkEndDate || undefined,
        currentUser.user_id,
        currentUser.name
      );

      const details: string[] = [];
      result.success.forEach(r => {
        details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rental ended`);
      });
      result.failed.forEach(f => {
        const rental = selectedRentals.find(r => r.forklift_id === f.forkliftId);
        details.push(`✗ ${rental?.forklift?.serial_number || f.forkliftId} - ${f.error}`);
      });

      setResultModal({
        show: true,
        type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
        title: result.failed.length === 0 ? 'Rentals Ended Successfully' : 'Bulk End Rental Complete',
        message: `Successfully ended ${result.success.length} rental(s)${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}.`,
        details,
      });

      setShowBulkEndModal(false);
      setSelectedRentalIds(new Set());
      setIsSelectionMode(false);
      await loadCustomerData();
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message,
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleForkliftForRent = (forkliftId: string) => {
    const newSelected = new Set(selectedForkliftIds);
    if (newSelected.has(forkliftId)) {
      newSelected.delete(forkliftId);
    } else {
      newSelected.add(forkliftId);
    }
    setSelectedForkliftIds(newSelected);
  };

  const handleRentForklifts = async () => {
    if (!customer || selectedForkliftIds.size === 0 || !rentStartDate) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Validation Error',
        message: 'Please select at least one forklift and a start date',
      });
      return;
    }

    setRentProcessing(true);
    try {
      const forkliftIds: string[] = Array.from(selectedForkliftIds);
      
      if (forkliftIds.length === 1) {
        await MockDb.assignForkliftToCustomer(
          forkliftIds[0],
          customer.customer_id,
          rentStartDate,
          rentEndDate || undefined,
          rentNotes || undefined,
          currentUser.user_id,
          currentUser.name,
          rentMonthlyRate ? parseFloat(rentMonthlyRate) : undefined
        );
        
        const forklift = availableForklifts.find(f => f.forklift_id === forkliftIds[0]);
        setResultModal({
          show: true,
          type: 'success',
          title: 'Forklift Rented Successfully',
          message: `${forklift?.make} ${forklift?.model} (${forklift?.serial_number}) has been rented to ${customer.name}.`,
          details: [
            `✓ Rental created successfully`,
            `✓ Start date: ${new Date(rentStartDate).toLocaleDateString()}`,
            rentMonthlyRate ? `✓ Monthly rate: RM${parseFloat(rentMonthlyRate).toLocaleString()}` : '',
          ].filter(Boolean),
        });
      } else {
        const result = await MockDb.bulkAssignForkliftsToCustomer(
          forkliftIds,
          customer.customer_id,
          rentStartDate,
          rentEndDate || undefined,
          rentNotes || undefined,
          currentUser.user_id,
          currentUser.name,
          rentMonthlyRate ? parseFloat(rentMonthlyRate) : undefined
        );

        const details: string[] = [];
        result.success.forEach(r => {
          details.push(`✓ ${r.forklift?.serial_number || 'Unknown'} - Rented successfully`);
        });
        result.failed.forEach(f => {
          const forklift = availableForklifts.find(fl => fl.forklift_id === f.forkliftId);
          details.push(`✗ ${forklift?.serial_number || f.forkliftId} - ${f.error}`);
        });

        setResultModal({
          show: true,
          type: result.failed.length === 0 ? 'success' : result.success.length === 0 ? 'error' : 'mixed',
          title: result.failed.length === 0 ? 'Forklifts Rented Successfully' : 'Bulk Rental Complete',
          message: `Successfully rented ${result.success.length} forklift(s) to ${customer.name}${result.failed.length > 0 ? `. ${result.failed.length} failed.` : '.'}`,
          details,
        });
      }

      setShowRentModal(false);
      await loadCustomerData();
    } catch (error) {
      setResultModal({
        show: true,
        type: 'error',
        title: 'Error',
        message: (error as Error).message,
      });
    } finally {
      setRentProcessing(false);
    }
  };

  // ========== RENDER ==========

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>;
  }

  if (!customer) {
    return <div className="p-8 text-center text-red-500">Customer not found</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
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

      {/* KPI Strip */}
      <CustomerKPIStrip
        totalJobs={stats.totalJobs}
        activeRentalsCount={stats.activeRentalsCount}
        totalServiceRevenue={stats.totalServiceRevenue}
        totalRentalRevenue={stats.totalRentalRevenue}
        totalRevenue={stats.totalRevenue}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Rentals Section */}
        <div className="lg:col-span-4">
          <RentalsSection
            activeRentals={activeRentals}
            pastRentals={pastRentals}
            rentalTab={rentalTab}
            setRentalTab={(tab) => {
              setRentalTab(tab);
              setIsSelectionMode(false);
              setSelectedRentalIds(new Set());
            }}
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

        {/* Service History */}
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

        {/* Insights Sidebar */}
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
            onClearAnalysis={() => setAiAnalysis('')}
          />
        </div>
      </div>

      {/* ========== MODALS ========== */}

      {/* Edit Rental Modal */}
      {editingRental && (
        <EditRentalModal
          rental={editingRental}
          isAdmin={isAdmin}
          onClose={() => setEditingRental(null)}
          onSave={handleSaveRentalEdit}
        />
      )}

      {/* Bulk End Rental Modal */}
      {showBulkEndModal && (
        <BulkEndRentalModal
          selectedRentals={selectedRentals}
          bulkEndDate={bulkEndDate}
          setBulkEndDate={setBulkEndDate}
          bulkProcessing={bulkProcessing}
          onClose={() => setShowBulkEndModal(false)}
          onConfirm={handleBulkEndRentals}
        />
      )}

      {/* Rent Forklift Modal */}
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
          onClose={() => setShowRentModal(false)}
          onToggleForklift={toggleForkliftForRent}
          onSetStartDate={setRentStartDate}
          onSetEndDate={setRentEndDate}
          onSetNotes={setRentNotes}
          onSetMonthlyRate={setRentMonthlyRate}
          onSetSearchQuery={setForkliftSearchQuery}
          onConfirm={handleRentForklifts}
        />
      )}

      {/* Result Modal */}
      <ResultModal
        show={resultModal.show}
        type={resultModal.type}
        title={resultModal.title}
        message={resultModal.message}
        details={resultModal.details}
        onClose={() => setResultModal({ ...resultModal, show: false })}
      />
    </div>
  );
};

export default CustomerProfilePage;

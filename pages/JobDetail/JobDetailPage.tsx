import React, { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, JobStatus, UserRole, Part, User } from '../../types';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { useTechnicians, usePartsForList } from '../../hooks/useQueryHooks';
import { ComboboxOption } from '../../components/Combobox';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { showToast } from '../../services/toastService';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

// Extracted components
import {
  JobHeader, JobTimerCard, EquipmentCard, FinancialSummary,
  JobTimeline, SignaturesCard, AIAssistantCard, JobPhotosSection,
  CustomerAssignmentCard, NotesSection,
  SignatureModal, StartJobModal, FinalizeModal, ReassignModal,
  ContinueTomorrowModal, DeleteModal, RejectJobModal, HourmeterAmendmentModal,
} from './components';

// Extracted hooks
import { useJobRealtime, useJobDetailState, useJobActions } from './hooks';

// Utils
import { getRoleFlags, getStatusFlags, getDefaultPhotoCategory } from './utils';
import { JobDetailProps } from './types';

const JobDetailPage: React.FC<JobDetailProps> = ({ currentUser }) => {
  const { displayRole } = useDevModeContext();
  const currentUserRole = displayRole;
  const currentUserId = currentUser.user_id;
  const currentUserName = currentUser.name;

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // All state management in one hook
  const state = useJobDetailState();
  const { job, setJob, loading, setLoading } = state;

  // Cached data from React Query
  const { data: cachedParts = [] } = usePartsForList();
  const { data: cachedTechnicians = [] } = useTechnicians();
  const parts = cachedParts as unknown as Part[];
  const technicians = cachedTechnicians as User[];

  // Data loading
  const loadJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await MockDb.getJobById(id);
      setJob(data ? { ...data } : null);
      if (data) {
        const serviceRecord = await MockDb.getJobServiceRecord(id);
        if (serviceRecord) state.setNoPartsUsed(serviceRecord.no_parts_used || false);
        if (data.forklift_id) {
          const rental = await MockDb.getActiveRentalForForklift(data.forklift_id);
          state.setActiveRental(rental);
        }
        if (data.helper_assignment) {
          const isHelper = data.helper_assignment.technician_id === currentUserId;
          state.setIsCurrentUserHelper(isHelper);
          if (isHelper) state.setHelperAssignmentId(data.helper_assignment.assignment_id);
        } else {
          state.setIsCurrentUserHelper(false);
          state.setHelperAssignmentId(null);
        }
      }
    } catch {
      showToast.error('Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [id, currentUserId, setJob, setLoading, state]);

  const loadRequests = useCallback(async () => {
    if (!id) return;
    try {
      const requests = await MockDb.getJobRequests(id);
      state.setJobRequests(requests);
    } catch {
      showToast.error('Failed to load requests');
    }
  }, [id, state]);

  const loadVanStock = useCallback(async () => {
    if (currentUserRole !== UserRole.TECHNICIAN) return;
    try {
      const data = await MockDb.getVanStockByTechnician(currentUserId);
      state.setVanStock(data);
    } catch { /* ignore */ }
  }, [currentUserId, currentUserRole, state]);

  // Real-time subscription
  useJobRealtime({
    jobId: id,
    currentUserId,
    onJobDeleted: () => navigate('/jobs'),
    onJobUpdated: loadJob,
    onRequestsUpdated: loadRequests,
  });

  useEffect(() => { loadJob(); loadRequests(); loadVanStock(); }, [loadJob, loadRequests, loadVanStock]);

  // All actions in one hook
  const actions = useJobActions({ state, currentUserId, currentUserName, technicians, loadJob });

  // Derived flags
  const statusFlags = getStatusFlags(job, currentUserId, currentUserRole);
  const roleFlags = getRoleFlags(currentUserRole, state.isCurrentUserHelper, job, statusFlags);

  // Combobox options
  const partOptions: ComboboxOption[] = parts.map(p => ({
    id: p.part_id,
    label: p.part_name,
    subLabel: roleFlags.canViewPricing ? `RM${p.sell_price} | Stock: ${p.stock_quantity} | ${p.category}` : `Stock: ${p.stock_quantity} | ${p.category}`
  }));
  const techOptions: ComboboxOption[] = technicians.map(t => ({ id: t.user_id, label: t.name, subLabel: t.email }));

  // Loading state
  if (loading) return (
    <div className="max-w-5xl mx-auto p-6 fade-in">
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--text-muted)] text-sm">Loading job details...</p>
        </div>
      </div>
    </div>
  );

  // Not found state
  if (!job) return (
    <div className="max-w-5xl mx-auto p-6 fade-in">
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-[var(--error)] mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[var(--text)]">Job not found</h2>
        <p className="text-[var(--text-muted)] mt-2">This job may have been deleted or you don't have access.</p>
        <button onClick={() => navigate('/jobs')} className="btn-premium btn-premium-primary mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-20 fade-in">
      {/* Header */}
      <JobHeader
        job={job} isRealtimeConnected={true} roleFlags={roleFlags} statusFlags={statusFlags}
        exportingToAutoCount={state.exportingToAutoCount}
        onAcceptJob={actions.handleAcceptJob}
        onRejectJob={() => state.setShowRejectJobModal(true)}
        onStartJob={actions.handleOpenStartJobModal}
        onCompleteJob={() => actions.handleStatusChange(JobStatus.AWAITING_FINALIZATION)}
        onContinueTomorrow={() => state.setShowContinueTomorrowModal(true)}
        onResumeJob={actions.handleResumeJob}
        onCustomerUnavailable={() => state.setShowDeferredModal(true)}
        onFinalizeInvoice={() => state.setShowFinalizeModal(true)}
        onPrintServiceReport={actions.handlePrintServiceReport}
        onExportPDF={actions.handleExportPDF}
        onExportToAutoCount={actions.handleExportToAutoCount}
        onDeleteJob={() => state.setShowDeleteModal(true)}
        onAcknowledgeJob={actions.handleAcknowledgeJob}
      />

      {/* Main Content */}
      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        <div className="lg:col-span-2 space-y-5">
          {job.forklift && (
            <EquipmentCard job={job} activeRental={state.activeRental} currentUserId={currentUserId} roleFlags={roleFlags} statusFlags={statusFlags}
              editingHourmeter={state.editingHourmeter} hourmeterInput={state.hourmeterInput}
              onHourmeterInputChange={state.setHourmeterInput} onStartEditHourmeter={actions.handleStartEditHourmeter}
              onSaveHourmeter={actions.handleSaveHourmeter} onCancelHourmeterEdit={actions.handleCancelHourmeterEdit}
              onRequestAmendment={() => state.setShowHourmeterAmendmentModal(true)} />
          )}
          {(statusFlags.isInProgress || statusFlags.isAwaitingFinalization || statusFlags.isCompleted) && <JobTimerCard job={job} />}
          <CustomerAssignmentCard job={job} roleFlags={roleFlags} statusFlags={statusFlags} techOptions={techOptions}
            selectedTechId={state.selectedTechId} onSelectedTechIdChange={state.setSelectedTechId}
            onAssignJob={actions.handleAssignJob} onOpenReassignModal={() => state.setShowReassignModal(true)} />
          <NotesSection job={job} roleFlags={roleFlags} statusFlags={statusFlags} noteInput={state.noteInput}
            onNoteInputChange={state.setNoteInput} onAddNote={actions.handleAddNote} />
          <JobPhotosSection job={job} currentUserId={currentUserId} currentUserName={currentUserName}
            roleFlags={roleFlags} statusFlags={statusFlags} isCurrentUserHelper={state.isCurrentUserHelper} onJobUpdate={setJob} />
        </div>
        <div className="space-y-5">
          <FinancialSummary job={job} roleFlags={roleFlags} editingLabor={state.editingLabor} laborCostInput={state.laborCostInput}
            onLaborInputChange={state.setLaborCostInput} onStartEditLabor={actions.handleStartEditLabor}
            onSaveLabor={actions.handleSaveLabor} onCancelLaborEdit={actions.handleCancelLaborEdit} />
          <JobTimeline job={job} />
          <SignaturesCard job={job} roleFlags={roleFlags} statusFlags={statusFlags}
            onOpenTechSignature={() => state.setShowTechSigPad(true)} onOpenCustomerSignature={() => state.setShowCustSigPad(true)} />
          <AIAssistantCard aiSummary={state.aiSummary} generatingAi={state.generatingAi} onGenerateSummary={actions.handleAiSummary} />
        </div>
      </div>

      {/* Modals */}
      <SignatureModal show={state.showTechSigPad} title="Technician Signature" subtitle="I certify that this work has been completed according to standards."
        onSave={actions.handleTechnicianSignature} onClose={() => state.setShowTechSigPad(false)} />
      <SignatureModal show={state.showCustSigPad} title="Customer Acceptance" subtitle="I acknowledge the service performed and agree to the charges."
        onSave={actions.handleCustomerSignature} onClose={() => state.setShowCustSigPad(false)} />
      <StartJobModal show={state.showStartJobModal} startJobHourmeter={state.startJobHourmeter} conditionChecklist={state.conditionChecklist}
        onHourmeterChange={state.setStartJobHourmeter} onChecklistToggle={actions.handleChecklistToggle}
        onStartJob={actions.handleStartJobWithCondition} onClose={() => state.setShowStartJobModal(false)} />
      <FinalizeModal show={state.showFinalizeModal} job={job} currentUserName={currentUserName}
        onFinalize={actions.handleFinalizeInvoice} onClose={() => state.setShowFinalizeModal(false)} />
      <ReassignModal show={state.showReassignModal} job={job} techOptions={techOptions} reassignTechId={state.reassignTechId}
        onReassignTechIdChange={state.setReassignTechId} onReassign={actions.handleReassignJob}
        onClose={() => { state.setShowReassignModal(false); state.setReassignTechId(''); }} />
      <ContinueTomorrowModal show={state.showContinueTomorrowModal} job={job} reason={state.continueTomorrowReason} submitting={state.submittingContinue}
        onReasonChange={state.setContinueTomorrowReason} onConfirm={actions.handleContinueTomorrow}
        onClose={() => { state.setShowContinueTomorrowModal(false); state.setContinueTomorrowReason(''); }} />
      <DeleteModal show={state.showDeleteModal} job={job} reason={state.deletionReason}
        onReasonChange={state.setDeletionReason} onConfirm={actions.handleDeleteJob}
        onClose={() => { state.setShowDeleteModal(false); state.setDeletionReason(''); }} />
      <RejectJobModal show={state.showRejectJobModal} job={job} reason={state.rejectJobReason}
        onReasonChange={state.setRejectJobReason} onConfirm={actions.handleRejectJob}
        onClose={() => { state.setShowRejectJobModal(false); state.setRejectJobReason(''); }} />
      {state.showHourmeterAmendmentModal && job.forklift && (
        <HourmeterAmendmentModal job={job} previousReading={job.forklift.hourmeter || 0}
          flagReasons={job.hourmeter_flag_reasons || state.hourmeterFlagReasons}
          onClose={() => state.setShowHourmeterAmendmentModal(false)} onSubmit={actions.handleSubmitHourmeterAmendment} />
      )}
    </div>
  );
};

export default JobDetailPage;

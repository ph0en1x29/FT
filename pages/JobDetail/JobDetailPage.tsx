import { AlertTriangle,ArrowLeft } from 'lucide-react';
import React from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { ComboboxOption } from '../../components/Combobox';
import ServiceUpgradeModal from '../../components/ServiceUpgradeModal';
import { SkeletonJobDetail } from '../../components/Skeleton';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { usePartsForList,useTechnicians } from '../../hooks/useQueryHooks';
import { JobStatus,Part,User } from '../../types';

// Extracted components
import {
ApproveRequestModal,
ChecklistWarningModal,
ConditionChecklistCard,
ConfirmationStatusCard,
ContinueTomorrowModal,
CreateRequestModal,
CustomerAssignmentCard,
DeferredCompletionModal,
DeleteModal,
EquipmentCard,
ExtraChargesSection,
FinalizeModal,
FinancialSummary,
HelperModal,
HourmeterAmendmentModal,
JobDetailsCard,
JobHeader,
JobPhotosSection,
JobRequestsSection,
JobTimeline,
JobTimerCard,
NotesSection,
PartsSection,
ReassignModal,
RejectJobModal,
SignatureModal,
SignaturesCard,
StartJobModal,
} from './components';

// Extracted hooks
import { useJobActions,useJobData,useJobDetailState } from './hooks';
import { JobDetailProps } from './types';
import { getRoleFlags,getStatusFlags } from './utils';

const JobDetailPage: React.FC<JobDetailProps> = ({ currentUser }) => {
  const { displayRole } = useDevModeContext();
  const currentUserRole = displayRole;
  const { user_id: currentUserId, name: currentUserName } = currentUser;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // All state in one hook
  const state = useJobDetailState();
  const { job, setJob, loading } = state;

  // Cached data
  const { data: cachedParts = [] } = usePartsForList();
  const { data: cachedTechnicians = [] } = useTechnicians();
  const parts = cachedParts as unknown as Part[];
  const technicians = cachedTechnicians as User[];

  // Data loading with real-time
  const { loadJob } = useJobData({ jobId: id, currentUserId, currentUserRole, state });

  // All actions
  const actions = useJobActions({ state, currentUserId, currentUserName, currentUserRole, technicians, loadJob });

  // Derived flags
  const statusFlags = getStatusFlags(job, currentUserId, currentUserRole);
  const roleFlags = getRoleFlags(currentUserRole, state.isCurrentUserHelper, job, statusFlags);

  // Options for comboboxes
  const partOptions: ComboboxOption[] = parts.map(p => ({
    id: p.part_id, label: p.part_name,
    subLabel: roleFlags.canViewPricing ? `RM${p.sell_price} | Stock: ${p.stock_quantity} | ${p.category}` : `Stock: ${p.stock_quantity} | ${p.category}`
  }));
  const techOptions: ComboboxOption[] = technicians.map(t => ({ id: t.user_id, label: t.name, subLabel: t.email }));

  if (loading) return (
    <div className="max-w-5xl mx-auto p-6 fade-in">
      <SkeletonJobDetail />
    </div>
  );

  if (!job) return (
    <div className="max-w-5xl mx-auto p-6 fade-in"><div className="text-center py-20">
      <AlertTriangle className="w-12 h-12 text-[var(--error)] mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-[var(--text)]">Job not found</h2>
      <p className="text-[var(--text-muted)] mt-2">This job may have been deleted or you don't have access.</p>
      <button onClick={() => navigate('/jobs')} className="btn-premium btn-premium-primary mt-4"><ArrowLeft className="w-4 h-4" /> Back to Jobs</button>
    </div></div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-20 fade-in">
      <JobHeader job={job} isRealtimeConnected={true} roleFlags={roleFlags} statusFlags={statusFlags}
        exportingToAutoCount={state.exportingToAutoCount} onAcceptJob={actions.handleAcceptJob}
        onRejectJob={() => state.setShowRejectJobModal(true)} onStartJob={actions.handleOpenStartJobModal}
        onCompleteJob={() => actions.handleStatusChange(JobStatus.AWAITING_FINALIZATION)}
        onContinueTomorrow={() => state.setShowContinueTomorrowModal(true)} onResumeJob={actions.handleResumeJob}
        onCustomerUnavailable={() => state.setShowDeferredModal(true)} onFinalizeInvoice={() => state.setShowFinalizeModal(true)}
        onPrintServiceReport={actions.handlePrintServiceReport} onExportPDF={actions.handleExportPDF}
        onExportToAutoCount={actions.handleExportToAutoCount} onDeleteJob={() => state.setShowDeleteModal(true)}
        onAcknowledgeJob={actions.handleAcknowledgeJob} />

      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        <div className="lg:col-span-2 space-y-5">
          {job.forklift && <EquipmentCard job={job} activeRental={state.activeRental} currentUserId={currentUserId}
            roleFlags={roleFlags} statusFlags={statusFlags} editingHourmeter={state.editingHourmeter}
            hourmeterInput={state.hourmeterInput} onHourmeterInputChange={state.setHourmeterInput}
            onStartEditHourmeter={actions.handleStartEditHourmeter} onSaveHourmeter={actions.handleSaveHourmeter}
            onCancelHourmeterEdit={actions.handleCancelHourmeterEdit} onRequestAmendment={() => state.setShowHourmeterAmendmentModal(true)} />}
          {(statusFlags.isInProgress || statusFlags.isAwaitingFinalization || statusFlags.isCompleted) && <JobTimerCard job={job} />}
          <CustomerAssignmentCard job={job} roleFlags={roleFlags} statusFlags={statusFlags} techOptions={techOptions}
            selectedTechId={state.selectedTechId} isCurrentUserHelper={state.isCurrentUserHelper}
            onSelectedTechIdChange={state.setSelectedTechId} onAssignJob={actions.handleAssignJob}
            onOpenReassignModal={() => state.setShowReassignModal(true)}
            onOpenHelperModal={() => state.setShowAssignHelperModal(true)} onRemoveHelper={actions.handleRemoveHelper} />
          <JobDetailsCard job={job} roleFlags={roleFlags} statusFlags={statusFlags}
            editingJobCarriedOut={state.editingJobCarriedOut} jobCarriedOutInput={state.jobCarriedOutInput}
            recommendationInput={state.recommendationInput} onJobCarriedOutInputChange={state.setJobCarriedOutInput}
            onRecommendationInputChange={state.setRecommendationInput} onStartEdit={actions.handleStartEditJobCarriedOut}
            onSave={actions.handleSaveJobCarriedOut} onCancel={actions.handleCancelJobCarriedOutEdit} />
          <ConfirmationStatusCard job={job} roleFlags={roleFlags} statusFlags={statusFlags}
            onConfirmParts={actions.handleConfirmParts} />
          <NotesSection job={job} roleFlags={roleFlags} statusFlags={statusFlags} noteInput={state.noteInput}
            onNoteInputChange={state.setNoteInput} onAddNote={actions.handleAddNote} />
          <ConditionChecklistCard job={job} roleFlags={roleFlags} statusFlags={statusFlags}
            editingChecklist={state.editingChecklist} checklistEditData={state.checklistEditData}
            onStartEdit={actions.handleStartEditChecklist} onSave={actions.handleSaveChecklist}
            onCancel={actions.handleCancelChecklistEdit} onSetItemState={actions.handleSetChecklistItemState}
            onCheckAll={actions.handleCheckAll} />
          <PartsSection job={job} roleFlags={roleFlags} statusFlags={statusFlags} partOptions={partOptions}
            selectedPartId={state.selectedPartId} selectedPartPrice={state.selectedPartPrice}
            editingPartId={state.editingPartId} editingPrice={state.editingPrice} noPartsUsed={state.noPartsUsed}
            onSelectedPartIdChange={state.setSelectedPartId} onSelectedPartPriceChange={state.setSelectedPartPrice}
            onAddPart={actions.handleAddPart} onStartEditPrice={actions.handleStartEditPartPrice}
            onSavePartPrice={actions.handleSavePartPrice} onCancelEdit={actions.handleCancelPartEdit}
            onRemovePart={actions.handleRemovePart} onEditingPriceChange={state.setEditingPrice}
            onToggleNoPartsUsed={actions.handleToggleNoPartsUsed}
            vanStock={state.vanStock}
            useFromVanStock={state.useFromVanStock}
            onToggleVanStock={() => state.setUseFromVanStock(!state.useFromVanStock)}
            selectedVanStockItemId={state.selectedVanStockItemId}
            onSelectedVanStockItemIdChange={state.setSelectedVanStockItemId}
            onUseVanStockPart={actions.handleUseVanStockPart} />
          <ExtraChargesSection job={job} roleFlags={roleFlags} showAddCharge={state.showAddCharge}
            chargeName={state.chargeName} chargeDescription={state.chargeDescription} chargeAmount={state.chargeAmount}
            onShowAddChargeChange={state.setShowAddCharge} onChargeNameChange={state.setChargeName}
            onChargeDescriptionChange={state.setChargeDescription} onChargeAmountChange={state.setChargeAmount}
            onAddCharge={actions.handleAddExtraCharge} onRemoveCharge={actions.handleRemoveExtraCharge} />
          <JobRequestsSection job={job} roleFlags={roleFlags} statusFlags={statusFlags}
            currentUserId={currentUserId}
            onCreateRequest={() => { state.setEditingRequest(null); state.setShowRequestModal(true); }}
            onApproveRequest={(request) => { state.setApprovalRequest(request); state.setShowApprovalModal(true); }}
            onEditRequest={actions.handleEditRequest}
            onIssuePartToTechnician={actions.handleIssuePartToTechnician}
            onMarkOutOfStock={actions.handleMarkOutOfStock}
            onMarkPartReceived={actions.handleMarkPartReceived}
            onConfirmPartCollection={actions.handleConfirmPartCollection} />
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
        </div>
      </div>

      {/* Modals */}
      <SignatureModal show={state.showTechSigPad} title="Technician Signature" subtitle="I certify that this work has been completed according to standards."
        onSave={actions.handleTechnicianSignature} onClose={() => state.setShowTechSigPad(false)} />
      <SignatureModal show={state.showCustSigPad} title="Customer Acceptance" subtitle="I acknowledge the service performed and agree to the charges."
        onSave={actions.handleCustomerSignature} onClose={() => state.setShowCustSigPad(false)} />
      <StartJobModal show={state.showStartJobModal} startJobHourmeter={state.startJobHourmeter} 
        lastRecordedHourmeter={job?.forklift?.hourmeter || 0} conditionChecklist={state.conditionChecklist}
        onHourmeterChange={state.setStartJobHourmeter} onChecklistToggle={actions.handleChecklistToggle}
        onCheckAll={actions.handleConditionCheckAll} onUncheckAll={actions.handleConditionUncheckAll}
        onStartJob={actions.handleStartJobWithCondition} onClose={() => state.setShowStartJobModal(false)} />
      <FinalizeModal show={state.showFinalizeModal} job={job} currentUserName={currentUserName}
        onFinalize={actions.handleFinalizeInvoice} onClose={() => state.setShowFinalizeModal(false)} />
      <ReassignModal show={state.showReassignModal} job={job} techOptions={techOptions} reassignTechId={state.reassignTechId}
        onReassignTechIdChange={state.setReassignTechId} onReassign={actions.handleReassignJob}
        onClose={() => { state.setShowReassignModal(false); state.setReassignTechId(''); }} />
      <ContinueTomorrowModal show={state.showContinueTomorrowModal} job={job} reason={state.continueTomorrowReason}
        submitting={state.submittingContinue} onReasonChange={state.setContinueTomorrowReason}
        onConfirm={actions.handleContinueTomorrow} onClose={() => { state.setShowContinueTomorrowModal(false); state.setContinueTomorrowReason(''); }} />
      <DeleteModal show={state.showDeleteModal} job={job} reason={state.deletionReason} onReasonChange={state.setDeletionReason}
        onConfirm={actions.handleDeleteJob} onClose={() => { state.setShowDeleteModal(false); state.setDeletionReason(''); }} />
      <RejectJobModal show={state.showRejectJobModal} job={job} reason={state.rejectJobReason} onReasonChange={state.setRejectJobReason}
        onConfirm={actions.handleRejectJob} onClose={() => { state.setShowRejectJobModal(false); state.setRejectJobReason(''); }} />
      {state.showHourmeterAmendmentModal && job.forklift && (
        <HourmeterAmendmentModal job={job} previousReading={job.forklift.hourmeter || 0}
          flagReasons={job.hourmeter_flag_reasons || state.hourmeterFlagReasons}
          onClose={() => state.setShowHourmeterAmendmentModal(false)} onSubmit={actions.handleSubmitHourmeterAmendment} />
      )}
      <ChecklistWarningModal
        show={state.showChecklistWarningModal}
        missingItems={state.missingChecklistItems}
        onGoBack={() => state.setShowChecklistWarningModal(false)}
      />
      <CreateRequestModal
        show={state.showRequestModal}
        submitting={state.submittingRequest}
        editingRequest={state.editingRequest}
        onSubmit={actions.handleCreateRequest}
        onUpdate={actions.handleUpdateRequest}
        onClose={() => { state.setShowRequestModal(false); state.setEditingRequest(null); }}
      />
      <ApproveRequestModal
        show={state.showApprovalModal}
        request={state.approvalRequest}
        submitting={state.submittingApproval}
        onApprove={actions.handleApproveRequest}
        onReject={actions.handleRejectRequest}
        onClose={() => { state.setShowApprovalModal(false); state.setApprovalRequest(null); }}
      />
      <HelperModal
        show={state.showAssignHelperModal}
        techOptions={techOptions}
        selectedHelperId={state.selectedHelperId}
        helperNotes={state.helperNotes}
        assignedTechnicianId={job.assigned_technician_id}
        onSelectedHelperIdChange={state.setSelectedHelperId}
        onHelperNotesChange={state.setHelperNotes}
        onAssign={actions.handleAssignHelper}
        onClose={() => state.setShowAssignHelperModal(false)}
      />
      <DeferredCompletionModal
        show={state.showDeferredModal}
        jobTitle={job.title}
        jobMedia={job.media || []}
        deferredReason={state.deferredReason}
        deferredHourmeter={state.deferredHourmeter}
        selectedEvidenceIds={state.selectedEvidenceIds}
        submitting={state.submittingDeferred}
        onDeferredReasonChange={state.setDeferredReason}
        onDeferredHourmeterChange={state.setDeferredHourmeter}
        onToggleEvidence={(id) => state.setSelectedEvidenceIds(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )}
        onConfirm={actions.handleDeferredCompletion}
        onClose={() => state.setShowDeferredModal(false)}
      />
      <ServiceUpgradeModal
        prompt={state.serviceUpgradePrompt}
        onUpgrade={actions.handleServiceUpgrade}
        onDecline={actions.handleDeclineServiceUpgrade}
        onClose={() => state.setServiceUpgradePrompt(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

export default JobDetailPage;

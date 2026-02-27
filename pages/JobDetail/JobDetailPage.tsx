import { AlertTriangle,ArrowLeft,Camera,Wrench } from 'lucide-react';
import React, { useRef } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { ComboboxOption } from '../../components/Combobox';
import ServiceUpgradeModal from '../../components/ServiceUpgradeModal';
import { SkeletonJobDetail } from '../../components/Skeleton';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { usePartsForList,useTechnicians } from '../../hooks/useQueryHooks';
import { JobRequest,JobStatus,Part,User } from '../../types';

// Extracted components
import {
ApproveRequestModal,
ChecklistWarningModal,
BulkApproveRequestsModal,
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

  // Refs for mobile scroll-to actions
  const photosRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<HTMLDivElement>(null);

  // Derived flags
  const statusFlags = getStatusFlags(job, currentUserId, currentUserRole);
  const roleFlags = getRoleFlags(currentUserRole, state.isCurrentUserHelper, job, statusFlags);

  // Hide sticky action bar when any modal is open (prevents overlap)
  const hasModalOpen =
    state.showTechSigPad || state.showCustSigPad || state.showStartJobModal ||
    state.showFinalizeModal || state.showReassignModal || state.showContinueTomorrowModal ||
    state.showDeleteModal || state.showRejectJobModal || state.showHourmeterAmendmentModal ||
    state.showChecklistWarningModal || state.showRequestModal || state.showApprovalModal ||
    state.showBulkApproveModal || state.showAssignHelperModal || state.showDeferredModal ||
    (state.serviceUpgradePrompt?.show ?? false);

  // Options for comboboxes
  const partOptions: ComboboxOption[] = parts.map(p => {
    const stock = p.stock_quantity ?? 0;
    const stockLabel = stock === 0 ? '⛔ OOS' : stock <= 5 ? `⚠️ ${stock}` : `${stock}`;
    return {
      id: p.part_id, label: p.part_name,
      subLabel: roleFlags.canViewPricing ? `RM${p.sell_price} | Stock: ${stockLabel} | ${p.category}` : `Stock: ${stockLabel} | ${p.category}`
    };
  });
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
    <div className="max-w-5xl mx-auto pb-24 md:pb-8 fade-in">
      {/* Mobile-only sticky status pill — visible while scrolling past header */}
      {roleFlags.isTechnician && (
        <div className="sticky top-[64px] z-20 md:hidden px-4 pt-2 pb-1 pointer-events-none">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-md backdrop-blur-sm bg-[var(--surface)]/90 border border-[var(--border)] text-[var(--text)]`}>
            {job.status}
          </span>
        </div>
      )}
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
          <div ref={partsRef}><PartsSection job={job} roleFlags={roleFlags} statusFlags={statusFlags} partOptions={partOptions}
            selectedPartId={state.selectedPartId} selectedPartPrice={state.selectedPartPrice}
            addPartQuantity={state.addPartQuantity} onAddPartQuantityChange={state.setAddPartQuantity}
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
            vanStockQuantity={state.vanStockQuantity}
            onVanStockQuantityChange={state.setVanStockQuantity}
            onUseVanStockPart={actions.handleUseVanStockPart}
            availableVans={state.availableVans}
            onSelectJobVan={actions.handleSelectJobVan}
            sellSealed={state.sellSealed}
            onSellSealedChange={state.setSellSealed} /></div>
          <ExtraChargesSection job={job} roleFlags={roleFlags} showAddCharge={state.showAddCharge}
            chargeName={state.chargeName} chargeDescription={state.chargeDescription} chargeAmount={state.chargeAmount}
            onShowAddChargeChange={state.setShowAddCharge} onChargeNameChange={state.setChargeName}
            onChargeDescriptionChange={state.setChargeDescription} onChargeAmountChange={state.setChargeAmount}
            onAddCharge={actions.handleAddExtraCharge} onRemoveCharge={actions.handleRemoveExtraCharge} />
          <JobRequestsSection job={job} roleFlags={roleFlags} statusFlags={statusFlags}
            currentUserId={currentUserId}
            onCreateRequest={() => { state.setEditingRequest(null); state.setShowRequestModal(true); }}
            onApproveRequest={(request) => { state.setApprovalRequest(request); state.setShowApprovalModal(true); }}
            onApproveAllRequests={(reqs) => { state.setBulkApproveRequests(reqs); state.setShowBulkApproveModal(true); }}
            onEditRequest={actions.handleEditRequest}
            onIssuePartToTechnician={actions.handleIssuePartToTechnician}
            onMarkOutOfStock={actions.handleMarkOutOfStock}
            onMarkPartReceived={actions.handleMarkPartReceived}
            onConfirmPartCollection={actions.handleConfirmPartCollection} />
          <div ref={photosRef}><JobPhotosSection job={job} currentUserId={currentUserId} currentUserName={currentUserName}
            roleFlags={roleFlags} statusFlags={statusFlags} isCurrentUserHelper={state.isCurrentUserHelper} onJobUpdate={setJob} /></div>
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
      <BulkApproveRequestsModal
        show={state.showBulkApproveModal}
        requests={state.bulkApproveRequests as JobRequest[]}
        submitting={state.submittingApproval}
        onApproveAll={actions.handleBulkApproveRequests}
        onClose={() => { state.setShowBulkApproveModal(false); state.setBulkApproveRequests([]); }}
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

      {(statusFlags.isNew || statusFlags.isAssigned || statusFlags.isInProgress || statusFlags.isCompleted) && (
        <div className={`fixed bottom-16 left-0 right-0 z-30 md:hidden bg-[var(--surface)]/95 backdrop-blur-sm border-t border-[var(--border)] px-4 py-3${hasModalOpen ? ' hidden' : ''}`}>
          <div className="flex flex-col gap-2">
            {(statusFlags.isNew || statusFlags.isAssigned) && (
              <button
                onClick={actions.handleOpenStartJobModal}
                className="w-full bg-[var(--accent)] text-white h-12 rounded-xl font-medium"
              >
                Start Job
              </button>
            )}

            {statusFlags.isInProgress && (
              <>
                {/* Hourmeter quick-input row */}
                {job.forklift && (
                  <div className="flex items-center gap-2 bg-[var(--surface-2)] rounded-xl px-3 py-2">
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
                      Hourmeter {job.hourmeter_reading ? `(current: ${job.hourmeter_reading}h)` : `(last: ${job.forklift.hourmeter || 0}h)`}
                    </span>
                    <input
                      type="number"
                      value={state.hourmeterInput}
                      onChange={e => state.setHourmeterInput(e.target.value)}
                      onFocus={() => { if (!state.hourmeterInput) state.setHourmeterInput((job.hourmeter_reading || job.forklift?.hourmeter || 0).toString()); }}
                      placeholder="Enter reading"
                      className="flex-1 bg-transparent text-[var(--text)] text-sm text-right focus:outline-none min-w-0"
                    />
                    {state.hourmeterInput ? (
                      <button
                        onClick={actions.handleSaveHourmeter}
                        className="text-xs font-semibold text-[var(--accent)] whitespace-nowrap"
                      >
                        Save
                      </button>
                    ) : null}
                  </div>
                )}
                {/* Action buttons row */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => actions.handleStatusChange(JobStatus.AWAITING_FINALIZATION)}
                    className="flex-1 bg-green-600 text-white h-12 rounded-xl font-medium"
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => photosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="w-12 h-12 bg-[var(--surface-2)] rounded-xl flex items-center justify-center"
                    aria-label="Scroll to Photos"
                  >
                    <Camera className="w-5 h-5 text-[var(--text)]" />
                  </button>
                  <button
                    onClick={() => partsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="w-12 h-12 bg-[var(--surface-2)] rounded-xl flex items-center justify-center"
                    aria-label="Scroll to Parts"
                  >
                    <Wrench className="w-5 h-5 text-[var(--text)]" />
                  </button>
                </div>
              </>
            )}

            {statusFlags.isCompleted && (
              <button
                onClick={actions.handlePrintServiceReport}
                className="w-full h-12 rounded-xl font-medium border border-[var(--border)] text-[var(--text)] bg-transparent"
              >
                View Report
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetailPage;

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle,ArrowLeft,Camera,ClipboardList,Clock,FileText,ImageIcon,Package,ShieldCheck } from 'lucide-react';
import React, { useMemo, useRef } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { ComboboxOption } from '../../components/Combobox';
import ServiceUpgradeModal from '../../components/ServiceUpgradeModal';
import { SkeletonJobDetail } from '../../components/Skeleton';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { usePartsForList,useTechnicians } from '../../hooks/useQueryHooks';
import { getCustomerContacts,getCustomerSites } from '../../services/customerService';
import { HourmeterFlagReason,Job,JobRequest,JobStatus,MANDATORY_CHECKLIST_ITEMS,normalizeChecklistState,Part,User } from '../../types';
import { CustomerContact,CustomerSite } from '../../types/customer.types';

// Extracted components
import {
ApproveRequestModal,
ChecklistWarningModal,
BulkApproveRequestsModal,
CollapsibleCard,
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
ReportOptionsModal,
SignaturesCard,
StartJobModal,
MobileTechnicianWorkflowCard,
} from './components';
import { PartsReconciliationModal } from './components/PartsReconciliationModal';

// Extracted hooks
import { useJobActions,useJobData,useJobDetailState } from './hooks';
import { JobDetailProps } from './types';
import { getRoleFlags,getStatusFlags, isChecklistExemptJob, isHourmeterExemptJob } from './utils';

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

  // Fetch PIC and Site for this job's customer
  const { data: customerContacts = [] } = useQuery({
    queryKey: ['customer-contacts', job?.customer_id],
    queryFn: () => getCustomerContacts(job!.customer_id),
    enabled: !!job?.customer_id,
  });
  const { data: customerSites = [] } = useQuery({
    queryKey: ['customer-sites', job?.customer_id],
    queryFn: () => getCustomerSites(job!.customer_id),
    enabled: !!job?.customer_id,
  });
  const jobContact = customerContacts.find((c: CustomerContact) => c.contact_id === job?.contact_id);
  const jobSite = customerSites.find((s: CustomerSite) => s.site_id === job?.site_id);

  // Data loading with real-time
  const { loadJob, loadVanStock } = useJobData({ jobId: id, currentUserId, currentUserRole, state });

  // All actions
  const actions = useJobActions({ state, currentUserId, currentUserName, currentUserRole, technicians, loadJob, loadVanStock });

  // On mobile (< md = 768px), secondary sections collapse by default
  const isDesktopDefault = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;

  // Refs for mobile scroll-to actions
  const photosRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<HTMLDivElement>(null);
  const checklistRef = useRef<HTMLDivElement>(null);
  const signaturesRef = useRef<HTMLDivElement>(null);
  const jobDetailsRef = useRef<HTMLDivElement>(null);

  // Derived flags
  const statusFlags = getStatusFlags(job, currentUserId, currentUserRole);
  const roleFlags = getRoleFlags(currentUserRole, state.isCurrentUserHelper, statusFlags);
  const isMobileTechnicianFlow = roleFlags.isTechnician && !roleFlags.isHelperOnly && !isDesktopDefault;
  // Lead technicians must declare parts usage (either add a part or tick "No parts were used") before completing.
  // Null-safe: this runs BEFORE the `if (!job) return` guard below, so we must handle the null case here too —
  // otherwise navigating to a deleted job (e.g., after the 2026-04-06 purge) crashes before the "Job not found" screen renders.
  // Active parts = not pending_return / returned. Mirrors the DB completion trigger
  // so the "Parts declaration" blocker chip clears once the tech has flagged
  // every wrong-model part for return and either added a real part or ticked
  // "No parts used".
  const activeParts = useMemo(
    () => (job?.parts_used ?? []).filter(
      p => p.return_status !== 'pending_return' && p.return_status !== 'returned'
    ),
    [job?.parts_used],
  );
  const partsDeclared = activeParts.length > 0 || state.noPartsUsed;
  const partsDeclarationRequired = roleFlags.isTechnician && !roleFlags.isHelperOnly && !partsDeclared;
  // HOURMETER_EXEMPT_JOB_TYPES — FTS skips the hourmeter gate so the
  // desktop in-progress banner + Complete button don't perma-disable when
  // hourmeter_reading is 0 (FTS without forklift) or absent.
  // (Repair was removed 2026-04-21 — repaired units have meaningful readings.)
  const hourmeterRequired = !isHourmeterExemptJob(job?.job_type) && !statusFlags.hasHourmeter;
  const completionBlocked = !statusFlags.hasBothSignatures || hourmeterRequired || !statusFlags.hasAfterPhoto || partsDeclarationRequired;

  // Hide sticky action bar when any modal is open (prevents overlap)
  const hasModalOpen =
    state.showStartJobModal ||
    state.showFinalizeModal || state.showReassignModal || state.showContinueTomorrowModal ||
    state.showDeleteModal || state.showRejectJobModal || state.showHourmeterAmendmentModal ||
    state.showChecklistWarningModal || state.showRequestModal || state.showApprovalModal ||
    state.showBulkApproveModal || state.showAssignHelperModal || state.showDeferredModal ||
    state.showReconciliationModal || state.showReportOptionsModal || (state.serviceUpgradePrompt?.show ?? false);

  // Options for comboboxes — memoized so memoized children don't re-render on every parent state tick.
  const partOptions: ComboboxOption[] = useMemo(
    () => parts.map(p => {
      const stock = p.stock_quantity ?? 0;
      const stockLabel = stock === 0 ? '⛔ OOS' : stock <= 5 ? `⚠️ ${stock}` : `${stock}`;
      return {
        id: p.part_id, label: p.part_name,
        subLabel: roleFlags.canViewPricing
          ? `${p.part_code} · RM${(p.sell_price ?? p.cost_price)?.toFixed(2) ?? '0.00'} · Stock: ${stockLabel}`
          : `${p.part_code} · Stock: ${stockLabel}`
      };
    }),
    [parts, roleFlags.canViewPricing],
  );
  const techOptions: ComboboxOption[] = useMemo(
    () => technicians.map(t => ({ id: t.user_id, label: t.name, subLabel: t.email })),
    [technicians],
  );
  const selectedPartIsLiquid = parts.find(p => p.part_id === state.selectedPartId)?.is_liquid ?? false;

  if (loading) return (
    <div className="max-w-7xl mx-auto p-6 fade-in">
      <SkeletonJobDetail />
    </div>
  );

  if (!job) return (
    <div className="max-w-7xl mx-auto p-6 fade-in"><div className="text-center py-20">
      <AlertTriangle className="w-12 h-12 text-[var(--error)] mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-[var(--text)]">Job not found</h2>
      <p className="text-[var(--text-muted)] mt-2">This job may have been deleted or you don't have access.</p>
      <button onClick={() => navigate('/jobs')} className="btn-premium btn-premium-primary mt-4"><ArrowLeft className="w-4 h-4" /> Back to Jobs</button>
    </div></div>
  );

  return (
    <div className={`min-w-0 max-w-7xl mx-auto overflow-x-hidden pb-24 md:pb-8 ${(statusFlags.isInProgress || statusFlags.isCompleted) && !hasModalOpen ? 'pt-16 md:pt-0' : ''} fade-in`}>
      <JobHeader job={job} isRealtimeConnected={true} roleFlags={roleFlags} statusFlags={statusFlags}
        partsDeclarationRequired={partsDeclarationRequired}
        exportingToAutoCount={state.exportingToAutoCount} onAcceptJob={actions.handleAcceptJob}
        onRejectJob={() => state.setShowRejectJobModal(true)} onStartJob={actions.handleOpenStartJobModal}
        onCompleteJob={() => actions.handleStatusChange(JobStatus.AWAITING_FINALIZATION)}
        onContinueTomorrow={() => state.setShowContinueTomorrowModal(true)} onResumeJob={actions.handleResumeJob}
        onCustomerUnavailable={() => state.setShowDeferredModal(true)} onFinalizeInvoice={() => state.setShowFinalizeModal(true)}
        onPrintServiceReport={actions.handlePrintServiceReport} onExportPDF={actions.handleExportPDF}
        onExportToAutoCount={actions.handleExportToAutoCount} onDeleteJob={() => state.setShowDeleteModal(true)}
        onAcknowledgeJob={actions.handleAcknowledgeJob} />

      {isMobileTechnicianFlow && (
        <div className="px-4 pt-4">
          <MobileTechnicianWorkflowCard
            job={job}
            statusFlags={statusFlags}
            partsDeclared={partsDeclared}
            onAcceptJob={actions.handleAcceptJob}
            onRejectJob={() => state.setShowRejectJobModal(true)}
            onStartJob={actions.handleOpenStartJobModal}
            onCompleteJob={() => actions.handleStatusChange(JobStatus.AWAITING_FINALIZATION)}
            onScrollToChecklist={() => checklistRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            onScrollToPhotos={() => photosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            onScrollToSignatures={() => signaturesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            onScrollToParts={() => partsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          />
        </div>
      )}

      <div className="min-w-0 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-2">
        <div className="min-w-0 lg:col-span-2 xl:col-span-3 space-y-5">
          {job.forklift && <EquipmentCard job={job} activeRental={state.activeRental} currentUserId={currentUserId}
            roleFlags={roleFlags} statusFlags={statusFlags} editingHourmeter={state.editingHourmeter}
            hourmeterInput={state.hourmeterInput} onHourmeterInputChange={state.setHourmeterInput}
            onStartEditHourmeter={actions.handleStartEditHourmeter} onSaveHourmeter={actions.handleSaveHourmeter}
            onCancelHourmeterEdit={actions.handleCancelHourmeterEdit} onRequestAmendment={() => state.setShowHourmeterAmendmentModal(true)}
            onSwitchForklift={actions.handleSwitchForklift} />}
          {(statusFlags.isInProgress || statusFlags.isAwaitingFinalization || statusFlags.isCompleted) && <JobTimerCard job={job} />}
          <CustomerAssignmentCard job={job} roleFlags={roleFlags} statusFlags={statusFlags} techOptions={techOptions}
            selectedTechId={state.selectedTechId} isCurrentUserHelper={state.isCurrentUserHelper}
            jobContact={jobContact} jobSite={jobSite}
            editingDescription={state.editingDescription} descriptionInput={state.descriptionInput}
            onDescriptionInputChange={state.setDescriptionInput}
            onStartEditDescription={actions.handleStartEditDescription}
            onSaveDescription={actions.handleSaveDescription}
            onCancelDescriptionEdit={actions.handleCancelDescriptionEdit}
            onSelectedTechIdChange={state.setSelectedTechId} onAssignJob={actions.handleAssignJob}
            onOpenReassignModal={() => state.setShowReassignModal(true)}
            onOpenHelperModal={() => state.setShowAssignHelperModal(true)} onRemoveHelper={actions.handleRemoveHelper}
            onScheduledDateChange={actions.handleScheduledDateChange} />
          <CollapsibleCard
            title="Notes"
            icon={<FileText className="w-5 h-5 text-[var(--text-muted)]" />}
            defaultOpen={isDesktopDefault}
            summary={job.notes && job.notes.length > 0 ? `${job.notes.length} note${job.notes.length !== 1 ? 's' : ''}` : 'No notes'}
          >
            <NotesSection job={job} roleFlags={roleFlags} statusFlags={statusFlags} noteInput={state.noteInput}
              onNoteInputChange={state.setNoteInput} onAddNote={actions.handleAddNote} />
          </CollapsibleCard>
          <div ref={jobDetailsRef}>
            <JobDetailsCard job={job} roleFlags={roleFlags} statusFlags={statusFlags}
              editingJobCarriedOut={state.editingJobCarriedOut} jobCarriedOutInput={state.jobCarriedOutInput}
              recommendationInput={state.recommendationInput} onJobCarriedOutInputChange={state.setJobCarriedOutInput}
              onRecommendationInputChange={state.setRecommendationInput} onStartEdit={actions.handleStartEditJobCarriedOut}
              onSave={actions.handleSaveJobCarriedOut} onCancel={actions.handleCancelJobCarriedOutEdit} />
          </div>
          {isMobileTechnicianFlow && (statusFlags.isInProgress || statusFlags.isAwaitingFinalization) && (
            <div ref={signaturesRef}>
              <SignaturesCard job={job} roleFlags={roleFlags} statusFlags={statusFlags}
                onTechSign={actions.handleTechnicianSwipeSign} onCustomerSign={actions.handleCustomerSwipeSign} />
            </div>
          )}
          {!isChecklistExemptJob(job.job_type) && <div ref={checklistRef}>
          <CollapsibleCard
            title="Condition Checklist"
            icon={<ClipboardList className="w-5 h-5 text-[var(--text-muted)]" />}
            defaultOpen={isDesktopDefault}
            summary={(() => {
              if (!job.condition_checklist) return `0/${MANDATORY_CHECKLIST_ITEMS.length} items checked`;
              const checked = MANDATORY_CHECKLIST_ITEMS.filter(key => {
                const s = normalizeChecklistState(job.condition_checklist?.[key]);
                return s === 'ok' || s === 'not_ok';
              }).length;
              return `${checked}/${MANDATORY_CHECKLIST_ITEMS.length} items checked`;
            })()}
          >
            <ConditionChecklistCard job={job} roleFlags={roleFlags} statusFlags={statusFlags}
              editingChecklist={state.editingChecklist} checklistEditData={state.checklistEditData}
              onStartEdit={actions.handleStartEditChecklist} onSave={actions.handleSaveChecklist}
              onCancel={actions.handleCancelChecklistEdit} onSetItemState={actions.handleSetChecklistItemState}
              onCheckAll={actions.handleCheckAll} />
          </CollapsibleCard>
          </div>}
          <div ref={partsRef}>
          <CollapsibleCard
            title="Parts"
            icon={<Package className="w-5 h-5 text-[var(--text-muted)]" />}
            defaultOpen={isDesktopDefault}
            summary={job.parts_used && job.parts_used.length > 0 ? `${job.parts_used.length} part${job.parts_used.length !== 1 ? 's' : ''} used` : 'No parts used'}
          >
          <PartsSection job={job} roleFlags={roleFlags} statusFlags={statusFlags} partOptions={partOptions}
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
            onSellSealedChange={state.setSellSealed}
            selectedPartIsLiquid={selectedPartIsLiquid}
            currentUserId={currentUserId}
            onPartReturnUpdated={(updated) => setJob({
              ...job,
              parts_used: (job.parts_used || []).map(p => p.job_part_id === updated.job_part_id ? { ...p, ...updated } : p),
            })} />
          </CollapsibleCard>
          </div>
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
            onDeleteRequest={actions.handleDeleteRequest}
            onIssuePartToTechnician={actions.handleIssuePartToTechnician}
            onMarkOutOfStock={actions.handleMarkOutOfStock}
            onMarkPartReceived={actions.handleMarkPartReceived}
            onConfirmPartCollection={actions.handleConfirmPartCollection} />
          <div ref={photosRef}>
          <CollapsibleCard
            title="Photos"
            icon={<ImageIcon className="w-5 h-5 text-[var(--text-muted)]" />}
            defaultOpen={currentUserRole === 'technician' || isDesktopDefault}
            summary={job.media && job.media.length > 0 ? `${job.media.length} photo${job.media.length !== 1 ? 's' : ''}` : 'No photos'}
          >
            <JobPhotosSection job={job} currentUserId={currentUserId} currentUserName={currentUserName}
              roleFlags={roleFlags} statusFlags={statusFlags} isCurrentUserHelper={state.isCurrentUserHelper} onJobUpdate={setJob} />
          </CollapsibleCard>
          </div>
        </div>
        <div className="min-w-0 space-y-5">
          <FinancialSummary job={job} roleFlags={roleFlags} editingLabor={state.editingLabor} laborCostInput={state.laborCostInput}
            onLaborInputChange={state.setLaborCostInput} onStartEditLabor={actions.handleStartEditLabor}
            onSaveLabor={actions.handleSaveLabor} onCancelLaborEdit={actions.handleCancelLaborEdit} />
          <CollapsibleCard
            title="Confirmation Status"
            icon={<ShieldCheck className="w-5 h-5 text-[var(--text-muted)]" />}
            defaultOpen={isDesktopDefault}
            summary={job.parts_confirmed_at ? 'Confirmed' : 'Pending'}
          >
            <ConfirmationStatusCard job={job} roleFlags={roleFlags} statusFlags={statusFlags}
              onConfirmParts={actions.handleConfirmParts}
              onOpenReconciliation={() => state.setShowReconciliationModal(true)} />
          </CollapsibleCard>
          <CollapsibleCard
            title="Timeline"
            icon={<Clock className="w-5 h-5 text-[var(--text-muted)]" />}
            defaultOpen={isDesktopDefault}
            summary={`${(job as Job & { status_history?: unknown[] }).status_history?.length || 0} events`}
          >
            <JobTimeline job={job} />
          </CollapsibleCard>
          {(!isMobileTechnicianFlow || (!statusFlags.isInProgress && !statusFlags.isAwaitingFinalization)) && (
            <div ref={signaturesRef}>
              <SignaturesCard job={job} roleFlags={roleFlags} statusFlags={statusFlags}
                onTechSign={actions.handleTechnicianSwipeSign} onCustomerSign={actions.handleCustomerSwipeSign} />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <StartJobModal show={state.showStartJobModal} startJobHourmeter={state.startJobHourmeter}
        lastRecordedHourmeter={job?.forklift?.hourmeter || 0} conditionChecklist={state.conditionChecklist}
        beforePhotos={state.beforePhotos}
        isRepairJob={isChecklistExemptJob(job?.job_type)}
        skipHourmeter={isHourmeterExemptJob(job?.job_type)}
        brokenMeterNote={state.brokenMeterNote}
        onHourmeterChange={state.setStartJobHourmeter}
        onBrokenMeterNoteChange={state.setBrokenMeterNote}
        onChecklistToggle={actions.handleChecklistToggle}
        onCheckAll={actions.handleConditionCheckAll} onUncheckAll={actions.handleConditionUncheckAll}
        onAddPhotos={(files) => state.setBeforePhotos(prev => [...prev, ...files])}
        onRemovePhoto={(index) => state.setBeforePhotos(prev => prev.filter((_, i) => i !== index))}
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
        photoFile={state.rejectionPhotoFile}
        photoPreviewUrl={state.rejectionPhotoPreviewUrl}
        onPhotoChange={(f) => {
          if (state.rejectionPhotoPreviewUrl) URL.revokeObjectURL(state.rejectionPhotoPreviewUrl);
          state.setRejectionPhotoFile(f);
          state.setRejectionPhotoPreviewUrl(f ? URL.createObjectURL(f) : '');
        }}
        uploading={state.rejectionUploading}
        onConfirm={actions.handleRejectJob}
        onClose={() => {
          if (state.rejectionPhotoPreviewUrl) URL.revokeObjectURL(state.rejectionPhotoPreviewUrl);
          state.setShowRejectJobModal(false);
          state.setRejectJobReason('');
          state.setRejectionPhotoFile(null);
          state.setRejectionPhotoPreviewUrl('');
        }} />
      <ReportOptionsModal
        show={state.showReportOptionsModal}
        onSelect={actions.handleConfirmPrintServiceReport}
        onClose={() => state.setShowReportOptionsModal(false)}
      />
      {state.showHourmeterAmendmentModal && job.forklift && (
        <HourmeterAmendmentModal job={job} previousReading={job.forklift.hourmeter || 0}
          flagReasons={(job.hourmeter_flag_reasons || state.hourmeterFlagReasons) as HourmeterFlagReason[]}
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
      <PartsReconciliationModal
        show={state.showReconciliationModal}
        // Exclude tech-returned rows — they're already accounted for via the
        // separate confirm_part_return RPC + inventory_movements row, so the
        // Admin 2 reconciliation flow shouldn't see them and risk double-restock.
        parts={(job.parts_used || []).filter(
          p => p.return_status !== 'pending_return' && p.return_status !== 'returned'
        )}
        submitting={state.submittingReconciliation}
        onConfirm={async (entries, notes) => {
          state.setSubmittingReconciliation(true);
          await actions.handleReconcileParts(entries, notes);
          state.setSubmittingReconciliation(false);
          state.setShowReconciliationModal(false);
        }}
        onClose={() => state.setShowReconciliationModal(false)}
      />
      <ServiceUpgradeModal
        prompt={state.serviceUpgradePrompt}
        onUpgrade={actions.handleServiceUpgrade}
        onDecline={actions.handleDeclineServiceUpgrade}
        onClose={() => state.setServiceUpgradePrompt(prev => ({ ...prev, show: false }))}
      />

      {(statusFlags.isInProgress || statusFlags.isCompleted) && (
        <div className={`fixed top-16 left-0 right-0 z-30 md:hidden bg-[var(--surface)] border-b border-[var(--border)] px-4 py-3${hasModalOpen ? ' hidden' : ''}`}>
          <div className="flex flex-col gap-2">
            {statusFlags.isInProgress && (
              <>
                {completionBlocked && (
                  <div className="flex flex-wrap gap-2">
                    {!statusFlags.hasAfterPhoto && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">After photo needed</span>
                    )}
                    {!statusFlags.hasBothSignatures && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">Signatures missing</span>
                    )}
                    {hourmeterRequired && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">Hourmeter needed</span>
                    )}
                    {partsDeclarationRequired && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-700">Parts declaration required</span>
                    )}
                  </div>
                )}
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
                    disabled={completionBlocked}
                    className={`flex-1 h-12 rounded-xl font-medium ${completionBlocked ? 'bg-slate-200 text-slate-500' : 'bg-green-600 text-white'}`}
                  >
                    {completionBlocked ? 'Finish Requirements' : 'Complete'}
                  </button>
                  <button
                    onClick={() => photosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="w-12 h-12 bg-[var(--surface-2)] rounded-xl flex items-center justify-center"
                    aria-label="Scroll to Photos"
                  >
                    <Camera className="w-5 h-5 text-[var(--text)]" />
                  </button>
                  <button
                    onClick={() => {
                      actions.handleStartEditJobCarriedOut();
                      setTimeout(() => jobDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                    }}
                    className="w-12 h-12 bg-[var(--surface-2)] rounded-xl flex items-center justify-center"
                    aria-label="Edit Job Details"
                  >
                    <ClipboardList className="w-5 h-5 text-[var(--text)]" />
                  </button>
                </div>
              </>
            )}

            {statusFlags.isCompleted && !roleFlags.isTechnician && (
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

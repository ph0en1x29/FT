import {
ArrowLeft,CheckCircle,
Clock,
FileCheck,
FileDown,
Play,
Send,
Trash2,
XCircle,
Zap
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SlotInSLABadge from '../../../components/SlotInSLABadge';
import { Job,JobPriority,JobType } from '../../../types';
import { RoleFlags,StatusFlags } from '../types';
import { getResponseTimeRemaining,getStatusBadgeClass } from '../utils';

interface JobHeaderProps {
  job: Job;
  isRealtimeConnected: boolean;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  exportingToAutoCount: boolean;
  // Action handlers
  onAcceptJob: () => void;
  onRejectJob: () => void;
  onStartJob: () => void;
  onCompleteJob: () => void;
  onContinueTomorrow: () => void;
  onResumeJob: () => void;
  onCustomerUnavailable: () => void;
  onFinalizeInvoice: () => void;
  onPrintServiceReport: () => void;
  onExportPDF: () => void;
  onExportToAutoCount: () => void;
  onDeleteJob: () => void;
  onAcknowledgeJob: () => void;
}

export const JobHeader: React.FC<JobHeaderProps> = ({
  job,
  isRealtimeConnected,
  roleFlags,
  statusFlags,
  exportingToAutoCount,
  onAcceptJob,
  onRejectJob,
  onStartJob,
  onCompleteJob,
  onContinueTomorrow,
  onResumeJob,
  onCustomerUnavailable,
  onFinalizeInvoice,
  onPrintServiceReport,
  onExportPDF,
  onExportToAutoCount,
  onDeleteJob,
  onAcknowledgeJob,
}) => {
  const navigate = useNavigate();
  const {
    isAdmin, isSupervisor, isTechnician, isAccountant, isHelperOnly
  } = roleFlags;
  
  const {
    isAssigned, isInProgress, isAwaitingFinalization, isCompleted,
    isIncompleteContinuing, hasBothSignatures, hasHourmeter, hasAfterPhoto, isSlotIn, isSlotInPendingAck,
    isAssignedToCurrentUser, needsAcceptance, hasAccepted, isAwaitingAck, isDisputed
  } = statusFlags;

  return (
    <div className="bg-[var(--surface)] border-b border-[var(--border)] -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 sticky top-0 z-30 shadow-premium-xs">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 h-12 w-12 md:h-auto md:w-auto flex items-center justify-center hover:bg-[var(--bg-subtle)] rounded-lg transition-colors mt-0.5 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-semibold text-[var(--text)] truncate">{job.title}</h1>
              {/* Real-time connection indicator */}
              <span 
                className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-gray-400'}`}
                title={isRealtimeConnected ? 'Live updates active' : 'Connecting...'}
              />
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`badge ${getStatusBadgeClass(statusFlags)}`}>{job.status}</span>
              {job.job_type && (
                <span className={`badge ${
                  job.job_type === JobType.SLOT_IN ? 'badge-error' :
                  job.job_type === JobType.COURIER ? 'bg-cyan-100 text-cyan-700' :
                  job.job_type === JobType.REPAIR ? 'badge-warning' :
                  job.job_type === JobType.CHECKING ? 'bg-purple-100 text-purple-700' :
                  'badge-success'
                }`}>{job.job_type}</span>
              )}
              {job.priority === JobPriority.EMERGENCY && (
                <span className="badge badge-error">Emergency</span>
              )}
              {statusFlags.isEscalated && (
                <span className="badge badge-error animate-pulse">⚠️ Escalated</span>
              )}
              {statusFlags.isOvertime && (
                <span className="badge bg-purple-100 text-purple-700">OT Job</span>
              )}
              {/* Slot-In SLA Badge */}
              {isSlotIn && (
                <SlotInSLABadge
                  createdAt={job.created_at}
                  acknowledgedAt={job.acknowledged_at}
                  slaTargetMinutes={job.sla_target_minutes || 15}
                  size="sm"
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-start md:justify-end overflow-x-auto [&>button]:min-h-[48px] [&>button]:md:min-h-0 [&>div>button]:min-h-[48px] [&>div>button]:md:min-h-0">
          {/* Acknowledge Slot-In Job Button */}
          {isSlotInPendingAck && (isAssigned || isInProgress) && (isAssignedToCurrentUser || isAdmin || isSupervisor) && (
            <button
              onClick={onAcknowledgeJob}
              className="btn-premium bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              <Zap className="w-4 h-4" /> Acknowledge
            </button>
          )}
          
          {/* Technician Accept/Reject buttons (before they can start) */}
          {isTechnician && isAssigned && !isHelperOnly && needsAcceptance && (
            <>
              <button onClick={onAcceptJob} className="btn-premium btn-premium-primary">
                <CheckCircle className="w-4 h-4" /> Accept Job
              </button>
              <button onClick={onRejectJob} className="btn-premium bg-[var(--error)] text-white hover:opacity-90">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              {job?.technician_response_deadline && (
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {getResponseTimeRemaining(job)}
                </span>
              )}
            </>
          )}
          
          {/* Start Job button - only after technician accepts (or for admin/supervisor) */}
          {((isTechnician && isAssigned && !isHelperOnly && hasAccepted) || 
            ((isAdmin || isSupervisor) && isAssigned && !isHelperOnly)) && (
            <button onClick={onStartJob} className="btn-premium btn-premium-primary">
              <Play className="w-4 h-4" /> Start Job
            </button>
          )}
          
          {(isTechnician || isAdmin || isSupervisor) && isInProgress && !isHelperOnly && (
            <div className="relative group">
              <button 
                onClick={onCompleteJob} 
                disabled={!hasBothSignatures || !hasHourmeter || !hasAfterPhoto}
                className={`btn-premium ${hasBothSignatures && hasHourmeter && hasAfterPhoto ? 'btn-premium-primary' : 'btn-premium-secondary opacity-60 cursor-not-allowed'}`}
              >
                <CheckCircle className="w-4 h-4" /> Complete
              </button>
              {(!hasBothSignatures || !hasHourmeter || !hasAfterPhoto) && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--text)] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  {!hasAfterPhoto ? '"After" photo required' : !hasHourmeter ? 'Hourmeter reading required' : 'Both signatures required'}
                </div>
              )}
            </div>
          )}
          
          {(isTechnician || isAdmin || isSupervisor) && isInProgress && !isHelperOnly && (
            <button onClick={onContinueTomorrow} className="btn-premium btn-premium-secondary">
              <Clock className="w-4 h-4" /> Continue Tomorrow
            </button>
          )}
          
          {(isTechnician || isAdmin || isSupervisor) && isIncompleteContinuing && !isHelperOnly && (
            <button onClick={onResumeJob} className="btn-premium btn-premium-primary">
              <Play className="w-4 h-4" /> Resume Job
            </button>
          )}
          
          {(isTechnician || isAdmin || isSupervisor) && isInProgress && !isHelperOnly && job.technician_signature && !job.customer_signature && (
            <button
              onClick={onCustomerUnavailable}
              className="btn-premium btn-premium-secondary border-[var(--warning)] text-[var(--warning)] hover:bg-[var(--warning-bg)] hover:border-[var(--warning)] hover:text-[var(--warning)]"
            >
              <CheckCircle className="w-4 h-4" /> Customer Unavailable
            </button>
          )}
          
          {(isAccountant || isAdmin) && isAwaitingFinalization && (
            <button onClick={onFinalizeInvoice} className="btn-premium btn-premium-primary">
              Finalize Invoice
            </button>
          )}
          
          {(isTechnician || isAdmin || isSupervisor) && (isInProgress || isAwaitingFinalization || isCompleted || isAwaitingAck || isDisputed) && (
            <button onClick={onPrintServiceReport} className="btn-premium btn-premium-secondary">
              <FileCheck className="w-4 h-4" /> Report
            </button>
          )}
          
          {(isAccountant || isAdmin) && (isAwaitingFinalization || isCompleted) && (
            <button onClick={onExportPDF} className="btn-premium btn-premium-secondary">
              <FileDown className="w-4 h-4" /> Invoice
            </button>
          )}
          
          {(isAccountant || isAdmin) && isCompleted && (
            <button
              onClick={onExportToAutoCount}
              disabled={exportingToAutoCount}
              className="btn-premium btn-premium-secondary"
              title="Export to AutoCount"
            >
              <Send className="w-4 h-4" /> {exportingToAutoCount ? 'Exporting...' : 'AutoCount'}
            </button>
          )}
          
          {(isAdmin || isSupervisor) && !isCompleted && (
            <button onClick={onDeleteJob} className="btn-premium btn-premium-ghost text-[var(--error)] hover:bg-[var(--error-bg)] hover:text-[var(--error)]">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

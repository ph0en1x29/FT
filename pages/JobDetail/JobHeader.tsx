/**
 * JobHeader - Title, status badges, and action buttons
 */

import React, { useState } from 'react';
import {
  ArrowLeft, Play, CheckCircle, Clock, XCircle, Trash2, FileCheck, FileDown, Send, Zap
} from 'lucide-react';
import { JobStatus, JobType, JobPriority } from '../../types';
import SlotInSLABadge from '../../components/SlotInSLABadge';
import { useJobDetail } from './JobDetailContext';
import { useJobActions } from './hooks/useJobActions';
import { useJobComputed } from './hooks/useJobComputed';

interface JobHeaderProps {
  onShowFinalizeModal: () => void;
  onShowDeleteModal: () => void;
  onShowStartJobModal: () => void;
  onShowContinueTomorrowModal: () => void;
  onShowDeferredModal: () => void;
  onShowRejectJobModal: () => void;
  exportingToAutoCount: boolean;
  setExportingToAutoCount: (v: boolean) => void;
}

export const JobHeader: React.FC<JobHeaderProps> = ({
  onShowFinalizeModal,
  onShowDeleteModal,
  onShowStartJobModal,
  onShowContinueTomorrowModal,
  onShowDeferredModal,
  onShowRejectJobModal,
  exportingToAutoCount,
  setExportingToAutoCount,
}) => {
  const { job, isRealtimeConnected, navigate } = useJobDetail();
  const { roleFlags, statusFlags, statusBadgeClass, responseTimeRemaining } = useJobComputed();
  const actions = useJobActions();

  if (!job) return null;

  const {
    isAdmin, isSupervisor, isTechnician, isAccountant, isHelperOnly
  } = roleFlags;

  const {
    isNew, isAssigned, isInProgress, isAwaitingFinalization, isCompleted,
    isIncompleteContinuing, isAwaitingAck, isDisputed, isEscalated, isOvertime,
    isSlotIn, isSlotInPendingAck, isAssignedToCurrentUser, needsAcceptance, hasAccepted, hasBothSignatures
  } = statusFlags;

  const handleExportToAutoCount = async () => {
    setExportingToAutoCount(true);
    await actions.handleExportToAutoCount();
    setExportingToAutoCount(false);
  };

  return (
    <div className="bg-[var(--surface)] border-b border-[var(--border)] -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 sticky top-0 z-30 shadow-premium-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg transition-colors mt-0.5"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--text)]">{job.title}</h1>
              <span 
                className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-gray-400'}`}
                title={isRealtimeConnected ? 'Live updates active' : 'Connecting...'}
              />
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`badge ${statusBadgeClass}`}>{job.status}</span>
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
              {isEscalated && (
                <span className="badge badge-error animate-pulse">⚠️ Escalated</span>
              )}
              {isOvertime && (
                <span className="badge bg-purple-100 text-purple-700">OT Job</span>
              )}
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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Acknowledge Slot-In Job Button */}
          {isSlotInPendingAck && (isAssigned || isInProgress) && (isAssignedToCurrentUser || isAdmin || isSupervisor) && (
            <button
              onClick={actions.handleAcknowledgeJob}
              className="btn-premium bg-red-600 hover:bg-red-700 text-white border-red-600"
            >
              <Zap className="w-4 h-4" /> Acknowledge
            </button>
          )}
          
          {/* Technician Accept/Reject buttons */}
          {isTechnician && isAssigned && !isHelperOnly && needsAcceptance && (
            <>
              <button onClick={actions.handleAcceptJob} className="btn-premium btn-premium-primary">
                <CheckCircle className="w-4 h-4" /> Accept Job
              </button>
              <button onClick={onShowRejectJobModal} className="btn-premium bg-[var(--error)] text-white hover:opacity-90">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              {job.technician_response_deadline && (
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {responseTimeRemaining}
                </span>
              )}
            </>
          )}
          
          {/* Start Job button */}
          {((isTechnician && isAssigned && !isHelperOnly && hasAccepted) || 
            ((isAdmin || isSupervisor) && isAssigned && !isHelperOnly)) && (
            <button onClick={onShowStartJobModal} className="btn-premium btn-premium-primary">
              <Play className="w-4 h-4" /> Start Job
            </button>
          )}
          
          {/* Complete button */}
          {(isTechnician || isAdmin || isSupervisor) && isInProgress && !isHelperOnly && (
            <div className="relative group">
              <button 
                onClick={() => actions.handleStatusChange(JobStatus.AWAITING_FINALIZATION)} 
                disabled={!hasBothSignatures}
                className={`btn-premium ${hasBothSignatures ? 'btn-premium-primary' : 'btn-premium-secondary opacity-60 cursor-not-allowed'}`}
              >
                <CheckCircle className="w-4 h-4" /> Complete
              </button>
              {!hasBothSignatures && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--text)] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  Both signatures required
                </div>
              )}
            </div>
          )}
          
          {/* Continue Tomorrow */}
          {(isTechnician || isAdmin || isSupervisor) && isInProgress && !isHelperOnly && (
            <button onClick={onShowContinueTomorrowModal} className="btn-premium btn-premium-secondary">
              <Clock className="w-4 h-4" /> Continue Tomorrow
            </button>
          )}
          
          {/* Resume Job */}
          {(isTechnician || isAdmin || isSupervisor) && isIncompleteContinuing && !isHelperOnly && (
            <button onClick={actions.handleResumeJob} className="btn-premium btn-premium-primary">
              <Play className="w-4 h-4" /> Resume Job
            </button>
          )}
          
          {/* Customer Unavailable */}
          {(isTechnician || isAdmin || isSupervisor) && isInProgress && !isHelperOnly && job.technician_signature && !job.customer_signature && (
            <button
              onClick={onShowDeferredModal}
              className="btn-premium btn-premium-secondary border-[var(--warning)] text-[var(--warning)] hover:bg-[var(--warning-bg)] hover:border-[var(--warning)] hover:text-[var(--warning)]"
            >
              <CheckCircle className="w-4 h-4" /> Customer Unavailable
            </button>
          )}
          
          {/* Finalize Invoice */}
          {(isAccountant || isAdmin) && isAwaitingFinalization && (
            <button onClick={onShowFinalizeModal} className="btn-premium btn-premium-primary">
              Finalize Invoice
            </button>
          )}
          
          {/* Service Report */}
          {(isTechnician || isAdmin || isSupervisor) && (isInProgress || isAwaitingFinalization || isCompleted || isAwaitingAck || isDisputed) && (
            <button onClick={actions.handlePrintServiceReport} className="btn-premium btn-premium-secondary">
              <FileCheck className="w-4 h-4" /> Report
            </button>
          )}
          
          {/* Invoice PDF */}
          {(isAccountant || isAdmin) && (isAwaitingFinalization || isCompleted) && (
            <button onClick={actions.handleExportPDF} className="btn-premium btn-premium-secondary">
              <FileDown className="w-4 h-4" /> Invoice
            </button>
          )}
          
          {/* AutoCount Export */}
          {(isAccountant || isAdmin) && isCompleted && (
            <button
              onClick={handleExportToAutoCount}
              disabled={exportingToAutoCount}
              className="btn-premium btn-premium-secondary"
              title="Export to AutoCount"
            >
              <Send className="w-4 h-4" /> {exportingToAutoCount ? 'Exporting...' : 'AutoCount'}
            </button>
          )}
          
          {/* Delete */}
          {(isAdmin || isSupervisor) && !isCompleted && (
            <button onClick={onShowDeleteModal} className="btn-premium btn-premium-ghost text-[var(--error)] hover:bg-[var(--error-bg)] hover:text-[var(--error)]">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobHeader;

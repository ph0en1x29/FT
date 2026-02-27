import { CheckCircle,CheckSquare,ClipboardList,Edit2,X } from 'lucide-react';
import React from 'react';
import { ForkliftConditionChecklist,Job,MANDATORY_CHECKLIST_ITEMS,normalizeChecklistState } from '../../../types';
import { CHECKLIST_CATEGORIES } from '../constants';
import { RoleFlags,StatusFlags } from '../types';

interface ConditionChecklistCardProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  editingChecklist: boolean;
  checklistEditData: ForkliftConditionChecklist;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onSetItemState: (key: string, state: 'ok' | 'not_ok' | undefined) => void;
  onCheckAll: () => void;
}

const isMandatoryItem = (key: string): boolean => {
  return MANDATORY_CHECKLIST_ITEMS.includes(key as keyof ForkliftConditionChecklist);
};

export const ConditionChecklistCard: React.FC<ConditionChecklistCardProps> = ({
  job,
  roleFlags,
  statusFlags,
  editingChecklist,
  checklistEditData,
  onStartEdit,
  onSave,
  onCancel,
  onSetItemState,
  onCheckAll,
}) => {
  const { isTechnician, isAdmin, isSupervisor, isHelperOnly } = roleFlags;
  const { isInProgress, isAwaitingFinalization } = statusFlags;

  // Only show for tech/admin/supervisor when job is in progress or has checklist data
  const shouldShow = (isTechnician || isAdmin || isSupervisor) && 
    (isInProgress || isAwaitingFinalization || (job.condition_checklist && Object.keys(job.condition_checklist).length > 0));

  if (!shouldShow) return null;

  // Calculate progress
  const getChecklistProgress = () => {
    if (!job?.condition_checklist) return { checked: 0, total: MANDATORY_CHECKLIST_ITEMS.length };
    const checklist = job.condition_checklist;
    const checked = MANDATORY_CHECKLIST_ITEMS.filter(key => {
      const state = normalizeChecklistState(checklist[key]);
      return state === 'ok' || state === 'not_ok';
    }).length;
    return { checked, total: MANDATORY_CHECKLIST_ITEMS.length };
  };

  const progress = getChecklistProgress();

  return (
    <div className="card-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text)]">Condition Checklist</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {progress.checked}/{progress.total} mandatory items checked
            </p>
          </div>
        </div>
        {(isInProgress || isAwaitingFinalization) && !editingChecklist && !isHelperOnly && (
          <button onClick={onStartEdit} className="btn-premium btn-premium-ghost text-xs">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {editingChecklist ? (
        <div className="space-y-4">
          {/* Check All Button */}
          <div className="flex justify-end">
            <button onClick={onCheckAll} className="btn-premium btn-premium-secondary text-xs">
              <CheckSquare className="w-3.5 h-3.5" /> Check All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {CHECKLIST_CATEGORIES.map(cat => (
              <div key={cat.name} className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl">
                <p className="font-medium text-[var(--text-secondary)] text-xs mb-2">{cat.name}</p>
                <div className="space-y-2">
                  {cat.items.map(item => {
                    const itemState = normalizeChecklistState(checklistEditData[item.key as keyof ForkliftConditionChecklist]);
                    return (
                      <div key={item.key} className="flex items-center justify-between flex-wrap gap-1 py-1">
                        <span className={`text-xs flex-1 min-w-0 break-words ${
                          itemState === 'ok' ? 'text-[var(--success)]' :
                          itemState === 'not_ok' ? 'text-[var(--error)]' :
                          'text-[var(--text-muted)]'
                        }`}>
                          {item.label}
                          {isMandatoryItem(item.key) && <span className="text-red-500 ml-0.5">*</span>}
                        </span>
                        <div className="shrink-0 flex gap-1">
                          <button
                            type="button"
                            onClick={() => onSetItemState(item.key, 'ok')}
                            className={`p-1.5 min-h-[36px] min-w-[36px] rounded text-xs transition-colors flex items-center justify-center ${
                              itemState === 'ok'
                                ? 'bg-[var(--success)] text-white'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--success-bg)] hover:text-[var(--success)]'
                            }`}
                            title="Good"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onSetItemState(item.key, 'not_ok')}
                            className={`p-1.5 min-h-[36px] min-w-[36px] rounded text-xs transition-colors flex items-center justify-center ${
                              itemState === 'not_ok'
                                ? 'bg-[var(--error)] text-white'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--error-bg)] hover:text-[var(--error)]'
                            }`}
                            title="Needs Attention"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onSave} className="btn-premium btn-premium-primary flex-1">Save</button>
            <button onClick={onCancel} className="btn-premium btn-premium-secondary">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {/* Show empty state with Start button if no checklist data */}
          {(!job.condition_checklist || Object.keys(job.condition_checklist).length === 0) ? (
            <div className="text-center py-6">
              <ClipboardList className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
              <p className="text-[var(--text-muted)] text-sm mb-4">
                Condition checklist not started yet.
                <br />
                <span className="text-xs">All mandatory items must be checked before completing the job.</span>
              </p>
              {(isInProgress || isAwaitingFinalization) && !isHelperOnly && (
                <button onClick={onStartEdit} className="btn-premium btn-premium-primary">
                  <ClipboardList className="w-4 h-4" /> Start Checklist
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {CHECKLIST_CATEGORIES.map(cat => {
                const checkedItems = cat.items.filter(item => {
                  const state = normalizeChecklistState(job.condition_checklist?.[item.key as keyof ForkliftConditionChecklist]);
                  return state === 'ok' || state === 'not_ok';
                });
                if (checkedItems.length === 0) return null;
                return (
                  <div key={cat.name} className="bg-[var(--surface)] border border-[var(--border)] p-2 rounded-lg">
                    <p className="font-medium text-[var(--text-secondary)] text-[10px] uppercase tracking-wide mb-1">{cat.name}</p>
                    {checkedItems.map(item => {
                      const state = normalizeChecklistState(job.condition_checklist?.[item.key as keyof ForkliftConditionChecklist]);
                      return (
                        <div key={item.key} className={`flex items-center gap-1 text-xs ${
                          state === 'ok' ? 'text-[var(--success)]' : 'text-[var(--error)]'
                        }`}>
                          {state === 'ok' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

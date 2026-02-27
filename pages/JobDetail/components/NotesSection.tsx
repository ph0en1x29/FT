import { PenTool } from 'lucide-react';
import React from 'react';
import { Job } from '../../../types';
import { RoleFlags,StatusFlags } from '../types';

interface NotesSectionProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  noteInput: string;
  onNoteInputChange: (value: string) => void;
  onAddNote: () => void;
}

export const NotesSection: React.FC<NotesSectionProps> = ({
  job,
  roleFlags,
  statusFlags,
  noteInput,
  onNoteInputChange,
  onAddNote,
}) => {
  // Only show notes to technicians, admins, and supervisors
  if (!(roleFlags.isTechnician || roleFlags.isAdmin || roleFlags.isSupervisor)) {
    return null;
  }

  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
          <PenTool className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <h3 className="font-semibold text-[var(--text)]">Notes</h3>
      </div>
      
      <div className="max-h-40 overflow-y-auto space-y-2 mb-4 scrollbar-premium">
        {job.notes.map((note, idx) => (
          <div key={idx} className="p-3 bg-[var(--bg-subtle)] rounded-xl border-l-2 border-[var(--accent)] text-sm text-[var(--text-secondary)]">
            {note}
          </div>
        ))}
        {job.notes.length === 0 && (
          <p className="text-[var(--text-muted)] italic text-sm">No notes yet.</p>
        )}
      </div>

      {(statusFlags.isAssigned || statusFlags.isInProgress || statusFlags.isAwaitingFinalization || statusFlags.isCompleted) && !roleFlags.isHelperOnly && (
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Add a note..." 
            className="input-premium flex-1" 
            value={noteInput} 
            onChange={(e) => onNoteInputChange(e.target.value)} 
          />
          <button onClick={onAddNote} className="btn-premium btn-premium-primary">Add</button>
        </div>
      )}
    </div>
  );
};

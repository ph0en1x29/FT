import React from 'react';
import { BrainCircuit } from 'lucide-react';

interface AIAssistantCardProps {
  aiSummary: string;
  generatingAi: boolean;
  onGenerateSummary: () => void;
}

export const AIAssistantCard: React.FC<AIAssistantCardProps> = ({
  aiSummary,
  generatingAi,
  onGenerateSummary,
}) => {
  return (
    <div className="card-premium card-tint-info p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--info-bg)] flex items-center justify-center">
          <BrainCircuit className="w-5 h-5 text-[var(--info)]" />
        </div>
        <h3 className="font-semibold text-[var(--text)]">AI Assistant</h3>
      </div>
      
      {aiSummary ? (
        <div className="bg-[var(--surface)] p-3 rounded-xl text-sm text-[var(--text-secondary)] italic border border-[var(--border)]">
          "{aiSummary}"
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)] mb-3">Generate a professional job summary.</p>
          <button 
            onClick={onGenerateSummary} 
            disabled={generatingAi} 
            className="btn-premium btn-premium-secondary w-full text-xs disabled:opacity-50"
          >
            {generatingAi ? 'Thinking...' : 'Generate Summary'}
          </button>
        </>
      )}
    </div>
  );
};

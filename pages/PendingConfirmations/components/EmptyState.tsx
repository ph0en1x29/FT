import React from 'react';
import { CheckCircle } from 'lucide-react';
import { TabType } from '../types';

interface EmptyStateProps {
  activeTab: TabType;
}

export function EmptyState({ activeTab }: EmptyStateProps) {
  return (
    <div className="card-theme p-8 rounded-xl text-center">
      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-theme">All Caught Up!</h3>
      <p className="text-theme-muted text-sm mt-1">
        No {activeTab === 'parts' ? 'parts confirmations' : 'job confirmations'} pending.
      </p>
    </div>
  );
}

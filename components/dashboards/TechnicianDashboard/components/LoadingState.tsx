import React from 'react';

/**
 * Loading state component for the dashboard
 */
export const LoadingState: React.FC = () => {
  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--text-muted)]">Loading your dashboard...</p>
        </div>
      </div>
    </div>
  );
};

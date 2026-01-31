import React from 'react';

/**
 * Loading spinner displayed while jobs are being fetched
 */
export const LoadingState: React.FC = () => {
  return (
    <div className="text-center py-12 text-theme-muted">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
      <p>Loading jobs...</p>
    </div>
  );
};

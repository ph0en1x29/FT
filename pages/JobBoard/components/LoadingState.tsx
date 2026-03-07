import React from 'react';
import { SkeletonJobCard, Skeleton } from '../../../components/Skeleton';

/**
 * Loading spinner displayed while jobs are being fetched
 */
export const LoadingState: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <Skeleton variant="text" width="45%" height={12} className="mb-3" />
            <Skeleton variant="text" width="35%" height={28} className="mb-2" />
            <Skeleton variant="text" width="55%" height={12} />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <Skeleton variant="rounded" height={48} className="mb-3" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} variant="rounded" width={96} height={30} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <SkeletonJobCard key={index} />
        ))}
      </div>
    </div>
  );
};

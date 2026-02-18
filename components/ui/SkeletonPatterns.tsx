import React from 'react';

export const JobCardSkeleton: React.FC = () => (
  <div className="card-theme rounded-xl p-4 animate-pulse">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 space-y-2">
        <div className="h-5 w-2/3 rounded bg-[var(--surface-2)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--surface-2)]" />
        <div className="h-3 w-3/4 rounded bg-[var(--surface-2)]" />
      </div>
      <div className="h-6 w-20 rounded-full bg-[var(--surface-2)]" />
    </div>
  </div>
);

export const DashboardCardSkeleton: React.FC = () => (
  <div className="card-theme rounded-xl p-4 animate-pulse">
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-2">
        <div className="h-8 w-20 rounded bg-[var(--surface-2)]" />
        <div className="h-3 w-24 rounded bg-[var(--surface-2)]" />
      </div>
      <div className="h-10 w-10 rounded-full bg-[var(--surface-2)]" />
    </div>
  </div>
);

interface TableRowSkeletonProps {
  columns?: number;
}

export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({ columns = 5 }) => (
  <tr className="animate-pulse border-b border-theme last:border-b-0">
    {Array.from({ length: columns }).map((_, index) => (
      <td key={index} className="px-4 py-3">
        <div className="h-3 rounded bg-[var(--surface-2)]" />
      </td>
    ))}
  </tr>
);

interface ListSkeletonProps {
  count?: number;
  skeleton: React.ComponentType;
  className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  count = 5,
  skeleton: SkeletonComponent,
  className = 'space-y-3',
}) => (
  <div className={className}>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonComponent key={index} />
    ))}
  </div>
);

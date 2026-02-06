import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}) => {
  const baseClasses = 'bg-[var(--bg-subtle)]';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-xl',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {
    width: width ?? (variant === 'text' ? '100%' : undefined),
    height: height ?? (variant === 'text' ? '1rem' : undefined),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

// Pre-built skeleton patterns
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
    <div className="flex items-center gap-3 mb-4">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1">
        <Skeleton variant="text" width="60%" height={16} className="mb-2" />
        <Skeleton variant="text" width="40%" height={12} />
      </div>
    </div>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} variant="text" className="mb-2" width={`${100 - i * 15}%`} />
    ))}
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
    {/* Header */}
    <div className="flex gap-4 p-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} variant="text" width={`${100 / cols}%`} height={14} />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="flex gap-4 p-4 border-b border-[var(--border)] last:border-b-0">
        {Array.from({ length: cols }).map((_, colIdx) => (
          <Skeleton key={colIdx} variant="text" width={`${100 / cols}%`} height={12} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonJobCard: React.FC = () => (
  <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
    <div className="flex justify-between items-start mb-3">
      <div className="flex-1">
        <Skeleton variant="text" width="70%" height={18} className="mb-2" />
        <Skeleton variant="text" width="50%" height={14} />
      </div>
      <Skeleton variant="rounded" width={80} height={24} />
    </div>
    <div className="flex gap-2 mt-3">
      <Skeleton variant="rounded" width={60} height={20} />
      <Skeleton variant="rounded" width={80} height={20} />
      <Skeleton variant="rounded" width={70} height={20} />
    </div>
  </div>
);

export const SkeletonJobDetail: React.FC = () => (
  <div className="space-y-4">
    {/* Header */}
    <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)]">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <Skeleton variant="text" width="40%" height={24} className="mb-3" />
          <Skeleton variant="text" width="60%" height={16} className="mb-2" />
          <Skeleton variant="text" width="30%" height={14} />
        </div>
        <Skeleton variant="rounded" width={100} height={32} />
      </div>
    </div>
    {/* Info cards */}
    <div className="grid grid-cols-2 gap-4">
      <SkeletonCard lines={2} />
      <SkeletonCard lines={2} />
    </div>
    {/* Main content */}
    <SkeletonCard lines={5} />
  </div>
);

export const SkeletonDashboard: React.FC = () => (
  <div className="space-y-6">
    {/* Stats row */}
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
          <Skeleton variant="text" width="50%" height={12} className="mb-2" />
          <Skeleton variant="text" width="70%" height={28} />
        </div>
      ))}
    </div>
    {/* Main table */}
    <SkeletonTable rows={8} cols={5} />
  </div>
);

export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <tr className="border-b border-[var(--border)] last:border-b-0">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton variant="text" width={i === 0 ? '60%' : '80%'} height={14} />
      </td>
    ))}
  </tr>
);

export const SkeletonJobList: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonJobCard key={i} />
    ))}
  </div>
);

export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className={`grid grid-cols-${count} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
        <Skeleton variant="text" width="60%" height={12} className="mb-2" />
        <Skeleton variant="text" width="40%" height={28} />
      </div>
    ))}
  </div>
);

export const SkeletonGrid: React.FC<{ count?: number; columns?: number }> = ({ count = 6, columns = 3 }) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} lines={3} />
    ))}
  </div>
);

export default Skeleton;

import React from 'react';

interface SkeletonProps {
  className?: string;
  /** Width - can be number (pixels) or string (e.g., 'full', '1/2', '32') */
  width?: number | string;
  /** Height - can be number (pixels) or string (e.g., '4', '8', '12') */
  height?: number | string;
  /** Make it circular */
  circle?: boolean;
  /** Number of skeleton items to render */
  count?: number;
}

/**
 * Skeleton loading placeholder component.
 * Uses Tailwind's animate-pulse for subtle loading animation.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  circle = false,
  count = 1,
}) => {
  const getWidthClass = () => {
    if (!width) return '';
    if (typeof width === 'number') return '';
    if (width === 'full') return 'w-full';
    return `w-${width}`;
  };

  const getHeightClass = () => {
    if (!height) return 'h-4';
    if (typeof height === 'number') return '';
    return `h-${height}`;
  };

  const style: React.CSSProperties = {};
  if (typeof width === 'number') style.width = width;
  if (typeof height === 'number') style.height = height;

  const baseClasses = `bg-slate-200 dark:bg-slate-700 animate-pulse ${
    circle ? 'rounded-full' : 'rounded'
  }`;

  const elements = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${baseClasses} ${getWidthClass()} ${getHeightClass()} ${className}`}
      style={Object.keys(style).length > 0 ? style : undefined}
    />
  ));

  return count === 1 ? elements[0] : <>{elements}</>;
};

/** Pre-styled skeleton for text lines */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton
        key={i}
        className={i === lines - 1 ? 'w-3/4' : 'w-full'}
        height="4"
      />
    ))}
  </div>
);

/** Pre-styled skeleton for cards */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`card-theme rounded-xl p-5 ${className}`}>
    <div className="flex items-start gap-3 mb-4">
      <Skeleton circle width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height="5" />
        <Skeleton width="40%" height="3" />
      </div>
    </div>
    <SkeletonText lines={3} />
  </div>
);

/** Pre-styled skeleton for table rows */
export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <tr className="border-b border-theme">
    {Array.from({ length: columns }, (_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton width={i === 0 ? '70%' : i === columns - 1 ? '50%' : '80%'} height="4" />
      </td>
    ))}
  </tr>
);

/** Pre-styled skeleton for list items */
export const SkeletonListItem: React.FC<{ showAvatar?: boolean }> = ({ showAvatar = false }) => (
  <div className="flex items-center gap-3 p-4 border-b border-theme">
    {showAvatar && <Skeleton circle width={40} height={40} />}
    <div className="flex-1 space-y-2">
      <Skeleton width="60%" height="4" />
      <Skeleton width="40%" height="3" />
    </div>
    <Skeleton width={60} height="8" className="rounded-md" />
  </div>
);

/** Grid of skeleton cards for loading data grids */
export const SkeletonGrid: React.FC<{ count?: number; columns?: 1 | 2 | 3 | 4 }> = ({
  count = 6,
  columns = 3,
}) => {
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  }[columns];

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

/** Skeleton for stat cards */
export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="card-theme p-4 rounded-xl">
        <Skeleton width="60%" height="3" className="mb-2" />
        <Skeleton width="40%" height="8" />
      </div>
    ))}
  </div>
);

export default Skeleton;

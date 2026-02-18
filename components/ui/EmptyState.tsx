import { LucideIcon } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
}) => {
  const shouldShowAction = Boolean(actionLabel && (actionTo || onAction));

  return (
    <div className="py-16 px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
          <Icon className="h-8 w-8" />
        </div>

        <h3 className="text-lg font-semibold text-theme">{title}</h3>
        <p className="mt-2 text-theme-muted">{description}</p>

        {shouldShowAction && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 text-white transition hover:opacity-90"
          >
            {actionLabel}
          </button>
        )}

        {shouldShowAction && !onAction && actionTo && (
          <Link
            to={actionTo}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 text-white transition hover:opacity-90"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
export type { EmptyStateProps };

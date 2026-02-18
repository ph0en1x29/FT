import { LayoutGrid, List } from 'lucide-react';
import React from 'react';

interface ViewToggleProps {
  view: 'table' | 'card';
  onChange: (view: 'table' | 'card') => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ view, onChange }) => {
  const getButtonClasses = (isActive: boolean) =>
    `rounded-md p-2 transition-colors ${
      isActive
        ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
        : 'text-theme-muted hover:bg-theme-surface-2'
    }`;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-theme p-1">
      <button
        type="button"
        onClick={() => onChange('card')}
        className={getButtonClasses(view === 'card')}
        aria-label="Card view"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={getButtonClasses(view === 'table')}
        aria-label="Table view"
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
};

export default ViewToggle;
export type { ViewToggleProps };

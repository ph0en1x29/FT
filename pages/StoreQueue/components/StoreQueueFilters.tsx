import type { FilterType } from '../types';

interface StoreQueueFiltersProps {
  filters: Array<{ id: FilterType; label: string; count: number }>;
  activeFilter: FilterType;
  onChange: (filter: FilterType) => void;
}

export function StoreQueueFilters({ filters, activeFilter, onChange }: StoreQueueFiltersProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {filters.map(f => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
            activeFilter === f.id
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {f.label}
          {f.count > 0 && (
            <span className={`px-1.5 py-0.5 text-xs rounded-full ${
              activeFilter === f.id ? 'bg-white/20' : 'bg-[var(--surface)]'
            }`}>
              {f.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

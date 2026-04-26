import { CheckCircle } from 'lucide-react';
import type { FilterType } from '../types';

interface StoreQueueEmptyStateProps {
  filter: FilterType;
  filters: Array<{ id: FilterType; label: string; count: number }>;
}

export function StoreQueueEmptyState({ filter, filters }: StoreQueueEmptyStateProps) {
  const filteredLabel = filters.find(f => f.id === filter)?.label.toLowerCase();

  return (
    <div className="text-center py-16 text-[var(--text-muted)]">
      <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium text-lg">All clear!</p>
      <p className="text-sm mt-1">
        {filter === 'all' ? 'Nothing needs attention right now.' : `No ${filteredLabel} items.`}
      </p>
    </div>
  );
}

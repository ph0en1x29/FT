import { Filter } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { BottomSheet } from './BottomSheet';

export interface MobileFilterSheetProps {
  children: ReactNode;
  activeFilterCount?: number;
}

export function MobileFilterSheet({
  children,
  activeFilterCount = 0,
}: MobileFilterSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <>
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-theme bg-theme-surface px-3 py-2 text-sm font-medium text-theme transition-colors hover:bg-theme-surface-2"
          aria-label="Open filters"
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          {hasActiveFilters ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-xs font-semibold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        <BottomSheet
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Filters"
        >
          {children}
        </BottomSheet>
      </div>

      <div className="hidden md:block">{children}</div>
    </>
  );
}

export const FilterSheet = MobileFilterSheet;

export default MobileFilterSheet;

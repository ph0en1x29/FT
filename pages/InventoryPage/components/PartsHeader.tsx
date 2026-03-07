import { ChevronLeft,ChevronRight,Download,Plus,Upload } from 'lucide-react';
import React from 'react';

interface PartsHeaderProps {
  filteredCount: number;
  totalCount: number;
  isAdmin: boolean;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  isRefreshing?: boolean;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onExport: () => void;
  onAddNew: () => void;
  onImport?: () => void;
}

const PartsHeader: React.FC<PartsHeaderProps> = ({
  filteredCount,
  totalCount,
  isAdmin,
  currentPage,
  pageSize,
  totalPages,
  isRefreshing = false,
  canGoPrev,
  canGoNext,
  onPreviousPage,
  onNextPage,
  onExport,
  onAddNew,
  onImport,
}) => {
  const rangeStart = totalCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(((currentPage - 1) * pageSize) + filteredCount, totalCount);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="text-sm text-theme-muted">
          {rangeStart}-{rangeEnd} of {totalCount} items
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2 text-xs text-theme-muted">
            <button
              onClick={onPreviousPage}
              disabled={!canGoPrev}
              className="inline-flex items-center gap-1 rounded-lg border border-theme px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3 h-3" />
              Prev
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              onClick={onNextPage}
              disabled={!canGoNext}
              className="inline-flex items-center gap-1 rounded-lg border border-theme px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </button>
            {isRefreshing && <span>Refreshing…</span>}
          </div>
        )}
      </div>
      <div className="flex gap-2 w-full sm:w-auto">
        <button
          onClick={onExport}
          className="flex items-center justify-center gap-2 px-4 py-2 h-10 md:h-auto border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition flex-1 sm:flex-none"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        {isAdmin && onImport && (
          <button
            onClick={onImport}
            className="flex items-center justify-center gap-2 px-4 py-2 h-10 md:h-auto border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition flex-1 sm:flex-none"
          >
            <Upload className="w-4 h-4" /> Import
          </button>
        )}
        {isAdmin && (
          <button
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 h-10 md:h-auto rounded-lg hover:bg-blue-700 shadow-sm font-medium flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" /> Add Part
          </button>
        )}
      </div>
    </div>
  );
};

export default PartsHeader;

import { FileText,RefreshCw } from 'lucide-react';

interface ExportHeaderProps {
  hideHeader?: boolean;
  onRefresh: () => void;
}

export function ExportHeader({ hideHeader, onRefresh }: ExportHeaderProps) {
  if (hideHeader) {
    return (
      <div className="flex justify-end">
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-theme flex items-center gap-2">
          <FileText className="w-7 h-7" />
          AutoCount Export
        </h1>
        <p className="text-sm text-theme-muted mt-1">
          Export invoices to AutoCount accounting system
        </p>
      </div>
      <button
        onClick={onRefresh}
        className="flex items-center gap-2 px-4 py-2 border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition"
      >
        <RefreshCw className="w-4 h-4" /> Refresh
      </button>
    </div>
  );
}

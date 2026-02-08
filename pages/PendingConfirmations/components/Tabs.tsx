import { Package,Wrench } from 'lucide-react';
import { TabsProps } from '../types';

export function Tabs({ activeTab, onTabChange, partsCount, jobsCount }: TabsProps) {
  return (
    <div className="flex border-b border-theme">
      <button
        onClick={() => onTabChange('parts')}
        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
          activeTab === 'parts'
            ? 'border-[var(--accent)] text-[var(--accent)]'
            : 'border-transparent text-theme-muted hover:text-theme'
        }`}
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          Parts Confirmation
          {partsCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
              {partsCount}
            </span>
          )}
        </div>
        <div className="text-xs text-theme-muted mt-0.5">Admin 2 (Store)</div>
      </button>
      <button
        onClick={() => onTabChange('jobs')}
        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
          activeTab === 'jobs'
            ? 'border-[var(--accent)] text-[var(--accent)]'
            : 'border-transparent text-theme-muted hover:text-theme'
        }`}
      >
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          Job Confirmation
          {jobsCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
              {jobsCount}
            </span>
          )}
        </div>
        <div className="text-xs text-theme-muted mt-0.5">Admin 1 (Service)</div>
      </button>
    </div>
  );
}

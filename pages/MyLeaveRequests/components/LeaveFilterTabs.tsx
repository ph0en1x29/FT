import { LeaveFilter } from '../hooks/useLeaveData';

interface LeaveFilterTabsProps {
  filter: LeaveFilter;
  onFilterChange: (filter: LeaveFilter) => void;
  pendingCount: number;
}

const TABS: LeaveFilter[] = ['all', 'upcoming', 'pending', 'past'];

export function LeaveFilterTabs({ filter, onFilterChange, pendingCount }: LeaveFilterTabsProps) {
  return (
    <div className="border-b border-slate-200 px-4">
      <nav className="flex -mb-px">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onFilterChange(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition capitalize ${
              filter === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab}
            {tab === 'pending' && pendingCount > 0 && (
              <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

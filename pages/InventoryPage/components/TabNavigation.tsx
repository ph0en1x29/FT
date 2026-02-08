import { LucideIcon } from 'lucide-react';
import React from 'react';

export type TabType = 'parts' | 'vanstock' | 'confirmations';

export interface Tab {
  id: TabType;
  label: string;
  icon: LucideIcon;
  show: boolean;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ tabs, activeTab, onTabChange }) => {
  const visibleTabs = tabs.filter(tab => tab.show);
  
  if (visibleTabs.length <= 1) return null;

  return (
    <div className="border-b border-theme">
      <nav className="flex gap-1 overflow-x-auto" aria-label="Inventory tabs">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-theme-muted hover:text-theme hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default TabNavigation;

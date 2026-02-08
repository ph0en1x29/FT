import { Briefcase,Calendar,Car,Shield } from 'lucide-react';
import { Employee } from '../../../types';
import { ActiveTab } from '../types';

interface ProfileTabsProps {
  activeTab: ActiveTab;
  isTechnician: boolean;
  employee: Employee;
  onTabChange: (tab: ActiveTab) => void;
}

/**
 * Tab navigation for employee profile sections
 */
export function ProfileTabs({
  activeTab,
  isTechnician,
  employee,
  onTabChange,
}: ProfileTabsProps) {
  const tabClasses = (tab: ActiveTab) =>
    `px-6 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
      activeTab === tab
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-slate-600 hover:text-slate-800'
    }`;

  return (
    <div className="border-b border-slate-200">
      <nav className="flex -mb-px overflow-x-auto">
        <button onClick={() => onTabChange('info')} className={tabClasses('info')}>
          Information
        </button>
        
        {isTechnician && (
          <>
            <button
              onClick={() => onTabChange('jobs')}
              className={`${tabClasses('jobs')} flex items-center gap-2`}
            >
              <Briefcase className="w-4 h-4" />
              Jobs
            </button>
            <button
              onClick={() => onTabChange('licenses')}
              className={`${tabClasses('licenses')} flex items-center gap-2`}
            >
              <Car className="w-4 h-4" />
              Licenses
              {employee.licenses && employee.licenses.length > 0 && (
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                  {employee.licenses.length}
                </span>
              )}
            </button>
            <button
              onClick={() => onTabChange('permits')}
              className={`${tabClasses('permits')} flex items-center gap-2`}
            >
              <Shield className="w-4 h-4" />
              Permits
              {employee.permits && employee.permits.length > 0 && (
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                  {employee.permits.length}
                </span>
              )}
            </button>
          </>
        )}
        
        <button
          onClick={() => onTabChange('leaves')}
          className={`${tabClasses('leaves')} flex items-center gap-2`}
        >
          <Calendar className="w-4 h-4" />
          Leave History
        </button>
      </nav>
    </div>
  );
}

import { Briefcase,Package } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Quick action buttons grid for common technician tasks.
 *
 * Fleet and Customers quick-actions intentionally removed — technicians are
 * blocked from those pages because they expose rental rates, pricing, and
 * customer details that are restricted (see AuthenticatedApp.tsx route guards
 * + ROLE_PERMISSIONS[TECHNICIAN] in types/user.types.ts).
 */
export const QuickActionsGrid: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'All Jobs',
      description: 'View job list',
      icon: Briefcase,
      color: 'blue',
      path: '/jobs',
    },
    {
      label: 'Van Stock',
      description: 'Manage inventory',
      icon: Package,
      color: 'orange',
      path: '/my-van-stock',
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        const iconClasses = colorMap[action.color];

        return (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconClasses}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-[var(--text)]">{action.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{action.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};

import { Camera,ClipboardCheck,Clock,FileText,Package as PackageIcon,Plus,Wrench,X,type LucideIcon } from 'lucide-react';
import React,{ useMemo,useState } from 'react';
import { Link } from 'react-router-dom';

interface FloatingActionButtonProps {
  currentUser: {
    role: string;
    user_id: string;
  };
  currentPath: string;
}

interface FabAction {
  icon: LucideIcon;
  label: string;
  to?: string;
}

const ADMIN_ROLES = new Set(['admin','admin_service','admin_store']);

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ currentUser,currentPath }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const role = currentUser.role.toLowerCase();

  const actions = useMemo<FabAction[]>(() => {
    if (role === 'technician') {
      return [
        { icon: Camera, label: 'Add Photo' },
        { icon: Wrench, label: 'Request Part' },
        { icon: Clock, label: 'Timer' },
      ];
    }

    if (role === 'supervisor') {
      return [
        { icon: ClipboardCheck, label: 'Approvals', to: '/jobs?tab=approvals' },
        { icon: ClipboardCheck, label: 'Assign Job', to: '/jobs' },
      ];
    }

    if (role === 'accountant') {
      return [{ icon: FileText, label: 'Billing', to: '/invoices' }];
    }

    if (ADMIN_ROLES.has(role)) {
      return [
        { icon: Plus, label: 'New Job', to: '/jobs/new' },
        { icon: ClipboardCheck, label: 'Approvals', to: '/jobs?tab=approvals' },
        { icon: PackageIcon, label: 'Inventory', to: '/inventory' },
      ];
    }

    return [];
  }, [role]);

  if (actions.length === 0) return null;

  const closeFab = () => setIsExpanded(false);
  const toggleFab = () => setIsExpanded(prev => !prev);

  const isActionActive = (to?: string) => {
    if (!to) return false;
    if (to.includes('?')) return currentPath === to;
    return currentPath === to || (to !== '/' && currentPath.startsWith(`${to}/`));
  };

  const getActionClasses = (active: boolean) =>
    `w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
      active
        ? 'bg-[var(--accent)] text-white shadow-lg shadow-blue-500/30'
        : 'bg-white border border-gray-200 text-gray-700 shadow-md hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200'
    }`;

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={closeFab}
        aria-label="Close quick actions"
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity duration-200 ${
          isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3">
        <div
          className={`flex flex-col items-end gap-2 transition-all duration-200 ${
            isExpanded ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          {actions.map(action => {
            const Icon = action.icon;
            const active = isActionActive(action.to);
            const actionClasses = getActionClasses(active);

            return (
              <div key={action.label} className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-md ${
                    active
                      ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'border-gray-200 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
                  }`}
                >
                  {action.label}
                </span>

                {action.to ? (
                  <Link to={action.to} onClick={closeFab} className={actionClasses} aria-label={action.label}>
                    <Icon className="w-5 h-5" />
                  </Link>
                ) : (
                  <button type="button" onClick={closeFab} className={actionClasses} aria-label={action.label}>
                    <Icon className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={toggleFab}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Close quick actions' : 'Open quick actions'}
          className="w-14 h-14 rounded-full bg-[var(--accent)] text-white flex items-center justify-center transition-all duration-200 hover:opacity-90"
          style={{ boxShadow: '0 4px 14px rgba(0, 102, 204, 0.45), 0 2px 6px rgba(0, 0, 0, 0.2)' }}
        >
          {isExpanded ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
};

export default FloatingActionButton;

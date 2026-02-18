import { ClipboardCheck,FileText,Package as PackageIcon,Plus,Wrench,X,type LucideIcon } from 'lucide-react';
import React,{ useEffect,useMemo,useState } from 'react';
import { Link,useLocation } from 'react-router-dom';

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

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ currentUser }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();

  // Close FAB on any route change
  useEffect(() => {
    setIsExpanded(false);
  }, [location.pathname, location.search]);

  const role = currentUser.role.toLowerCase();

  const actions = useMemo<FabAction[]>(() => {
    if (role === 'technician') {
      return [
        { icon: Wrench, label: 'Van Stock', to: '/my-van-stock' },
        { icon: ClipboardCheck, label: 'My Jobs', to: '/jobs' },
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

  const currentPath = location.pathname + location.search;
  const isActionActive = (to?: string) => {
    if (!to) return false;
    if (to.includes('?')) return currentPath === to;
    return currentPath === to || (to !== '/' && currentPath.startsWith(`${to}/`));
  };

  return (
    <div className="md:hidden">
      {/* Backdrop */}
      <button
        type="button"
        onClick={closeFab}
        aria-label="Close quick actions"
        className={`fixed inset-0 z-30 bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${
          isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3">
        {/* Action items */}
        <div
          className={`flex flex-col items-end gap-2.5 transition-all duration-200 ${
            isExpanded ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          {actions.map(action => {
            const Icon = action.icon;
            const active = isActionActive(action.to);

            const circleClasses = `w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-xl shadow-lg ${
              active
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface)] border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            }`;

            const labelClasses = `rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg ${
              active
                ? 'bg-[var(--accent)] text-white border border-[var(--accent)]'
                : 'bg-[var(--surface)] border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            }`;

            return (
              <div key={action.label} className="flex items-center gap-2" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' }}>
                <span className={labelClasses}>
                  {action.label}
                </span>

                {action.to ? (
                  <Link to={action.to} onClick={closeFab} className={circleClasses} aria-label={action.label}>
                    <Icon className="w-5 h-5" />
                  </Link>
                ) : (
                  <button type="button" onClick={closeFab} className={circleClasses} aria-label={action.label}>
                    <Icon className="w-5 h-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Main FAB button — glass with accent tint */}
        <button
          type="button"
          onClick={toggleFab}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Close quick actions' : 'Open quick actions'}
          className="w-14 h-14 rounded-full text-white flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 backdrop-blur-xl bg-[var(--accent)] border border-white/30"
          style={{ boxShadow: '0 4px 16px rgba(0, 102, 204, 0.4), 0 0 0 1px rgba(255,255,255,0.15) inset' }}
        >
          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-45' : ''}`}>
            {isExpanded ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
          </div>
        </button>
      </div>
    </div>
  );
};

export default FloatingActionButton;

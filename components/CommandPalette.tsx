import {
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  List,
  Package,
  Plus,
  Search,
  Truck,
  User as UserIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDevModeContext } from '../contexts/DevModeContext';
import { User, UserRole } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onNavigate: (path: string) => void;
}

interface CommandAction {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  shortcut?: string;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, currentUser, onNavigate }) => {
  const { hasPermission, permissionRole } = useDevModeContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const actions = useMemo<CommandAction[]>(() => {
    const canViewDashboard = hasPermission('canViewDashboard');
    const canViewForklifts = hasPermission('canViewForklifts');
    const canViewCustomers = hasPermission('canViewCustomers');
    const canManageInventory = hasPermission('canManageInventory');
    const canFinalizeInvoices = hasPermission('canFinalizeInvoices');
    const canCreateJobs = hasPermission('canCreateJobs');
    const canViewHR = hasPermission('canViewHR');
    const canManageUsers = hasPermission('canManageUsers');
    const canViewOwnProfile = hasPermission('canViewOwnProfile');
    const canViewTeam = canManageUsers || canViewHR || hasPermission('canViewKPI');

    const items: CommandAction[] = [];
    if (canViewDashboard) items.push({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' });
    items.push({ id: 'jobs', label: 'Jobs', icon: List, path: '/jobs' });
    if (canViewForklifts) items.push({ id: 'fleet', label: 'Fleet', icon: Truck, path: '/forklifts' });
    if (canViewCustomers) items.push({ id: 'customers', label: 'Customers', icon: Building2, path: '/customers' });
    if (canManageInventory) items.push({ id: 'inventory', label: 'Inventory', icon: Package, path: '/inventory' });
    if (canFinalizeInvoices) items.push({ id: 'billing', label: 'Billing', icon: FileText, path: '/invoices' });
    if (canViewTeam) items.push({ id: 'team', label: 'Team', icon: Users, path: '/people' });

    items.push({ id: 'my-leave', label: 'My Leave', icon: CalendarDays, path: '/my-leave' });
    if (permissionRole === UserRole.TECHNICIAN) {
      items.push({ id: 'my-van-stock', label: 'My Van Stock', icon: Truck, path: '/my-van-stock' });
    }
    if (canViewOwnProfile) {
      items.push({
        id: 'my-profile',
        label: 'My Profile',
        icon: UserIcon,
        path: `/people/employees/${currentUser.user_id}`,
      });
    }

    if (canCreateJobs) {
      items.push({ id: 'new-job', label: 'New Job', icon: Plus, path: '/jobs/new', shortcut: 'N J' });
    }
    if (canViewCustomers) {
      items.push({ id: 'new-customer', label: 'New Customer', icon: Plus, path: '/customers', shortcut: 'N C' });
    }

    return items;
  }, [currentUser.user_id, hasPermission, permissionRole]);

  const filteredActions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return actions.filter((action) => action.label.toLowerCase().includes(normalizedQuery));
  }, [actions, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const selectAction = (index: number) => {
    const action = filteredActions[index];
    if (!action) return;
    onNavigate(action.path);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (filteredActions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredActions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      selectAction(activeIndex);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20 sm:pt-28" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 shadow-xl backdrop-blur-xl">
        <div className="relative border-b border-[var(--border)]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-theme-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands..."
            className="w-full bg-transparent py-4 pl-12 pr-24 text-theme outline-none placeholder:text-theme-muted"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-theme-muted">
            Esc
          </span>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {filteredActions.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-theme-muted">No matching commands</li>
          ) : (
            filteredActions.map((action, index) => {
              const Icon = action.icon;
              const isActive = index === activeIndex;
              return (
                <li key={action.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectAction(index)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                      isActive
                        ? 'bg-theme-surface-2 text-theme'
                        : 'text-theme-muted hover:bg-theme-surface-2 hover:text-theme'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{action.label}</span>
                    </span>
                    {action.shortcut ? <span className="text-xs text-theme-muted">{action.shortcut}</span> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;

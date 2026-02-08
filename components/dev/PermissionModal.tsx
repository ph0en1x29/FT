/* eslint-disable max-lines */
import { ChevronDown,ChevronUp,RotateCcw,Search,ToggleLeft,ToggleRight,X } from 'lucide-react';
import React,{ useCallback,useEffect,useState } from 'react';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { RolePermissions,UserRole } from '../../types';

// Permission display labels (user-friendly names)
const permissionLabels: Record<keyof RolePermissions, string> = {
  canViewDashboard: 'View Dashboard',
  canViewAllJobs: 'View All Jobs',
  canCreateJobs: 'Create Jobs',
  canAssignJobs: 'Assign Jobs',
  canReassignJobs: 'Reassign Jobs',
  canEditJobs: 'Edit Jobs',
  canDeleteJobs: 'Delete Jobs',
  canFinalizeInvoices: 'Finalize Invoices',
  canViewKPI: 'View KPI',
  canManageUsers: 'Manage Users',
  canManageInventory: 'Manage Inventory',
  canEditInventory: 'Edit Inventory',
  canViewCustomers: 'View Customers',
  canEditCustomers: 'Edit Customers',
  canDeleteCustomers: 'Delete Customers',
  canViewForklifts: 'View Forklifts',
  canEditForklifts: 'Edit Forklifts',
  canManageRentals: 'Manage Rentals',
  canEditRentalRates: 'Edit Rental Rates',
  canViewServiceRecords: 'View Service Records',
  canScheduleMaintenance: 'Schedule Maintenance',
  canViewHR: 'View HR',
  canManageEmployees: 'Manage Employees',
  canApproveLeave: 'Approve Leave',
  canViewOwnProfile: 'View Own Profile',
  canViewPricing: 'View Pricing',
  canViewJobCosts: 'View Job Costs',
};

// Permission groups for organized display
const permissionGroups: { name: string; permissions: (keyof RolePermissions)[] }[] = [
  {
    name: 'Dashboard & General',
    permissions: ['canViewDashboard', 'canViewKPI', 'canViewOwnProfile'],
  },
  {
    name: 'Jobs',
    permissions: ['canViewAllJobs', 'canCreateJobs', 'canAssignJobs', 'canReassignJobs', 'canEditJobs', 'canDeleteJobs'],
  },
  {
    name: 'Customers',
    permissions: ['canViewCustomers', 'canEditCustomers', 'canDeleteCustomers'],
  },
  {
    name: 'Forklifts & Service',
    permissions: ['canViewForklifts', 'canEditForklifts', 'canViewServiceRecords', 'canScheduleMaintenance'],
  },
  {
    name: 'Inventory & Rentals',
    permissions: ['canManageInventory', 'canEditInventory', 'canManageRentals', 'canEditRentalRates'],
  },
  {
    name: 'Finance',
    permissions: ['canFinalizeInvoices', 'canViewPricing', 'canViewJobCosts'],
  },
  {
    name: 'HR & Users',
    permissions: ['canViewHR', 'canManageEmployees', 'canApproveLeave', 'canManageUsers'],
  },
];

const roleLabels: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.ADMIN_SERVICE]: 'Admin (Service)',
  [UserRole.ADMIN_STORE]: 'Admin (Store)',
  [UserRole.SUPERVISOR]: 'Supervisor',
  [UserRole.TECHNICIAN]: 'Technician',
  [UserRole.ACCOUNTANT]: 'Accountant',
};

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({ isOpen, onClose }) => {
  const {
    permissionRole,
    permissionOverrides,
    setPermissionOverride,
    clearPermissionOverrides,
    hasPermission,
    getRolePermissions,
  } = useDevModeContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(permissionGroups.map(g => g.name)));

  const rolePermissions = getRolePermissions(permissionRole);
  const overrideCount = Object.keys(permissionOverrides).length;

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  const handlePermissionToggle = useCallback((permission: keyof RolePermissions) => {
    const currentValue = hasPermission(permission);
    const roleDefault = rolePermissions[permission];

    // If toggling would result in same as role default, remove override
    if (!currentValue === roleDefault) {
      setPermissionOverride(permission, null);
    } else {
      setPermissionOverride(permission, !currentValue);
    }
  }, [hasPermission, rolePermissions, setPermissionOverride]);

  // Filter permissions based on search
  const filterPermissions = useCallback((permissions: (keyof RolePermissions)[]) => {
    if (!searchQuery) return permissions;
    return permissions.filter(p =>
      permissionLabels[p].toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal - Theme Aware */}
      <div className="relative bg-theme-surface border border-theme rounded-xl shadow-lg w-full max-w-2xl max-h-[85vh] mx-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme bg-theme-surface-2">
          <div>
            <h2 className="text-lg font-semibold text-theme">Permission Overrides</h2>
            <p className="text-sm text-theme-muted mt-0.5">
              Role: <span className="text-theme-accent font-medium">{roleLabels[permissionRole]}</span>
              {overrideCount > 0 && (
                <span className="ml-2 text-amber-600 [data-theme=dark]:text-amber-400">
                  ({overrideCount} override{overrideCount !== 1 ? 's' : ''} active)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-theme-muted hover:text-theme hover:bg-theme-surface-2 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search and Reset */}
        <div className="px-5 py-3 border-b border-theme flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search permissions..."
              className="w-full pl-10 pr-4 py-2 bg-theme-surface-2 border border-theme rounded-lg text-sm text-theme placeholder:text-theme-muted focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              autoFocus
            />
          </div>
          {overrideCount > 0 && (
            <button
              onClick={clearPermissionOverrides}
              className="flex items-center gap-2 px-3 py-2 text-sm text-amber-600 [data-theme=dark]:text-amber-400 hover:bg-amber-100 [data-theme=dark]:hover:bg-amber-900/20 border border-amber-300 [data-theme=dark]:border-amber-700 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset All
            </button>
          )}
        </div>

        {/* Permission Groups - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {permissionGroups.map(group => {
            const filteredPermissions = filterPermissions(group.permissions);
            if (filteredPermissions.length === 0) return null;

            const isExpanded = expandedGroups.has(group.name) || searchQuery.length > 0;
            const groupOverrides = filteredPermissions.filter(p => p in permissionOverrides).length;

            return (
              <div key={group.name} className="border border-theme rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-theme-surface-2 hover:bg-theme-surface transition-colors"
                >
                  <span className="text-sm font-medium text-theme">{group.name}</span>
                  <div className="flex items-center gap-2">
                    {groupOverrides > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 [data-theme=dark]:bg-amber-900/30 text-amber-700 [data-theme=dark]:text-amber-400 rounded-full">
                        {groupOverrides} override{groupOverrides !== 1 ? 's' : ''}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-theme-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-theme-muted" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-3 space-y-1 bg-theme-surface">
                    {filteredPermissions.map(permission => {
                      const isOverridden = permission in permissionOverrides;
                      const currentValue = hasPermission(permission);
                      const roleDefault = rolePermissions[permission];

                      return (
                        <PermissionRow
                          key={permission}
                          label={permissionLabels[permission]}
                          enabled={currentValue}
                          isOverridden={isOverridden}
                          roleDefault={roleDefault}
                          onToggle={() => handlePermissionToggle(permission)}
                          onReset={() => setPermissionOverride(permission, null)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-theme bg-theme-surface-2">
          <p className="text-xs text-theme-muted text-center">
            Click toggles to override permissions.{' '}
            <span className="text-amber-600 [data-theme=dark]:text-amber-400">Amber</span> = differs from role default.
            Press Escape or click outside to close.
          </p>
        </div>
      </div>
    </div>
  );
};

// Individual permission toggle row
interface PermissionRowProps {
  label: string;
  enabled: boolean;
  isOverridden: boolean;
  roleDefault: boolean;
  onToggle: () => void;
  onReset: () => void;
}

const PermissionRow: React.FC<PermissionRowProps> = ({
  label,
  enabled,
  isOverridden,
  roleDefault,
  onToggle,
  onReset,
}) => {
  return (
    <div
      className={`
        flex items-center justify-between px-3 py-2 rounded-lg
        ${isOverridden
          ? 'bg-amber-50 [data-theme=dark]:bg-amber-900/20 border border-amber-300 [data-theme=dark]:border-amber-700'
          : 'hover:bg-theme-surface-2'}
      `}
    >
      <span className={`text-sm ${enabled ? 'text-theme' : 'text-theme-muted'}`}>
        {label}
      </span>

      <div className="flex items-center gap-2">
        {isOverridden && (
          <button
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            className="text-xs text-amber-600 [data-theme=dark]:text-amber-400 hover:bg-amber-100 [data-theme=dark]:hover:bg-amber-900/30 px-2 py-1 rounded transition-colors"
            title={`Reset to role default (${roleDefault ? 'on' : 'off'})`}
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={onToggle}
          className="flex items-center transition-colors"
          aria-label={enabled ? 'Disable permission' : 'Enable permission'}
        >
          {enabled ? (
            <ToggleRight className={`w-8 h-8 ${isOverridden ? 'text-amber-600 [data-theme=dark]:text-amber-400' : 'text-green-600 [data-theme=dark]:text-green-500'}`} />
          ) : (
            <ToggleLeft className="w-8 h-8 text-gray-400 [data-theme=dark]:text-gray-600" />
          )}
        </button>
      </div>
    </div>
  );
};

export default PermissionModal;

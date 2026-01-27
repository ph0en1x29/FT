import React, { useState } from 'react';
import { RotateCcw, Check, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { RolePermissions, ROLE_PERMISSIONS } from '../../types';
import { useDevModeContext } from '../../contexts/DevModeContext';

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

// Group permissions by category for better organization
const permissionGroups: { name: string; permissions: (keyof RolePermissions)[] }[] = [
  {
    name: 'Jobs',
    permissions: ['canViewAllJobs', 'canCreateJobs', 'canAssignJobs', 'canReassignJobs', 'canEditJobs', 'canDeleteJobs'],
  },
  {
    name: 'Dashboard & Reports',
    permissions: ['canViewDashboard', 'canViewKPI', 'canViewServiceRecords'],
  },
  {
    name: 'Finance',
    permissions: ['canFinalizeInvoices', 'canViewPricing', 'canViewJobCosts'],
  },
  {
    name: 'Customers',
    permissions: ['canViewCustomers', 'canEditCustomers', 'canDeleteCustomers'],
  },
  {
    name: 'Fleet',
    permissions: ['canViewForklifts', 'canEditForklifts', 'canManageRentals', 'canEditRentalRates', 'canScheduleMaintenance'],
  },
  {
    name: 'Inventory',
    permissions: ['canManageInventory', 'canEditInventory'],
  },
  {
    name: 'Users & HR',
    permissions: ['canManageUsers', 'canViewHR', 'canManageEmployees', 'canApproveLeave', 'canViewOwnProfile'],
  },
];

/**
 * PermissionOverrides - Toggle individual permissions on/off
 *
 * Features:
 * - All 27 permissions grouped by category
 * - Visual indicator for overridden vs role default
 * - Reset to role defaults button
 * - Search/filter functionality
 */
export const PermissionOverrides: React.FC = () => {
  const {
    permissionRole,
    permissionOverrides,
    setPermissionOverride,
    clearPermissionOverrides,
    hasPermission,
    getRolePermissions,
  } = useDevModeContext();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const rolePermissions = getRolePermissions(permissionRole);
  const overrideCount = Object.keys(permissionOverrides).length;

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const handlePermissionToggle = (permission: keyof RolePermissions) => {
    const currentValue = hasPermission(permission);
    const roleDefault = rolePermissions[permission];

    // If clicking would result in same as role default, remove override
    if (!currentValue === roleDefault) {
      setPermissionOverride(permission, null);
    } else {
      // Toggle opposite of current value
      setPermissionOverride(permission, !currentValue);
    }
  };

  // Filter permissions based on search
  const filterPermissions = (permissions: (keyof RolePermissions)[]) => {
    if (!searchQuery) return permissions;
    return permissions.filter(p =>
      permissionLabels[p].toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <div className="space-y-3">
      {/* Header with override count and reset */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {overrideCount > 0 ? (
            <span className="text-amber-400">{overrideCount} override{overrideCount !== 1 ? 's' : ''} active</span>
          ) : (
            'Using role defaults'
          )}
        </span>
        {overrideCount > 0 && (
          <button
            onClick={clearPermissionOverrides}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset All
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search permissions..."
          className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Permission Groups */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {permissionGroups.map(group => {
          const filteredPermissions = filterPermissions(group.permissions);
          if (filteredPermissions.length === 0) return null;

          const isExpanded = expandedGroups.has(group.name) || searchQuery.length > 0;
          const groupOverrides = filteredPermissions.filter(p => p in permissionOverrides).length;

          return (
            <div key={group.name} className="border border-slate-700/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleGroup(group.name)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                <span className="text-xs font-medium text-slate-300">{group.name}</span>
                <div className="flex items-center gap-2">
                  {groupOverrides > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                      {groupOverrides}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="p-2 space-y-1 bg-slate-900/30">
                  {filteredPermissions.map(permission => {
                    const isOverridden = permission in permissionOverrides;
                    const currentValue = hasPermission(permission);
                    const roleDefault = rolePermissions[permission];

                    return (
                      <PermissionToggle
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

      {/* Hint */}
      <p className="text-[10px] text-slate-600">
        Click to toggle. Yellow = overridden from role default.
      </p>
    </div>
  );
};

// Individual permission toggle row
interface PermissionToggleProps {
  label: string;
  enabled: boolean;
  isOverridden: boolean;
  roleDefault: boolean;
  onToggle: () => void;
  onReset: () => void;
}

const PermissionToggle: React.FC<PermissionToggleProps> = ({
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
        flex items-center justify-between px-2 py-1 rounded
        ${isOverridden ? 'bg-amber-500/10 border border-amber-500/30' : 'hover:bg-slate-800/50'}
      `}
    >
      <button
        onClick={onToggle}
        className="flex items-center gap-2 flex-1 text-left"
      >
        <span
          className={`
            w-4 h-4 rounded flex items-center justify-center flex-shrink-0
            ${enabled
              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
              : 'bg-slate-700 text-slate-500 border border-slate-600'
            }
          `}
        >
          {enabled ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
        </span>
        <span className={`text-xs ${enabled ? 'text-slate-200' : 'text-slate-500'}`}>
          {label}
        </span>
      </button>

      {isOverridden && (
        <button
          onClick={(e) => { e.stopPropagation(); onReset(); }}
          className="text-[10px] text-amber-400 hover:text-amber-300 px-1.5 py-0.5 hover:bg-amber-500/20 rounded"
          title={`Reset to role default (${roleDefault ? 'on' : 'off'})`}
        >
          Reset
        </button>
      )}
    </div>
  );
};

export default PermissionOverrides;

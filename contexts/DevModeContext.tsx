import { createContext, useContext, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole, RolePermissions } from '../types';
import { ROLE_PERMISSIONS } from '../types';
import { useDevMode, DevModeType, DevModeRole, PermissionOverrides } from '../hooks/useDevMode';

/**
 * DevModeContext - Provides dev mode state to all components
 *
 * This context wraps the useDevMode hook and makes it available throughout
 * the app, so any component can check the effective role without prop drilling.
 *
 * Key concepts:
 * - displayRole: Role to use for UI rendering (always impersonated when active)
 * - permissionRole: Role to use for permission checks (impersonated only in STRICT mode)
 * - hasPermission(): Helper that checks permissions using the correct role
 */

interface DevModeContextValue {
  // Current user (real user from database)
  currentUser: User;

  // Dev mode state
  isDev: boolean;
  isDevModeActive: boolean;
  impersonatedRole: DevModeRole;
  devModeType: DevModeType;

  // Computed roles
  /** Role for UI display - always shows impersonated role when dev mode active */
  displayRole: UserRole;
  /** Role for permission checks - uses impersonated role only in STRICT mode */
  permissionRole: UserRole;

  // Permission overrides
  /** Current permission overrides */
  permissionOverrides: PermissionOverrides;

  // Actions
  activateDevMode: (role: UserRole, type?: DevModeType) => void;
  deactivateDevMode: () => void;
  setDevModeType: (type: DevModeType) => void;
  setImpersonatedRole: (role: UserRole) => void;

  // Permission override actions
  /** Set a permission override (true = force on, false = force off, null = use role default) */
  setPermissionOverride: (permission: keyof RolePermissions, value: boolean | null) => void;
  /** Clear all permission overrides */
  clearPermissionOverrides: () => void;

  // Helper functions
  /**
   * Check if the current effective role has a specific permission
   * NOTE: This checks permission overrides first, then falls back to role permissions
   */
  hasPermission: (permission: keyof RolePermissions) => boolean;
  /** Get all permissions for the current effective role (with overrides applied) */
  getPermissions: () => RolePermissions;
  /** Get permissions for a specific role (without overrides) */
  getRolePermissions: (role: UserRole) => RolePermissions;
}

const DevModeContext = createContext<DevModeContextValue | null>(null);

interface DevModeProviderProps {
  currentUser: User;
  children: ReactNode;
}

export const DevModeProvider = ({ currentUser, children }: DevModeProviderProps) => {
  const devMode = useDevMode(currentUser.email, currentUser.role);

  /**
   * Check if current role has permission
   * IMPORTANT: Checks permission overrides FIRST, then falls back to role permissions
   *
   * Order of precedence:
   * 1. If there's an override for this permission, use override value
   * 2. Otherwise, use the role's default permission
   */
  const hasPermission = useCallback((permission: keyof RolePermissions): boolean => {
    // Check if there's an override for this permission
    const overrides = devMode.permissionOverrides;
    if (permission in overrides) {
      return overrides[permission]!;
    }
    // Fall back to role permission
    return ROLE_PERMISSIONS[devMode.permissionRole]?.[permission] ?? false;
  }, [devMode.permissionRole, devMode.permissionOverrides]);

  /**
   * Get all permissions for current role WITH overrides applied
   */
  const getPermissions = useCallback((): RolePermissions => {
    const basePermissions = ROLE_PERMISSIONS[devMode.permissionRole];
    return {
      ...basePermissions,
      ...devMode.permissionOverrides,
    } as RolePermissions;
  }, [devMode.permissionRole, devMode.permissionOverrides]);

  /**
   * Get permissions for a specific role WITHOUT overrides
   * Useful for comparing against overridden permissions
   */
  const getRolePermissions = useCallback((role: UserRole): RolePermissions => {
    return ROLE_PERMISSIONS[role];
  }, []);

  const value: DevModeContextValue = useMemo(() => ({
    currentUser,
    isDev: devMode.isDev,
    isDevModeActive: devMode.isDevModeActive,
    impersonatedRole: devMode.impersonatedRole,
    devModeType: devMode.devModeType,
    displayRole: devMode.displayRole,
    permissionRole: devMode.permissionRole,
    permissionOverrides: devMode.permissionOverrides,
    activateDevMode: devMode.activateDevMode,
    deactivateDevMode: devMode.deactivateDevMode,
    setDevModeType: devMode.setDevModeType,
    setImpersonatedRole: devMode.setImpersonatedRole,
    setPermissionOverride: devMode.setPermissionOverride,
    clearPermissionOverrides: devMode.clearPermissionOverrides,
    hasPermission,
    getPermissions,
    getRolePermissions,
  }), [
    currentUser,
    devMode.isDev,
    devMode.isDevModeActive,
    devMode.impersonatedRole,
    devMode.devModeType,
    devMode.displayRole,
    devMode.permissionRole,
    devMode.permissionOverrides,
    devMode.activateDevMode,
    devMode.deactivateDevMode,
    devMode.setDevModeType,
    devMode.setImpersonatedRole,
    devMode.setPermissionOverride,
    devMode.clearPermissionOverrides,
    hasPermission,
    getPermissions,
    getRolePermissions,
  ]);

  return (
    <DevModeContext.Provider value={value}>
      {children}
    </DevModeContext.Provider>
  );
};

/**
 * Hook to access dev mode context
 *
 * @example
 * const { displayRole, hasPermission } = useDevModeContext();
 *
 * // Check permission
 * if (hasPermission('canCreateJobs')) {
 *   // Show create button
 * }
 *
 * // Get current role for display
 * const role = displayRole; // Will be impersonated role if dev mode active
 */
export function useDevModeContext(): DevModeContextValue {
  const context = useContext(DevModeContext);
  if (!context) {
    throw new Error('useDevModeContext must be used within a DevModeProvider');
  }
  return context;
}

/**
 * Optional hook that returns null if outside provider
 * Useful for components that may or may not be wrapped
 */
export function useOptionalDevModeContext(): DevModeContextValue | null {
  return useContext(DevModeContext);
}

export default DevModeContext;

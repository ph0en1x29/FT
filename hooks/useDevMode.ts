import { useCallback,useEffect,useState } from 'react';
import { RolePermissions,UserRole } from '../types';

// Dev emails - from environment variable + hardcoded test account
// VITE_DEV_EMAILS can add additional dev emails
const HARDCODED_DEV_EMAILS = ['dev@test.com'];  // Test account always has dev access
const ENV_DEV_EMAILS = (import.meta.env.VITE_DEV_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
const DEV_EMAILS = [...new Set([...HARDCODED_DEV_EMAILS, ...ENV_DEV_EMAILS])];

// Dev mode enabled in: dev environment OR explicitly enabled OR for hardcoded test accounts
const IS_DEV_ENVIRONMENT = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_MODE === 'true';

export type DevModeRole = UserRole | null;
export type DevModeType = 'ui_only' | 'strict';

// Permission overrides - partial map of permissions to override values
export type PermissionOverrides = Partial<Record<keyof RolePermissions, boolean>>;

interface DevModeState {
  isDev: boolean;
  isDevModeActive: boolean;
  impersonatedRole: DevModeRole;
  devModeType: DevModeType;
  /** Role used for UI/display purposes (always uses impersonated role when active) */
  displayRole: UserRole;
  /** Role used for permission checks (only uses impersonated role in strict mode) */
  permissionRole: UserRole;
  /** @deprecated Use displayRole or permissionRole instead */
  effectiveRole: UserRole;
  /** Permission overrides - individual permission toggles that override role defaults */
  permissionOverrides: PermissionOverrides;
}

interface DevModeActions {
  activateDevMode: (role: UserRole, type?: DevModeType) => void;
  deactivateDevMode: () => void;
  setDevModeType: (type: DevModeType) => void;
  setImpersonatedRole: (role: UserRole) => void;
  // Permission override actions
  setPermissionOverride: (permission: keyof RolePermissions, value: boolean | null) => void;
  clearPermissionOverrides: () => void;
  getPermissionOverrides: () => PermissionOverrides;
}

const STORAGE_KEY = 'fieldpro_dev_mode';
const OVERRIDES_STORAGE_KEY = 'fieldpro_permission_overrides';

interface StoredDevMode {
  impersonatedRole: DevModeRole;
  devModeType: DevModeType;
}

// Load stored state (called unconditionally)
const loadStoredState = (): StoredDevMode | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    /* Silently ignore */
  }
  return null;
};

// Load permission overrides from localStorage
const loadPermissionOverrides = (): PermissionOverrides => {
  try {
    const stored = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    /* Silently ignore */
  }
  return {};
};

// Save permission overrides to localStorage
const savePermissionOverrides = (overrides: PermissionOverrides) => {
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(OVERRIDES_STORAGE_KEY);
    } else {
      localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch (e) {
    /* Silently ignore */
  }
};

/**
 * Hook to manage developer mode functionality
 *
 * UI Only mode: Display shows impersonated role, but permissions use real role
 * Strict mode: Both display AND permissions use impersonated role
 *
 * Permission Overrides: Individual permissions can be toggled on/off regardless
 * of the current role. This is useful for testing edge cases like
 * "What if a Technician COULD create jobs?"
 *
 * @param userEmail - Current user's email
 * @param userRole - Current user's actual role
 */
export function useDevMode(userEmail: string | undefined, userRole: UserRole): DevModeState & DevModeActions {
  // Load stored state UNCONDITIONALLY on mount (fixes persistence issue)
  const [impersonatedRole, setImpersonatedRoleState] = useState<DevModeRole>(() => {
    const stored = loadStoredState();
    return stored?.impersonatedRole || null;
  });

  const [devModeType, setDevModeTypeState] = useState<DevModeType>(() => {
    const stored = loadStoredState();
    return stored?.devModeType || 'ui_only';
  });

  // Permission overrides state
  const [permissionOverrides, setPermissionOverridesState] = useState<PermissionOverrides>(() => {
    return loadPermissionOverrides();
  });

  // Track if we've validated the user yet
  const [hasValidated, setHasValidated] = useState(false);

  // Check if user is a developer (may be undefined initially while loading)
  // Hardcoded test accounts always have dev access, others need IS_DEV_ENVIRONMENT
  const isHardcodedDev = userEmail ? HARDCODED_DEV_EMAILS.includes(userEmail.toLowerCase()) : false;
  const isEnvDev = IS_DEV_ENVIRONMENT && userEmail ? ENV_DEV_EMAILS.includes(userEmail.toLowerCase()) : false;
  const isDev = isHardcodedDev || isEnvDev;

  // Once we have the email, validate and clear if not dev
  useEffect(() => {
    if (userEmail && !hasValidated) {
      setHasValidated(true);
      if (!DEV_EMAILS.includes(userEmail.toLowerCase())) {
        // Not a dev user - clear any stored dev mode and overrides
        setImpersonatedRoleState(null);
        setPermissionOverridesState({});
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(OVERRIDES_STORAGE_KEY);
      }
    }
  }, [userEmail, hasValidated]);

  // Persist state to localStorage when it changes
  useEffect(() => {
    if (impersonatedRole) {
      const state: StoredDevMode = { impersonatedRole, devModeType };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [impersonatedRole, devModeType]);

  // Persist permission overrides when they change
  useEffect(() => {
    savePermissionOverrides(permissionOverrides);
  }, [permissionOverrides]);

  const isDevModeActive = isDev && impersonatedRole !== null;

  // Calculate roles based on dev mode settings
  // displayRole: Always shows impersonated role when active (for UI rendering)
  // permissionRole: Only shows impersonated role in STRICT mode (for permission checks)
  const displayRole = isDevModeActive ? impersonatedRole! : userRole;
  const permissionRole = (isDevModeActive && devModeType === 'strict') ? impersonatedRole! : userRole;

  // Actions
  const activateDevMode = useCallback((role: UserRole, type: DevModeType = 'ui_only') => {
    if (!isDev) return;
    setImpersonatedRoleState(role);
    setDevModeTypeState(type);
  }, [isDev]);

  const deactivateDevMode = useCallback(() => {
    setImpersonatedRoleState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setDevModeType = useCallback((type: DevModeType) => {
    if (!isDev) return;
    setDevModeTypeState(type);
  }, [isDev]);

  const setImpersonatedRole = useCallback((role: UserRole) => {
    if (!isDev) return;
    setImpersonatedRoleState(role);
  }, [isDev]);

  // Permission override actions
  const setPermissionOverride = useCallback((permission: keyof RolePermissions, value: boolean | null) => {
    if (!isDev) return;
    setPermissionOverridesState(prev => {
      if (value === null) {
        // Remove the override (use role default)
        const { [permission]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [permission]: value,
      };
    });
  }, [isDev]);

  const clearPermissionOverrides = useCallback(() => {
    setPermissionOverridesState({});
    localStorage.removeItem(OVERRIDES_STORAGE_KEY);
  }, []);

  const getPermissionOverrides = useCallback(() => {
    return permissionOverrides;
  }, [permissionOverrides]);

  return {
    isDev,
    isDevModeActive,
    impersonatedRole,
    devModeType,
    displayRole,
    permissionRole,
    permissionOverrides,
    // Keep effectiveRole for backward compatibility (maps to displayRole)
    effectiveRole: displayRole,
    activateDevMode,
    deactivateDevMode,
    setDevModeType,
    setImpersonatedRole,
    setPermissionOverride,
    clearPermissionOverrides,
    getPermissionOverrides,
  };
}

export default useDevMode;

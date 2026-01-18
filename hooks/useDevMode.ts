import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '../types';

// Hardcoded dev emails (always allowed) + env variable for additional emails
const HARDCODED_DEV_EMAILS = ['dev@test.com'];
const ENV_DEV_EMAILS = (import.meta.env.VITE_DEV_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);
const DEV_EMAILS = [...new Set([...HARDCODED_DEV_EMAILS, ...ENV_DEV_EMAILS])];

export type DevModeRole = UserRole | null;
export type DevModeType = 'ui_only' | 'strict';

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
}

interface DevModeActions {
  activateDevMode: (role: UserRole, type?: DevModeType) => void;
  deactivateDevMode: () => void;
  setDevModeType: (type: DevModeType) => void;
  setImpersonatedRole: (role: UserRole) => void;
}

const STORAGE_KEY = 'fieldpro_dev_mode';

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
    console.error('Failed to load dev mode state:', e);
  }
  return null;
};

/**
 * Hook to manage developer mode functionality
 * 
 * UI Only mode: Display shows impersonated role, but permissions use real role
 * Strict mode: Both display AND permissions use impersonated role
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

  // Track if we've validated the user yet
  const [hasValidated, setHasValidated] = useState(false);

  // Check if user is a developer (may be undefined initially while loading)
  const isDev = userEmail ? DEV_EMAILS.includes(userEmail.toLowerCase()) : false;

  // Once we have the email, validate and clear if not dev
  useEffect(() => {
    if (userEmail && !hasValidated) {
      setHasValidated(true);
      if (!DEV_EMAILS.includes(userEmail.toLowerCase())) {
        // Not a dev user - clear any stored dev mode
        setImpersonatedRoleState(null);
        localStorage.removeItem(STORAGE_KEY);
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

  return {
    isDev,
    isDevModeActive,
    impersonatedRole,
    devModeType,
    displayRole,
    permissionRole,
    // Keep effectiveRole for backward compatibility (maps to displayRole)
    effectiveRole: displayRole,
    activateDevMode,
    deactivateDevMode,
    setDevModeType,
    setImpersonatedRole,
  };
}

export default useDevMode;

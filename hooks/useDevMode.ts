import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '../types_with_invoice_tracking';

// Get dev emails from environment variable
const DEV_EMAILS = (import.meta.env.VITE_DEV_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean);

export type DevModeRole = UserRole | null;
export type DevModeType = 'ui_only' | 'strict';

interface DevModeState {
  isDev: boolean;
  isDevModeActive: boolean;
  impersonatedRole: DevModeRole;
  devModeType: DevModeType;
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

/**
 * Hook to manage developer mode functionality
 * @param userEmail - Current user's email
 * @param userRole - Current user's actual role
 */
export function useDevMode(userEmail: string | undefined, userRole: UserRole): DevModeState & DevModeActions {
  // Check if user is a developer
  const isDev = userEmail ? DEV_EMAILS.includes(userEmail.toLowerCase()) : false;

  // Load stored state
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

  // Initialize state from localStorage
  const [impersonatedRole, setImpersonatedRoleState] = useState<DevModeRole>(() => {
    if (!isDev) return null;
    const stored = loadStoredState();
    return stored?.impersonatedRole || null;
  });

  const [devModeType, setDevModeTypeState] = useState<DevModeType>(() => {
    if (!isDev) return 'ui_only';
    const stored = loadStoredState();
    return stored?.devModeType || 'ui_only';
  });

  // Persist state to localStorage
  useEffect(() => {
    if (isDev && impersonatedRole) {
      const state: StoredDevMode = { impersonatedRole, devModeType };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isDev, impersonatedRole, devModeType]);

  // Clear dev mode if user is not a dev
  useEffect(() => {
    if (!isDev && impersonatedRole) {
      setImpersonatedRoleState(null);
    }
  }, [isDev, impersonatedRole]);

  const isDevModeActive = isDev && impersonatedRole !== null;

  // Calculate effective role based on dev mode settings
  const effectiveRole = isDevModeActive ? impersonatedRole! : userRole;

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
    effectiveRole,
    activateDevMode,
    deactivateDevMode,
    setDevModeType,
    setImpersonatedRole,
  };
}

export default useDevMode;

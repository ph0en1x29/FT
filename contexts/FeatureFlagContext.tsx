import type { ReactNode } from 'react';
import { createContext,useCallback,useContext,useEffect,useMemo,useState } from 'react';

/**
 * Feature Flag System
 *
 * Allows developers to toggle experimental features on/off.
 * Flags are persisted to localStorage and only available to dev users.
 */

// Define available feature flags with descriptions
export interface FeatureFlags {
  realtimeNotifications: boolean;  // Enable real-time notification system
  experimentalUI: boolean;         // Enable experimental UI components
  dashboardV5: boolean;            // Future dashboard version toggle (placeholder)
  debugMode: boolean;              // Show extra debug info in console
  darkModeBeta: boolean;           // Dark mode beta features
}

// Default flag values
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  realtimeNotifications: true,
  experimentalUI: false,
  dashboardV5: false,
  debugMode: false,
  darkModeBeta: false,
};

// Human-readable labels and descriptions for the UI
export const FEATURE_FLAG_INFO: Record<keyof FeatureFlags, { label: string; description: string }> = {
  realtimeNotifications: {
    label: 'Real-time Notifications',
    description: 'Enable live push notifications for job updates',
  },
  experimentalUI: {
    label: 'Experimental UI',
    description: 'Enable experimental UI components and layouts',
  },
  dashboardV5: {
    label: 'Dashboard V5 (Preview)',
    description: 'Preview the next-generation dashboard design',
  },
  debugMode: {
    label: 'Debug Mode',
    description: 'Show extra debug info in browser console',
  },
  darkModeBeta: {
    label: 'Dark Mode Beta',
    description: 'Enable additional dark mode features',
  },
};

const STORAGE_KEY = 'fieldpro_feature_flags';

// Load flags from localStorage
const loadStoredFlags = (): Partial<FeatureFlags> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
  }
  return null;
};

// Save flags to localStorage
const saveFlags = (flags: FeatureFlags) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch (e) {
  }
};

interface FeatureFlagContextValue {
  // Current flag values
  flags: FeatureFlags;

  // Check if a specific flag is enabled
  isEnabled: (flag: keyof FeatureFlags) => boolean;

  // Toggle a flag
  toggleFlag: (flag: keyof FeatureFlags) => void;

  // Set a specific flag value
  setFlag: (flag: keyof FeatureFlags, value: boolean) => void;

  // Reset all flags to defaults
  resetFlags: () => void;

  // Set multiple flags at once
  setFlags: (flags: Partial<FeatureFlags>) => void;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

interface FeatureFlagProviderProps {
  children: ReactNode;
  // If true, enables feature flags (typically for dev users)
  enabled?: boolean;
}

export const FeatureFlagProvider = ({ children, enabled = true }: FeatureFlagProviderProps) => {
  // Initialize with stored flags merged with defaults
  const [flags, setFlagsState] = useState<FeatureFlags>(() => {
    if (!enabled) return DEFAULT_FEATURE_FLAGS;

    const stored = loadStoredFlags();
    return {
      ...DEFAULT_FEATURE_FLAGS,
      ...stored,
    };
  });

  // Persist flags when they change
  useEffect(() => {
    if (enabled) {
      saveFlags(flags);
    }
  }, [flags, enabled]);

  // Debug mode logging
  useEffect(() => {
    if (flags.debugMode) {
    }
  }, [flags]);

  const isEnabled = useCallback((flag: keyof FeatureFlags): boolean => {
    return flags[flag] ?? false;
  }, [flags]);

  const toggleFlag = useCallback((flag: keyof FeatureFlags) => {
    setFlagsState(prev => ({
      ...prev,
      [flag]: !prev[flag],
    }));
  }, []);

  const setFlag = useCallback((flag: keyof FeatureFlags, value: boolean) => {
    setFlagsState(prev => ({
      ...prev,
      [flag]: value,
    }));
  }, []);

  const resetFlags = useCallback(() => {
    setFlagsState(DEFAULT_FEATURE_FLAGS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setFlags = useCallback((newFlags: Partial<FeatureFlags>) => {
    setFlagsState(prev => ({
      ...prev,
      ...newFlags,
    }));
  }, []);

  const value = useMemo(() => ({
    flags,
    isEnabled,
    toggleFlag,
    setFlag,
    resetFlags,
    setFlags,
  }), [flags, isEnabled, toggleFlag, setFlag, resetFlags, setFlags]);

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

/**
 * Hook to access feature flags
 *
 * @example
 * const { isEnabled, toggleFlag } = useFeatureFlags();
 *
 * if (isEnabled('experimentalUI')) {
 *   // Show experimental component
 * }
 */
export function useFeatureFlags(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
}

/**
 * Optional hook that returns default values if outside provider
 */
export function useOptionalFeatureFlags(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    // Return a default implementation
    return {
      flags: DEFAULT_FEATURE_FLAGS,
      isEnabled: () => false,
      toggleFlag: () => {},
      setFlag: () => {},
      resetFlags: () => {},
      setFlags: () => {},
    };
  }
  return context;
}

export default FeatureFlagContext;

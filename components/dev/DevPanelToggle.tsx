import React, { useState, useEffect, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { useDevModeContext } from '../../contexts/DevModeContext';
import DevPanel from './DevPanel';

/**
 * DevPanelToggle - Floating button that opens the Dev Panel
 *
 * Features:
 * - Floating gear button in bottom-right corner (only for devs)
 * - Keyboard shortcut: Ctrl+Shift+D
 * - Visual indicator when dev mode is active
 */
export const DevPanelToggle: React.FC = () => {
  const { isDev, isDevModeActive, permissionOverrides } = useDevModeContext();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Check if any overrides are active (with null check)
  const hasOverrides = permissionOverrides ? Object.keys(permissionOverrides).length > 0 : false;

  // Keyboard shortcut: Ctrl+Shift+D
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      setIsPanelOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Don't render for non-dev users
  if (!isDev) return null;

  // Calculate indicator status
  const isActive = isDevModeActive || hasOverrides;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsPanelOpen(true)}
        className={`
          fixed bottom-20 md:bottom-6 right-4 z-[80]
          w-12 h-12 rounded-full
          flex items-center justify-center
          shadow-lg transition-all duration-200
          ${isActive
            ? 'bg-indigo-600 hover:bg-indigo-700 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900'
            : 'bg-slate-700 hover:bg-slate-600'
          }
          ${isPanelOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
        `}
        title="Open Dev Panel (Ctrl+Shift+D)"
      >
        <Settings className={`w-5 h-5 text-white ${isActive ? 'animate-spin-slow' : ''}`} />

        {/* Active indicator dot */}
        {isActive && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
        )}
      </button>

      {/* Panel */}
      <DevPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />

      {/* Custom animation */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </>
  );
};

export default DevPanelToggle;

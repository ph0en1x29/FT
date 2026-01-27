import React, { useEffect } from 'react';
import { X, Settings, RotateCcw } from 'lucide-react';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import RoleSwitcher from './RoleSwitcher';
import PermissionOverrides from './PermissionOverrides';
import FeatureFlagsPanel from './FeatureFlags';
import QuickActions from './QuickActions';

interface DevPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dev Panel - Slide-out control panel for developers
 *
 * Features:
 * - Role simulation (existing)
 * - Permission overrides (new)
 * - Feature flags (new)
 * - Quick actions (new)
 *
 * Keyboard shortcut: Ctrl+Shift+D (handled by parent)
 */
export const DevPanel: React.FC<DevPanelProps> = ({ isOpen, onClose }) => {
  const { isDev, deactivateDevMode, clearPermissionOverrides } = useDevModeContext();
  const { resetFlags } = useFeatureFlags();

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Don't render for non-dev users
  if (!isDev) return null;

  const handleResetAll = () => {
    deactivateDevMode();
    clearPermissionOverrides();
    resetFlags();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[90] md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`
          fixed top-0 right-0 h-full w-80 bg-slate-900 border-l border-slate-700
          z-[100] transform transition-transform duration-300 ease-out
          flex flex-col shadow-2xl
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-white">Dev Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetAll}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Reset All Dev Settings"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Role Simulation Section */}
          <PanelSection title="Role Simulation">
            <RoleSwitcher />
          </PanelSection>

          {/* Permission Overrides Section */}
          <PanelSection title="Permission Overrides">
            <PermissionOverrides />
          </PanelSection>

          {/* Feature Flags Section */}
          <PanelSection title="Feature Flags">
            <FeatureFlagsPanel />
          </PanelSection>

          {/* Quick Actions Section */}
          <PanelSection title="Quick Actions">
            <QuickActions />
          </PanelSection>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-700 bg-slate-800">
          <p className="text-xs text-slate-500 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Ctrl+Shift+D</kbd> to toggle
          </p>
        </div>
      </aside>
    </>
  );
};

// Reusable section component
const PanelSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-slate-800/50 rounded-lg border border-slate-700/50">
    <div className="px-3 py-2 border-b border-slate-700/50">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</h3>
    </div>
    <div className="p-3">
      {children}
    </div>
  </div>
);

export default DevPanel;

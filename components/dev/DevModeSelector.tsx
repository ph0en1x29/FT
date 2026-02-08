import { ChevronDown,Eye,Lock,Settings } from 'lucide-react';
import React,{ useEffect,useRef,useState } from 'react';
import { useOptionalDevModeContext } from '../../contexts/DevModeContext';
import { DevModeType } from '../../hooks/useDevMode';
import { UserRole } from '../../types';

const roleLabels: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'Admin',
  [UserRole.ADMIN_SERVICE]: 'Admin (Service)',
  [UserRole.ADMIN_STORE]: 'Admin (Store)',
  [UserRole.SUPERVISOR]: 'Supervisor',
  [UserRole.TECHNICIAN]: 'Technician',
  [UserRole.ACCOUNTANT]: 'Accountant',
};

/**
 * DevModeSelector - Simple dropdown for dev users to switch roles
 *
 * Theme-aware: uses CSS variables for colors
 * Only visible to dev users (dev@test.com or VITE_DEV_EMAILS)
 */
export const DevModeSelector: React.FC = () => {
  const context = useOptionalDevModeContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside - hook must be before any returns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't render if context is not available or user is not a dev
  if (!context || !context.isDev) return null;

  const {
    isDevModeActive,
    impersonatedRole,
    devModeType,
    currentUser,
    activateDevMode,
    deactivateDevMode,
    setDevModeType,
    setImpersonatedRole,
  } = context;

  const handleRoleSelect = (role: UserRole) => {
    if (isDevModeActive) {
      setImpersonatedRole(role);
    } else {
      activateDevMode(role, devModeType);
    }
    setIsOpen(false);
  };

  const handleModeToggle = () => {
    const newMode: DevModeType = devModeType === 'ui_only' ? 'strict' : 'ui_only';
    if (isDevModeActive) {
      setDevModeType(newMode);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
          ${isDevModeActive
            ? 'bg-amber-100 border-amber-300 text-amber-700 [data-theme=dark]:bg-amber-900/30 [data-theme=dark]:border-amber-700 [data-theme=dark]:text-amber-300'
            : 'bg-theme-surface-2 border-theme text-theme-muted hover:text-theme'
          }
        `}
        title="Dev Mode"
      >
        <Settings className={`w-4 h-4 ${isDevModeActive ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
        <span className="text-xs font-medium hidden sm:inline">
          {isDevModeActive ? roleLabels[impersonatedRole!] : 'DEV'}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-theme-surface border border-theme rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 bg-theme-surface-2 border-b border-theme">
            <p className="text-xs font-medium text-theme-muted">
              Actual Role: <span className="text-theme">{roleLabels[currentUser.role]}</span>
            </p>
          </div>

          {/* Role Options */}
          <div className="py-1">
            <p className="px-3 py-1 text-xs font-semibold text-theme-muted uppercase">Impersonate Role</p>
            {Object.entries(roleLabels).map(([value, label]) => (
              <button
                key={value}
                onClick={() => handleRoleSelect(value as UserRole)}
                className={`
                  w-full px-3 py-2 text-left text-sm transition-colors
                  ${impersonatedRole === value
                    ? 'bg-theme-accent-subtle text-theme-accent font-medium'
                    : 'text-theme hover:bg-theme-surface-2'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mode Toggle */}
          {isDevModeActive && (
            <div className="px-3 py-2 border-t border-theme">
              <button
                onClick={handleModeToggle}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-theme-surface-2 text-sm"
              >
                <span className="flex items-center gap-2 text-theme-muted">
                  {devModeType === 'strict' ? <Lock className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {devModeType === 'strict' ? 'Strict Mode' : 'UI Only'}
                </span>
                <span className="text-xs text-theme-muted">Click to toggle</span>
              </button>
            </div>
          )}

          {/* Exit Button */}
          {isDevModeActive && (
            <div className="px-3 py-2 border-t border-theme">
              <button
                onClick={() => { deactivateDevMode(); setIsOpen(false); }}
                className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 [data-theme=dark]:text-red-400 [data-theme=dark]:hover:bg-red-900/20 rounded transition-colors"
              >
                Exit Dev Mode
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DevModeSelector;

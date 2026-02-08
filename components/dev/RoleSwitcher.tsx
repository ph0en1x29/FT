import { ChevronDown,Eye,Lock } from 'lucide-react';
import React from 'react';
import { useDevModeContext } from '../../contexts/DevModeContext';
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

const roleColors: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'bg-purple-500',
  [UserRole.ADMIN_SERVICE]: 'bg-purple-600',
  [UserRole.ADMIN_STORE]: 'bg-indigo-500',
  [UserRole.SUPERVISOR]: 'bg-blue-500',
  [UserRole.TECHNICIAN]: 'bg-green-500',
  [UserRole.ACCOUNTANT]: 'bg-amber-500',
};

const modeOptions: { value: DevModeType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'ui_only',
    label: 'UI Only',
    icon: <Eye className="w-4 h-4" />,
    description: 'See UI as role, keep real permissions',
  },
  {
    value: 'strict',
    label: 'Strict',
    icon: <Lock className="w-4 h-4" />,
    description: 'Full role simulation with permissions',
  },
];

/**
 * RoleSwitcher - Component for switching between roles in dev mode
 *
 * Features:
 * - Role dropdown selector
 * - Mode toggle (UI Only vs Strict)
 * - Visual feedback for current selection
 *
 * Used within DevPanel for compact display
 */
export const RoleSwitcher: React.FC = () => {
  const {
    currentUser,
    isDevModeActive,
    impersonatedRole,
    devModeType,
    displayRole,
    activateDevMode,
    deactivateDevMode,
    setDevModeType,
    setImpersonatedRole,
  } = useDevModeContext();

  const handleRoleChange = (role: UserRole | 'none') => {
    if (role === 'none') {
      deactivateDevMode();
    } else {
      if (isDevModeActive) {
        setImpersonatedRole(role);
      } else {
        activateDevMode(role, devModeType);
      }
    }
  };

  const handleModeChange = (mode: DevModeType) => {
    if (!isDevModeActive) {
      // If not active, activate with current user's role in selected mode
      activateDevMode(currentUser.role, mode);
    } else {
      setDevModeType(mode);
    }
  };

  return (
    <div className="space-y-3">
      {/* Current Status */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">
          Actual: <span className="text-slate-300">{roleLabels[currentUser.role]}</span>
        </span>
        {isDevModeActive && (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleColors[displayRole]} text-white`}>
            Viewing as: {roleLabels[displayRole]}
          </span>
        )}
      </div>

      {/* Role Selector */}
      <div className="relative">
        <select
          value={isDevModeActive && impersonatedRole ? impersonatedRole : 'none'}
          onChange={(e) => handleRoleChange(e.target.value as UserRole | 'none')}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="none">-- No Impersonation --</option>
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        {modeOptions.map(({ value, label, icon, description }) => (
          <button
            key={value}
            onClick={() => handleModeChange(value)}
            className={`
              flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-colors
              ${devModeType === value && isDevModeActive
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-slate-300 hover:border-slate-500'
              }
            `}
            title={description}
          >
            <div className="flex items-center gap-1.5">
              {icon}
              <span className="text-xs font-medium">{label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Mode description */}
      {isDevModeActive && (
        <p className="text-xs text-slate-500">
          {devModeType === 'strict'
            ? 'Permissions are enforced as the impersonated role.'
            : 'UI shows impersonated role, but your real permissions apply.'}
        </p>
      )}
    </div>
  );
};

export default RoleSwitcher;

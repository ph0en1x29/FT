import React, { useState } from 'react';
import { UserRole } from '../../types_with_invoice_tracking';
import { DevModeType } from '../../hooks/useDevMode';
import { Shield, Wrench, FileText, User, ChevronDown, Eye, Lock } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: UserRole;
  impersonatedRole: UserRole | null;
  devModeType: DevModeType;
  onRoleChange: (role: UserRole) => void;
  onModeTypeChange: (type: DevModeType) => void;
  onDeactivate: () => void;
}

const roles = [
  { role: UserRole.ADMIN, label: 'Admin', icon: Shield, color: 'text-purple-500' },
  { role: UserRole.SUPERVISOR, label: 'Supervisor', icon: User, color: 'text-blue-500' },
  { role: UserRole.TECHNICIAN, label: 'Technician', icon: Wrench, color: 'text-green-500' },
  { role: UserRole.ACCOUNTANT, label: 'Accountant', icon: FileText, color: 'text-amber-500' },
];

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentRole,
  impersonatedRole,
  devModeType,
  onRoleChange,
  onModeTypeChange,
  onDeactivate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeRole = impersonatedRole || currentRole;
  const activeRoleInfo = roles.find(r => r.role === activeRole)!;
  const ActiveIcon = activeRoleInfo.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-surface-secondary rounded-lg border border-border hover:border-primary/50 transition-colors"
      >
        <ActiveIcon className={`w-4 h-4 ${activeRoleInfo.color}`} />
        <span className="text-sm font-medium text-text-primary">{activeRoleInfo.label}</span>
        <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-surface-primary border border-border rounded-lg shadow-xl z-50 overflow-hidden">
            {/* Role Selection */}
            <div className="p-2 border-b border-border">
              <p className="text-xs text-text-secondary px-2 py-1 font-medium">VIEW AS ROLE</p>
              {roles.map(({ role, label, icon: Icon, color }) => (
                <button
                  key={role}
                  onClick={() => {
                    onRoleChange(role);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                    activeRole === role
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-surface-secondary text-text-primary'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-sm">{label}</span>
                  {activeRole === role && (
                    <span className="ml-auto text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Active</span>
                  )}
                </button>
              ))}
            </div>

            {/* Mode Type Toggle */}
            <div className="p-2 border-b border-border">
              <p className="text-xs text-text-secondary px-2 py-1 font-medium">PERMISSION MODE</p>
              <button
                onClick={() => onModeTypeChange('ui_only')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  devModeType === 'ui_only'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'hover:bg-surface-secondary text-text-primary'
                }`}
              >
                <Eye className="w-4 h-4" />
                <div>
                  <span className="text-sm">UI Only</span>
                  <p className="text-xs text-text-secondary">See dashboard, keep real permissions</p>
                </div>
              </button>
              <button
                onClick={() => onModeTypeChange('strict')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  devModeType === 'strict'
                    ? 'bg-red-500/10 text-red-600'
                    : 'hover:bg-surface-secondary text-text-primary'
                }`}
              >
                <Lock className="w-4 h-4" />
                <div>
                  <span className="text-sm">Strict Mode</span>
                  <p className="text-xs text-text-secondary">Actually limit to role's permissions</p>
                </div>
              </button>
            </div>

            {/* Exit Button */}
            {impersonatedRole && (
              <div className="p-2">
                <button
                  onClick={() => {
                    onDeactivate();
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-md transition-colors text-center font-medium"
                >
                  Exit Dev Mode
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RoleSwitcher;

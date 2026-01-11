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
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)',
          color: 'var(--text)'
        }}
      >
        <ActiveIcon className={`w-4 h-4 ${activeRoleInfo.color}`} />
        <span className="text-sm font-medium">{activeRoleInfo.label}</span>
        <ChevronDown 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute right-0 mt-2 w-64 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            {/* Role Selection */}
            <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-xs px-2 py-1 font-medium" style={{ color: 'var(--text-muted)' }}>VIEW AS ROLE</p>
              {roles.map(({ role, label, icon: Icon, color }) => (
                <button
                  key={role}
                  onClick={() => {
                    onRoleChange(role);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors`}
                  style={{ 
                    background: activeRole === role ? 'var(--accent-subtle)' : 'transparent',
                    color: activeRole === role ? 'var(--accent)' : 'var(--text)'
                  }}
                >
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-sm">{label}</span>
                  {activeRole === role && (
                    <span 
                      className="ml-auto text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
                    >
                      Active
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Mode Type Toggle */}
            <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-xs px-2 py-1 font-medium" style={{ color: 'var(--text-muted)' }}>PERMISSION MODE</p>
              <button
                onClick={() => onModeTypeChange('ui_only')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors"
                style={{ 
                  background: devModeType === 'ui_only' ? 'var(--warning-bg)' : 'transparent',
                  color: devModeType === 'ui_only' ? 'var(--warning)' : 'var(--text)'
                }}
              >
                <Eye className="w-4 h-4" />
                <div>
                  <span className="text-sm">UI Only</span>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>See dashboard, keep real permissions</p>
                </div>
              </button>
              <button
                onClick={() => onModeTypeChange('strict')}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors"
                style={{ 
                  background: devModeType === 'strict' ? 'var(--error-bg)' : 'transparent',
                  color: devModeType === 'strict' ? 'var(--error)' : 'var(--text)'
                }}
              >
                <Lock className="w-4 h-4" />
                <div>
                  <span className="text-sm">Strict Mode</span>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Actually limit to role's permissions</p>
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
                  className="w-full px-3 py-2 text-sm rounded-md transition-colors text-center font-medium"
                  style={{ color: 'var(--error)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--error-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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

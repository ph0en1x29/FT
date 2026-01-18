import React from 'react';
import { AlertTriangle, X, Eye, Lock } from 'lucide-react';
import { UserRole } from '../../types';
import { DevModeType } from '../../hooks/useDevMode';

interface DevBannerProps {
  impersonatedRole: UserRole;
  actualRole: UserRole;
  devModeType: DevModeType;
  onExit: () => void;
}

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

export const DevBanner: React.FC<DevBannerProps> = ({
  impersonatedRole,
  actualRole,
  devModeType,
  onExit,
}) => {
  const isStrict = devModeType === 'strict';

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] ${isStrict ? 'bg-red-600' : 'bg-amber-500'} text-white px-4 py-2 shadow-lg`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">DEV MODE</span>
          <span className="text-white/80">|</span>
          <div className="flex items-center gap-2">
            <span className="text-white/80">Viewing as:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${roleColors[impersonatedRole]}`}>
              {roleLabels[impersonatedRole]}
            </span>
          </div>
          <span className="text-white/80">|</span>
          <div className="flex items-center gap-1.5">
            {isStrict ? (
              <>
                <Lock className="w-4 h-4" />
                <span className="text-xs font-medium">STRICT MODE</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span className="text-xs font-medium">UI ONLY</span>
              </>
            )}
          </div>
          <span className="text-white/60 text-xs hidden sm:inline">
            (Actual: {roleLabels[actualRole]})
          </span>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Exit Dev Mode
        </button>
      </div>
    </div>
  );
};

export default DevBanner;

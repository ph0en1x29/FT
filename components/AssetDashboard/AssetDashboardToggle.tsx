/**
 * AssetDashboardToggle - Dev mode toggle between V1 and V2 dashboard
 * 
 * When dev mode is active, shows a toggle button to switch between
 * the current (V1) and prototype (V2) fleet overview.
 * Non-dev users always see V1.
 */

import { Beaker } from 'lucide-react';
import React, { useState } from 'react';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { User } from '../../types';
import AssetDashboard from './AssetDashboard';
import AssetDashboardV2 from './AssetDashboardV2';

interface AssetDashboardToggleProps {
  currentUser: User;
}

const AssetDashboardToggle: React.FC<AssetDashboardToggleProps> = ({ currentUser }) => {
  const { isDev } = useDevModeContext();
  const [useV2, setUseV2] = useState(false);

  // Non-dev users always get V1
  if (!isDev) {
    return <AssetDashboard currentUser={currentUser} />;
  }

  return (
    <div>
      {/* Dev toggle */}
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setUseV2(!useV2)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            useV2
              ? 'bg-purple-100 text-purple-700 border border-purple-300'
              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
          }`}
        >
          <Beaker className="w-3.5 h-3.5" />
          {useV2 ? 'V2 Prototype' : 'V1 Current'}
        </button>
      </div>

      {/* Render selected version */}
      {useV2 ? (
        <AssetDashboardV2 currentUser={currentUser} />
      ) : (
        <AssetDashboard currentUser={currentUser} />
      )}
    </div>
  );
};

export default AssetDashboardToggle;

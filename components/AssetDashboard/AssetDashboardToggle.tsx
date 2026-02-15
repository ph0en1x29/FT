/**
 * AssetDashboardToggle - Dev mode toggle between V1 and V3 dashboard
 * 
 * Dev users see a toggle button to switch between current (V1) and prototype (V3).
 * Non-dev users always see V1.
 */

import { Beaker } from 'lucide-react';
import React, { useState } from 'react';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { User } from '../../types';
import AssetDashboard from './AssetDashboard';
import AssetDashboardV3 from './AssetDashboardV3';

interface AssetDashboardToggleProps {
  currentUser: User;
}

const AssetDashboardToggle: React.FC<AssetDashboardToggleProps> = ({ currentUser }) => {
  const { isDev } = useDevModeContext();
  const [useV3, setUseV3] = useState(false);

  if (!isDev) {
    return <AssetDashboard currentUser={currentUser} />;
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setUseV3(!useV3)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            useV3
              ? 'bg-purple-100 text-purple-700 border border-purple-300'
              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
          }`}
        >
          <Beaker className="w-3.5 h-3.5" />
          {useV3 ? 'V3 Prototype' : 'V1 Current'}
        </button>
      </div>

      {useV3 ? (
        <AssetDashboardV3 currentUser={currentUser} />
      ) : (
        <AssetDashboard currentUser={currentUser} />
      )}
    </div>
  );
};

export default AssetDashboardToggle;

/**
 * AssetDashboardToggle - Dev mode toggle between V1, V3, and V3.1
 * 
 * Dev users see toggle buttons to compare versions.
 * Non-dev users always see V1.
 */

import { Beaker } from 'lucide-react';
import React, { useState } from 'react';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { User } from '../../types';
import AssetDashboard from './AssetDashboard';
import AssetDashboardV3 from './AssetDashboardV3';
import AssetDashboardV3_1 from './AssetDashboardV3_1';

type Version = 'v1' | 'v3' | 'v3.1';

const VERSIONS: { id: Version; label: string; desc: string }[] = [
  { id: 'v1', label: 'V1', desc: 'Current' },
  { id: 'v3', label: 'V3', desc: 'Clean header' },
  { id: 'v3.1', label: 'V3.1', desc: 'Accent table' },
];

interface AssetDashboardToggleProps {
  currentUser: User;
}

const AssetDashboardToggle: React.FC<AssetDashboardToggleProps> = ({ currentUser }) => {
  const { isDev } = useDevModeContext();
  const [version, setVersion] = useState<Version>('v1');

  if (!isDev) {
    return <AssetDashboard currentUser={currentUser} />;
  }

  return (
    <div>
      {/* Version toggle */}
      <div className="flex items-center justify-end gap-1 mb-4">
        <Beaker className="w-3.5 h-3.5 text-purple-500 mr-1" />
        {VERSIONS.map((v) => (
          <button
            key={v.id}
            onClick={() => setVersion(v.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              version === v.id
                ? 'bg-purple-100 text-purple-700 border border-purple-300'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            }`}
            title={v.desc}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Render selected version */}
      {version === 'v1' && <AssetDashboard currentUser={currentUser} />}
      {version === 'v3' && <AssetDashboardV3 currentUser={currentUser} />}
      {version === 'v3.1' && <AssetDashboardV3_1 currentUser={currentUser} />}
    </div>
  );
};

export default AssetDashboardToggle;

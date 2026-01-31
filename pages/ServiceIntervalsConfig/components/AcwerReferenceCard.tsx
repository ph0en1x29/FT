import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ACWER_DEFAULTS } from '../constants';
import { getTypeIcon } from '../utils';

const AcwerReferenceCard: React.FC = () => {
  return (
    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-semibold text-indigo-400 mb-2 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        ACWER Default Service Intervals
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ACWER_DEFAULTS.map((d) => (
          <div key={d.type} className="flex items-center gap-2 text-sm text-theme-secondary">
            {getTypeIcon(d.type)}
            <span className="font-medium text-theme-primary">{d.type}:</span>
            <span>{d.interval}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AcwerReferenceCard;

import React from 'react';
import { RotateCcw, ToggleLeft, ToggleRight } from 'lucide-react';
import { useFeatureFlags, FEATURE_FLAG_INFO, DEFAULT_FEATURE_FLAGS, FeatureFlags } from '../../hooks/useFeatureFlags';

/**
 * FeatureFlagsPanel - Toggle experimental features on/off
 *
 * Features:
 * - Toggle flags individually
 * - Reset to defaults button
 * - Persisted to localStorage
 */
export const FeatureFlagsPanel: React.FC = () => {
  const { flags, toggleFlag, resetFlags } = useFeatureFlags();

  const flagKeys = Object.keys(FEATURE_FLAG_INFO) as (keyof FeatureFlags)[];
  const changedCount = flagKeys.filter(key => flags[key] !== DEFAULT_FEATURE_FLAGS[key]).length;

  return (
    <div className="space-y-3">
      {/* Header with reset */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {changedCount > 0 ? (
            <span className="text-indigo-400">{changedCount} changed from defaults</span>
          ) : (
            'Using defaults'
          )}
        </span>
        {changedCount > 0 && (
          <button
            onClick={resetFlags}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* Flag List */}
      <div className="space-y-2">
        {flagKeys.map(flagKey => {
          const info = FEATURE_FLAG_INFO[flagKey];
          const isEnabled = flags[flagKey];
          const isDefault = isEnabled === DEFAULT_FEATURE_FLAGS[flagKey];

          return (
            <button
              key={flagKey}
              onClick={() => toggleFlag(flagKey)}
              className={`
                w-full flex items-start gap-3 p-2 rounded-lg border transition-colors text-left
                ${isEnabled
                  ? 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20'
                  : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                }
              `}
            >
              {/* Toggle icon */}
              <div className="flex-shrink-0 mt-0.5">
                {isEnabled ? (
                  <ToggleRight className="w-5 h-5 text-indigo-400" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-500" />
                )}
              </div>

              {/* Label and description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${isEnabled ? 'text-indigo-300' : 'text-slate-300'}`}>
                    {info.label}
                  </span>
                  {!isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                      Changed
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  {info.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <p className="text-[10px] text-slate-600">
        Flags persist across page reloads.
      </p>
    </div>
  );
};

export default FeatureFlagsPanel;

/**
 * Re-export feature flag hook from context for convenience
 *
 * This allows importing from hooks/ directory consistently
 */
export {
  useFeatureFlags,
  useOptionalFeatureFlags,
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_INFO,
} from '../contexts/FeatureFlagContext';

export type { FeatureFlags } from '../contexts/FeatureFlagContext';

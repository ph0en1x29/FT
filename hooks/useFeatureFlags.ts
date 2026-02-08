/**
 * Re-export feature flag hook from context for convenience
 *
 * This allows importing from hooks/ directory consistently
 */
export {
DEFAULT_FEATURE_FLAGS,
FEATURE_FLAG_INFO,useFeatureFlags,
useOptionalFeatureFlags
} from '../contexts/FeatureFlagContext';

export type { FeatureFlags } from '../contexts/FeatureFlagContext';

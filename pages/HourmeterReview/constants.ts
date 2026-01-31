import { HourmeterFlagReason } from '../../types';

export const FLAG_REASON_LABELS: Record<HourmeterFlagReason, string> = {
  lower_than_previous: 'Lower than previous',
  excessive_jump: 'Excessive jump',
  pattern_mismatch: 'Pattern mismatch',
  manual_flag: 'Manually flagged',
  timestamp_mismatch: 'Timestamp issue',
};

export type TabType = 'pending' | 'approved' | 'rejected';

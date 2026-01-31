import { JobStatus, JobType } from '../../../types';

export type ToneStyle = { bg: string; text: string };

export const toneStyles: Record<string, ToneStyle> = {
  success: { bg: 'bg-[var(--success-bg)]', text: 'text-[var(--success)]' },
  warning: { bg: 'bg-[var(--warning-bg)]', text: 'text-[var(--warning)]' },
  error: { bg: 'bg-[var(--error-bg)]', text: 'text-[var(--error)]' },
  info: { bg: 'bg-[var(--info-bg)]', text: 'text-[var(--info)]' },
  accent: { bg: 'bg-theme-accent-subtle', text: 'text-theme-accent' },
  neutral: { bg: 'bg-theme-surface-2', text: 'text-theme-secondary' },
};

export const getStatusTone = (status: string): ToneStyle => {
  switch (status) {
    case JobStatus.COMPLETED:
      return toneStyles.success;
    case JobStatus.IN_PROGRESS:
      return toneStyles.info;
    case JobStatus.ASSIGNED:
      return toneStyles.accent;
    case JobStatus.NEW:
      return toneStyles.info;
    case JobStatus.AWAITING_FINALIZATION:
      return toneStyles.warning;
    case 'Completed Awaiting Ack':
      return toneStyles.accent;
    case 'Cancelled':
      return toneStyles.error;
    default:
      return toneStyles.neutral;
  }
};

export const getJobTypeTone = (type?: string): ToneStyle => {
  switch (type) {
    case JobType.SLOT_IN:
      return toneStyles.error;
    case JobType.REPAIR:
      return toneStyles.warning;
    case JobType.SERVICE:
      return toneStyles.success;
    case JobType.CHECKING:
      return toneStyles.info;
    case JobType.COURIER:
      return toneStyles.warning;
    default:
      return toneStyles.neutral;
  }
};

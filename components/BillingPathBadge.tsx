/**
 * BillingPathBadge — ACWER service flow Path A/B/C visual indicator.
 *
 * Read-only chip rendered next to other job badges. The reason text becomes
 * the title attribute so admins can see WHY a job got classified.
 *
 * Phase 1: this is purely advisory. Path A/B/C is observed, not enforced —
 * downstream pricing and inventory still go through the legacy `billing_type`
 * pathway. Phase 4+ will add enforcement gates.
 */
import React from 'react';

import type { BillingPath } from '../types/service-flow.types';

type Path = BillingPath | 'amc' | 'chargeable' | 'fleet' | 'unset' | undefined | null;

interface BillingPathBadgeProps {
  path?: Path;
  reason?: string | null;
  /** When true, render in a compact form (just the path letter, no full text) */
  compact?: boolean;
  className?: string;
}

const STYLES: Record<string, { label: string; short: string; cls: string }> = {
  amc: {
    label: 'Path A · AMC',
    short: 'A',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
  },
  chargeable: {
    label: 'Path B · Chargeable',
    short: 'B',
    cls: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700',
  },
  fleet: {
    label: 'Path C · Fleet',
    short: 'C',
    cls: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  },
  unset: {
    label: 'Path: Unset',
    short: '?',
    cls: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
  },
};

export const BillingPathBadge: React.FC<BillingPathBadgeProps> = ({
  path,
  reason,
  compact = false,
  className = '',
}) => {
  const key = (path ?? 'unset') as keyof typeof STYLES;
  const style = STYLES[key] ?? STYLES.unset;
  const title = reason ? `${style.label} — ${reason}` : style.label;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${style.cls} ${className}`.trim()}
    >
      {compact ? style.short : style.label}
    </span>
  );
};

export default BillingPathBadge;

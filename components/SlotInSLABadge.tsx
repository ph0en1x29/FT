import React, { useState, useEffect, useMemo } from 'react';
import { Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export type SLAStatus = 'on_track' | 'warning' | 'critical' | 'breached' | 'met';

interface SlotInSLABadgeProps {
  createdAt: string;
  acknowledgedAt?: string;
  slaTargetMinutes?: number;
  showCountdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface SLAState {
  status: SLAStatus;
  remainingMs: number;
  elapsedMs: number;
  percentUsed: number;
  label: string;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const sign = ms < 0 ? '-' : '';
  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function calculateSLAState(
  createdAt: string,
  acknowledgedAt: string | undefined,
  slaTargetMinutes: number
): SLAState {
  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  const targetMs = slaTargetMinutes * 60 * 1000;
  const deadlineTime = createdTime + targetMs;

  // If already acknowledged, check if SLA was met
  if (acknowledgedAt) {
    const ackTime = new Date(acknowledgedAt).getTime();
    const elapsedMs = ackTime - createdTime;
    const wasOnTime = elapsedMs <= targetMs;

    return {
      status: 'met',
      remainingMs: targetMs - elapsedMs,
      elapsedMs,
      percentUsed: Math.min(100, (elapsedMs / targetMs) * 100),
      label: wasOnTime
        ? `Acknowledged in ${formatTime(elapsedMs)}`
        : `Acknowledged ${formatTime(elapsedMs - targetMs)} late`,
    };
  }

  // Calculate current state
  const elapsedMs = now - createdTime;
  const remainingMs = deadlineTime - now;
  const percentUsed = Math.min(100, Math.max(0, (elapsedMs / targetMs) * 100));

  // Determine status based on remaining time
  let status: SLAStatus;
  let label: string;

  if (remainingMs <= 0) {
    // SLA breached
    status = 'breached';
    label = `Overdue by ${formatTime(Math.abs(remainingMs))}`;
  } else if (remainingMs <= 5 * 60 * 1000) {
    // Less than 5 minutes - critical
    status = 'critical';
    label = `${formatTime(remainingMs)} remaining`;
  } else if (remainingMs <= 10 * 60 * 1000) {
    // Less than 10 minutes - warning
    status = 'warning';
    label = `${formatTime(remainingMs)} remaining`;
  } else {
    // More than 10 minutes - on track
    status = 'on_track';
    label = `${formatTime(remainingMs)} remaining`;
  }

  return {
    status,
    remainingMs,
    elapsedMs,
    percentUsed,
    label,
  };
}

const statusConfig: Record<
  SLAStatus,
  { bgClass: string; textClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  on_track: {
    bgClass: 'bg-[var(--success-bg)]',
    textClass: 'text-[var(--success)]',
    icon: Clock,
  },
  warning: {
    bgClass: 'bg-[var(--warning-bg)]',
    textClass: 'text-[var(--warning)]',
    icon: AlertTriangle,
  },
  critical: {
    bgClass: 'bg-[var(--error-bg)]',
    textClass: 'text-[var(--error)]',
    icon: AlertTriangle,
  },
  breached: {
    bgClass: 'bg-[#1a1a1a]',
    textClass: 'text-white',
    icon: XCircle,
  },
  met: {
    bgClass: 'bg-[var(--success-bg)]',
    textClass: 'text-[var(--success)]',
    icon: CheckCircle,
  },
};

const sizeConfig = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    iconSize: 12,
  },
  md: {
    padding: 'px-2.5 py-1',
    text: 'text-sm',
    iconSize: 14,
  },
  lg: {
    padding: 'px-3 py-1.5',
    text: 'text-base',
    iconSize: 16,
  },
};

export default function SlotInSLABadge({
  createdAt,
  acknowledgedAt,
  slaTargetMinutes = 15,
  showCountdown = true,
  size = 'md',
  className = '',
}: SlotInSLABadgeProps) {
  const [slaState, setSlaState] = useState<SLAState>(() =>
    calculateSLAState(createdAt, acknowledgedAt, slaTargetMinutes)
  );

  // Update countdown every second if not acknowledged
  useEffect(() => {
    if (acknowledgedAt) {
      // Already acknowledged, no need to update
      setSlaState(calculateSLAState(createdAt, acknowledgedAt, slaTargetMinutes));
      return;
    }

    // Update immediately
    setSlaState(calculateSLAState(createdAt, acknowledgedAt, slaTargetMinutes));

    // Set up interval for live countdown
    const interval = setInterval(() => {
      setSlaState(calculateSLAState(createdAt, acknowledgedAt, slaTargetMinutes));
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt, acknowledgedAt, slaTargetMinutes]);

  const config = statusConfig[slaState.status];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  const shouldAnimate = slaState.status === 'critical' || slaState.status === 'breached';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeStyles.padding} ${sizeStyles.text} ${config.bgClass} ${config.textClass} ${shouldAnimate ? 'animate-pulse' : ''} ${className}`}
      title={`SLA Target: ${slaTargetMinutes} minutes`}
    >
      <Icon className="flex-shrink-0" style={{ width: sizeStyles.iconSize, height: sizeStyles.iconSize }} />
      {showCountdown && <span>{slaState.label}</span>}
    </span>
  );
}

// Export utility function for other components
export function getSLAStatus(
  createdAt: string,
  acknowledgedAt: string | undefined,
  slaTargetMinutes: number = 15
): SLAState {
  return calculateSLAState(createdAt, acknowledgedAt, slaTargetMinutes);
}

// Compact version for table cells
export function SlotInSLABadgeCompact({
  createdAt,
  acknowledgedAt,
  slaTargetMinutes = 15,
}: {
  createdAt: string;
  acknowledgedAt?: string;
  slaTargetMinutes?: number;
}) {
  return (
    <SlotInSLABadge
      createdAt={createdAt}
      acknowledgedAt={acknowledgedAt}
      slaTargetMinutes={slaTargetMinutes}
      size="sm"
      showCountdown={true}
    />
  );
}

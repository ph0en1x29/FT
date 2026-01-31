import React from 'react';
import {
  AlertTriangle, Clock, CheckCircle, UserX, Timer,
  Play, Calendar, ChevronRight, ArrowRight
} from 'lucide-react';

/**
 * Design tokens and shared UI components for Dashboard V4
 */

// ============================================
// DESIGN TOKENS
// ============================================
export const colors = {
  red: { bg: 'rgba(255, 59, 48, 0.08)', text: '#FF3B30', border: 'rgba(255, 59, 48, 0.15)' },
  orange: { bg: 'rgba(255, 149, 0, 0.08)', text: '#FF9500', border: 'rgba(255, 149, 0, 0.15)' },
  green: { bg: 'rgba(52, 199, 89, 0.08)', text: '#34C759', border: 'rgba(52, 199, 89, 0.15)' },
  blue: { bg: 'rgba(0, 122, 255, 0.08)', text: '#007AFF', border: 'rgba(0, 122, 255, 0.15)' },
  purple: { bg: 'rgba(175, 82, 222, 0.08)', text: '#AF52DE', border: 'rgba(175, 82, 222, 0.15)' },
};

// ============================================
// SHARED COMPONENTS
// ============================================

export const EscalationBanner: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => {
  if (count === 0) return null;
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.995]"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 59, 48, 0.06) 0%, rgba(255, 149, 0, 0.04) 100%)',
        border: '1px solid rgba(255, 59, 48, 0.12)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: colors.red.bg }}>
          <AlertTriangle className="w-4 h-4" style={{ color: colors.red.text }} />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {count} escalation{count !== 1 ? 's' : ''} need attention
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Review and acknowledge to resolve</p>
        </div>
      </div>
      <button
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
        style={{ background: colors.red.text, color: 'white' }}
      >
        Review <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export const KPICard: React.FC<{
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  accent: keyof typeof colors;
  alert?: boolean;
  onClick?: () => void;
}> = ({ label, value, sublabel, icon, accent, alert, onClick }) => {
  const c = colors[accent];
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl p-4 transition-all ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}`}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${alert ? c.text : 'var(--border)'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-2xl font-semibold mt-1" style={{ color: alert ? c.text : 'var(--text)', letterSpacing: '-0.02em' }}>{value}</p>
          {sublabel && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
          <div style={{ color: c.text }}>{icon}</div>
        </div>
      </div>
    </div>
  );
};

export type QueueItemType = 'overdue' | 'escalated' | 'unassigned' | 'awaiting' | 'due-today' | 'disputed' | 'assigned' | 'in-progress';

export const QueueItem: React.FC<{
  type: QueueItemType;
  jobNumber: string;
  customer: string;
  detail: string;
  urgent?: boolean;
  onClick?: () => void;
}> = ({ type, jobNumber, customer, detail, urgent, onClick }) => {
  const typeConfig = {
    overdue: { icon: <Clock className="w-4 h-4" />, color: colors.red },
    escalated: { icon: <AlertTriangle className="w-4 h-4" />, color: colors.red },
    unassigned: { icon: <UserX className="w-4 h-4" />, color: colors.orange },
    awaiting: { icon: <Timer className="w-4 h-4" />, color: colors.purple },
    disputed: { icon: <AlertTriangle className="w-4 h-4" />, color: colors.orange },
    'due-today': { icon: <Calendar className="w-4 h-4" />, color: colors.blue },
    assigned: { icon: <CheckCircle className="w-4 h-4" />, color: colors.blue },
    'in-progress': { icon: <Play className="w-4 h-4" />, color: colors.orange },
  };
  const config = typeConfig[type];

  return (
    <div onClick={onClick} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-2)] cursor-pointer transition-colors">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: config.color.bg }}>
        <div style={{ color: config.color.text }}>{config.icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{jobNumber}</p>
          {urgent && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: colors.red.bg, color: colors.red.text }}>URGENT</span>
          )}
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{customer} · {detail}</p>
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
    </div>
  );
};

export const TeamRow: React.FC<{ name: string; status: 'available' | 'busy' | 'overloaded'; jobCount: number }> = ({ name, status, jobCount }) => {
  const statusConfig = {
    available: { color: colors.green.text, bg: colors.green.bg, label: 'Available' },
    busy: { color: colors.orange.text, bg: colors.orange.bg, label: `${jobCount} jobs` },
    overloaded: { color: colors.red.text, bg: colors.red.bg, label: `${jobCount} jobs` },
  };
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
        {name.charAt(0)}
      </div>
      <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{name}</span>
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: config.bg }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
        <span className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</span>
      </div>
    </div>
  );
};

export const QuickChip: React.FC<{ icon: React.ReactNode; label: string; count?: number; accent?: string; onClick?: () => void }> = ({ icon, label, count, accent, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
    style={{ background: accent ? `${accent}10` : 'var(--surface)', border: '1px solid var(--border)', color: accent || 'var(--text)' }}
  >
    {icon}
    <span>{label}</span>
    {count !== undefined && count > 0 && (
      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: accent ? `${accent}15` : 'var(--surface-2)', color: accent || 'var(--text-muted)' }}>{count}</span>
    )}
  </button>
);

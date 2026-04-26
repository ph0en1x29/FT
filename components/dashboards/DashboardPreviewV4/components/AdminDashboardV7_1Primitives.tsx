import { CheckSquare, ChevronDown, ChevronUp, Square, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import type { Job } from '../../../../types';
import { colors } from './DashboardWidgets';

export const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: number;
  badgeColor?: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, badge, badgeColor, defaultOpen = true, actions, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between transition-colors hover:opacity-90"
        style={{ borderBottom: open ? '1px solid var(--border-subtle)' : 'none' }}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</h3>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: badgeColor || colors.red.bg, color: badgeColor ? 'white' : colors.red.text }}>
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && actions}
          {open ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
};

export const BulkActionBar: React.FC<{
  count: number;
  onClear: () => void;
  actions: { label: string; icon: React.ReactNode; onClick: () => void; variant?: 'primary' | 'danger' | 'default' }[];
}> = ({ count, onClear, actions }) => {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
      style={{ background: 'var(--text)', color: 'white', minWidth: 320 }}>
      <span className="text-sm font-medium">{count} selected</span>
      <div className="flex items-center gap-2 ml-auto">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95 ${
              a.variant === 'primary' ? 'bg-[var(--surface)] text-gray-900' :
              a.variant === 'danger' ? 'bg-red-500 text-white' :
              'bg-white/20 text-white'
            }`}
          >
            {a.icon} {a.label}
          </button>
        ))}
        <button onClick={onClear} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const SelectableJobRow: React.FC<{
  job: Job;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
  badge: { label: string; color: string; bg: string };
  techName?: string;
  showActions?: React.ReactNode;
}> = ({ job, selected, onToggle, onClick, badge, techName, showActions }) => (
  <div
    className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:scale-[1.005]"
    style={{ background: selected ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'transparent', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}` }}
  >
    <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-0.5 flex-shrink-0">
      {selected
        ? <CheckSquare className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        : <Square className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      }
    </button>
    <button onClick={onClick} className="flex-1 text-left min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
          {job.job_number || job.title}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{ background: badge.bg, color: badge.color }}>
          {badge.label}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{job.customer?.name || 'Unknown'}</span>
        {techName && (
          <>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>•</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{techName}</span>
          </>
        )}
      </div>
    </button>
    {showActions && <div className="flex-shrink-0">{showActions}</div>}
  </div>
);

export const PipelineColumn: React.FC<{
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ title, count, color, children, onClick }) => (
  <div className="flex-1 min-w-[160px]">
    <button onClick={onClick} className="flex items-center gap-2 mb-2 w-full text-left hover:opacity-80">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>
      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>{count}</span>
    </button>
    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {count === 0 ? (
        <div className="py-4 text-center rounded-lg" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No jobs</p>
        </div>
      ) : children}
    </div>
  </div>
);

export const PipelineCard: React.FC<{
  job: Job;
  techName?: string;
  onClick: () => void;
  accent: string;
  technicians?: { user_id: string; name: string }[];
  onAssign?: (jobId: string, techId: string) => void;
}> = ({ job, techName, onClick, accent, technicians, onAssign }) => {
  const [showAssign, setShowAssign] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isUnassigned = !job.assigned_technician_id;

  useEffect(() => {
    if (!showAssign) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAssign(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAssign]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onClick}
        className="w-full text-left p-2 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: 'var(--surface-2)', borderLeft: `3px solid ${accent}` }}
      >
        <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{job.job_number || job.title}</p>
        <div className="flex items-center gap-1">
          {isUnassigned && onAssign ? (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAssign(!showAssign); }}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:opacity-80 transition-colors"
              style={{ color: colors.orange.text, background: colors.orange.bg }}
            >
              + Assign
            </button>
          ) : (
            <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{techName || 'Unassigned'}</span>
          )}
          <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>• {job.customer?.name || ''}</span>
        </div>
      </button>
      {showAssign && technicians && onAssign && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-lg shadow-xl py-1 max-h-[150px] overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {technicians.map(t => (
            <button
              key={t.user_id}
              onClick={() => { onAssign(job.job_id, t.user_id); setShowAssign(false); }}
              className="w-full text-left px-3 py-1.5 text-xs transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const StatPill: React.FC<{
  label: string;
  value: string | number;
  color: string;
  pulse?: boolean;
  onClick?: () => void;
}> = ({ label, value, color, pulse, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97] ${pulse ? 'animate-pulse' : ''}`}
    style={{ background: `${color}15`, border: `1px solid ${color}30` }}
  >
    <span className="text-lg font-bold" style={{ color }}>{value}</span>
    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
  </button>
);

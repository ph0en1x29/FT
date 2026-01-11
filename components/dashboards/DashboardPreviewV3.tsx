import React from 'react';
import {
  AlertTriangle, Clock, CheckCircle, Users, TrendingUp, TrendingDown,
  ChevronRight, Play, Wrench, DollarSign, UserX, Timer, FileText,
  Plus, Truck, BarChart3, Bell, ArrowUpRight, ArrowDownRight,
  Calendar, AlertCircle, Package
} from 'lucide-react';

/**
 * Dashboard Preview V3 - Layout Mockup
 * 
 * This is a VISUAL PREVIEW to validate the layout before full implementation.
 * Uses static/mock data to demonstrate:
 * - Balanced 12-col grid layout
 * - Clear information hierarchy
 * - "Work Queue" as operational center
 * - Consistent card purposes (metrics vs lists vs navigation)
 */

// ============================================
// DESIGN TOKENS
// ============================================
const colors = {
  red: { bg: 'rgba(255, 59, 48, 0.08)', text: '#FF3B30', border: 'rgba(255, 59, 48, 0.15)' },
  orange: { bg: 'rgba(255, 149, 0, 0.08)', text: '#FF9500', border: 'rgba(255, 149, 0, 0.15)' },
  green: { bg: 'rgba(52, 199, 89, 0.08)', text: '#34C759', border: 'rgba(52, 199, 89, 0.15)' },
  blue: { bg: 'rgba(0, 122, 255, 0.08)', text: '#007AFF', border: 'rgba(0, 122, 255, 0.15)' },
  purple: { bg: 'rgba(175, 82, 222, 0.08)', text: '#AF52DE', border: 'rgba(175, 82, 222, 0.15)' },
};

// ============================================
// COMPACT KPI CARD (Row 1)
// ============================================
const KPICard: React.FC<{
  label: string;
  value: string | number;
  delta?: { value: number; label: string };
  icon: React.ReactNode;
  accent: keyof typeof colors;
  alert?: boolean;
}> = ({ label, value, delta, icon, accent, alert }) => {
  const c = colors[accent];
  return (
    <div 
      className="relative rounded-2xl p-4 transition-all"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${alert ? c.text : 'var(--border)'}`,
        boxShadow: alert 
          ? `0 0 0 3px ${c.bg}, 0 0 0 4px ${c.text}` 
          : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          <p className="text-2xl font-semibold mt-1" style={{ color: alert ? c.text : 'var(--text)', letterSpacing: '-0.02em' }}>
            {value}
          </p>
          {delta && (
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium`} style={{ color: delta.value >= 0 ? colors.green.text : colors.red.text }}>
              {delta.value >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(delta.value)}% {delta.label}
            </div>
          )}
        </div>
        <div 
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: c.bg }}
        >
          <div style={{ color: c.text }}>{icon}</div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// WORK QUEUE ITEM (Row 2 - Main operational area)
// ============================================
const QueueItem: React.FC<{
  type: 'overdue' | 'escalated' | 'unassigned' | 'awaiting' | 'due-today';
  jobNumber: string;
  customer: string;
  detail: string;
  urgent?: boolean;
}> = ({ type, jobNumber, customer, detail, urgent }) => {
  const typeConfig = {
    overdue: { icon: <Clock className="w-4 h-4" />, color: colors.red, label: 'Overdue' },
    escalated: { icon: <AlertTriangle className="w-4 h-4" />, color: colors.red, label: 'Escalated' },
    unassigned: { icon: <UserX className="w-4 h-4" />, color: colors.orange, label: 'Unassigned' },
    awaiting: { icon: <Timer className="w-4 h-4" />, color: colors.purple, label: 'Awaiting Ack' },
    'due-today': { icon: <Calendar className="w-4 h-4" />, color: colors.blue, label: 'Due Today' },
  };
  const config = typeConfig[type];

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-2)] cursor-pointer transition-colors">
      <div 
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: config.color.bg }}
      >
        <div style={{ color: config.color.text }}>{config.icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{jobNumber}</p>
          {urgent && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: colors.red.bg, color: colors.red.text }}>
              URGENT
            </span>
          )}
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{customer} · {detail}</p>
      </div>
      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
    </div>
  );
};

// ============================================
// TEAM MEMBER ROW (Row 2 - Right side)
// ============================================
const TeamRow: React.FC<{
  name: string;
  status: 'available' | 'busy' | 'overloaded';
  jobCount: number;
}> = ({ name, status, jobCount }) => {
  const statusConfig = {
    available: { color: colors.green.text, bg: colors.green.bg, label: 'Available' },
    busy: { color: colors.orange.text, bg: colors.orange.bg, label: `${jobCount} jobs` },
    overloaded: { color: colors.red.text, bg: colors.red.bg, label: `${jobCount} jobs` },
  };
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3 py-2">
      <div 
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
        style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
      >
        {name.charAt(0)}
      </div>
      <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{name}</span>
      <div 
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
        style={{ background: config.bg }}
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
        <span className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</span>
      </div>
    </div>
  );
};

// ============================================
// QUICK ACTION CHIP (Row 4 - Compact horizontal)
// ============================================
const QuickChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  count?: number;
  accent?: string;
}> = ({ icon, label, count, accent }) => (
  <button 
    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
    style={{ 
      background: accent ? `${accent}10` : 'var(--surface)',
      border: '1px solid var(--border)',
      color: accent || 'var(--text)'
    }}
  >
    {icon}
    <span>{label}</span>
    {count !== undefined && (
      <span 
        className="text-xs px-1.5 py-0.5 rounded-full"
        style={{ background: accent ? `${accent}15` : 'var(--surface-2)', color: accent || 'var(--text-muted)' }}
      >
        {count}
      </span>
    )}
  </button>
);

// ============================================
// MAIN PREVIEW COMPONENT
// ============================================
const DashboardPreviewV3: React.FC = () => {
  return (
    <div className="space-y-5 p-6 max-w-6xl mx-auto">
      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
            Good morning, Jay
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Saturday, 11 January 2026
          </p>
        </div>
        {/* Quick Actions as horizontal chips */}
        <div className="flex items-center gap-2">
          <QuickChip icon={<Plus className="w-4 h-4" />} label="New Job" accent="#007AFF" />
          <QuickChip icon={<Truck className="w-4 h-4" />} label="Fleet" />
          <QuickChip icon={<Users className="w-4 h-4" />} label="Team" />
        </div>
      </div>

      {/* ===== ROW 1: KPI CARDS (4 equal columns) ===== */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Overdue"
          value={3}
          icon={<Clock className="w-4 h-4" />}
          accent="red"
          alert={true}
        />
        <KPICard
          label="Unassigned"
          value={5}
          icon={<UserX className="w-4 h-4" />}
          accent="orange"
        />
        <KPICard
          label="In Progress"
          value={8}
          delta={{ value: 12, label: 'vs yesterday' }}
          icon={<Play className="w-4 h-4" />}
          accent="blue"
        />
        <KPICard
          label="Revenue (7d)"
          value="RM 12.4k"
          delta={{ value: 8, label: 'vs last week' }}
          icon={<DollarSign className="w-4 h-4" />}
          accent="green"
        />
      </div>

      {/* ===== ROW 2: WORK QUEUE (8 cols) + TEAM STATUS (4 cols) ===== */}
      <div className="grid grid-cols-12 gap-5">
        {/* Work Queue - THE OPERATIONAL CENTER */}
        <div 
          className="col-span-8 rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* Queue Header with Tabs */}
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-1">
              {/* Tab Pills */}
              <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: colors.red.bg, color: colors.red.text }}>
                Action Required (6)
              </button>
              <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Due Today (12)
              </button>
              <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Unassigned (5)
              </button>
            </div>
            <button className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
              View All →
            </button>
          </div>
          
          {/* Queue List */}
          <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
            <QueueItem type="escalated" jobNumber="JOB-2024-0892" customer="ABC Logistics" detail="Overdue 2 days" urgent />
            <QueueItem type="overdue" jobNumber="JOB-2024-0891" customer="Metro Transport" detail="Was due yesterday" />
            <QueueItem type="awaiting" jobNumber="JOB-2024-0889" customer="FastMove Sdn Bhd" detail="Pending 3 days" />
            <QueueItem type="unassigned" jobNumber="JOB-2024-0895" customer="Warehouse Co" detail="Created 2h ago" />
            <QueueItem type="due-today" jobNumber="JOB-2024-0893" customer="Industrial Parts" detail="Due at 3:00 PM" />
            <QueueItem type="due-today" jobNumber="JOB-2024-0894" customer="Port Authority" detail="Due at 5:00 PM" />
          </div>
        </div>

        {/* Team Status */}
        <div 
          className="col-span-4 rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Team Status</h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>3 of 6 available</p>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: colors.green.text }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>3 free</span>
            </div>
          </div>
          <div className="p-3 space-y-1">
            <TeamRow name="Ahmad Razak" status="busy" jobCount={2} />
            <TeamRow name="Tan Wei Ming" status="overloaded" jobCount={4} />
            <TeamRow name="Raj Kumar" status="available" jobCount={0} />
            <TeamRow name="Lee Chong" status="busy" jobCount={1} />
            <TeamRow name="Muthu Samy" status="available" jobCount={0} />
            <TeamRow name="Hafiz Azlan" status="available" jobCount={0} />
          </div>
        </div>
      </div>

      {/* ===== ROW 3: CHARTS (6 + 6 cols) ===== */}
      <div className="grid grid-cols-2 gap-5">
        {/* Job Status Distribution */}
        <div 
          className="rounded-2xl p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Job Status</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>This week</span>
          </div>
          {/* Placeholder for chart */}
          <div className="h-40 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
            <div className="text-center">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Status distribution chart</p>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {[
              { label: 'Completed', color: colors.green.text, value: 24 },
              { label: 'In Progress', color: colors.blue.text, value: 8 },
              { label: 'Assigned', color: colors.purple.text, value: 12 },
              { label: 'New', color: colors.orange.text, value: 5 },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Trend */}
        <div 
          className="rounded-2xl p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Revenue Trend</h3>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Last 7 days</span>
          </div>
          {/* Placeholder for chart */}
          <div className="h-40 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
            <div className="text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Revenue area chart</p>
            </div>
          </div>
          {/* Summary */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total (7d)</p>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>RM 12,450</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color: colors.green.text }}>
              <ArrowUpRight className="w-3 h-3" />
              +8% vs last week
            </div>
          </div>
        </div>
      </div>

      {/* ===== ROW 4: SMART ACTIONS + NOTIFICATIONS (Compact) ===== */}
      <div className="grid grid-cols-12 gap-5">
        {/* Smart Actions */}
        <div className="col-span-8 flex items-center gap-3">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Quick:</span>
          <QuickChip icon={<UserX className="w-3.5 h-3.5" />} label="Assign unassigned" count={5} accent="#FF9500" />
          <QuickChip icon={<FileText className="w-3.5 h-3.5" />} label="Finalize jobs" count={3} accent="#AF52DE" />
          <QuickChip icon={<Package className="w-3.5 h-3.5" />} label="Low stock alerts" count={2} />
        </div>

        {/* Notifications indicator */}
        <div className="col-span-4 flex items-center justify-end gap-2">
          <div 
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <Bell className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <span className="text-sm" style={{ color: 'var(--text)' }}>3 new notifications</span>
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* ===== LAYOUT ANNOTATIONS (for review) ===== */}
      <div className="mt-8 p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
        <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>📐 Layout Notes (for review)</h4>
        <ul className="text-xs space-y-1.5" style={{ color: 'var(--text-muted)' }}>
          <li>✅ <strong>Row 1:</strong> 4 equal KPIs with deltas, "Overdue" has alert ring to draw attention</li>
          <li>✅ <strong>Row 2:</strong> Work Queue (8 cols) is the "operational center" — biggest block answers "what next?"</li>
          <li>✅ <strong>Row 2:</strong> Team Status (4 cols) shows availability + overloaded warnings</li>
          <li>✅ <strong>Row 3:</strong> Charts side-by-side (6+6), equal visual weight</li>
          <li>✅ <strong>Row 4:</strong> Smart actions as horizontal chips — context-aware with counts</li>
          <li>✅ <strong>Quick Actions:</strong> Moved to header as compact chips (not a tall sidebar panel)</li>
          <li>✅ <strong>Hierarchy:</strong> Metrics (compact), Lists (taller with rows), Navigation (button-like)</li>
        </ul>
      </div>
    </div>
  );
};

export default DashboardPreviewV3;

import { Plus, RefreshCw } from 'lucide-react';
import type { AdminDashboardV7_1Data } from './useAdminDashboardV7_1Data';
import { colors, EscalationBanner } from './DashboardWidgets';
import { StatPill } from './AdminDashboardV7_1Primitives';

interface AdminDashboardV7_1HeaderProps {
  data: AdminDashboardV7_1Data;
}

export function AdminDashboardV7_1Header({ data }: AdminDashboardV7_1HeaderProps) {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{data.greeting}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {data.jobsByStatus.dueToday.length} jobs today • {data.availableTechs}/{data.technicians.length} techs available
            {data.urgentCount > 0 && <span style={{ color: colors.red.text }}> • ⚠️ {data.urgentCount} need attention</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white">
            ⚡ V7.1
          </span>
          <button onClick={data.onRefresh} className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
          <button onClick={() => data.navigate('/jobs/new')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95" style={{ background: colors.blue.text, color: 'white' }}>
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>
      </div>

      <EscalationBanner count={data.jobsByStatus.escalated.length} onClick={() => data.navigate('/jobs?filter=escalated')} />

      <div className="flex items-center gap-2 overflow-x-auto pb-2 md:flex-wrap">
        <StatPill label="Overdue" value={data.jobsByStatus.overdue.length} color={colors.red.text} pulse={data.jobsByStatus.overdue.length > 2} onClick={() => data.navigate('/jobs?filter=overdue')} />
        <StatPill label="Unassigned" value={data.jobsByStatus.unassigned.length} color={colors.orange.text} onClick={() => data.navigate('/jobs?filter=unassigned')} />
        <StatPill label="In Progress" value={data.jobsByStatus.inProgress.length} color={colors.blue.text} onClick={() => data.navigate('/jobs?filter=in-progress')} />
        <StatPill label="To Finalize" value={data.jobsByStatus.awaitingFinalization.length} color="#9333ea" onClick={() => data.navigate('/jobs?filter=awaiting-finalization')} />
        <StatPill label="On-Time" value={`${data.slaMetrics.onTimeRate}%`} color={colors.green.text} />
        <StatPill label="Revenue 7d" value={`RM${(data.weeklyRevenue / 1000).toFixed(1)}k`} color={colors.green.text} onClick={() => data.navigate('/invoices')} />
        {data.oosCount > 0 && <StatPill label="OOS" value={data.oosCount} color={colors.red.text} onClick={() => data.navigate('/inventory')} />}
        {data.lowStockCount > 0 && <StatPill label="Low Stock" value={data.lowStockCount} color={colors.orange.text} onClick={() => data.navigate('/inventory')} />}
      </div>
    </>
  );
}

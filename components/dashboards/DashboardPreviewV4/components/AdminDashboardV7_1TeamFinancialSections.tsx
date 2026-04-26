import { ChevronRight, DollarSign, TrendingUp, Users } from 'lucide-react';
import { colors } from './DashboardWidgets';
import { Section } from './AdminDashboardV7_1Primitives';
import type { AdminDashboardV7_1Data } from './useAdminDashboardV7_1Data';

interface AdminDashboardV7_1TeamFinancialSectionsProps {
  data: AdminDashboardV7_1Data;
}

export function AdminDashboardV7_1TeamFinancialSections({ data }: AdminDashboardV7_1TeamFinancialSectionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Section
        title="Team"
        icon={<Users className="w-4 h-4" style={{ color: colors.blue.text }} />}
        actions={
          <button onClick={() => data.navigate('/people?tab=employees')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            Manage <ChevronRight className="w-3 h-3" />
          </button>
        }
      >
        <div className="max-h-[200px] overflow-y-auto pr-1">
          {data.teamStatus.length === 0 ? (
            <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>No technicians</p>
          ) : (
            data.teamStatus
              .sort((a, b) => {
                const order = { overloaded: 0, busy: 1, available: 2 };
                return order[a.status] - order[b.status];
              })
              .map(({ tech, activeCount, status }) => {
                const statusConfig = {
                  available: { color: colors.green.text, bg: colors.green.bg, label: 'Available' },
                  busy: { color: colors.blue.text, bg: colors.blue.bg, label: `${activeCount} jobs` },
                  overloaded: { color: colors.red.text, bg: colors.red.bg, label: `${activeCount} jobs` },
                };
                const config = statusConfig[status];
                return (
                  <div key={tech.user_id} className="flex items-center gap-3 py-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                      {tech.name?.charAt(0) || '?'}
                    </div>
                    <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{tech.name}</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: config.bg }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
                      <span className="text-[10px] font-medium" style={{ color: config.color }}>{config.label}</span>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </Section>

      <div className="space-y-4">
        <Section
          title="Today's Progress"
          icon={<TrendingUp className="w-4 h-4" style={{ color: colors.green.text }} />}
        >
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1.5">
                <span style={{ color: 'var(--text-muted)' }}>Completed</span>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{data.jobsByStatus.completedToday.length}/{data.totalDueToday}</span>
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${data.completionPct}%`, background: `linear-gradient(90deg, ${colors.green.text}, ${colors.blue.text})` }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: data.completionPct >= 80 ? colors.green.text : data.completionPct >= 50 ? colors.blue.text : colors.orange.text }}>
                {data.completionPct}%
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Financial"
          icon={<DollarSign className="w-4 h-4" style={{ color: colors.green.text }} />}
          actions={
            <button onClick={() => data.navigate('/invoices')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              Billing <ChevronRight className="w-3 h-3" />
            </button>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl text-center min-w-0 overflow-hidden" style={{ background: colors.orange.bg }}>
              <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{data.jobsByStatus.awaitingFinalization.length}</p>
              <p className="text-[10px] truncate" style={{ color: colors.orange.text }}>To Invoice</p>
            </div>
            <div className="p-2.5 rounded-xl text-center min-w-0 overflow-hidden" style={{ background: colors.blue.bg }}>
              <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>{data.jobsByStatus.awaitingAck.length}</p>
              <p className="text-[10px] truncate" style={{ color: colors.blue.text }}>Awaiting Ack</p>
            </div>
            <div className="p-2.5 rounded-xl text-center min-w-0 overflow-hidden" style={{ background: colors.green.bg }}>
              <p className="text-lg font-bold truncate" style={{ color: 'var(--text)' }}>RM{(data.weeklyRevenue / 1000).toFixed(1)}k</p>
              <p className="text-[10px] truncate" style={{ color: colors.green.text }}>7-Day Rev</p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

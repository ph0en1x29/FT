import { CheckCircle, ChevronRight, Clock, Package, XCircle } from 'lucide-react';
import { colors } from './DashboardWidgets';
import { Section } from './AdminDashboardV7_1Primitives';
import type { AdminDashboardV7_1Data } from './useAdminDashboardV7_1Data';

interface AdminDashboardV7_1StockActivitySectionsProps {
  data: AdminDashboardV7_1Data;
}

export function AdminDashboardV7_1StockActivitySections({ data }: AdminDashboardV7_1StockActivitySectionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Section
          title="Out of Stock"
          icon={<XCircle className="w-4 h-4" style={{ color: colors.red.text }} />}
          badge={data.oosCount}
          defaultOpen={data.oosCount > 0}
          actions={
            <button onClick={() => data.navigate('/inventory')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              Inventory <ChevronRight className="w-3 h-3" />
            </button>
          }
        >
          {data.oosItems.length === 0 ? (
            <div className="py-3 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-1 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>All items in stock</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {data.oosItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: colors.red.bg }}>
                  <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--text)' }}>{item.name}</span>
                  <span className="text-xs font-bold" style={{ color: colors.red.text }}>
                    0/{item.min}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Low Stock"
          icon={<Package className="w-4 h-4" style={{ color: colors.orange.text }} />}
          badge={data.lowStockCount}
          defaultOpen={data.lowStockCount > 0}
          actions={
            <button onClick={() => data.navigate('/inventory')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              All items <ChevronRight className="w-3 h-3" />
            </button>
          }
        >
          {data.lowStockItems.length === 0 ? (
            <div className="py-3 text-center">
              <Package className="w-8 h-8 mx-auto mb-1 opacity-30" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Stock levels OK</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {data.lowStockItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: colors.orange.bg }}>
                  <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--text)' }}>{item.name}</span>
                  <span className="text-xs font-bold" style={{ color: colors.orange.text }}>
                    {item.quantity}/{item.min}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section
        title="Recent Activity"
        icon={<Clock className="w-4 h-4" style={{ color: colors.blue.text }} />}
      >
        {data.recentActivity.length === 0 ? (
          <div className="py-3 text-center">
            <Clock className="w-8 h-8 mx-auto mb-1 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-1">
            {data.recentActivity.map(({ job, status, agoText, techName: tech }) => {
              const statusColor = status === 'Completed' ? colors.green.text : status === 'In Progress' ? colors.blue.text : 'var(--text-muted)';
              return (
                <button
                  key={job.job_id}
                  onClick={() => data.navigate(`/jobs/${job.job_id}`)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all hover:opacity-80"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor }} />
                  <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{job.job_number || job.title}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{tech}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{agoText}</span>
                </button>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

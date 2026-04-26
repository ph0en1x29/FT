import { ChevronRight, Clock } from 'lucide-react';
import { colors } from './DashboardWidgets';
import { Section } from './AdminDashboardV7_1Primitives';
import type { AdminDashboardV7_1Data } from './useAdminDashboardV7_1Data';

interface AdminDashboardV7_1ScheduleSectionProps {
  data: AdminDashboardV7_1Data;
}

export function AdminDashboardV7_1ScheduleSection({ data }: AdminDashboardV7_1ScheduleSectionProps) {
  return (
    <Section
      title="Today's Schedule"
      icon={<Clock className="w-4 h-4" style={{ color: colors.blue.text }} />}
      badge={data.todaySchedule.length}
      defaultOpen={data.todaySchedule.length > 0}
      actions={
        <button onClick={() => data.navigate('/calendar')} className="text-xs font-medium hover:opacity-70 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
          Calendar <ChevronRight className="w-3 h-3" />
        </button>
      }
    >
      {data.todaySchedule.length === 0 ? (
        <div className="py-3 text-center">
          <Clock className="w-8 h-8 mx-auto mb-1 opacity-30" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No jobs scheduled today</p>
        </div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-1.5">
            {data.todaySchedule.map(({ job, tech, time, status }) => {
              const statusStyles = {
                completed: { bg: colors.green.bg, dot: colors.green.text },
                'in-progress': { bg: colors.blue.bg, dot: colors.blue.text },
                upcoming: { bg: 'var(--surface-2)', dot: 'var(--text-muted)' },
              };
              const s = statusStyles[status];
              return (
                <button
                  key={job.job_id}
                  onClick={() => data.navigate(`/jobs/${job.job_id}`)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all hover:opacity-80"
                  style={{ background: s.bg }}
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                  <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{time}</span>
                  <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{job.job_number || job.title}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{tech}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Section>
  );
}

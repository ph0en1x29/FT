import { AlertTriangle, CheckCircle, ChevronRight, Zap } from 'lucide-react';
import { SupabaseDb } from '../../../../services/supabaseService';
import { showToast } from '../../../../services/toastService';
import { colors } from './DashboardWidgets';
import { Section, SelectableJobRow } from './AdminDashboardV7_1Primitives';
import type { AdminDashboardV7_1Data } from './useAdminDashboardV7_1Data';

interface AdminDashboardV7_1ApprovalSectionsProps {
  data: AdminDashboardV7_1Data;
}

function getApprovalBadge(type: string) {
  switch (type) {
    case 'escalation': return { label: 'ESCALATED', color: colors.red.text, bg: colors.red.bg };
    case 'dispute': return { label: 'DISPUTED', color: '#9333ea', bg: '#f3e8ff' };
    case 'parts': return { label: 'VERIFY PARTS', color: colors.orange.text, bg: colors.orange.bg };
    case 'ack': return { label: 'AWAITING ACK', color: colors.blue.text, bg: colors.blue.bg };
    case 'job': return { label: 'CONFIRM JOB', color: colors.green.text, bg: colors.green.bg };
    default: return { label: type.toUpperCase(), color: 'var(--text-muted)', bg: 'var(--surface-2)' };
  }
}

export function AdminDashboardV7_1ApprovalSections({ data }: AdminDashboardV7_1ApprovalSectionsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
      <Section
        title="Approval Queue"
        icon={<Zap className="w-4 h-4" style={{ color: colors.orange.text }} />}
        badge={data.approvalQueue.length}
        badgeColor={colors.orange.bg}
        actions={
          data.approvalQueue.length > 0 ? (
            <button onClick={data.selectAll} className="text-xs font-medium px-2 py-1 rounded-lg hover:opacity-80" style={{ color: 'var(--accent)', background: 'var(--accent-bg, rgba(59,130,246,0.08))' }}>
              {data.selectedApprovalIds.size === data.approvalQueue.length ? 'Deselect All' : 'Select All'}
            </button>
          ) : undefined
        }
      >
        {data.approvalQueue.length === 0 ? (
          <div className="py-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-1" style={{ color: colors.green.text, opacity: 0.4 }} />
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>All clear</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[270px] overflow-y-auto pr-1">
            {data.approvalQueue.map(item => (
              <SelectableJobRow
                key={`${item.type}-${item.job.job_id}`}
                job={item.job}
                selected={data.selectedApprovalIds.has(item.job.job_id)}
                onToggle={() => data.toggleSelection(item.job.job_id)}
                onClick={() => data.navigate(`/jobs/${item.job.job_id}`)}
                badge={getApprovalBadge(item.type)}
                techName={item.job.assigned_technician_id ? data.techNameMap.get(item.job.assigned_technician_id) : undefined}
                showActions={
                  item.type === 'parts' ? (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await SupabaseDb.confirmParts(item.job.job_id, data.currentUser.user_id, data.currentUser.name, data.currentUser.role);
                          showToast.success('Parts verified');
                          await new Promise(r => setTimeout(r, 300));
                          data.onRefresh();
                        } catch (err) {
                          showToast.error('Could not verify parts', (err as Error).message);
                        }
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={{ background: colors.green.text, color: 'white' }}
                    >
                      Verify
                    </button>
                  ) : item.type === 'escalation' ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); data.navigate(`/jobs/${item.job.job_id}`); }}
                      className="px-3 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={{ background: colors.red.text, color: 'white' }}
                    >
                      Review
                    </button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Action Required"
        icon={<AlertTriangle className="w-4 h-4" style={{ color: colors.red.text }} />}
        badge={data.urgentCount}
      >
        {data.urgentCount === 0 ? (
          <div className="py-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-1" style={{ color: colors.green.text, opacity: 0.4 }} />
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>No urgent items</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[270px] overflow-y-auto pr-1">
            {[
              ...data.jobsByStatus.escalated.map(j => ({ job: j, label: '🔥 Escalated', color: colors.red.text, bg: colors.red.bg })),
              ...data.jobsByStatus.overdue.map(j => ({ job: j, label: '⏰ Overdue', color: colors.orange.text, bg: colors.orange.bg })),
              ...data.jobsByStatus.disputed.map(j => ({ job: j, label: '⚠️ Disputed', color: '#9333ea', bg: '#f3e8ff' })),
            ].map(({ job, label, color, bg }) => (
              <button
                key={job.job_id}
                onClick={() => data.navigate(`/jobs/${job.job_id}`)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all hover:opacity-80"
                style={{ background: `${bg}` }}
              >
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{ color }}>{label}</span>
                <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text)' }}>{job.job_number || job.title}</span>
                <span className="text-[10px] truncate max-w-[80px]" style={{ color: 'var(--text-muted)' }}>{job.customer?.name || ''}</span>
                <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

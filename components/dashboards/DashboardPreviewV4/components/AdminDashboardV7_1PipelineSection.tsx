import { ArrowRight } from 'lucide-react';
import { colors } from './DashboardWidgets';
import { PipelineCard, PipelineColumn, Section } from './AdminDashboardV7_1Primitives';
import type { AdminDashboardV7_1Data } from './useAdminDashboardV7_1Data';

interface AdminDashboardV7_1PipelineSectionProps {
  data: AdminDashboardV7_1Data;
}

export function AdminDashboardV7_1PipelineSection({ data }: AdminDashboardV7_1PipelineSectionProps) {
  return (
    <Section
      title="Job Pipeline"
      icon={<ArrowRight className="w-4 h-4" style={{ color: colors.blue.text }} />}
      badge={data.jobs.filter(j => !['Completed', 'Cancelled'].includes(j.status)).length}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        <PipelineColumn title="New" count={data.jobsByStatus.newJobs.length} color={colors.blue.text} onClick={() => data.navigate('/jobs?filter=new')}>
          {data.jobsByStatus.newJobs.slice(0, 4).map(j => (
            <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? data.techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => data.navigate(`/jobs/${j.job_id}`)} accent={colors.blue.text} technicians={data.techList} onAssign={data.handleInlineAssign} />
          ))}
          {data.jobsByStatus.newJobs.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{data.jobsByStatus.newJobs.length - 4} more</p>}
        </PipelineColumn>

        <PipelineColumn title="Assigned" count={data.jobsByStatus.assigned.length} color={colors.orange.text} onClick={() => data.navigate('/jobs?filter=assigned')}>
          {data.jobsByStatus.assigned.slice(0, 4).map(j => (
            <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? data.techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => data.navigate(`/jobs/${j.job_id}`)} accent={colors.orange.text} />
          ))}
          {data.jobsByStatus.assigned.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{data.jobsByStatus.assigned.length - 4} more</p>}
        </PipelineColumn>

        <PipelineColumn title="In Progress" count={data.jobsByStatus.inProgress.length} color={colors.green.text} onClick={() => data.navigate('/jobs?filter=in-progress')}>
          {data.jobsByStatus.inProgress.slice(0, 4).map(j => (
            <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? data.techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => data.navigate(`/jobs/${j.job_id}`)} accent={colors.green.text} />
          ))}
          {data.jobsByStatus.inProgress.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{data.jobsByStatus.inProgress.length - 4} more</p>}
        </PipelineColumn>

        <PipelineColumn title="Finalization" count={data.jobsByStatus.awaitingFinalization.length} color="#9333ea" onClick={() => data.navigate('/jobs?filter=awaiting-finalization')}>
          {data.jobsByStatus.awaitingFinalization.slice(0, 4).map(j => (
            <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? data.techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => data.navigate(`/jobs/${j.job_id}`)} accent="#9333ea" />
          ))}
          {data.jobsByStatus.awaitingFinalization.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{data.jobsByStatus.awaitingFinalization.length - 4} more</p>}
        </PipelineColumn>

        <PipelineColumn title="Completed" count={data.jobsByStatus.completedToday.length} color={colors.green.text} onClick={() => data.navigate('/jobs?filter=completed')}>
          {data.jobsByStatus.completedToday.slice(0, 4).map(j => (
            <PipelineCard key={j.job_id} job={j} techName={j.assigned_technician_id ? data.techNameMap.get(j.assigned_technician_id) : undefined} onClick={() => data.navigate(`/jobs/${j.job_id}`)} accent={colors.green.text} />
          ))}
          {data.jobsByStatus.completedToday.length > 4 && <p className="text-[10px] text-center py-1" style={{ color: 'var(--text-muted)' }}>+{data.jobsByStatus.completedToday.length - 4} more</p>}
        </PipelineColumn>
      </div>
    </Section>
  );
}

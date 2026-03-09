import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Package,
  RefreshCw,
  Truck,
  UserPlus2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SupabaseDb } from '../../../../services/supabaseService';
import { ForkliftDashboardRow } from '../../../../services/forkliftService';
import { Job, User, UserRole } from '../../../../types';
import { colors, DashboardSection, KPICard, QuickChip, QueueItem, TeamRow } from './DashboardWidgets';

interface ServiceAdminDashboardProps {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

const ServiceAdminDashboard: React.FC<ServiceAdminDashboardProps> = ({
  currentUser,
  jobs,
  users,
  onRefresh,
  navigate,
}) => {
  const [forklifts, setForklifts] = useState<ForkliftDashboardRow[]>([]);
  const [fleetLoading, setFleetLoading] = useState(true);

  const loadFleetSnapshot = useCallback(async () => {
    try {
      setFleetLoading(true);
      // Use lightweight query — only fields needed for the fleet snapshot widget
      const data = await SupabaseDb.getForkliftsLightweightForDashboard();
      setForklifts(data);
    } catch {
      setForklifts([]);
    } finally {
      setFleetLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFleetSnapshot();
  }, [loadFleetSnapshot]);

  const today = new Date();
  const todayStr = today.toDateString();
  const displayName = currentUser.name?.split(' ')[0] || 'Service';

  const technicians = useMemo(
    () => users.filter(user => user.role === UserRole.TECHNICIAN && user.is_active),
    [users]
  );

  const jobsByStatus = useMemo(() => {
    const openJobs = jobs.filter(job => !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(job.status));
    const unassigned = openJobs.filter(job => !job.assigned_technician_id);
    const overdue = openJobs.filter(job => {
      const scheduled = job.scheduled_date ? new Date(job.scheduled_date) : null;
      return scheduled && scheduled < new Date(todayStr) && job.status !== 'New';
    });
    const escalated = openJobs.filter(job => (job.is_escalated || job.escalation_triggered_at) && !job.escalation_acknowledged_at);
    const disputed = jobs.filter(job => job.status === 'Disputed');
    const awaitingServiceConfirmation = jobs.filter(job =>
      job.status === 'Awaiting Finalization' &&
      (job.parts_confirmed_at || job.parts_confirmation_skipped || job.parts_used.length === 0) &&
      !job.job_confirmed_at
    );
    const dueToday = openJobs.filter(job => {
      const scheduled = job.scheduled_date ? new Date(job.scheduled_date) : null;
      return scheduled?.toDateString() === todayStr;
    });
    const inProgress = jobs.filter(job => job.status === 'In Progress');
    const assigned = jobs.filter(job => job.status === 'Assigned');
    const awaitingFinalization = jobs.filter(job => job.status === 'Awaiting Finalization');
    const completedToday = jobs.filter(job => {
      if (job.status !== 'Completed') return false;
      const completedAt = job.completed_at ? new Date(job.completed_at) : null;
      return completedAt?.toDateString() === todayStr;
    });

    return {
      openJobs,
      unassigned,
      overdue,
      escalated,
      disputed,
      awaitingServiceConfirmation,
      dueToday,
      inProgress,
      assigned,
      awaitingFinalization,
      completedToday,
    };
  }, [jobs, todayStr]);

  const teamStatus = useMemo(() => {
    return technicians
      .map(tech => {
        const activeJobs = jobs.filter(job =>
          job.assigned_technician_id === tech.user_id &&
          !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(job.status)
        ).length;
        const status = activeJobs === 0 ? 'available' : activeJobs >= 3 ? 'overloaded' : 'busy';
        return { tech, activeJobs, status: status as 'available' | 'busy' | 'overloaded' };
      })
      .sort((left, right) => {
        const order = { overloaded: 0, busy: 1, available: 2 };
        return order[left.status] - order[right.status];
      });
  }, [jobs, technicians]);

  const availableTechs = teamStatus.filter(row => row.status === 'available').length;

  const actionQueue = useMemo(() => {
    const queue = [
      ...jobsByStatus.escalated.map(job => ({ kind: 'escalated' as const, job, detail: 'Needs acknowledgement' })),
      ...jobsByStatus.disputed.map(job => ({ kind: 'disputed' as const, job, detail: 'Customer dispute requires review' })),
      ...jobsByStatus.overdue.map(job => ({ kind: 'overdue' as const, job, detail: 'Past scheduled date' })),
      ...jobsByStatus.awaitingServiceConfirmation.map(job => ({ kind: 'awaiting' as const, job, detail: 'Ready for service-side confirmation' })),
      ...jobsByStatus.unassigned.map(job => ({ kind: 'unassigned' as const, job, detail: 'Needs technician assignment' })),
    ];

    const seen = new Set<string>();
    return queue.filter(item => {
      if (seen.has(item.job.job_id)) return false;
      seen.add(item.job.job_id);
      return true;
    }).slice(0, 8);
  }, [jobsByStatus]);

  const topCustomerPressure = useMemo(() => {
    const map = new Map<string, { name: string; count: number; overdue: number }>();
    jobsByStatus.openJobs.forEach(job => {
      const key = job.customer?.customer_id || job.customer?.name || 'unknown';
      const existing = map.get(key) || { name: job.customer?.name || 'Unknown Customer', count: 0, overdue: 0 };
      existing.count += 1;
      if (jobsByStatus.overdue.some(overdueJob => overdueJob.job_id === job.job_id)) {
        existing.overdue += 1;
      }
      map.set(key, existing);
    });

    return Array.from(map.values())
      .sort((left, right) => right.count - left.count || right.overdue - left.overdue)
      .slice(0, 4);
  }, [jobsByStatus.openJobs, jobsByStatus.overdue]);

  const fleetSnapshot = useMemo(() => {
    const needsAttention = forklifts.filter(forklift =>
      ['Service Due', 'Awaiting Parts', 'Out of Service', 'In Service', 'Under Maintenance', 'Inactive'].includes(forklift.status)
    );
    const rented = forklifts.filter(forklift => !!forklift.current_customer_id);
    return {
      total: forklifts.length,
      needsAttention,
      rented,
      ready: forklifts.filter(forklift => !forklift.current_customer_id && ['Available', 'Active'].includes(forklift.status)),
    };
  }, [forklifts]);

  const serviceRoutes = {
    openWork: '/jobs?tab=active&date=unfinished',
    dueToday: '/jobs?tab=active&filter=due-today',
    unassigned: '/jobs?tab=active&filter=unassigned',
    serviceConfirm: '/jobs?tab=active&filter=awaiting-service-confirm',
    assigned: '/jobs?tab=active&filter=assigned',
    inProgress: '/jobs?tab=active&filter=in-progress',
    awaitingFinalization: `/jobs?tab=active&status=${encodeURIComponent('Awaiting Finalization')}&date=all`,
    overdue: '/jobs?tab=active&filter=overdue',
  } as const;

  return (
    <div className="space-y-5">
      <section
        className="overflow-hidden rounded-[32px] px-5 py-5 md:px-6 md:py-6"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--surface) 82%, #dbeafe 18%) 0%, color-mix(in srgb, var(--surface) 86%, #f0fdf4 14%) 100%)',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ background: colors.blue.bg, color: colors.blue.text }}>
                Service Operations
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]" style={{ color: 'var(--text)' }}>
              Good {today.getHours() < 12 ? 'morning' : today.getHours() < 18 ? 'afternoon' : 'evening'}, {displayName}
            </h1>
            <div className="mt-5 flex flex-wrap gap-2">
              <QuickChip icon={<ClipboardCheck className="w-4 h-4" />} label="Service Queue" count={jobsByStatus.awaitingServiceConfirmation.length} accent={colors.purple.text} onClick={() => navigate(serviceRoutes.serviceConfirm)} />
              <QuickChip icon={<UserPlus2 className="w-4 h-4" />} label="Assign Jobs" count={jobsByStatus.unassigned.length} accent={colors.orange.text} onClick={() => navigate(serviceRoutes.unassigned)} />
              <QuickChip icon={<Truck className="w-4 h-4" />} label="Fleet" count={fleetSnapshot.needsAttention.length} accent={colors.blue.text} onClick={() => navigate('/forklifts?tab=fleet')} />
            </div>
          </div>
          <div className="flex flex-col gap-2 self-start">
            <button
              onClick={onRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => navigate('/jobs/new')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: colors.blue.text }}
            >
              <CalendarClock className="w-4 h-4" />
              New Job
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KPICard label="Open Work" value={jobsByStatus.openJobs.length} sublabel="Active service jobs" icon={<CheckCircle2 className="w-4 h-4" />} accent="blue" onClick={() => navigate(serviceRoutes.openWork)} />
        <KPICard label="Due Today" value={jobsByStatus.dueToday.length} sublabel="Scheduled for today" icon={<CalendarClock className="w-4 h-4" />} accent="green" onClick={() => navigate(serviceRoutes.dueToday)} />
        <KPICard label="Need Assignment" value={jobsByStatus.unassigned.length} sublabel="Dispatch gap" icon={<UserPlus2 className="w-4 h-4" />} accent="orange" alert={jobsByStatus.unassigned.length > 0} onClick={() => navigate(serviceRoutes.unassigned)} />
        <KPICard label="Service Confirm" value={jobsByStatus.awaitingServiceConfirmation.length} sublabel="Ready to close" icon={<ClipboardCheck className="w-4 h-4" />} accent="purple" alert={jobsByStatus.awaitingServiceConfirmation.length > 0} onClick={() => navigate(serviceRoutes.serviceConfirm)} />
        <KPICard label="Tech Capacity" value={`${availableTechs}/${technicians.length}`} sublabel="Available now" icon={<Users className="w-4 h-4" />} accent="green" onClick={() => navigate('/people')} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <DashboardSection
          eyebrow="Priority"
          title="Action Queue"
          actionLabel="Open Jobs"
          onAction={() => navigate('/jobs')}
        >
          {actionQueue.length === 0 ? (
            <div className="rounded-3xl px-6 py-10 text-center" style={{ background: 'var(--surface-2)' }}>
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10" style={{ color: colors.green.text, opacity: 0.7 }} />
              <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No urgent service blockers</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Dispatch, escalations, and service confirmations are clear right now.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <QuickChip icon={<CheckCircle2 className="w-4 h-4" />} label="Open Jobs" accent={colors.blue.text} onClick={() => navigate(serviceRoutes.openWork)} />
                <QuickChip icon={<CalendarClock className="w-4 h-4" />} label="Create Job" accent={colors.green.text} onClick={() => navigate('/jobs/new')} />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {actionQueue.map(item => (
                <QueueItem
                  key={item.job.job_id}
                  type={item.kind}
                  jobNumber={item.job.job_number || item.job.title}
                  customer={item.job.customer?.name || 'Unknown customer'}
                  detail={item.detail}
                  urgent={item.kind === 'escalated' || item.kind === 'overdue' || item.kind === 'disputed'}
                  onClick={() => navigate(`/jobs/${item.job.job_id}`)}
                  actionLabel={item.kind === 'unassigned' ? 'Assign' : item.kind === 'awaiting' ? 'Confirm' : 'Review'}
                  onAction={() => navigate(`/jobs/${item.job.job_id}`)}
                />
              ))}
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Team"
          title="Dispatch & Capacity"
          actionLabel="Manage Team"
          onAction={() => navigate('/people')}
        >
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl p-3" style={{ background: colors.green.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.green.text }}>Available</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{availableTechs}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: colors.orange.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.orange.text }}>Busy</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{teamStatus.filter(row => row.status === 'busy').length}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: colors.red.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.red.text }}>Overloaded</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{teamStatus.filter(row => row.status === 'overloaded').length}</p>
            </div>
          </div>
          <div className="space-y-1">
            {teamStatus.slice(0, 6).map(row => (
              <TeamRow key={row.tech.user_id} name={row.tech.name || 'Unknown'} status={row.status} jobCount={row.activeJobs} />
            ))}
          </div>
        </DashboardSection>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardSection
          eyebrow="Flow"
          title="Service Pipeline"
          actionLabel="Approvals"
          onAction={() => navigate('/jobs?tab=approvals')}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Assigned', value: jobsByStatus.assigned.length, accent: colors.blue.bg, text: colors.blue.text, route: serviceRoutes.assigned },
              { label: 'In Progress', value: jobsByStatus.inProgress.length, accent: colors.green.bg, text: colors.green.text, route: serviceRoutes.inProgress },
              { label: 'Awaiting Finalization', value: jobsByStatus.awaitingFinalization.length, accent: colors.orange.bg, text: colors.orange.text, route: serviceRoutes.awaitingFinalization },
              { label: 'Service Confirm', value: jobsByStatus.awaitingServiceConfirmation.length, accent: colors.purple.bg, text: colors.purple.text, route: serviceRoutes.serviceConfirm },
            ].map(card => (
              <button
                key={card.label}
                onClick={() => navigate(card.route)}
                className="rounded-3xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: card.accent }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: card.text }}>{card.label}</p>
                <p className="mt-3 text-3xl font-semibold" style={{ color: 'var(--text)' }}>{card.value}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-3xl p-4" style={{ background: 'var(--surface-2)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Customer Pressure</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Accounts with the highest concentration of open work.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {topCustomerPressure.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No customer hotspots right now.</p>
              ) : (
                topCustomerPressure.map(customer => (
                  <div key={customer.name} className="rounded-2xl px-4 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{customer.name}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {customer.count} open job{customer.count !== 1 ? 's' : ''}{customer.overdue > 0 ? ` • ${customer.overdue} overdue` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </DashboardSection>

        <DashboardSection
          eyebrow="Equipment"
          title="Fleet Pressure"
          actionLabel="Open Fleet"
          onAction={() => navigate('/forklifts?tab=fleet')}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl p-3" style={{ background: colors.blue.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.blue.text }}>Fleet</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{fleetSnapshot.total}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: colors.green.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.green.text }}>Ready</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{fleetSnapshot.ready.length}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: colors.orange.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.orange.text }}>Attention</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{fleetSnapshot.needsAttention.length}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {fleetSnapshot.needsAttention.slice(0, 5).map(forklift => (
              <button
                key={forklift.forklift_id}
                onClick={() => navigate(`/forklifts/${forklift.forklift_id}`)}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{forklift.make} {forklift.model}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {forklift.serial_number} • {forklift.status}
                  </p>
                </div>
                <span className="rounded-full px-2 py-1 text-[11px] font-semibold" style={{ background: colors.orange.bg, color: colors.orange.text }}>
                  {forklift.current_customer ? forklift.current_customer.name : 'Internal'}
                </span>
              </button>
            ))}
            {!fleetLoading && fleetSnapshot.needsAttention.length === 0 && (
              <div className="rounded-2xl px-4 py-6 text-center" style={{ background: 'var(--surface-2)' }}>
                <Package className="mx-auto mb-2 h-8 w-8" style={{ color: colors.green.text, opacity: 0.65 }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Fleet looks stable</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>No forklifts are currently flagged for service-side attention.</p>
                <div className="mt-4 flex justify-center">
                  <QuickChip icon={<Truck className="w-4 h-4" />} label="Open Fleet" accent={colors.blue.text} onClick={() => navigate('/forklifts?tab=fleet')} />
                </div>
              </div>
            )}
          </div>
        </DashboardSection>
      </div>
    </div>
  );
};

export default ServiceAdminDashboard;

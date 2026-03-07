import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Package,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getReplenishmentRequests } from '../../../../services/replenishmentService';
import { supabase } from '../../../../services/supabaseClient';
import { SupabaseDb } from '../../../../services/supabaseService';
import { Part, Job, User, VanStockReplenishment } from '../../../../types';
import { colors, KPICard, QuickChip } from './DashboardWidgets';

interface StoreAdminDashboardProps {
  currentUser: User;
  jobs: Job[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

interface StoreRequestSnapshot {
  request_id: string;
  status: 'pending' | 'approved' | 'part_ordered' | 'issued' | 'rejected';
  created_at: string;
  description: string | null;
  job: {
    job_id: string;
    title: string | null;
    status: string | null;
    assigned_technician_name: string | null;
    customer: { name: string | null } | null;
  } | null;
}

interface ExpirySnapshot {
  batch_id: string;
  batch_label: string | null;
  expires_at: string;
  parts: { part_name: string | null } | null;
}

const DashboardSection: React.FC<{
  eyebrow: string;
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}> = ({ eyebrow, title, detail, actionLabel, onAction, children }) => (
  <section
    className="overflow-hidden rounded-[28px]"
    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
  >
    <div className="flex flex-col gap-2 border-b px-5 py-4 md:flex-row md:items-center md:justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </h2>
        {detail && (
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {detail}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
        >
          {actionLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
    <div className="p-4 md:p-5">{children}</div>
  </section>
);

const formatRelativeDay = (isoDate: string) => {
  const days = Math.ceil((new Date(isoDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
};

const StoreAdminDashboard: React.FC<StoreAdminDashboardProps> = ({
  currentUser,
  jobs,
  onRefresh,
  navigate,
}) => {
  const [parts, setParts] = useState<Part[]>([]);
  const [requests, setRequests] = useState<StoreRequestSnapshot[]>([]);
  const [replenishments, setReplenishments] = useState<VanStockReplenishment[]>([]);
  const [expiryBatches, setExpiryBatches] = useState<ExpirySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStoreSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const nextThirty = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [partsData, replenishmentData, requestsResult, expiryResult] = await Promise.all([
        SupabaseDb.getParts(),
        getReplenishmentRequests(),
        supabase
          .from('job_requests')
          .select(`
            request_id,
            status,
            created_at,
            description,
            job:jobs(
              job_id,
              title,
              status,
              assigned_technician_name,
              customer:customers(name)
            )
          `)
          .eq('request_type', 'spare_part')
          .in('status', ['pending', 'approved', 'part_ordered', 'issued'])
          .order('created_at', { ascending: true })
          .limit(30),
        supabase
          .from('purchase_batches')
          .select(`
            batch_id,
            batch_label,
            expires_at,
            parts(part_name)
          `)
          .gte('expires_at', today)
          .lte('expires_at', nextThirty)
          .order('expires_at', { ascending: true })
          .limit(8),
      ]);

      setParts(partsData);
      setReplenishments(replenishmentData);
      setRequests((requestsResult.data || []) as unknown as StoreRequestSnapshot[]);
      setExpiryBatches((expiryResult.data || []) as unknown as ExpirySnapshot[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStoreSnapshot();
  }, [loadStoreSnapshot]);

  const today = new Date();
  const displayName = currentUser.name?.split(' ')[0] || 'Store';

  const lowStock = useMemo(
    () => parts.filter(part => (part.min_stock_level || 0) > 0 && part.stock_quantity <= (part.min_stock_level || 0)),
    [parts]
  );
  const outOfStock = useMemo(
    () => parts.filter(part => (part.min_stock_level || 0) > 0 && part.stock_quantity === 0),
    [parts]
  );
  const pendingRequests = useMemo(
    () => requests.filter(request => request.status === 'pending'),
    [requests]
  );
  const readyToIssue = useMemo(
    () => requests.filter(request => request.status === 'approved'),
    [requests]
  );
  const orderedRequests = useMemo(
    () => requests.filter(request => request.status === 'part_ordered'),
    [requests]
  );
  const pendingReplenishments = useMemo(
    () => replenishments.filter(request => request.status === 'pending' || request.status === 'approved'),
    [replenishments]
  );
  const jobsWaitingParts = useMemo(() => {
    return jobs.filter(job =>
      job.status === 'Awaiting Finalization' &&
      job.parts_used.length > 0 &&
      !job.parts_confirmed_at &&
      !job.parts_confirmation_skipped
    );
  }, [jobs]);

  const queueItems = useMemo(() => {
    const combined = [
      ...pendingRequests.map(request => ({ kind: 'Part Request', priority: 0, time: request.created_at, title: request.description || 'Spare part request', subtitle: request.job?.customer?.name || 'Unknown customer', href: request.job?.job_id ? `/jobs/${request.job.job_id}` : '/jobs?tab=approvals' })),
      ...readyToIssue.map(request => ({ kind: 'Ready to Issue', priority: 1, time: request.created_at, title: request.description || 'Approved part request', subtitle: request.job?.assigned_technician_name || 'Technician pending', href: request.job?.job_id ? `/jobs/${request.job.job_id}` : '/jobs?tab=approvals' })),
      ...orderedRequests.map(request => ({ kind: 'Awaiting Receipt', priority: 2, time: request.created_at, title: request.description || 'Ordered part request', subtitle: request.job?.customer?.name || 'Order follow-up', href: request.job?.job_id ? `/jobs/${request.job.job_id}` : '/jobs?tab=approvals' })),
      ...jobsWaitingParts.map(job => ({ kind: 'Blocked Job', priority: 3, time: job.completed_at || job.updated_at || job.created_at, title: job.job_number || job.title, subtitle: job.customer?.name || 'Unknown customer', href: `/jobs/${job.job_id}` })),
    ];

    return combined
      .sort((left, right) => left.priority - right.priority || new Date(left.time).getTime() - new Date(right.time).getTime())
      .slice(0, 8);
  }, [jobsWaitingParts, orderedRequests, pendingRequests, readyToIssue]);

  return (
    <div className="space-y-5">
      <section
        className="overflow-hidden rounded-[32px] px-5 py-5 md:px-6 md:py-6"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--surface) 82%, #fef3c7 18%) 0%, color-mix(in srgb, var(--surface) 86%, #dbeafe 14%) 100%)',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ background: colors.orange.bg, color: colors.orange.text }}>
                Store Control
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]" style={{ color: 'var(--text)' }}>
              Good {today.getHours() < 12 ? 'morning' : today.getHours() < 18 ? 'afternoon' : 'evening'}, {displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
              This dashboard is tuned for parts flow, stock risk, and technician support. The ideal experience is that you can approve, issue, receive, and spot inventory risk before it blocks the field team.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <QuickChip icon={<ClipboardCheck className="w-4 h-4" />} label="Store Queue" count={pendingRequests.length + readyToIssue.length} accent={colors.orange.text} onClick={() => navigate('/jobs?tab=approvals')} />
              <QuickChip icon={<Package className="w-4 h-4" />} label="Inventory" count={lowStock.length} accent={colors.red.text} onClick={() => navigate('/inventory')} />
              <QuickChip icon={<Truck className="w-4 h-4" />} label="Replenishments" count={pendingReplenishments.length} accent={colors.blue.text} onClick={() => navigate('/inventory?tab=replenishments')} />
            </div>
          </div>
          <div className="flex flex-col gap-2 self-start">
            <button
              onClick={() => {
                onRefresh();
                loadStoreSnapshot();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => navigate('/inventory')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: colors.orange.text }}
            >
              <Boxes className="w-4 h-4" />
              Open Inventory
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KPICard label="Pending Requests" value={pendingRequests.length} sublabel="Need approval" icon={<Package className="w-4 h-4" />} accent="orange" alert={pendingRequests.length > 0} />
        <KPICard label="Ready to Issue" value={readyToIssue.length} sublabel="Approved for technicians" icon={<CheckCircle2 className="w-4 h-4" />} accent="blue" alert={readyToIssue.length > 0} />
        <KPICard label="Jobs Waiting Parts" value={jobsWaitingParts.length} sublabel="Blocked from closure" icon={<ShieldAlert className="w-4 h-4" />} accent="purple" alert={jobsWaitingParts.length > 0} />
        <KPICard label="Low Stock" value={lowStock.length} sublabel="Below reorder level" icon={<AlertTriangle className="w-4 h-4" />} accent="red" alert={lowStock.length > 0} />
        <KPICard label="Replenishments" value={pendingReplenishments.length} sublabel="Pending or approved" icon={<Truck className="w-4 h-4" />} accent="green" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardSection
          eyebrow="Queue"
          title="Store Action Queue"
          detail="The store admin home should feel like a premium operational inbox: approve, issue, receive, then unblock jobs."
          actionLabel="Open Queue"
          onAction={() => navigate('/jobs?tab=approvals')}
        >
          {queueItems.length === 0 ? (
            <div className="rounded-3xl px-6 py-10 text-center" style={{ background: 'var(--surface-2)' }}>
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10" style={{ color: colors.green.text, opacity: 0.7 }} />
              <p className="text-base font-medium" style={{ color: 'var(--text)' }}>Store queue is clear</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>No spare part requests, issuance work, or blocked confirmations are waiting right now.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queueItems.map(item => (
                <button
                  key={`${item.kind}-${item.title}-${item.time}`}
                  onClick={() => navigate(item.href)}
                  className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: item.kind === 'Blocked Job' ? colors.purple.bg : colors.orange.bg, color: item.kind === 'Blocked Job' ? colors.purple.text : colors.orange.text }}>
                        {item.kind}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text)' }}>{item.title}</p>
                    <p className="mt-1 text-xs truncate" style={{ color: 'var(--text-muted)' }}>{item.subtitle}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Risk"
          title="Inventory Risk"
          detail={loading ? 'Refreshing stock signals…' : `${outOfStock.length} out of stock • ${expiryBatches.length} expiring batches in the next 30 days`}
          actionLabel="Inventory Ledger"
          onAction={() => navigate('/inventory?tab=ledger')}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl p-3" style={{ background: colors.red.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.red.text }}>Low</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{lowStock.length}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: colors.orange.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.orange.text }}>OOS</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{outOfStock.length}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: colors.blue.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.blue.text }}>Expiry</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{expiryBatches.length}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {lowStock.slice(0, 4).map(part => (
              <div key={part.part_id} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: 'var(--surface-2)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{part.part_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {part.stock_quantity} left • min {(part.min_stock_level || 0).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: colors.red.bg, color: colors.red.text }}>
                  {part.stock_quantity === 0 ? 'OOS' : 'LOW'}
                </span>
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="rounded-2xl px-4 py-6 text-center" style={{ background: 'var(--surface-2)' }}>
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8" style={{ color: colors.green.text, opacity: 0.65 }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Inventory risk is stable</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Nothing is currently below reorder level.</p>
              </div>
            )}
          </div>
        </DashboardSection>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardSection
          eyebrow="Flow"
          title="Replenishment Pipeline"
          detail="Van support work should be visible from the dashboard so the store admin can keep technicians stocked without opening multiple tabs."
          actionLabel="Open Replenishments"
          onAction={() => navigate('/inventory?tab=replenishments')}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl p-3" style={{ background: colors.orange.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.orange.text }}>Pending</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{replenishments.filter(item => item.status === 'pending').length}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: colors.blue.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.blue.text }}>Approved</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{replenishments.filter(item => item.status === 'approved').length}</p>
            </div>
            <div className="rounded-2xl p-3" style={{ background: colors.green.bg }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: colors.green.text }}>In Progress</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{replenishments.filter(item => item.status === 'in_progress').length}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {pendingReplenishments.slice(0, 4).map(item => (
              <button
                key={item.replenishment_id}
                onClick={() => navigate('/inventory?tab=replenishments')}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.technician_name || 'Technician replenishment'}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.items.length} line items • {item.status.replace('_', ' ')}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>
        </DashboardSection>

        <DashboardSection
          eyebrow="Receiving"
          title="Orders, Blocks & Quick Actions"
          detail="This area keeps the store admin focused on receipt follow-up and the jobs still waiting on parts verification."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl p-4" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4" style={{ color: colors.blue.text }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Ordered Parts</p>
              </div>
              <div className="mt-4 space-y-2">
                {orderedRequests.slice(0, 3).map(request => (
                  <div key={request.request_id} className="rounded-2xl px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{request.description || 'Ordered request'}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{request.job?.customer?.name || 'Awaiting vendor follow-up'}</p>
                  </div>
                ))}
                {orderedRequests.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No ordered parts are waiting for receipt.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl p-4" style={{ background: 'var(--surface-2)' }}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: colors.purple.text }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Expiring Batches</p>
              </div>
              <div className="mt-4 space-y-2">
                {expiryBatches.slice(0, 3).map(batch => (
                  <div key={batch.batch_id} className="rounded-2xl px-3 py-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{batch.parts?.part_name || 'Inventory batch'}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatRelativeDay(batch.expires_at)} • {batch.batch_label || batch.batch_id}
                    </p>
                  </div>
                ))}
                {expiryBatches.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No batches are expiring in the next 30 days.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <QuickChip icon={<Package className="w-4 h-4" />} label="Parts Catalog" onClick={() => navigate('/inventory?tab=parts')} accent={colors.blue.text} />
            <QuickChip icon={<Truck className="w-4 h-4" />} label="Replenishments" onClick={() => navigate('/inventory?tab=replenishments')} accent={colors.green.text} />
            <QuickChip icon={<ClipboardCheck className="w-4 h-4" />} label="Jobs Waiting Parts" count={jobsWaitingParts.length} onClick={() => navigate('/jobs?tab=approvals')} accent={colors.purple.text} />
          </div>
        </DashboardSection>
      </div>
    </div>
  );
};

export default StoreAdminDashboard;

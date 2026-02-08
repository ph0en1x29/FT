import {
CheckCircle,
ChevronRight,
Clock,FileText,
RefreshCw,
TrendingUp
} from 'lucide-react';
import React from 'react';
import { Job } from '../../../../types';
import { colors,KPICard } from './DashboardWidgets';

interface AccountantDashboardProps {
  jobs: Job[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

const AccountantDashboard: React.FC<AccountantDashboardProps> = ({ jobs, onRefresh, navigate }) => {
  const awaitingFinalization = jobs.filter(j => j.status === 'Awaiting Finalization');
  const completedJobs = jobs.filter(j => j.status === 'Completed');
  const laborRate = 150;
  const pendingInvoiceValue = awaitingFinalization.length * 850;
  const monthlyRevenue = completedJobs.reduce((acc, job) => {
    const partsUsed = job.parts_used || [];
    const partsCost = partsUsed.reduce((sum, p) => sum + ((p.sell_price_at_time || 0) * (p.quantity || 0)), 0);
    return acc + partsCost + laborRate;
  }, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Financial Overview</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Invoice and payment management</p>
        </div>
        <button onClick={onRefresh} className="p-2 rounded-xl transition-all hover:scale-105 active:scale-95" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Pending Invoices" value={awaitingFinalization.length} sublabel="Ready to finalize" icon={<FileText className="w-4 h-4" />} accent="blue" />
        <KPICard label="Pending Value" value={`RM ${pendingInvoiceValue.toLocaleString()}`} sublabel="Estimated" icon={<Clock className="w-4 h-4" />} accent="orange" />
        <KPICard label="Completed" value={completedJobs.length} sublabel="Month to date" icon={<CheckCircle className="w-4 h-4" />} accent="green" />
        <KPICard label="Revenue" value={`RM ${monthlyRevenue.toLocaleString()}`} sublabel="Month to date" icon={<TrendingUp className="w-4 h-4" />} accent="purple" />
      </div>

      {/* Jobs Ready for Finalization */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Ready for Finalization</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{awaitingFinalization.length} jobs awaiting invoice</p>
          </div>
          <button onClick={() => navigate('/invoices')} className="text-xs font-medium hover:opacity-70" style={{ color: 'var(--accent)' }}>View All →</button>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {awaitingFinalization.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
              <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: colors.green.text }} />
              <p className="font-medium" style={{ color: 'var(--text)' }}>All caught up!</p>
              <p className="text-sm">No jobs pending finalization</p>
            </div>
          ) : (
            awaitingFinalization.slice(0, 5).map(job => (
              <div key={job.job_id} onClick={() => navigate(`/jobs/${job.job_id}`)} className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--text)' }}>{job.job_number || job.title}</p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{job.customer?.name} · {job.job_type}</p>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountantDashboard;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import {
  DollarSign, FileText, Clock, CheckCircle, TrendingUp,
  ChevronRight, Calendar, AlertCircle, Receipt
} from 'lucide-react';
import { User, Job, JobStatus } from '../../types';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';

interface AccountantDashboardProps {
  currentUser: User;
}

const AccountantDashboard: React.FC<AccountantDashboardProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      const jobsData = await MockDb.getJobs(currentUser);
      setJobs(jobsData || []);
    } catch (error: any) {
      showToast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Jobs awaiting finalization (main focus for accountant)
  const awaitingFinalization = jobs.filter(j => j.status === JobStatus.AWAITING_FINALIZATION);

  // Completed awaiting acknowledgement
  const awaitingAck = jobs.filter(j => j.status === JobStatus.COMPLETED_AWAITING_ACK);

  // Completed jobs (for revenue calculation)
  const completedJobs = jobs.filter(j =>
    j.status === JobStatus.COMPLETED ||
    j.status === JobStatus.COMPLETED_AWAITING_ACK
  );

  // Completed this month
  const completedThisMonth = completedJobs.filter(j =>
    j.completed_at && new Date(j.completed_at) >= monthStart
  );

  // Calculate revenue
  const laborRate = 150;
  const calculateJobRevenue = (job: Job) => {
    const partsUsed = job.parts_used || [];
    const partsCost = partsUsed.reduce((sum, p) =>
      sum + ((p.sell_price_at_time || 0) * (p.quantity || 0)), 0
    );
    return partsCost + laborRate;
  };

  const totalRevenue = completedJobs.reduce((acc, job) => acc + calculateJobRevenue(job), 0);
  const monthlyRevenue = completedThisMonth.reduce((acc, job) => acc + calculateJobRevenue(job), 0);

  // Revenue trend (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const revenueData = last7Days.map(date => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayJobs = completedJobs.filter(j => {
      const completedDate = j.completed_at ? new Date(j.completed_at) : null;
      return completedDate && completedDate.toDateString() === date.toDateString();
    });
    const dayRevenue = dayJobs.reduce((acc, job) => acc + calculateJobRevenue(job), 0);
    return { name: dayName, revenue: Math.round(dayRevenue) };
  });

  // Invoice status distribution
  const invoiceStatusData = [
    { name: 'Finalized', value: completedJobs.length, color: '#22c55e' },
    { name: 'Awaiting Finalization', value: awaitingFinalization.length, color: '#8b5cf6' },
    { name: 'Awaiting Ack', value: awaitingAck.length, color: '#f97316' },
  ].filter(d => d.value > 0);

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--text-muted)]">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            {getGreeting()}, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="text-sm mt-1 text-[var(--text-muted)]">
            {today.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <Receipt className="w-4 h-4" /> View Invoices
        </button>
      </div>

      {/* Alert Banner - Jobs needing attention */}
      {awaitingFinalization.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-full">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="font-semibold text-purple-800">
                {awaitingFinalization.length} Job{awaitingFinalization.length > 1 ? 's' : ''} Awaiting Finalization
              </div>
              <div className="text-sm text-purple-600">Ready for invoice processing</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/invoices')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-sm"
          >
            Process Now
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Revenue */}
        <div className="card-premium p-5 border-l-4 border-l-green-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">This Month</p>
              <p className="text-3xl font-bold mt-2 text-green-600">
                RM{monthlyRevenue.toLocaleString()}
              </p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">Revenue</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        {/* Awaiting Finalization */}
        <div
          className={`card-premium p-5 border-l-4 cursor-pointer hover:shadow-lg transition-all ${
            awaitingFinalization.length > 0 ? 'border-l-purple-500 bg-purple-50/50' : 'border-l-gray-300'
          }`}
          onClick={() => navigate('/invoices')}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">To Finalize</p>
              <p className={`text-3xl font-bold mt-2 ${awaitingFinalization.length > 0 ? 'text-purple-600' : 'text-[var(--text)]'}`}>
                {awaitingFinalization.length}
              </p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">Jobs pending</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Awaiting Acknowledgement */}
        <div
          className={`card-premium p-5 border-l-4 cursor-pointer hover:shadow-lg transition-all ${
            awaitingAck.length > 0 ? 'border-l-orange-500 bg-orange-50/50' : 'border-l-gray-300'
          }`}
          onClick={() => navigate('/jobs?filter=awaiting-ack')}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Awaiting Ack</p>
              <p className={`text-3xl font-bold mt-2 ${awaitingAck.length > 0 ? 'text-orange-600' : 'text-[var(--text)]'}`}>
                {awaitingAck.length}
              </p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">Customer sign-off</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Completed This Month */}
        <div className="card-premium p-5 border-l-4 border-l-[var(--accent)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Completed</p>
              <p className="text-3xl font-bold mt-2 text-[var(--text)]">{completedThisMonth.length}</p>
              <p className="text-xs mt-1 text-[var(--text-subtle)]">This month</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--accent)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-[var(--text)]">Revenue Trend</h3>
              <p className="text-xs mt-0.5 text-[var(--text-muted)]">Last 7 days</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="font-medium">RM{totalRevenue.toLocaleString()} total</span>
            </div>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            {revenueData.some(d => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradientAcc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={(value) => `RM${value}`}
                  />
                  <Tooltip
                    formatter={(value) => [`RM${value}`, 'Revenue']}
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#revenueGradientAcc)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <DollarSign className="w-10 h-10 text-[var(--text-muted)] opacity-30 mb-2" />
                <p className="text-sm font-medium text-[var(--text)]">No revenue data</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Complete jobs to see revenue trends</p>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Status */}
        <div className="card-premium p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-[var(--text)]">Invoice Status</h3>
            <p className="text-xs mt-0.5 text-[var(--text-muted)]">Current distribution</p>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            {invoiceStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={invoiceStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {invoiceStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FileText className="w-10 h-10 text-[var(--text-muted)] opacity-30 mb-2" />
                <p className="text-sm font-medium text-[var(--text)]">No jobs yet</p>
              </div>
            )}
          </div>
          {/* Legend */}
          {invoiceStatusData.length > 0 && (
            <div className="flex flex-wrap gap-4 justify-center mt-2">
              {invoiceStatusData.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[var(--text-muted)]">{item.name}</span>
                  <span className="font-medium text-[var(--text)]">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Finalization Queue */}
      <div className="card-premium overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-lg text-[var(--text)]">Finalization Queue</h2>
                <p className="text-xs text-[var(--text-muted)]">Jobs ready for invoice processing</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/invoices')}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              View All →
            </button>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {awaitingFinalization.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
              <p className="font-medium text-[var(--text)]">All caught up!</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">No jobs awaiting finalization</p>
            </div>
          ) : (
            awaitingFinalization.slice(0, 6).map(job => {
              const revenue = calculateJobRevenue(job);

              return (
                <div
                  key={job.job_id}
                  onClick={() => navigate(`/jobs/${job.job_id}`)}
                  className="p-4 cursor-pointer transition-all hover:bg-[var(--bg-subtle)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text)] truncate">{job.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                          <span>{job.customer?.name || 'No customer'}</span>
                          {job.completed_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(job.completed_at).toLocaleDateString('en-MY', {
                                day: 'numeric', month: 'short'
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-green-600">RM{revenue.toLocaleString()}</p>
                        <p className="text-xs text-[var(--text-muted)]">Est. revenue</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {awaitingFinalization.length > 6 && (
          <div className="p-3 border-t border-[var(--border-subtle)] text-center">
            <button
              onClick={() => navigate('/invoices')}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              View all {awaitingFinalization.length} jobs →
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/invoices')}
          className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Invoices</p>
            <p className="text-xs text-[var(--text-muted)]">Manage billing</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/jobs')}
          className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">All Jobs</p>
            <p className="text-xs text-[var(--text-muted)]">View job list</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/customers')}
          className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Customers</p>
            <p className="text-xs text-[var(--text-muted)]">View accounts</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/forklifts')}
          className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">Assets</p>
            <p className="text-xs text-[var(--text-muted)]">View fleet</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default AccountantDashboard;

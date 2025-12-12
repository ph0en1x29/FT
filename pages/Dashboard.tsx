import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { UserRole, Job, JobStatus, User } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';

interface DashboardProps {
  role: UserRole;
  currentUser: User;
}

const Dashboard: React.FC<DashboardProps> = ({ role, currentUser }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  const loadDashboardData = async () => {
    try {
      const jobsData = await MockDb.getJobs(currentUser);
      setJobs(jobsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats from real data
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const jobsThisWeek = jobs.filter(j => new Date(j.created_at) >= oneWeekAgo);
  
  // Status distribution
  const statusCounts = {
    [JobStatus.COMPLETED]: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
    [JobStatus.IN_PROGRESS]: jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
    [JobStatus.NEW]: jobs.filter(j => j.status === JobStatus.NEW).length,
    [JobStatus.ASSIGNED]: jobs.filter(j => j.status === JobStatus.ASSIGNED).length,
    [JobStatus.INVOICED]: jobs.filter(j => j.status === JobStatus.INVOICED).length,
  };

  const dataStatus = [
    { name: 'Completed', value: statusCounts[JobStatus.COMPLETED], color: '#22c55e' },
    { name: 'In Progress', value: statusCounts[JobStatus.IN_PROGRESS], color: '#f59e0b' },
    { name: 'New', value: statusCounts[JobStatus.NEW], color: '#3b82f6' },
    { name: 'Assigned', value: statusCounts[JobStatus.ASSIGNED], color: '#8b5cf6' },
    { name: 'Invoiced', value: statusCounts[JobStatus.INVOICED], color: '#a855f7' },
  ].filter(item => item.value > 0); // Only show statuses with jobs

  // Revenue calculation (parts + labor estimate)
  const laborRate = 150; // Base labor per job
  const totalRevenue = jobs.reduce((acc, job) => {
    const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
    return acc + partsCost + (job.status !== JobStatus.NEW ? laborRate : 0);
  }, 0);

  // Pending invoices
  const pendingInvoices = jobs.filter(j => j.status === JobStatus.COMPLETED && !j.customer_signature).length;

  // Average response time (mock calculation based on created vs arrival time)
  const jobsWithArrival = jobs.filter(j => j.arrival_time);
  const avgResponseHours = jobsWithArrival.length > 0
    ? jobsWithArrival.reduce((acc, j) => {
        const created = new Date(j.created_at).getTime();
        const arrived = new Date(j.arrival_time!).getTime();
        return acc + ((arrived - created) / (1000 * 60 * 60));
      }, 0) / jobsWithArrival.length
    : 0;

  // Weekly revenue breakdown (last 5 days)
  const last5Days = Array.from({ length: 5 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (4 - i));
    return date;
  });

  const dataRevenue = last5Days.map(date => {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayJobs = jobs.filter(j => {
      const jobDate = new Date(j.created_at);
      return jobDate.toDateString() === date.toDateString();
    });

    const dayRevenue = dayJobs.reduce((acc, job) => {
      const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
      return acc + partsCost + laborRate;
    }, 0);

    return {
      name: dayName,
      revenue: Math.round(dayRevenue)
    };
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <div className="text-center py-12 text-slate-500">Loading dashboard data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">Total Jobs This Week</p>
          <p className="text-3xl font-bold text-slate-800">{jobsThisWeek.length}</p>
          <p className="text-xs text-slate-400 mt-1">Last 7 days</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">Revenue Estimate</p>
          <p className="text-3xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">All-time total</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">Pending Sign-offs</p>
          <p className="text-3xl font-bold text-purple-600">{pendingInvoices}</p>
          <p className="text-xs text-slate-400 mt-1">Awaiting signature</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">Avg. Response Time</p>
          <p className="text-3xl font-bold text-blue-600">{avgResponseHours.toFixed(1)}h</p>
          <p className="text-xs text-slate-400 mt-1">First arrival time</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm h-80">
          <h3 className="font-semibold text-slate-700 mb-4">Job Status Distribution</h3>
          {dataStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={dataStatus} 
                  innerRadius={60} 
                  outerRadius={80} 
                  paddingAngle={5} 
                  dataKey="value"
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  labelLine={false}
                >
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              No jobs yet
            </div>
          )}
        </div>

        {/* Weekly Revenue */}
        <div className="bg-white p-6 rounded-xl shadow-sm h-80">
          <h3 className="font-semibold text-slate-700 mb-4">Last 5 Days Revenue</h3>
          {dataRevenue.some(d => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataRevenue}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value}`} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              No revenue data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold text-slate-700 mb-4">Recent Jobs</h3>
        <div className="space-y-2">
          {jobs.slice(0, 5).map(job => (
            <div key={job.job_id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex-1">
                <p className="font-medium text-slate-800">{job.title}</p>
                <p className="text-xs text-slate-500">{job.customer.name} • {new Date(job.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                job.status === JobStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                job.status === JobStatus.IN_PROGRESS ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {job.status}
              </span>
            </div>
          ))}
          {jobs.length === 0 && (
            <p className="text-center text-slate-400 py-4">No jobs found</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
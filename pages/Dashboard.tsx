import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { AlertTriangle, Clock } from 'lucide-react';
import { UserRole, Job, JobStatus, User } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import ServiceAutomationWidget from '../components/ServiceAutomationWidget';
import { showToast } from '../services/toastService';

interface DashboardProps {
  role: UserRole;
  currentUser: User;
}

const Dashboard: React.FC<DashboardProps> = ({ role, currentUser }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalatedJobs, setEscalatedJobs] = useState<any[]>([]);
  const [escalationChecked, setEscalationChecked] = useState(false);
  const navigate = useNavigate();

  const isAdmin = role === UserRole.ADMIN;
  const isSupervisor = role === UserRole.SUPERVISOR;

  useEffect(() => {
    loadDashboardData();
  }, [currentUser]);

  // Check escalations on load (Admin/Supervisor only)
  useEffect(() => {
    if ((isAdmin || isSupervisor) && !escalationChecked) {
      checkEscalations();
    }
  }, [isAdmin, isSupervisor, escalationChecked]);

  const checkEscalations = async () => {
    try {
      // Check escalations
      const result = await MockDb.checkAndTriggerEscalations();
      if (result.escalated > 0) {
        showToast.warning(
          `${result.escalated} job(s) escalated`,
          'Jobs exceeded time limit without completion'
        );
      }
      // Load all escalated jobs for display
      const allEscalated = await MockDb.getEscalatedJobs();
      setEscalatedJobs(allEscalated);
      
      // Check auto-complete for deferred jobs (#8)
      const autoResult = await MockDb.checkAndAutoCompleteJobs();
      if (autoResult.completed > 0) {
        showToast.info(
          `${autoResult.completed} job(s) auto-completed`,
          'Customer acknowledgement deadline passed'
        );
      }
      
      setEscalationChecked(true);
    } catch (e) {
      console.error('Escalation check error:', e);
    }
  };

  const loadDashboardData = async () => {
    try {
      const jobsData = await MockDb.getJobs(currentUser);
      setJobs(jobsData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      showToast.error('Failed to load dashboard data', 'Please refresh the page');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats from real data
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const jobsThisWeek = jobs.filter(j => new Date(j.created_at) >= oneWeekAgo);
  
  // Status distribution (with new #7/#8 statuses)
  const completedCount = jobs.filter(j => j.status === JobStatus.COMPLETED).length;
  const awaitingAckCount = jobs.filter(j => j.status === JobStatus.COMPLETED_AWAITING_ACK).length;
  const disputedCount = jobs.filter(j => j.status === JobStatus.DISPUTED).length;
  const incompleteContinuingCount = jobs.filter(j => j.status === JobStatus.INCOMPLETE_CONTINUING).length;
  const incompleteReassignedCount = jobs.filter(j => j.status === JobStatus.INCOMPLETE_REASSIGNED).length;
  
  // For main totals: Awaiting Ack + Disputed count as "completed" (work was done)
  const totalCompletedForStats = completedCount + awaitingAckCount + disputedCount;
  
  const statusCounts = {
    [JobStatus.COMPLETED]: completedCount,
    [JobStatus.AWAITING_FINALIZATION]: jobs.filter(j => j.status === JobStatus.AWAITING_FINALIZATION).length,
    [JobStatus.IN_PROGRESS]: jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
    [JobStatus.NEW]: jobs.filter(j => j.status === JobStatus.NEW).length,
    [JobStatus.ASSIGNED]: jobs.filter(j => j.status === JobStatus.ASSIGNED).length,
    // New statuses
    [JobStatus.COMPLETED_AWAITING_ACK]: awaitingAckCount,
    [JobStatus.DISPUTED]: disputedCount,
    [JobStatus.INCOMPLETE_CONTINUING]: incompleteContinuingCount,
    [JobStatus.INCOMPLETE_REASSIGNED]: incompleteReassignedCount,
  };

  const dataStatus = [
    { name: 'Completed', value: completedCount, color: '#22c55e' },
    { name: 'Awaiting Ack', value: awaitingAckCount, color: '#f97316' },
    { name: 'Disputed', value: disputedCount, color: '#ef4444' },
    { name: 'Awaiting Finalization', value: statusCounts[JobStatus.AWAITING_FINALIZATION], color: '#a855f7' },
    { name: 'In Progress', value: statusCounts[JobStatus.IN_PROGRESS], color: '#f59e0b' },
    { name: 'Continuing', value: incompleteContinuingCount, color: '#fbbf24' },
    { name: 'Reassigned', value: incompleteReassignedCount, color: '#fb7185' },
    { name: 'New', value: statusCounts[JobStatus.NEW], color: '#3b82f6' },
    { name: 'Assigned', value: statusCounts[JobStatus.ASSIGNED], color: '#8b5cf6' },
  ].filter(item => item.value > 0); // Only show statuses with jobs

  // Revenue calculation (parts + labor estimate)
  const laborRate = 150; // Base labor per job
  const totalRevenue = jobs.reduce((acc, job) => {
    const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
    return acc + partsCost + (job.status !== JobStatus.NEW ? laborRate : 0);
  }, 0);

  // Pending finalization (jobs awaiting accountant review)
  const pendingFinalization = jobs.filter(j => j.status === JobStatus.AWAITING_FINALIZATION).length;

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
        <h1 className="text-2xl font-bold text-theme">Dashboard</h1>
        <div className="text-center py-12 text-theme-muted">Loading dashboard data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-theme">Dashboard</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-theme p-6 rounded-xl theme-transition">
          <p className="text-theme-muted text-sm">Total Jobs This Week</p>
          <p className="text-3xl font-bold text-theme">{jobsThisWeek.length}</p>
          <p className="text-xs text-theme-muted mt-1">Last 7 days</p>
        </div>
        
        <div className="card-theme p-6 rounded-xl theme-transition">
          <p className="text-theme-muted text-sm">Revenue Estimate</p>
          <p className="text-3xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-theme-muted mt-1">All-time total</p>
        </div>
        
        <div className="card-theme p-6 rounded-xl theme-transition">
          <p className="text-theme-muted text-sm">Pending Finalization</p>
          <p className="text-3xl font-bold text-purple-600">{pendingFinalization}</p>
          <p className="text-xs text-theme-muted mt-1">Awaiting accountant review</p>
        </div>
        
        <div className="card-theme p-6 rounded-xl theme-transition">
          <p className="text-theme-muted text-sm">Avg. Response Time</p>
          <p className="text-3xl font-bold text-blue-600">{avgResponseHours.toFixed(1)}h</p>
          <p className="text-xs text-theme-muted mt-1">First arrival time</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Status Distribution */}
        <div className="card-theme p-6 rounded-xl h-80 theme-transition">
          <h3 className="font-semibold text-theme mb-4">Job Status Distribution</h3>
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
            <div className="flex items-center justify-center h-full text-theme-muted">
              No jobs yet
            </div>
          )}
        </div>

        {/* Weekly Revenue */}
        <div className="card-theme p-6 rounded-xl h-80 theme-transition">
          <h3 className="font-semibold text-theme mb-4">Last 5 Days Revenue</h3>
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
            <div className="flex items-center justify-center h-full text-theme-muted">
              No revenue data yet
            </div>
          )}
        </div>
      </div>

      {/* Escalated Jobs Alert - Admin/Supervisor only */}
      {(isAdmin || isSupervisor) && escalatedJobs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-800">
              Escalated Jobs ({escalatedJobs.length})
            </h3>
          </div>
          <p className="text-sm text-red-600 mb-3">
            These jobs exceeded their time limit without completion and require attention.
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {escalatedJobs.map(job => (
              <div 
                key={job.job_id}
                onClick={() => navigate(`/jobs/${job.job_id}`)}
                className="flex justify-between items-center p-3 bg-white rounded-lg border border-red-200 hover:border-red-400 cursor-pointer transition-all"
              >
                <div className="flex-1">
                  <p className="font-medium text-red-800">{job.title}</p>
                  <p className="text-xs text-red-600">
                    {job.customer?.name || 'No Customer'} • {job.assigned_technician_name || 'Unassigned'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                    {job.status}
                  </span>
                  <p className="text-xs text-red-500 mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(job.escalation_triggered_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Awaiting Customer Acknowledgement - Admin/Supervisor only */}
      {(isAdmin || isSupervisor) && awaitingAckCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-orange-800">
              Awaiting Customer Acknowledgement ({awaitingAckCount})
            </h3>
          </div>
          <p className="text-sm text-orange-600 mb-3">
            Work completed but pending customer confirmation. Check customer response deadlines.
          </p>
          <button
            onClick={() => navigate('/jobs?status=Completed%20Awaiting%20Acknowledgement')}
            className="text-sm text-orange-700 hover:text-orange-900 font-medium"
          >
            View all →
          </button>
        </div>
      )}

      {/* Disputed Jobs - Admin/Supervisor only */}
      {(isAdmin || isSupervisor) && disputedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-800">
              Disputed Jobs ({disputedCount})
            </h3>
          </div>
          <p className="text-sm text-red-600 mb-3">
            Customers have disputed these job completions. Resolution required.
          </p>
          <button
            onClick={() => navigate('/jobs?status=Disputed')}
            className="text-sm text-red-700 hover:text-red-900 font-medium"
          >
            View all →
          </button>
        </div>
      )}

      {/* Service Automation Widget & Recent Jobs - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Automation - Admin/Supervisor only */}
        {(role === UserRole.ADMIN || role === UserRole.SUPERVISOR) && (
          <ServiceAutomationWidget 
            onViewAll={() => navigate('/service-due')} 
          />
        )}

        {/* Recent Jobs */}
        <div className="card-theme p-6 rounded-xl theme-transition">
          <h3 className="font-semibold text-theme mb-4">Recent Jobs</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {jobs.slice(0, 5).map(job => (
              <div 
                key={job.job_id} 
                onClick={() => navigate(`/jobs/${job.job_id}`)}
                className="flex justify-between items-center p-3 bg-theme-surface-2 rounded-lg border border-theme hover:shadow-theme-sm cursor-pointer transition-all theme-transition"
              >
                <div className="flex-1">
                  <p className="font-medium text-theme hover:text-blue-600">{job.title}</p>
                  <p className="text-xs text-theme-muted">
                    {job.customer ? (
                      <span>{job.customer.name}</span>
                    ) : (
                      <span className="text-amber-600 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> No Customer
                      </span>
                    )}
                    {' • '}{new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  job.status === JobStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                  job.status === JobStatus.AWAITING_FINALIZATION ? 'bg-purple-100 text-purple-700' :
                  job.status === JobStatus.IN_PROGRESS ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {job.status}
                </span>
              </div>
            ))}
            {jobs.length === 0 && (
              <p className="text-center text-theme-muted py-4">No jobs found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
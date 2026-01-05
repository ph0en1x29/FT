import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { AlertTriangle, Clock, Phone, ChevronDown, ChevronUp, Check, MessageSquare, UserCog, Calendar } from 'lucide-react';
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
  const [expandedEscalationId, setExpandedEscalationId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState('');
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

  // Escalation handlers
  const handleAcknowledgeEscalation = async (jobId: string) => {
    const success = await MockDb.acknowledgeEscalation(jobId, currentUser.user_id);
    if (success) {
      showToast.success('Escalation acknowledged');
      // Refresh escalated jobs list
      const updated = await MockDb.getEscalatedJobs();
      setEscalatedJobs(updated);
    } else {
      showToast.error('Failed to acknowledge escalation');
    }
  };

  const handleSaveNotes = async (jobId: string) => {
    const success = await MockDb.updateEscalationNotes(jobId, notesInput);
    if (success) {
      showToast.success('Notes saved');
      setEditingNotesId(null);
      // Refresh escalated jobs list
      const updated = await MockDb.getEscalatedJobs();
      setEscalatedJobs(updated);
    } else {
      showToast.error('Failed to save notes');
    }
  };

  const handleMarkOvertime = async (jobId: string) => {
    const success = await MockDb.markJobAsOvertime(jobId, true);
    if (success) {
      showToast.success('Job marked as overtime (escalation disabled)');
      // Refresh escalated jobs list
      const updated = await MockDb.getEscalatedJobs();
      setEscalatedJobs(updated);
    } else {
      showToast.error('Failed to mark as overtime');
    }
  };

  const getDaysOverdue = (escalationTriggeredAt: string): number => {
    const escalated = new Date(escalationTriggeredAt);
    const now = new Date();
    const diffMs = now.getTime() - escalated.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const toggleExpandEscalation = (jobId: string) => {
    if (expandedEscalationId === jobId) {
      setExpandedEscalationId(null);
      setEditingNotesId(null);
    } else {
      setExpandedEscalationId(jobId);
      // Pre-fill notes input when expanding
      const job = escalatedJobs.find(j => j.job_id === jobId);
      setNotesInput(job?.escalation_notes || '');
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

      {/* Escalated Jobs Alert - Admin/Supervisor only (Enhanced) */}
      {(isAdmin || isSupervisor) && escalatedJobs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-800">
                Escalated Jobs ({escalatedJobs.length})
              </h3>
              <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full">
                {escalatedJobs.filter(j => !j.escalation_acknowledged_at).length} unacknowledged
              </span>
            </div>
          </div>
          <p className="text-sm text-red-600 mb-3">
            Jobs exceeded time limit. Acknowledge to take ownership.
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {escalatedJobs.map(job => {
              const isExpanded = expandedEscalationId === job.job_id;
              const isAcknowledged = !!job.escalation_acknowledged_at;
              const daysOverdue = getDaysOverdue(job.escalation_triggered_at);
              
              return (
                <div 
                  key={job.job_id}
                  className={`rounded-lg border transition-all ${
                    isAcknowledged 
                      ? 'bg-gray-50 border-gray-200' 
                      : 'bg-white border-red-200'
                  }`}
                >
                  {/* Collapsed Row */}
                  <div 
                    className="flex justify-between items-center p-3 cursor-pointer"
                    onClick={() => toggleExpandEscalation(job.job_id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${isAcknowledged ? 'text-gray-700' : 'text-red-800'}`}>
                          {job.title}
                        </p>
                        {isAcknowledged && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Acknowledged
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${isAcknowledged ? 'text-gray-500' : 'text-red-600'}`}>
                        {job.customer?.name || 'No Customer'} • {job.assigned_technician_name || 'Unassigned'}
                      </p>
                      {job.escalation_notes && !isExpanded && (
                        <p className="text-xs text-gray-500 mt-1 italic truncate max-w-xs">
                          <MessageSquare className="w-3 h-3 inline mr-1" />
                          {job.escalation_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          daysOverdue >= 3 
                            ? 'bg-red-500 text-white' 
                            : daysOverdue >= 1 
                              ? 'bg-red-200 text-red-700' 
                              : 'bg-orange-100 text-orange-700'
                        }`}>
                          {daysOverdue}d overdue
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          {job.status}
                        </p>
                      </div>
                      {!isAcknowledged && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcknowledgeEscalation(job.job_id);
                          }}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Ack
                        </button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                        {/* Customer Info */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Customer</p>
                          <p className="font-medium text-gray-800">{job.customer?.name || 'N/A'}</p>
                          {job.customer?.phone && (
                            <a 
                              href={`tel:${job.customer.phone}`}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                            >
                              <Phone className="w-3 h-3" /> {job.customer.phone}
                            </a>
                          )}
                        </div>
                        {/* Technician Info */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Technician</p>
                          <p className="font-medium text-gray-800">{job.assigned_technician_name || 'Unassigned'}</p>
                          {job.technician?.phone && (
                            <a 
                              href={`tel:${job.technician.phone}`}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                            >
                              <Phone className="w-3 h-3" /> {job.technician.phone}
                            </a>
                          )}
                        </div>
                        {/* Forklift Info */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Forklift</p>
                          <p className="font-medium text-gray-800">
                            {job.forklift?.serial_number || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">{job.forklift?.model || ''}</p>
                        </div>
                        {/* Timeline */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Timeline</p>
                          <p className="text-xs text-gray-600">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Scheduled: {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'N/A'}
                          </p>
                          <p className="text-xs text-gray-600">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Escalated: {new Date(job.escalation_triggered_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Notes Section */}
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">Escalation Notes</p>
                        {editingNotesId === job.job_id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={notesInput}
                              onChange={(e) => setNotesInput(e.target.value)}
                              placeholder="E.g., Waiting for parts, Customer rescheduled..."
                              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveNotes(job.job_id)}
                              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingNotesId(null)}
                              className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => {
                              setEditingNotesId(job.job_id);
                              setNotesInput(job.escalation_notes || '');
                            }}
                            className="p-2 bg-gray-50 rounded text-sm text-gray-600 cursor-pointer hover:bg-gray-100 min-h-[2rem]"
                          >
                            {job.escalation_notes || <span className="text-gray-400 italic">Click to add notes...</span>}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => navigate(`/jobs/${job.job_id}`)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          View Job →
                        </button>
                        <button
                          onClick={() => navigate(`/jobs/${job.job_id}?action=reassign`)}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
                        >
                          <UserCog className="w-3 h-3" /> Reassign
                        </button>
                        {!job.is_overtime && (
                          <button
                            onClick={() => handleMarkOvertime(job.job_id)}
                            className="px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3" /> Mark Overtime
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
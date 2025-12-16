import React, { useState, useEffect, useMemo } from 'react';
import { User, Job, UserRole, TechnicianKPI } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { 
  Users, Clock, CheckCircle, DollarSign, TrendingUp, 
  AlertTriangle, Award, Target, Activity, Calendar,
  ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';

interface TechnicianKPIPageProps {
  currentUser: User;
}

const TechnicianKPIPage: React.FC<TechnicianKPIPageProps> = ({ currentUser }) => {
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [expandedTech, setExpandedTech] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [techData, jobData] = await Promise.all([
        MockDb.getTechnicians(),
        MockDb.getJobs(currentUser),
      ]);
      setTechnicians(techData);
      setAllJobs(jobData);
    } catch (error) {
      console.error('Error loading KPI data:', error);
    }
    setLoading(false);
  };

  // Filter jobs by date range
  const filteredJobs = useMemo(() => {
    if (dateRange === 'all') return allJobs;
    
    const now = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return allJobs.filter(job => new Date(job.created_at) >= cutoff);
  }, [allJobs, dateRange]);

  // Calculate KPIs for each technician
  const technicianKPIs: TechnicianKPI[] = useMemo(() => {
    return technicians.map(tech => {
      const techJobs = filteredJobs.filter(j => j.assigned_technician_id === tech.user_id);
      const completedJobs = techJobs.filter(j => 
        j.status === 'Completed' || j.status === 'Awaiting Finalization'
      );
      
      // Response time calculation (time from assignment to arrival)
      const jobsWithArrival = techJobs.filter(j => j.arrival_time);
      const avgResponseTime = jobsWithArrival.length > 0
        ? jobsWithArrival.reduce((acc, j) => {
            const created = new Date(j.created_at).getTime();
            const arrived = new Date(j.arrival_time!).getTime();
            return acc + (arrived - created) / (1000 * 60 * 60);
          }, 0) / jobsWithArrival.length
        : 0;

      // Completion time calculation (arrival to completion)
      const jobsWithCompletion = completedJobs.filter(j => j.arrival_time && j.completion_time);
      const avgCompletionTime = jobsWithCompletion.length > 0
        ? jobsWithCompletion.reduce((acc, j) => {
            const arrived = new Date(j.arrival_time!).getTime();
            const completed = new Date(j.completion_time!).getTime();
            return acc + (completed - arrived) / (1000 * 60 * 60);
          }, 0) / jobsWithCompletion.length
        : 0;

      // Revenue calculation
      const totalRevenue = completedJobs.reduce((acc, job) => {
        const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
        const laborCost = job.labor_cost || 0;
        const extraCharges = (job.extra_charges || []).reduce((sum, c) => sum + c.amount, 0);
        return acc + partsCost + laborCost + extraCharges;
      }, 0);

      // Parts used
      const totalParts = completedJobs.reduce((acc, job) => 
        acc + job.parts_used.reduce((sum, p) => sum + p.quantity, 0), 0
      );

      // Priority breakdown
      const priorityBreakdown = {
        emergency: techJobs.filter(j => j.priority === 'Emergency').length,
        high: techJobs.filter(j => j.priority === 'High').length,
        medium: techJobs.filter(j => j.priority === 'Medium').length,
        low: techJobs.filter(j => j.priority === 'Low').length,
      };

      return {
        technician_id: tech.user_id,
        technician_name: tech.name,
        period_start: '',
        period_end: '',
        total_jobs_assigned: techJobs.length,
        total_jobs_completed: completedJobs.length,
        completion_rate: techJobs.length > 0 ? (completedJobs.length / techJobs.length) * 100 : 0,
        avg_response_time: avgResponseTime,
        avg_completion_time: avgCompletionTime,
        total_hours_worked: jobsWithCompletion.reduce((acc, j) => {
          const arrived = new Date(j.arrival_time!).getTime();
          const completed = new Date(j.completion_time!).getTime();
          return acc + (completed - arrived) / (1000 * 60 * 60);
        }, 0),
        jobs_with_callbacks: 0,
        total_revenue_generated: totalRevenue,
        avg_job_value: completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0,
        total_parts_used: totalParts,
        emergency_jobs: priorityBreakdown.emergency,
        high_priority_jobs: priorityBreakdown.high,
        medium_priority_jobs: priorityBreakdown.medium,
        low_priority_jobs: priorityBreakdown.low,
      };
    }).sort((a, b) => b.total_revenue_generated - a.total_revenue_generated);
  }, [technicians, filteredJobs]);

  // Team totals
  const teamTotals = useMemo(() => {
    return {
      totalJobs: technicianKPIs.reduce((acc, t) => acc + t.total_jobs_assigned, 0),
      totalCompleted: technicianKPIs.reduce((acc, t) => acc + t.total_jobs_completed, 0),
      totalRevenue: technicianKPIs.reduce((acc, t) => acc + t.total_revenue_generated, 0),
      avgResponseTime: technicianKPIs.length > 0
        ? technicianKPIs.reduce((acc, t) => acc + t.avg_response_time, 0) / technicianKPIs.filter(t => t.avg_response_time > 0).length
        : 0,
      avgCompletionTime: technicianKPIs.length > 0
        ? technicianKPIs.reduce((acc, t) => acc + t.avg_completion_time, 0) / technicianKPIs.filter(t => t.avg_completion_time > 0).length
        : 0,
    };
  }, [technicianKPIs]);

  const formatTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600 bg-green-50';
    if (rate >= 70) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getResponseTimeColor = (hours: number) => {
    if (hours <= 2) return 'text-green-600';
    if (hours <= 4) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading KPI data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Technician Performance</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor KPIs and track team performance
          </p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Team Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs uppercase">Technicians</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{technicians.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs uppercase">Total Jobs</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{teamTotals.totalJobs}</div>
          <div className="text-xs text-green-600">{teamTotals.totalCompleted} completed</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs uppercase">Revenue</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            RM {teamTotals.totalRevenue.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs uppercase">Avg Response</span>
          </div>
          <div className={`text-2xl font-bold ${getResponseTimeColor(teamTotals.avgResponseTime)}`}>
            {formatTime(teamTotals.avgResponseTime || 0)}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Target className="w-4 h-4" />
            <span className="text-xs uppercase">Avg Completion</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatTime(teamTotals.avgCompletionTime || 0)}
          </div>
        </div>
      </div>

      {/* Technician Cards */}
      <div className="space-y-4">
        {technicianKPIs.map((kpi, index) => (
          <div key={kpi.technician_id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Main Row */}
            <div 
              className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedTech(expandedTech === kpi.technician_id ? null : kpi.technician_id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-slate-200 text-slate-700' :
                    index === 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {index === 0 ? <Award className="w-4 h-4" /> : index + 1}
                  </div>
                  
                  {/* Name and Stats */}
                  <div>
                    <h3 className="font-bold text-slate-900">{kpi.technician_name}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {kpi.total_jobs_completed}/{kpi.total_jobs_assigned} jobs
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPerformanceColor(kpi.completion_rate)}`}>
                        {kpi.completion_rate.toFixed(0)}% completion
                      </span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className={`text-lg font-bold ${getResponseTimeColor(kpi.avg_response_time)}`}>
                      {formatTime(kpi.avg_response_time)}
                    </div>
                    <div className="text-xs text-slate-400">Response</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-700">
                      {formatTime(kpi.avg_completion_time)}
                    </div>
                    <div className="text-xs text-slate-400">Completion</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      RM {kpi.total_revenue_generated.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400">Revenue</div>
                  </div>
                  
                  <div className="text-slate-400">
                    {expandedTech === kpi.technician_id ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedTech === kpi.technician_id && (
              <div className="border-t border-slate-100 p-4 bg-slate-50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Detailed Stats */}
                  <div className="bg-white rounded-lg p-4">
                    <div className="text-xs text-slate-500 uppercase mb-2">Job Metrics</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Total Assigned</span>
                        <span className="font-medium">{kpi.total_jobs_assigned}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Completed</span>
                        <span className="font-medium text-green-600">{kpi.total_jobs_completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">In Progress</span>
                        <span className="font-medium text-blue-600">
                          {kpi.total_jobs_assigned - kpi.total_jobs_completed}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <div className="text-xs text-slate-500 uppercase mb-2">Time Metrics</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Avg Response</span>
                        <span className={`font-medium ${getResponseTimeColor(kpi.avg_response_time)}`}>
                          {formatTime(kpi.avg_response_time)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Avg Completion</span>
                        <span className="font-medium">{formatTime(kpi.avg_completion_time)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Total Hours</span>
                        <span className="font-medium">{kpi.total_hours_worked.toFixed(1)}h</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <div className="text-xs text-slate-500 uppercase mb-2">Revenue</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Total Revenue</span>
                        <span className="font-medium text-green-600">
                          RM {kpi.total_revenue_generated.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Avg Job Value</span>
                        <span className="font-medium">RM {kpi.avg_job_value.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Parts Used</span>
                        <span className="font-medium">{kpi.total_parts_used}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <div className="text-xs text-slate-500 uppercase mb-2">Priority Breakdown</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-red-600 text-sm">Emergency</span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                          {kpi.emergency_jobs}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-orange-600 text-sm">High</span>
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                          {kpi.high_priority_jobs}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-blue-600 text-sm">Medium</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {kpi.medium_priority_jobs}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600 text-sm">Low</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                          {kpi.low_priority_jobs}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Bar */}
                <div className="mt-4 bg-white rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Completion Rate</span>
                    <span className="text-sm font-bold text-slate-900">{kpi.completion_rate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        kpi.completion_rate >= 90 ? 'bg-green-500' :
                        kpi.completion_rate >= 70 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(kpi.completion_rate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {technicians.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">No Technicians Found</h3>
          <p className="text-sm text-slate-400">
            Add technicians to start tracking their performance
          </p>
        </div>
      )}
    </div>
  );
};

export default TechnicianKPIPage;

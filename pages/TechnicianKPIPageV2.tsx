import React, { useState, useEffect, useMemo } from 'react';
import { User, Job, UserRole, EnhancedTechnicianKPI, JobType } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { 
  Users, Clock, CheckCircle, DollarSign, TrendingUp, 
  AlertTriangle, Award, Target, Activity, Calendar,
  ChevronDown, ChevronUp, BarChart3, Zap, Timer,
  Wrench, RefreshCw, Gauge, Star, Filter
} from 'lucide-react';

interface TechnicianKPIPageProps {
  currentUser: User;
}

const TechnicianKPIPage: React.FC<TechnicianKPIPageProps> = ({ currentUser }) => {
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '365d' | 'custom'>('30d');
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Industry Benchmark Constants
  const BENCHMARKS = {
    first_time_fix_rate: 77, // Industry average FTFR
    avg_response_time: 4, // Hours
    technician_utilization: 75, // Percentage
    jobs_per_day: 4,
  };

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
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (dateRange === 'custom') {
      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
      } else {
        return allJobs;
      }
    } else {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
    
    return allJobs.filter(job => {
      const jobDate = new Date(job.created_at);
      return jobDate >= startDate && jobDate <= endDate;
    });
  }, [allJobs, dateRange, customStartDate, customEndDate]);

  // Calculate working days in period
  const getWorkingDays = (startDate: Date, endDate: Date): number => {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++; // Exclude weekends
      current.setDate(current.getDate() + 1);
    }
    return Math.max(count, 1);
  };

  // Calculate Enhanced KPIs for each technician
  const technicianKPIs: EnhancedTechnicianKPI[] = useMemo(() => {
    const now = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : dateRange === '365d' ? 365 : 30;
    const periodStart = dateRange === 'custom' && customStartDate 
      ? new Date(customStartDate) 
      : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const periodEnd = dateRange === 'custom' && customEndDate 
      ? new Date(customEndDate) 
      : now;
    const workingDays = getWorkingDays(periodStart, periodEnd);

    return technicians.map(tech => {
      const techJobs = filteredJobs.filter(j => j.assigned_technician_id === tech.user_id);
      const completedJobs = techJobs.filter(j => 
        j.status === 'Completed' || j.status === 'Awaiting Finalization'
      );

      // First Time Fix Rate (jobs without callbacks)
      const callbackJobs = techJobs.filter(j => (j as any).is_callback === true);
      const ftfr = completedJobs.length > 0 
        ? ((completedJobs.length - callbackJobs.length) / completedJobs.length) * 100 
        : 0;

      // Response time calculation (time from assignment to arrival)
      const jobsWithArrival = techJobs.filter(j => j.arrival_time && j.assigned_at);
      const avgResponseTime = jobsWithArrival.length > 0
        ? jobsWithArrival.reduce((acc, j) => {
            const assigned = new Date(j.assigned_at || j.created_at).getTime();
            const arrived = new Date(j.arrival_time!).getTime();
            return acc + Math.max(0, (arrived - assigned) / (1000 * 60 * 60));
          }, 0) / jobsWithArrival.length
        : 0;

      // Mean Time to Repair (MTTR) - actual repair time
      const jobsWithRepairTimes = completedJobs.filter(j => j.repair_start_time && j.repair_end_time);
      const mttr = jobsWithRepairTimes.length > 0
        ? jobsWithRepairTimes.reduce((acc, j) => {
            const start = new Date(j.repair_start_time!).getTime();
            const end = new Date(j.repair_end_time!).getTime();
            return acc + Math.max(0, (end - start) / (1000 * 60 * 60));
          }, 0) / jobsWithRepairTimes.length
        : 0;

      // Completion time (arrival to completion)
      const jobsWithCompletion = completedJobs.filter(j => j.arrival_time && j.completion_time);
      const avgCompletionTime = jobsWithCompletion.length > 0
        ? jobsWithCompletion.reduce((acc, j) => {
            const arrived = new Date(j.arrival_time!).getTime();
            const completed = new Date(j.completion_time!).getTime();
            return acc + Math.max(0, (completed - arrived) / (1000 * 60 * 60));
          }, 0) / jobsWithCompletion.length
        : 0;

      // Total hours worked
      const totalHoursWorked = jobsWithCompletion.reduce((acc, j) => {
        const arrived = new Date(j.arrival_time!).getTime();
        const completed = new Date(j.completion_time!).getTime();
        return acc + Math.max(0, (completed - arrived) / (1000 * 60 * 60));
      }, 0);

      // Technician Utilization (assuming 8-hour workday)
      const availableHours = workingDays * 8;
      const utilization = availableHours > 0 ? (totalHoursWorked / availableHours) * 100 : 0;

      // Jobs per day
      const jobsPerDay = workingDays > 0 ? completedJobs.length / workingDays : 0;


      // Revenue calculation
      const totalRevenue = completedJobs.reduce((acc, job) => {
        const partsCost = job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0);
        const laborCost = job.labor_cost || 0;
        const extraCharges = (job.extra_charges || []).reduce((sum, c) => sum + c.amount, 0);
        return acc + partsCost + laborCost + extraCharges;
      }, 0);

      // Total parts value
      const totalPartsValue = completedJobs.reduce((acc, job) => 
        acc + job.parts_used.reduce((sum, p) => sum + (p.sell_price_at_time * p.quantity), 0), 0
      );

      // Job Type Breakdown
      const serviceJobs = techJobs.filter(j => j.job_type === JobType.SERVICE).length;
      const repairJobs = techJobs.filter(j => j.job_type === JobType.REPAIR).length;
      const checkingJobs = techJobs.filter(j => j.job_type === JobType.CHECKING).length;
      const accidentJobs = techJobs.filter(j => j.job_type === JobType.ACCIDENT).length;

      // Priority breakdown
      const priorityBreakdown = {
        emergency: techJobs.filter(j => j.priority === 'Emergency').length,
        high: techJobs.filter(j => j.priority === 'High').length,
        medium: techJobs.filter(j => j.priority === 'Medium').length,
        low: techJobs.filter(j => j.priority === 'Low').length,
      };

      // Calculate scores
      const efficiencyScore = Math.min(100, (
        (ftfr / BENCHMARKS.first_time_fix_rate) * 30 +
        (BENCHMARKS.avg_response_time / Math.max(avgResponseTime, 0.5)) * 30 +
        (utilization / BENCHMARKS.technician_utilization) * 40
      ));

      const productivityScore = Math.min(100, (jobsPerDay / BENCHMARKS.jobs_per_day) * 100);
      const qualityScore = Math.min(100, ftfr);

      return {
        technician_id: tech.user_id,
        technician_name: tech.name,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_jobs_assigned: techJobs.length,
        total_jobs_completed: completedJobs.length,
        completion_rate: techJobs.length > 0 ? (completedJobs.length / techJobs.length) * 100 : 0,
        avg_response_time: avgResponseTime,
        avg_completion_time: avgCompletionTime,
        total_hours_worked: totalHoursWorked,
        jobs_with_callbacks: callbackJobs.length,
        total_revenue_generated: totalRevenue,
        avg_job_value: completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0,
        total_parts_used: completedJobs.reduce((acc, job) => 
          acc + job.parts_used.reduce((sum, p) => sum + p.quantity, 0), 0
        ),
        emergency_jobs: priorityBreakdown.emergency,
        high_priority_jobs: priorityBreakdown.high,
        medium_priority_jobs: priorityBreakdown.medium,
        low_priority_jobs: priorityBreakdown.low,
        // Enhanced KPIs
        first_time_fix_rate: ftfr,
        mean_time_to_repair: mttr,
        technician_utilization: utilization,
        jobs_per_day: jobsPerDay,
        repeat_visit_count: callbackJobs.length,
        service_jobs: serviceJobs,
        repair_jobs: repairJobs,
        checking_jobs: checkingJobs,
        accident_jobs: accidentJobs,
        efficiency_score: efficiencyScore,
        productivity_score: productivityScore,
        quality_score: qualityScore,
      };
    }).sort((a, b) => b.efficiency_score - a.efficiency_score);
  }, [technicians, filteredJobs, dateRange, customStartDate, customEndDate]);

  // Team totals
  const teamTotals = useMemo(() => {
    const activeTechs = technicianKPIs.filter(t => t.total_jobs_assigned > 0);
    return {
      totalJobs: technicianKPIs.reduce((acc, t) => acc + t.total_jobs_assigned, 0),
      totalCompleted: technicianKPIs.reduce((acc, t) => acc + t.total_jobs_completed, 0),
      totalRevenue: technicianKPIs.reduce((acc, t) => acc + t.total_revenue_generated, 0),
      avgFTFR: activeTechs.length > 0
        ? activeTechs.reduce((acc, t) => acc + t.first_time_fix_rate, 0) / activeTechs.length
        : 0,
      avgResponseTime: activeTechs.length > 0
        ? activeTechs.reduce((acc, t) => acc + t.avg_response_time, 0) / activeTechs.filter(t => t.avg_response_time > 0).length || 0
        : 0,
      avgUtilization: activeTechs.length > 0
        ? activeTechs.reduce((acc, t) => acc + t.technician_utilization, 0) / activeTechs.length
        : 0,
      avgJobsPerDay: activeTechs.length > 0
        ? activeTechs.reduce((acc, t) => acc + t.jobs_per_day, 0) / activeTechs.length
        : 0,
    };
  }, [technicianKPIs]);



  // Helper functions
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-amber-100';
    return 'bg-red-100';
  };

  const getBenchmarkStatus = (value: number, benchmark: number, inverse: boolean = false) => {
    const ratio = inverse ? benchmark / value : value / benchmark;
    if (ratio >= 1) return { color: 'text-green-600', icon: '✓', label: 'Above Target' };
    if (ratio >= 0.8) return { color: 'text-amber-600', icon: '~', label: 'Near Target' };
    return { color: 'text-red-600', icon: '↓', label: 'Below Target' };
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Technician KPI Dashboard</h1>
          <p className="text-slate-500 text-sm">Performance metrics and industry benchmarks</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex items-center gap-2 hover:bg-slate-50"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={loadData}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Period:</span>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                {(['7d', '30d', '90d', '365d', 'custom'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-1.5 text-sm ${
                      dateRange === range
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {range === 'custom' ? 'Custom' : range}
                  </button>
                ))}
              </div>
            </div>
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Total Jobs</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{teamTotals.totalJobs}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Completed</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{teamTotals.totalCompleted}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <DollarSign className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Revenue</span>
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 truncate" title={`RM${teamTotals.totalRevenue.toLocaleString()}`}>
            RM{teamTotals.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Target className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Avg FTFR</span>
          </div>
          <p className={`text-2xl font-bold ${getBenchmarkStatus(teamTotals.avgFTFR, BENCHMARKS.first_time_fix_rate).color}`}>
            {teamTotals.avgFTFR.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Avg Response</span>
          </div>
          <p className={`text-2xl font-bold ${getBenchmarkStatus(teamTotals.avgResponseTime, BENCHMARKS.avg_response_time, true).color}`}>
            {teamTotals.avgResponseTime.toFixed(1)}h
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Gauge className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Utilization</span>
          </div>
          <p className={`text-2xl font-bold ${getBenchmarkStatus(teamTotals.avgUtilization, BENCHMARKS.technician_utilization).color}`}>
            {teamTotals.avgUtilization.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Zap className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Jobs/Day</span>
          </div>
          <p className={`text-2xl font-bold ${getBenchmarkStatus(teamTotals.avgJobsPerDay, BENCHMARKS.jobs_per_day).color}`}>
            {teamTotals.avgJobsPerDay.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Industry Benchmarks Legend */}
      <div className="bg-slate-50 rounded-lg p-3 flex flex-wrap gap-4 text-xs">
        <span className="font-medium text-slate-600">Industry Benchmarks:</span>
        <span className="text-slate-500">FTFR: {BENCHMARKS.first_time_fix_rate}%</span>
        <span className="text-slate-500">Response: {BENCHMARKS.avg_response_time}h</span>
        <span className="text-slate-500">Utilization: {BENCHMARKS.technician_utilization}%</span>
        <span className="text-slate-500">Jobs/Day: {BENCHMARKS.jobs_per_day}</span>
      </div>

      {/* Technician Cards */}
      <div className="space-y-4">
        {technicianKPIs.map((kpi, index) => (
          <div
            key={kpi.technician_id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
          >
            {/* Header Row */}
            <div
              className="p-4 cursor-pointer hover:bg-slate-50 transition"
              onClick={() => setExpandedTech(expandedTech === kpi.technician_id ? null : kpi.technician_id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {index === 0 && <Award className="w-5 h-5 text-amber-500" />}
                    <span className="font-bold text-slate-900">{kpi.technician_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(kpi.efficiency_score)} ${getScoreColor(kpi.efficiency_score)}`}>
                      Efficiency: {kpi.efficiency_score.toFixed(0)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(kpi.productivity_score)} ${getScoreColor(kpi.productivity_score)}`}>
                      Productivity: {kpi.productivity_score.toFixed(0)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(kpi.quality_score)} ${getScoreColor(kpi.quality_score)}`}>
                      Quality: {kpi.quality_score.toFixed(0)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Jobs</p>
                    <p className="font-bold text-slate-900">{kpi.total_jobs_completed}/{kpi.total_jobs_assigned}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Revenue</p>
                    <p className="font-bold text-green-600">RM{kpi.total_revenue_generated.toLocaleString()}</p>
                  </div>
                  {expandedTech === kpi.technician_id ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedTech === kpi.technician_id && (
              <div className="border-t border-slate-200 p-4 bg-slate-50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* KPI Metrics */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <Target className="w-4 h-4" /> Key Metrics
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">First Time Fix Rate</span>
                        <span className={`font-medium ${getBenchmarkStatus(kpi.first_time_fix_rate, BENCHMARKS.first_time_fix_rate).color}`}>
                          {kpi.first_time_fix_rate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Avg Response Time</span>
                        <span className={`font-medium ${getBenchmarkStatus(kpi.avg_response_time, BENCHMARKS.avg_response_time, true).color}`}>
                          {kpi.avg_response_time.toFixed(1)}h
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mean Time to Repair</span>
                        <span className="font-medium text-slate-700">{kpi.mean_time_to_repair.toFixed(1)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Utilization</span>
                        <span className={`font-medium ${getBenchmarkStatus(kpi.technician_utilization, BENCHMARKS.technician_utilization).color}`}>
                          {kpi.technician_utilization.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Jobs/Day</span>
                        <span className={`font-medium ${getBenchmarkStatus(kpi.jobs_per_day, BENCHMARKS.jobs_per_day).color}`}>
                          {kpi.jobs_per_day.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Job Types */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <Wrench className="w-4 h-4" /> Job Types
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Service</span>
                        <span className="font-medium text-blue-600">{kpi.service_jobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Repair</span>
                        <span className="font-medium text-orange-600">{kpi.repair_jobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Checking</span>
                        <span className="font-medium text-purple-600">{kpi.checking_jobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Accident</span>
                        <span className="font-medium text-red-600">{kpi.accident_jobs}</span>
                      </div>
                    </div>
                  </div>

                  {/* Priority Breakdown */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Priority
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Emergency</span>
                        <span className="font-medium text-red-600">{kpi.emergency_jobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">High</span>
                        <span className="font-medium text-orange-600">{kpi.high_priority_jobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Medium</span>
                        <span className="font-medium text-amber-600">{kpi.medium_priority_jobs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Low</span>
                        <span className="font-medium text-slate-600">{kpi.low_priority_jobs}</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Financial
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Revenue</span>
                        <span className="font-medium text-green-600">RM{kpi.total_revenue_generated.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Avg Job Value</span>
                        <span className="font-medium text-slate-700">RM{kpi.avg_job_value.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Parts Used</span>
                        <span className="font-medium text-slate-700">{kpi.total_parts_used}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Hours Worked</span>
                        <span className="font-medium text-slate-700">{kpi.total_hours_worked.toFixed(1)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Repeat Visits</span>
                        <span className={`font-medium ${kpi.repeat_visit_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {kpi.repeat_visit_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {technicianKPIs.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No technician data available for the selected period</p>
        </div>
      )}
    </div>
  );
};

export default TechnicianKPIPage;

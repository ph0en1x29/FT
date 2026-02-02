import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole, Job } from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import {
  Users, UserCheck, UserX, Loader2, ChevronRight, Briefcase,
  AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';

interface TeamStatusTabProps {
  currentUser: User;
}

// Design tokens - use theme CSS variables (no Tailwind dark: classes)
const statusStyles = {
  available: {
    chip: 'bg-[var(--success-bg)] text-[var(--success)]',
    icon: 'bg-[var(--success-bg)]',
    iconColor: 'text-[var(--success)]',
    border: 'border-[var(--success)]',
  },
  busy: {
    chip: 'bg-[var(--warning-bg)] text-[var(--warning)]',
    icon: 'bg-[var(--warning-bg)]',
    iconColor: 'text-[var(--warning)]',
    border: 'border-[var(--warning)]',
  },
  overloaded: {
    chip: 'bg-[var(--error-bg)] text-[var(--error)]',
    icon: 'bg-[var(--error-bg)]',
    iconColor: 'text-[var(--error)]',
    border: 'border-[var(--error)]',
  },
};

type TechnicianStatus = 'available' | 'busy' | 'overloaded';

interface TechnicianWithStatus {
  user: User;
  status: TechnicianStatus;
  jobCount: number;
  jobs: Job[];
}

const TeamStatusTab: React.FC<TeamStatusTabProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<TechnicianWithStatus[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expandedTech, setExpandedTech] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, jobsData] = await Promise.all([
        MockDb.getUsersLightweight(),
        MockDb.getJobs(currentUser),
      ]);

      setJobs(jobsData || []);

      // Filter to active technicians only
      const techUsers = (usersData || []).filter(
        (u) => u.role === UserRole.TECHNICIAN && u.is_active
      );

      // Calculate status for each technician
      const techsWithStatus: TechnicianWithStatus[] = techUsers.map((tech) => {
        const techJobs = (jobsData || []).filter(
          (j) =>
            j.assigned_technician_id === tech.user_id &&
            !['Completed', 'Cancelled', 'Completed Awaiting Ack'].includes(j.status)
        );
        const activeCount = techJobs.length;

        let status: TechnicianStatus;
        if (activeCount === 0) {
          status = 'available';
        } else if (activeCount >= 3) {
          status = 'overloaded';
        } else {
          status = 'busy';
        }

        return {
          user: tech,
          status,
          jobCount: activeCount,
          jobs: techJobs,
        };
      });

      // Sort: overloaded first, then busy, then available
      techsWithStatus.sort((a, b) => {
        const order = { overloaded: 0, busy: 1, available: 2 };
        return order[a.status] - order[b.status];
      });

      setTechnicians(techsWithStatus);
    } catch (error) {
      showToast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: TechnicianStatus) => {
    const styles = statusStyles[status];
    switch (status) {
      case 'available':
        return { ...styles, label: 'Available', icon: UserCheck };
      case 'busy':
        return { ...styles, label: 'Busy', icon: Briefcase };
      case 'overloaded':
        return { ...styles, label: 'Overloaded', icon: AlertCircle };
    }
  };

  // Summary counts
  const availableCount = technicians.filter((t) => t.status === 'available').length;
  const busyCount = technicians.filter((t) => t.status === 'busy').length;
  const overloadedCount = technicians.filter((t) => t.status === 'overloaded').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-theme-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={`card-theme rounded-xl p-4 cursor-pointer hover:shadow-md transition-all border-l-4 ${statusStyles.available.border}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusStyles.available.icon}`}
            >
              <UserCheck className={`w-5 h-5 ${statusStyles.available.iconColor}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{availableCount}</p>
              <p className="text-xs text-theme-muted">Available</p>
            </div>
          </div>
        </div>

        <div
          className={`card-theme rounded-xl p-4 cursor-pointer hover:shadow-md transition-all border-l-4 ${statusStyles.busy.border}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusStyles.busy.icon}`}
            >
              <Briefcase className={`w-5 h-5 ${statusStyles.busy.iconColor}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{busyCount}</p>
              <p className="text-xs text-theme-muted">Busy (1-2 jobs)</p>
            </div>
          </div>
        </div>

        <div
          className={`card-theme rounded-xl p-4 cursor-pointer hover:shadow-md transition-all border-l-4 ${statusStyles.overloaded.border}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusStyles.overloaded.icon}`}
            >
              <AlertCircle className={`w-5 h-5 ${statusStyles.overloaded.iconColor}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-theme">{overloadedCount}</p>
              <p className="text-xs text-theme-muted">Overloaded (3+)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Technician Cards */}
      {technicians.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No technicians found</h3>
          <p className="text-sm text-theme-muted">There are no active technicians in the system</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {technicians.map((tech) => {
            const config = getStatusConfig(tech.status);
            const Icon = config.icon;
            const isExpanded = expandedTech === tech.user.user_id;

            return (
              <div
                key={tech.user.user_id}
                className="card-theme rounded-xl overflow-hidden hover:shadow-md transition-all"
              >
                {/* Header - clickable to navigate */}
                <div
                  onClick={() => navigate(`/people/employees/${tech.user.user_id}`)}
                  className="p-5 cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                      {tech.user.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name as prominent headline */}
                      <h3 className="font-semibold text-base text-theme truncate">{tech.user.name}</h3>

                      {/* Chips row - consistent chip styling for both status and jobs */}
                      <div className="flex items-center gap-2 mt-2">
                        {/* Status chip - colored with dark mode support */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.chip}`}
                          title={`Status: ${config.label}`}
                        >
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </span>

                        {/* Jobs chip - neutral badge, theme-aware */}
                        {tech.jobCount > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                            title={`${tech.jobCount} active job${tech.jobCount !== 1 ? 's' : ''} assigned`}
                          >
                            <Briefcase className="w-3 h-3" />
                            {tech.jobCount} job{tech.jobCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron with hover state and larger tap target */}
                    <div className="p-1 rounded-lg group-hover:bg-[var(--bg-subtle)] transition-colors flex-shrink-0">
                      <ChevronRight className="w-5 h-5 text-theme-muted" />
                    </div>
                  </div>
                </div>

                {/* Jobs List (expandable) */}
                {tech.jobCount > 0 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedTech(isExpanded ? null : tech.user.user_id);
                      }}
                      className="w-full px-4 py-2 border-t border-theme flex items-center justify-center gap-1 text-xs text-theme-accent hover:text-[var(--accent-hover)] hover:bg-theme-accent-subtle transition-colors"
                    >
                      <span>{isExpanded ? 'Hide jobs' : 'View assigned jobs'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-theme divide-y divide-theme">
                        {tech.jobs.map((job) => (
                          <div
                            key={job.job_id}
                            onClick={() => navigate(`/jobs/${job.job_id}`)}
                            className="px-4 py-2 text-sm hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
                          >
                            <p className="font-medium text-theme truncate">
                              {job.job_number || job.title}
                            </p>
                            <p className="text-xs text-theme-muted truncate">
                              {job.customer?.name || 'No customer'} &middot; {job.status}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TeamStatusTab;

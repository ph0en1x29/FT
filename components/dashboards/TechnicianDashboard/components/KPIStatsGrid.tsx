import { Calendar,CheckCircle,Package,Play } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Job } from '../types';

interface KPIStatsGridProps {
  todayJobs: Job[];
  inProgressJobs: Job[];
  completedThisWeek: Job[];
  vanStockLow: number;
}

/**
 * KPI statistics grid for the dashboard
 */
export const KPIStatsGrid: React.FC<KPIStatsGridProps> = ({
  todayJobs,
  inProgressJobs,
  completedThisWeek,
  vanStockLow,
}) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Today's Jobs */}
      <div
        className="card-premium p-5 border-l-4 border-l-[var(--accent)] cursor-pointer hover:shadow-lg transition-all"
        onClick={() => navigate('/jobs')}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Today's Jobs
            </p>
            <p className="text-3xl font-bold mt-2 text-[var(--text)]">{todayJobs.length}</p>
            <p className="text-xs mt-1 text-[var(--text-subtle)]">Scheduled for today</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[var(--accent)]" />
          </div>
        </div>
      </div>

      {/* In Progress */}
      <div
        className={`card-premium p-5 border-l-4 cursor-pointer hover:shadow-lg transition-all ${
          inProgressJobs.length > 0 ? 'border-l-blue-500 bg-blue-50/50' : 'border-l-gray-300'
        }`}
        onClick={() => navigate('/jobs?filter=in-progress')}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              In Progress
            </p>
            <p
              className={`text-3xl font-bold mt-2 ${
                inProgressJobs.length > 0 ? 'text-blue-600' : 'text-[var(--text)]'
              }`}
            >
              {inProgressJobs.length}
            </p>
            <p className="text-xs mt-1 text-[var(--text-subtle)]">Currently working</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Play className="w-5 h-5 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Completed This Week */}
      <div className="card-premium p-5 border-l-4 border-l-green-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Completed
            </p>
            <p className="text-3xl font-bold mt-2 text-green-600">{completedThisWeek.length}</p>
            <p className="text-xs mt-1 text-[var(--text-subtle)]">This week</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
        </div>
      </div>

      {/* Van Stock Alert */}
      <div
        className={`card-premium p-5 border-l-4 cursor-pointer hover:shadow-lg transition-all ${
          vanStockLow > 0 ? 'border-l-orange-500 bg-orange-50/50' : 'border-l-gray-300'
        }`}
        onClick={() => navigate('/my-van-stock')}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Van Stock
            </p>
            <p
              className={`text-3xl font-bold mt-2 ${
                vanStockLow > 0 ? 'text-orange-600' : 'text-green-600'
              }`}
            >
              {vanStockLow > 0 ? vanStockLow : 'OK'}
            </p>
            <p className="text-xs mt-1 text-[var(--text-subtle)]">
              {vanStockLow > 0 ? 'Items low' : 'Stock levels good'}
            </p>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              vanStockLow > 0 ? 'bg-orange-100' : 'bg-green-100'
            }`}
          >
            <Package className={`w-5 h-5 ${vanStockLow > 0 ? 'text-orange-600' : 'text-green-600'}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

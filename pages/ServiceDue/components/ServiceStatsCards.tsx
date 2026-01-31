import React from 'react';
import { AlertTriangle, Calendar, CheckCircle, Truck } from 'lucide-react';

type FilterType = 'all' | 'overdue' | 'due_soon' | 'job_created';

interface ServiceStats {
  total: number;
  overdue: number;
  dueSoon: number;
  withJobs: number;
}

interface ServiceStatsCardsProps {
  stats: ServiceStats;
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
}

const ServiceStatsCards: React.FC<ServiceStatsCardsProps> = ({ stats, filter, setFilter }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <button
        onClick={() => setFilter('all')}
        className={`card-theme p-4 rounded-xl text-left transition-all ${
          filter === 'all' ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <div className="flex items-center gap-2 text-theme-muted text-sm mb-1">
          <Truck className="w-4 h-4" />
          Total Due
        </div>
        <div className="text-2xl font-bold text-theme">{stats.total}</div>
      </button>

      <button
        onClick={() => setFilter('overdue')}
        className={`card-theme p-4 rounded-xl text-left transition-all ${
          filter === 'overdue' ? 'ring-2 ring-red-500' : ''
        }`}
      >
        <div className="flex items-center gap-2 text-theme-muted text-sm mb-1">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Overdue
        </div>
        <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
      </button>

      <button
        onClick={() => setFilter('due_soon')}
        className={`card-theme p-4 rounded-xl text-left transition-all ${
          filter === 'due_soon' ? 'ring-2 ring-yellow-500' : ''
        }`}
      >
        <div className="flex items-center gap-2 text-theme-muted text-sm mb-1">
          <Calendar className="w-4 h-4 text-yellow-500" />
          Due Soon
        </div>
        <div className="text-2xl font-bold text-yellow-500">{stats.dueSoon}</div>
      </button>

      <button
        onClick={() => setFilter('job_created')}
        className={`card-theme p-4 rounded-xl text-left transition-all ${
          filter === 'job_created' ? 'ring-2 ring-green-500' : ''
        }`}
      >
        <div className="flex items-center gap-2 text-theme-muted text-sm mb-1">
          <CheckCircle className="w-4 h-4 text-green-500" />
          Job Created
        </div>
        <div className="text-2xl font-bold text-green-500">{stats.withJobs}</div>
      </button>
    </div>
  );
};

export default ServiceStatsCards;

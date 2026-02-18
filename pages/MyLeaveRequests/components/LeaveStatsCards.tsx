import { Calendar,CheckCircle,Clock } from 'lucide-react';
import { LeaveStats } from '../hooks/useLeaveData';

interface LeaveStatsCardsProps {
  stats: LeaveStats;
}

export function LeaveStatsCards({ stats }: LeaveStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm text-theme-muted">Pending Approval</p>
            <p className="text-2xl font-bold text-theme">{stats.pending}</p>
          </div>
        </div>
      </div>
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-theme-muted">Upcoming Approved</p>
            <p className="text-2xl font-bold text-theme">{stats.approved}</p>
          </div>
        </div>
      </div>
      <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Days Used</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalDays}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

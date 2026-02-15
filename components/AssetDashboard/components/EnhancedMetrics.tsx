import { Activity, DollarSign, Gauge, TrendingUp } from 'lucide-react';
import React from 'react';
import { DashboardMetrics, StatusCounts } from '../types';

interface EnhancedMetricsProps {
  metrics: DashboardMetrics;
  statusCounts: StatusCounts;
}

/**
 * EnhancedMetrics - Key business metrics in a clean card layout
 * Shows utilization rate, jobs completed, avg duration, and fleet health
 */
export const EnhancedMetrics: React.FC<EnhancedMetricsProps> = ({ metrics, statusCounts }) => {
  const total = statusCounts.total || 1;
  const utilizationRate = Math.round((statusCounts.rented_out / total) * 100);
  const healthyCount = statusCounts.rented_out + statusCounts.available + statusCounts.reserved;
  const healthRate = Math.round((healthyCount / total) * 100);

  const cards = [
    {
      label: 'Utilization Rate',
      value: `${utilizationRate}%`,
      subtitle: `${statusCounts.rented_out} of ${total} rented`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Jobs (30d)',
      value: metrics.jobs_completed_30d.toString(),
      subtitle: 'Completed',
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Avg Duration',
      value: metrics.avg_job_duration_hours > 0 
        ? `${metrics.avg_job_duration_hours.toFixed(1)}h`
        : '—',
      subtitle: 'Per job',
      icon: Gauge,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Fleet Health',
      value: `${healthRate}%`,
      subtitle: `${statusCounts.out_of_service + statusCounts.awaiting_parts} need attention`,
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="card-theme rounded-xl p-4 border border-theme"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-theme-muted uppercase tracking-wide">
                {card.label}
              </p>
              <div className={`p-1.5 rounded-lg ${card.bgColor}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-theme-muted mt-1">{card.subtitle}</p>
          </div>
        );
      })}
    </div>
  );
};

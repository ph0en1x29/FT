/**
 * KPI stats cards for accountant dashboard
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, FileText, Clock, CheckCircle } from 'lucide-react';

interface AccountantKPIStatsProps {
  monthlyRevenue: number;
  awaitingFinalizationCount: number;
  awaitingAckCount: number;
  completedThisMonthCount: number;
}

export const AccountantKPIStats: React.FC<AccountantKPIStatsProps> = ({
  monthlyRevenue,
  awaitingFinalizationCount,
  awaitingAckCount,
  completedThisMonthCount,
}) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Monthly Revenue */}
      <div className="card-premium p-5 border-l-4 border-l-green-500">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              This Month
            </p>
            <p className="text-3xl font-bold mt-2 text-green-600">
              RM{monthlyRevenue.toLocaleString()}
            </p>
            <p className="text-xs mt-1 text-[var(--text-subtle)]">Revenue</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
        </div>
      </div>

      {/* Awaiting Finalization */}
      <div
        className={`card-premium p-5 border-l-4 cursor-pointer hover:shadow-lg transition-all ${
          awaitingFinalizationCount > 0
            ? 'border-l-purple-500 bg-purple-50/50'
            : 'border-l-gray-300'
        }`}
        onClick={() => navigate('/invoices')}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              To Finalize
            </p>
            <p
              className={`text-3xl font-bold mt-2 ${
                awaitingFinalizationCount > 0 ? 'text-purple-600' : 'text-[var(--text)]'
              }`}
            >
              {awaitingFinalizationCount}
            </p>
            <p className="text-xs mt-1 text-[var(--text-subtle)]">Jobs pending</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Awaiting Acknowledgement */}
      <div
        className={`card-premium p-5 border-l-4 cursor-pointer hover:shadow-lg transition-all ${
          awaitingAckCount > 0 ? 'border-l-orange-500 bg-orange-50/50' : 'border-l-gray-300'
        }`}
        onClick={() => navigate('/jobs?filter=awaiting-ack')}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Awaiting Ack
            </p>
            <p
              className={`text-3xl font-bold mt-2 ${
                awaitingAckCount > 0 ? 'text-orange-600' : 'text-[var(--text)]'
              }`}
            >
              {awaitingAckCount}
            </p>
            <p className="text-xs mt-1 text-[var(--text-subtle)]">Customer sign-off</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Completed This Month */}
      <div className="card-premium p-5 border-l-4 border-l-[var(--accent)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Completed
            </p>
            <p className="text-3xl font-bold mt-2 text-[var(--text)]">
              {completedThisMonthCount}
            </p>
            <p className="text-xs mt-1 text-[var(--text-subtle)]">This month</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-[var(--accent)]" />
          </div>
        </div>
      </div>
    </div>
  );
};

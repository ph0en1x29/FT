import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Gauge, ChevronDown, ChevronUp } from 'lucide-react';
import { ForkliftWithStatus } from '../types';
import { STATUS_CONFIG } from '../constants';

interface ForkliftTableProps {
  forklifts: ForkliftWithStatus[];
  filteredCount: number;
  displayLimit: number;
  hasMore: boolean;
  onShowMore: () => void;
  onShowAll: () => void;
  onCollapse: () => void;
}

export const ForkliftTable: React.FC<ForkliftTableProps> = ({
  forklifts,
  filteredCount,
  displayLimit,
  hasMore,
  onShowMore,
  onShowAll,
  onCollapse
}) => {
  const navigate = useNavigate();

  const handleCreateJob = (forklift: ForkliftWithStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const customerId = forklift.rental_customer_id || forklift.current_customer_id || '';
    navigate(`/jobs/create?forklift_id=${forklift.forklift_id}&customer_id=${customerId}`);
  };

  return (
    <div className="card-theme rounded-xl border border-theme overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-theme-surface-2 border-b border-theme">
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase">
                Serial / Model
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase">
                Customer
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase">
                Hourmeter
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {forklifts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No forklifts found</p>
                </td>
              </tr>
            ) : (
              forklifts.map((forklift) => (
                <ForkliftRow
                  key={forklift.forklift_id}
                  forklift={forklift}
                  onRowClick={() => navigate(`/forklifts/${forklift.forklift_id}`)}
                  onCreateJob={(e) => handleCreateJob(forklift, e)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredCount > 5 && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-4">
          {hasMore ? (
            <>
              <button
                onClick={onShowMore}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                <ChevronDown className="w-4 h-4" />
                Show more (+20)
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={onShowAll}
                className="text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Show all ({filteredCount})
              </button>
            </>
          ) : (
            <button
              onClick={onCollapse}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              <ChevronUp className="w-4 h-4" />
              Collapse
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface ForkliftRowProps {
  forklift: ForkliftWithStatus;
  onRowClick: () => void;
  onCreateJob: (e: React.MouseEvent) => void;
}

const ForkliftRow: React.FC<ForkliftRowProps> = ({
  forklift,
  onRowClick,
  onCreateJob
}) => {
  const statusConfig = STATUS_CONFIG[forklift.operational_status];
  const StatusIcon = statusConfig.icon;
  const customerName = forklift.rental_customer_name || forklift.current_customer_name || '-';

  return (
    <tr className="clickable-row" onClick={onRowClick}>
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-slate-800">{forklift.serial_number}</p>
          <p className="text-sm text-slate-500">{forklift.make} {forklift.model}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={customerName === '-' ? 'text-slate-400' : 'text-slate-700'}>
          {customerName}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </span>
          {forklift.secondary_badges.map((badge, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
            >
              ⚠️ {badge}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Gauge className="w-4 h-4 text-slate-400" />
          {forklift.hourmeter.toLocaleString()} hrs
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onCreateJob}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </button>
      </td>
    </tr>
  );
};

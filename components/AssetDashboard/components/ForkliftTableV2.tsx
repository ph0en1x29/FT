/**
 * ForkliftTableV2 - Scrollable table with attention sorting + left-border accents
 * 
 * - Attention rows (service due, out of service, awaiting parts, "Due" badge) sorted to top
 * - Left-border color accent on attention rows
 * - Scrollable body with sticky header (no show more/show all)
 */

import { ArrowUpDown, Gauge, Plus, Truck } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATUS_CONFIG } from '../constants';
import { ForkliftWithStatus, OperationalStatus } from '../types';

interface ForkliftTableV2Props {
  forklifts: ForkliftWithStatus[];
  filteredCount: number;
}

const ATTENTION_STATUSES = new Set<OperationalStatus>(['service_due', 'out_of_service', 'awaiting_parts']);

const ACCENT_COLORS: Record<string, string> = {
  service_due: '#f59e0b',
  out_of_service: '#ef4444',
  awaiting_parts: '#a855f7',
};

// Priority for sorting (lower = higher priority / top of list)
const STATUS_PRIORITY: Record<OperationalStatus, number> = {
  out_of_service: 0,
  service_due: 1,
  awaiting_parts: 2,
  in_service: 3,
  rented_out: 4,
  reserved: 5,
  available: 6,
};

export const ForkliftTableV2: React.FC<ForkliftTableV2Props> = ({
  forklifts,
  filteredCount,
}) => {
  const navigate = useNavigate();
  const [sortByAttention, setSortByAttention] = useState(false);

  const displayForklifts = useMemo(() => {
    if (!sortByAttention) return forklifts; // default: creation order from DB

    return [...forklifts].sort((a, b) => {
      const aNeeds = ATTENTION_STATUSES.has(a.operational_status) || a.secondary_badges.includes('Due');
      const bNeeds = ATTENTION_STATUSES.has(b.operational_status) || b.secondary_badges.includes('Due');

      if (aNeeds && !bNeeds) return -1;
      if (!aNeeds && bNeeds) return 1;

      return (STATUS_PRIORITY[a.operational_status] ?? 99) - (STATUS_PRIORITY[b.operational_status] ?? 99);
    });
  }, [forklifts, sortByAttention]);

  const handleCreateJob = (forklift: ForkliftWithStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const customerId = forklift.rental_customer_id || forklift.current_customer_id || '';
    navigate(`/jobs/create?forklift_id=${forklift.forklift_id}&customer_id=${customerId}`);
  };

  return (
    <div className="card-theme rounded-xl border border-theme overflow-hidden">
      {/* Sort toggle */}
      <div className="px-4 py-2 bg-theme-surface-2 border-b border-theme flex items-center justify-end">
        <button
          onClick={() => setSortByAttention(!sortByAttention)}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            sortByAttention
              ? 'bg-amber-100 text-amber-700 border border-amber-300'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortByAttention ? 'Attention first' : 'Sort by attention'}
        </button>
      </div>
      {/* Scrollable container — max ~8 rows visible */}
      <div className="overflow-auto" style={{ maxHeight: '480px' }}>
        <table className="w-full">
          <thead className="sticky top-0 z-10">
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
            {displayForklifts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No forklifts found</p>
                </td>
              </tr>
            ) : (
              displayForklifts.map((forklift) => {
                const needsAttention = ATTENTION_STATUSES.has(forklift.operational_status) ||
                  forklift.secondary_badges.includes('Due');
                const accentColor = ACCENT_COLORS[forklift.operational_status] ||
                  (forklift.secondary_badges.includes('Due') ? '#f59e0b' : '');
                const statusConfig = STATUS_CONFIG[forklift.operational_status];
                const StatusIcon = statusConfig.icon;
                const customerName = forklift.rental_customer_name || forklift.current_customer_name || '-';

                return (
                  <tr
                    key={forklift.forklift_id}
                    className="clickable-row"
                    style={needsAttention ? { borderLeft: `3px solid ${accentColor}` } : undefined}
                    onClick={() => navigate(`/forklifts/${forklift.forklift_id}`)}
                  >
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
                        onClick={(e) => handleCreateJob(forklift, e)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create Job
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with count */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-center">
        <span className="text-xs text-slate-500">
          {filteredCount} unit{filteredCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

import React from 'react';
import { VanStockUsage, VanStockReplenishment } from '../../../types';
import { History, CheckCircle, Clock, TrendingDown } from 'lucide-react';

interface UsageHistoryTabProps {
  usageHistory: VanStockUsage[];
  replenishments: VanStockReplenishment[];
}

function getApprovalBadge(status: string) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
        <CheckCircle className="w-3 h-3" /> Approved
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
      <TrendingDown className="w-3 h-3" /> Rejected
    </span>
  );
}

function getReplenishmentStatusClass(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700';
    case 'approved':
      return 'bg-indigo-100 text-indigo-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function UsageHistoryTab({ usageHistory, replenishments }: UsageHistoryTabProps) {
  return (
    <div className="space-y-4">
      {usageHistory.length === 0 ? (
        <div className="card-theme rounded-xl p-8 text-center">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No usage history yet</p>
        </div>
      ) : (
        <div className="card-theme rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-theme-surface-2">
              <tr>
                <th className="text-left p-3 text-theme-muted">Part</th>
                <th className="text-center p-3 text-theme-muted">Qty</th>
                <th className="text-left p-3 text-theme-muted">Job</th>
                <th className="text-left p-3 text-theme-muted">Date</th>
                <th className="text-center p-3 text-theme-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {usageHistory.map((usage) => (
                <tr key={usage.usage_id} className="hover:bg-theme-surface-2">
                  <td className="p-3">
                    <div className="font-medium text-theme">
                      {usage.van_stock_item?.part?.part_name || 'Unknown'}
                    </div>
                    <div className="text-xs text-theme-muted">
                      {usage.van_stock_item?.part?.part_code}
                    </div>
                  </td>
                  <td className="p-3 text-center font-medium text-theme">
                    {usage.quantity_used}
                  </td>
                  <td className="p-3">
                    <span className="text-theme">{usage.job?.title || usage.job_id}</span>
                  </td>
                  <td className="p-3 text-theme-muted">
                    {new Date(usage.used_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-center">
                    {getApprovalBadge(usage.approval_status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Replenishment History */}
      {replenishments.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-theme mb-3">Replenishment History</h3>
          <div className="space-y-3">
            {replenishments.map((rep) => (
              <div key={rep.replenishment_id} className="card-theme rounded-xl p-4 theme-transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-theme">
                    {rep.items?.length || 0} items requested
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium ${getReplenishmentStatusClass(rep.status)}`}>
                    {rep.status.charAt(0).toUpperCase() + rep.status.slice(1).replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-theme-muted">
                  Requested: {new Date(rep.requested_at).toLocaleDateString()}
                  {rep.fulfilled_at && ` • Fulfilled: ${new Date(rep.fulfilled_at).toLocaleDateString()}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

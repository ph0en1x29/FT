import { ChevronRight,FileText } from 'lucide-react';
import { AutoCountExport } from '../../../types';
import { STATUS_CONFIG } from '../statusConfig';
import { TabType } from '../types';

interface ExportsListProps {
  exports: AutoCountExport[];
  activeTab: TabType;
  onSelectExport: (exp: AutoCountExport) => void;
}

function getTimeSince(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ExportsList({ exports, activeTab, onSelectExport }: ExportsListProps) {
  if (exports.length === 0) {
    return (
      <div className="card-theme rounded-xl p-12 text-center theme-transition">
        <FileText className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-theme mb-2">No Exports Found</h3>
        <p className="text-sm text-theme-muted">
          {activeTab === 'pending'
            ? 'No exports pending'
            : activeTab === 'failed'
            ? 'No failed exports'
            : 'No exported invoices yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exports.map((exp) => {
        const statusConfig = STATUS_CONFIG[exp.status];
        const StatusIcon = statusConfig.icon;

        return (
          <div
            key={exp.export_id}
            className="card-theme rounded-xl overflow-hidden theme-transition hover:shadow-md cursor-pointer"
            onClick={() => onSelectExport(exp)}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${statusConfig.bgColor}`}>
                    <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-theme">{exp.customer_name}</h4>
                    <p className="text-xs text-theme-muted">
                      {exp.autocount_invoice_number || `Job: ${exp.job_id.slice(0, 8)}...`} • {getTimeSince(exp.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                  <ChevronRight className="w-5 h-5 text-theme-muted" />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-theme-muted">{exp.export_type === 'invoice' ? 'Invoice' : 'Credit Note'}</span>
                <span className="font-semibold text-theme">
                  {exp.currency} {exp.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              {exp.status === 'failed' && exp.export_error && (
                <div className="mt-2 p-2 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-700">{exp.export_error}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

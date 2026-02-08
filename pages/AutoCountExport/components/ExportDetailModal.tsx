import { AlertTriangle,RefreshCw,X } from 'lucide-react';
import { AutoCountExport } from '../../../types';
import { STATUS_CONFIG } from '../statusConfig';

interface ExportDetailModalProps {
  export_: AutoCountExport;
  canExport: boolean;
  processing: boolean;
  onClose: () => void;
  onRetry: (exportId: string) => Promise<void>;
  onCancel: (exportId: string) => Promise<void>;
}

export function ExportDetailModal({
  export_,
  canExport,
  processing,
  onClose,
  onRetry,
  onCancel,
}: ExportDetailModalProps) {
  const statusConfig = STATUS_CONFIG[export_.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className={`p-4 border-b ${statusConfig.bgColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon className={`w-6 h-6 ${statusConfig.color}`} />
              <div>
                <h2 className="font-semibold text-lg">Export Details</h2>
                <p className="text-sm text-slate-600">{export_.customer_name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Export Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Invoice Number</p>
              <p className="font-medium">{export_.autocount_invoice_number || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Type</p>
              <p className="font-medium capitalize">{export_.export_type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Invoice Date</p>
              <p className="font-medium">{new Date(export_.invoice_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Amount</p>
              <p className="font-medium">
                {export_.currency} {export_.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Customer Code */}
          {export_.customer_code && (
            <div>
              <p className="text-xs text-slate-500">AutoCount Customer Code</p>
              <p className="font-medium font-mono">{export_.customer_code}</p>
            </div>
          )}

          {/* Line Items */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Line Items</h3>
            <div className="space-y-2">
              {export_.line_items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start p-2 bg-slate-50 rounded-lg text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-xs text-slate-500">
                      {item.item_code && `Code: ${item.item_code} • `}
                      Qty: {item.quantity} × {export_.currency} {item.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <p className="font-medium">
                    {export_.currency} {item.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Export Error */}
          {export_.status === 'failed' && export_.export_error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-medium text-red-800 mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Export Error
              </h3>
              <p className="text-sm text-red-700">{export_.export_error}</p>
              {export_.retry_count > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Retried {export_.retry_count} time(s)
                </p>
              )}
            </div>
          )}

          {/* Export Info */}
          {export_.exported_at && (
            <div className="text-sm text-slate-600">
              <p>
                Exported by {export_.exported_by_name} on{' '}
                {new Date(export_.exported_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t bg-slate-50">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-white text-sm"
            >
              Close
            </button>
            {export_.status === 'failed' && canExport && (
              <button
                onClick={() => onRetry(export_.export_id)}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Export
              </button>
            )}
            {export_.status === 'pending' && canExport && (
              <button
                onClick={() => onCancel(export_.export_id)}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 text-sm font-medium"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

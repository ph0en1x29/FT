import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  UserRole,
  AutoCountExport as AutoCountExportType,
  AutoCountExportStatus,
  Job,
} from '../types';
import { SupabaseDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import {
  FileText,
  Search,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  X,
  Send,
  Filter,
  ExternalLink,
} from 'lucide-react';

interface AutoCountExportProps {
  currentUser: User;
  hideHeader?: boolean;
}

type TabType = 'pending' | 'exported' | 'failed';

const STATUS_CONFIG: Record<AutoCountExportStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    icon: Clock,
  },
  exported: {
    label: 'Exported',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-slate-500',
    bgColor: 'bg-slate-50',
    icon: X,
  },
};

export default function AutoCountExport({ currentUser, hideHeader = false }: AutoCountExportProps) {
  const navigate = useNavigate();
  const [exports, setExports] = useState<AutoCountExportType[]>([]);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExport, setSelectedExport] = useState<AutoCountExportType | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPERVISOR;
  const isAccountant = currentUser.role === UserRole.ACCOUNTANT;
  const canExport = isAdmin || isAccountant;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load export records
      const exportData = await SupabaseDb.getAutoCountExports();
      setExports(exportData);

      // Load pending jobs (finalized but not exported)
      const jobs = await SupabaseDb.getJobsPendingExport();
      setPendingJobs(jobs);
    } catch (error) {
      console.error('Error loading data:', error);
      showToast.error('Failed to load export data');
    }
    setLoading(false);
  };

  // Filter exports by tab and search
  const filteredExports = useMemo(() => {
    let result = exports;

    if (activeTab === 'pending') {
      result = result.filter(e => e.status === 'pending');
    } else if (activeTab === 'exported') {
      result = result.filter(e => e.status === 'exported');
    } else if (activeTab === 'failed') {
      result = result.filter(e => e.status === 'failed');
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.customer_name.toLowerCase().includes(query) ||
        e.autocount_invoice_number?.toLowerCase().includes(query) ||
        e.job_id.toLowerCase().includes(query)
      );
    }

    // Sort by most recent first
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }, [exports, activeTab, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    pending: exports.filter(e => e.status === 'pending').length,
    exported: exports.filter(e => e.status === 'exported').length,
    failed: exports.filter(e => e.status === 'failed').length,
    pendingJobs: pendingJobs.length,
  }), [exports, pendingJobs]);

  const handleExportJob = async (jobId: string) => {
    if (!canExport) return;
    setProcessing(true);
    try {
      await SupabaseDb.createAutoCountExport(jobId, currentUser.user_id, currentUser.name);
      showToast.success('Export created', 'Invoice queued for AutoCount export');
      loadData();
    } catch (error) {
      showToast.error('Export failed', (error as Error).message);
    }
    setProcessing(false);
  };

  const handleBulkExport = async () => {
    if (!canExport || selectedJobIds.size === 0) return;
    setProcessing(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const jobId of selectedJobIds) {
        try {
          await SupabaseDb.createAutoCountExport(jobId, currentUser.user_id, currentUser.name);
          successCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) {
        showToast.success(`${successCount} export(s) created`);
      }
      if (failCount > 0) {
        showToast.warning(`${failCount} export(s) failed`);
      }

      setSelectedJobIds(new Set());
      loadData();
    } catch (error) {
      showToast.error('Bulk export failed', (error as Error).message);
    }
    setProcessing(false);
  };

  const handleRetryExport = async (exportId: string) => {
    if (!canExport) return;
    setProcessing(true);
    try {
      await SupabaseDb.retryAutoCountExport(exportId, currentUser.user_id, currentUser.name);
      showToast.success('Retry initiated');
      loadData();
      setShowDetailModal(false);
    } catch (error) {
      showToast.error('Retry failed', (error as Error).message);
    }
    setProcessing(false);
  };

  const handleCancelExport = async (exportId: string) => {
    if (!canExport) return;
    setProcessing(true);
    try {
      await SupabaseDb.cancelAutoCountExport(exportId);
      showToast.success('Export cancelled');
      loadData();
      setShowDetailModal(false);
    } catch (error) {
      showToast.error('Cancel failed', (error as Error).message);
    }
    setProcessing(false);
  };

  const toggleJobSelection = (jobId: string) => {
    const newSelected = new Set(selectedJobIds);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobIds(newSelected);
  };

  const selectAllJobs = () => {
    setSelectedJobIds(new Set(pendingJobs.map(j => j.job_id)));
  };

  const clearSelection = () => {
    setSelectedJobIds(new Set());
  };

  const getTimeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading AutoCount exports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - only show when not embedded as a tab */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-theme flex items-center gap-2">
              <FileText className="w-7 h-7" />
              AutoCount Export
            </h1>
            <p className="text-sm text-theme-muted mt-1">
              Export invoices to AutoCount accounting system
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      )}

      {/* Refresh button when embedded as tab */}
      {hideHeader && (
        <div className="flex justify-end">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      )}

      {/* Pending Jobs Section */}
      {pendingJobs.length > 0 && (
        <div className="card-theme rounded-xl p-5 theme-transition">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-theme flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Jobs Ready for Export ({pendingJobs.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={selectAllJobs}
                className="text-xs text-blue-600 hover:underline"
              >
                Select All
              </button>
              {selectedJobIds.size > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pendingJobs.map((job) => (
              <div
                key={job.job_id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  selectedJobIds.has(job.job_id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleJobSelection(job.job_id)}
                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                      selectedJobIds.has(job.job_id)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {selectedJobIds.has(job.job_id) && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div>
                    <p className="font-medium text-sm text-theme">{job.title}</p>
                    <p className="text-xs text-theme-muted">
                      {job.customer?.name} • RM {(job.total_amount || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleExportJob(job.job_id)}
                  disabled={processing}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download className="w-3 h-3" /> Export
                </button>
              </div>
            ))}
          </div>

          {selectedJobIds.size > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={handleBulkExport}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                <Send className="w-4 h-4" />
                {processing ? 'Exporting...' : `Export ${selectedJobIds.size} Selected`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
            activeTab === 'pending'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
              : stats.pending > 0
              ? 'bg-amber-50 border-amber-200'
              : 'bg-slate-50 border-slate-200'
          }`}
          onClick={() => setActiveTab('pending')}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className={`w-5 h-5 ${stats.pending > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${stats.pending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {stats.pending}
          </div>
          <div className={`text-xs ${stats.pending > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
            Pending Export
          </div>
        </div>

        <div
          className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
            activeTab === 'exported'
              ? 'bg-green-50 border-green-300 ring-2 ring-green-200'
              : 'bg-slate-50 border-slate-200'
          }`}
          onClick={() => setActiveTab('exported')}
        >
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className={`w-5 h-5 ${activeTab === 'exported' ? 'text-green-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${activeTab === 'exported' ? 'text-green-600' : 'text-slate-400'}`}>
            {stats.exported}
          </div>
          <div className={`text-xs ${activeTab === 'exported' ? 'text-green-700' : 'text-slate-500'}`}>
            Exported
          </div>
        </div>

        <div
          className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
            activeTab === 'failed'
              ? 'bg-red-50 border-red-300 ring-2 ring-red-200'
              : stats.failed > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-slate-50 border-slate-200'
          }`}
          onClick={() => setActiveTab('failed')}
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className={`w-5 h-5 ${stats.failed > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${stats.failed > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {stats.failed}
          </div>
          <div className={`text-xs ${stats.failed > 0 ? 'text-red-700' : 'text-slate-500'}`}>
            Failed
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by customer, invoice number..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Exports List */}
      {filteredExports.length === 0 ? (
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
      ) : (
        <div className="space-y-3">
          {filteredExports.map((exp) => {
            const statusConfig = STATUS_CONFIG[exp.status];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={exp.export_id}
                className="card-theme rounded-xl overflow-hidden theme-transition hover:shadow-md cursor-pointer"
                onClick={() => {
                  setSelectedExport(exp);
                  setShowDetailModal(true);
                }}
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
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedExport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className={`p-4 border-b ${STATUS_CONFIG[selectedExport.status].bgColor}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {React.createElement(STATUS_CONFIG[selectedExport.status].icon, {
                    className: `w-6 h-6 ${STATUS_CONFIG[selectedExport.status].color}`
                  })}
                  <div>
                    <h2 className="font-semibold text-lg">Export Details</h2>
                    <p className="text-sm text-slate-600">
                      {selectedExport.customer_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
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
                  <p className="font-medium">{selectedExport.autocount_invoice_number || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Type</p>
                  <p className="font-medium capitalize">{selectedExport.export_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Invoice Date</p>
                  <p className="font-medium">{new Date(selectedExport.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Amount</p>
                  <p className="font-medium">
                    {selectedExport.currency} {selectedExport.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Customer Code */}
              {selectedExport.customer_code && (
                <div>
                  <p className="text-xs text-slate-500">AutoCount Customer Code</p>
                  <p className="font-medium font-mono">{selectedExport.customer_code}</p>
                </div>
              )}

              {/* Line Items */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Line Items</h3>
                <div className="space-y-2">
                  {selectedExport.line_items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start p-2 bg-slate-50 rounded-lg text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-slate-500">
                          {item.item_code && `Code: ${item.item_code} • `}
                          Qty: {item.quantity} × {selectedExport.currency} {item.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-medium">
                        {selectedExport.currency} {item.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export Error */}
              {selectedExport.status === 'failed' && selectedExport.export_error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="text-sm font-medium text-red-800 mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Export Error
                  </h3>
                  <p className="text-sm text-red-700">{selectedExport.export_error}</p>
                  {selectedExport.retry_count > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      Retried {selectedExport.retry_count} time(s)
                    </p>
                  )}
                </div>
              )}

              {/* Export Info */}
              {selectedExport.exported_at && (
                <div className="text-sm text-slate-600">
                  <p>
                    Exported by {selectedExport.exported_by_name} on{' '}
                    {new Date(selectedExport.exported_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-slate-50">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-white text-sm"
                >
                  Close
                </button>
                {selectedExport.status === 'failed' && canExport && (
                  <button
                    onClick={() => handleRetryExport(selectedExport.export_id)}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry Export
                  </button>
                )}
                {selectedExport.status === 'pending' && canExport && (
                  <button
                    onClick={() => handleCancelExport(selectedExport.export_id)}
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
      )}
    </div>
  );
}

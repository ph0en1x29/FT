import { useState, useEffect, useMemo } from 'react';
import { User, UserRole, AutoCountExport, Job } from '../../../types';
import { SupabaseDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { TabType, ExportStats, UseAutoCountExportReturn } from '../types';

export function useAutoCountExport(currentUser: User): UseAutoCountExportReturn {
  const [exports, setExports] = useState<AutoCountExport[]>([]);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExport, setSelectedExport] = useState<AutoCountExport | null>(null);
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
      const exportData = await SupabaseDb.getAutoCountExports();
      setExports(exportData);
      const jobs = await SupabaseDb.getJobsPendingExport();
      setPendingJobs(jobs);
    } catch (error) {
      showToast.error('Failed to load export data');
    }
    setLoading(false);
  };

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

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [exports, activeTab, searchQuery]);

  const stats: ExportStats = useMemo(() => ({
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
      await SupabaseDb.retryAutoCountExport(exportId);
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

  return {
    exports,
    pendingJobs,
    loading,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedExport,
    setSelectedExport,
    showDetailModal,
    setShowDetailModal,
    processing,
    selectedJobIds,
    filteredExports,
    stats,
    canExport,
    loadData,
    handleExportJob,
    handleBulkExport,
    handleRetryExport,
    handleCancelExport,
    toggleJobSelection,
    selectAllJobs,
    clearSelection,
  };
}

import React,{ useEffect,useMemo,useState } from 'react';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { Job,JobStatus,User } from '../../types';
import { InvoiceFilters,InvoiceSummaryCards,InvoiceTable,calculateJobTotal } from './components';

interface InvoiceHistoryTabProps {
  currentUser: User;
}

const InvoiceHistoryTab: React.FC<InvoiceHistoryTabProps> = ({ currentUser }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    loadJobs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      // Filter at database level for better performance
      const data = await MockDb.getJobs(currentUser, { status: JobStatus.COMPLETED });
      setJobs(data);
    } catch (_error) {
      showToast.error('Failed to load invoices');
    }
    setLoading(false);
  };

  // Get unique values for filters
  const uniqueCustomers = useMemo(() => {
    const customers = [...new Set(jobs.map(j => j.customer?.name))].filter(Boolean).sort() as string[];
    return customers;
  }, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        (job.title || '').toLowerCase().includes(searchLower) ||
        (job.customer?.name || '').toLowerCase().includes(searchLower) ||
        (job.forklift?.serial_number || '').toLowerCase().includes(searchLower) ||
        (job.job_id || '').toLowerCase().includes(searchLower) ||
        (job.invoiced_by_name || '').toLowerCase().includes(searchLower);

      // Customer filter
      const matchesCustomer = filterCustomer === 'all' || job.customer?.name === filterCustomer;

      // Date filter
      const invoiceDate = new Date(job.invoiced_at || job.completion_time || job.created_at);
      const matchesDateFrom = !filterDateFrom || invoiceDate >= new Date(filterDateFrom);
      const matchesDateTo = !filterDateTo || invoiceDate <= new Date(filterDateTo + 'T23:59:59');

      return matchesSearch && matchesCustomer && matchesDateFrom && matchesDateTo;
    });
  }, [jobs, searchQuery, filterCustomer, filterDateFrom, filterDateTo]);

  // Grand total of filtered invoices
  const grandTotal = useMemo(() => {
    return filteredJobs.reduce((acc, job) => acc + calculateJobTotal(job), 0);
  }, [filteredJobs]);

  const handleClearFilters = () => {
    setFilterCustomer('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasFilters = searchQuery || filterCustomer !== 'all' || filterDateFrom || filterDateTo;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-theme-muted">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="flex items-center gap-4 text-sm text-theme-muted">
        <span>{filteredJobs.length} invoices</span>
        <span className="text-slate-300">|</span>
        <span>Total: <span className="font-semibold text-green-600">RM {grandTotal.toFixed(2)}</span></span>
      </div>

      {/* Search and Filters */}
      <InvoiceFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filterCustomer={filterCustomer}
        onCustomerChange={setFilterCustomer}
        uniqueCustomers={uniqueCustomers}
        filterDateFrom={filterDateFrom}
        onDateFromChange={setFilterDateFrom}
        filterDateTo={filterDateTo}
        onDateToChange={setFilterDateTo}
        onClearFilters={handleClearFilters}
      />

      {/* Summary Cards */}
      <InvoiceSummaryCards
        totalInvoices={filteredJobs.length}
        totalRevenue={grandTotal}
      />

      {/* Invoices Table */}
      <InvoiceTable
        jobs={filteredJobs}
        grandTotal={grandTotal}
        hasFilters={!!hasFilters}
      />
    </div>
  );
};

export default InvoiceHistoryTab;

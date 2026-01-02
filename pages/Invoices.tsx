import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Job, JobStatus } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { 
  Search, Filter, FileText, Calendar, 
  Eye, Download, CheckCircle, Building2, DollarSign
} from 'lucide-react';

interface InvoicesProps {
  currentUser: any;
}

const Invoices: React.FC<InvoicesProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getJobs(currentUser);
      // Only show completed jobs (finalized invoices)
      const completedJobs = data.filter(j => j.status === JobStatus.COMPLETED);
      setJobs(completedJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
    setLoading(false);
  };

  // Get unique values for filters
  const uniqueCustomers = useMemo(() => {
    const customers = [...new Set(jobs.map(j => j.customer?.name))].filter(Boolean).sort();
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

  // Calculate total
  const calculateTotal = (job: Job) => {
    const totalParts = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
    const labor = job.labor_cost || 150;
    const extra = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
    return totalParts + labor + extra;
  };

  // Grand total of filtered invoices
  const grandTotal = useMemo(() => {
    return filteredJobs.reduce((acc, job) => acc + calculateTotal(job), 0);
  }, [filteredJobs]);

  const openInvoicePDF = (job: Job) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to view the invoice');
      return;
    }

    const totalParts = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
    const labor = job.labor_cost || 150;
    const extra = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
    const subtotal = totalParts + labor + extra;
    const sst = 0; // 0% SST for now
    const total = subtotal + sst;

    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - INV-${job.job_id.slice(0, 8).toUpperCase()}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; font-size: 11px; }
          
          .header { display: flex; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1e40af; }
          .company-section h1 { font-size: 22px; font-weight: bold; color: #1e40af; }
          .company-section p { font-size: 9px; color: #666; line-height: 1.4; }
          .company-section .sst { font-size: 10px; font-weight: bold; margin-top: 5px; }
          
          .invoice-title { text-align: right; }
          .invoice-title h2 { font-size: 20px; color: #333; margin-bottom: 5px; }
          .invoice-title .inv-no { font-size: 14px; font-weight: bold; color: #dc2626; }
          .invoice-title .inv-date { font-size: 11px; color: #666; margin-top: 3px; }
          
          .billing-section { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; margin-bottom: 20px; }
          .bill-to { background: #f8fafc; padding: 15px; border-radius: 6px; }
          .bill-to h3 { font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px; }
          .bill-to .company-name { font-size: 13px; font-weight: bold; margin-bottom: 5px; }
          .bill-to p { font-size: 10px; line-height: 1.5; }
          
          .reference-box { background: #fef3c7; padding: 15px; border-radius: 6px; border: 1px solid #fcd34d; }
          .reference-box h3 { font-size: 10px; color: #92400e; text-transform: uppercase; margin-bottom: 8px; }
          .reference-box p { font-size: 10px; line-height: 1.6; }
          .reference-box strong { color: #78350f; }
          
          .attn-line { font-size: 11px; margin-bottom: 20px; padding: 10px; background: #f1f5f9; border-radius: 4px; }
          
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th { background: #1e40af; color: white; padding: 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
          .items-table th:last-child, .items-table th:nth-last-child(2) { text-align: right; }
          .items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; vertical-align: top; }
          .items-table td:last-child, .items-table td:nth-last-child(2) { text-align: right; }
          .items-table .item-desc { max-width: 350px; }
          .items-table .item-desc strong { display: block; margin-bottom: 3px; }
          .items-table .item-desc small { color: #64748b; font-size: 9px; }
          
          .totals-section { display: flex; justify-content: flex-end; margin-bottom: 20px; }
          .totals-box { width: 280px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 11px; border-bottom: 1px solid #e2e8f0; }
          .totals-row.subtotal { border-top: 2px solid #e2e8f0; margin-top: 5px; padding-top: 10px; }
          .totals-row.grand-total { background: #1e40af; color: white; padding: 12px 10px; margin-top: 5px; font-size: 14px; font-weight: bold; border-radius: 4px; }
          
          .terms-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 10px; }
          .terms-box { }
          .terms-box h4 { font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
          .terms-box p { line-height: 1.5; }
          
          .footer-note { text-align: center; font-size: 9px; color: #64748b; margin-bottom: 30px; padding: 15px; background: #f8fafc; border-radius: 6px; }
          
          .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
          .sig-box { }
          .sig-box h4 { font-size: 10px; color: #64748b; margin-bottom: 5px; }
          .sig-box .sig-line { border-bottom: 1px solid #333; height: 60px; margin-bottom: 5px; }
          .sig-box .sig-name { font-size: 11px; font-weight: bold; }
          .sig-box .sig-title { font-size: 9px; color: #666; }
          
          .accept-box { border: 2px solid #1e40af; padding: 15px; border-radius: 6px; }
          .accept-box h4 { color: #1e40af; margin-bottom: 10px; }
          .accept-box .chop-area { height: 60px; border: 1px dashed #ccc; margin-bottom: 5px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 9px; }
          
          @media print {
            body { padding: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-section">
            <h1>FieldPro</h1>
            <p>
              Field Service Management System<br/>
              123 Business Park, Tech City<br/>
              Tel: 03-1234 5678 | Fax: 03-1234 5679<br/>
              Email: service@fieldpro.com
            </p>
            <p class="sst">SST NO: B16-XXXX-XXXXXXXX</p>
          </div>
          <div class="invoice-title">
            <h2>INVOICE</h2>
            <div class="inv-no">No.: INV-${job.job_id.slice(0, 8).toUpperCase()}</div>
            <div class="inv-date">Date: ${new Date(job.invoiced_at || job.created_at).toLocaleDateString()}</div>
            <div class="inv-date">Page: 1 of 1</div>
          </div>
        </div>

        <div class="billing-section">
          <div class="bill-to">
            <h3>Bill To</h3>
            <div class="company-name">${job.customer?.name || ''}</div>
            <p>
              ${job.customer?.address || ''}<br/>
              Tel: ${job.customer?.phone || ''}<br/>
              Email: ${job.customer?.email || ''}
            </p>
          </div>
          
          ${job.forklift ? `
            <div class="reference-box">
              <h3>Equipment Reference</h3>
              <p>
                <strong>Model:</strong> ${job.forklift.make} ${job.forklift.model}<br/>
                <strong>Serial No:</strong> ${job.forklift.serial_number}<br/>
                <strong>Type:</strong> ${job.forklift.type}<br/>
                ${job.hourmeter_reading ? `<strong>Hourmeter:</strong> ${job.hourmeter_reading.toLocaleString()} hrs` : ''}
              </p>
            </div>
          ` : ''}
        </div>

        <div class="attn-line">
          <strong>RE:</strong> ${job.title} - ${job.description.substring(0, 100)}${job.description.length > 100 ? '...' : ''}
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 40px;">Item</th>
              <th>Description</th>
              <th style="width: 50px;">Qty</th>
              <th style="width: 90px;">Unit Price (RM)</th>
              <th style="width: 100px;">Amount (RM)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td class="item-desc">
                <strong>Labor Charges</strong>
                <small>Service/repair work performed</small>
              </td>
              <td>1</td>
              <td>${labor.toFixed(2)}</td>
              <td>${labor.toFixed(2)}</td>
            </tr>
            
            ${job.parts_used.map((p, idx) => `
              <tr>
                <td>${idx + 2}</td>
                <td class="item-desc">
                  <strong>${p.part_name}</strong>
                </td>
                <td>${p.quantity}</td>
                <td>${p.sell_price_at_time.toFixed(2)}</td>
                <td>${(p.sell_price_at_time * p.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
            
            ${(job.extra_charges || []).map((c, idx) => `
              <tr>
                <td>${job.parts_used.length + idx + 2}</td>
                <td class="item-desc">
                  <strong>${c.name}</strong>
                  ${c.description ? `<small>${c.description}</small>` : ''}
                </td>
                <td>1</td>
                <td>${c.amount.toFixed(2)}</td>
                <td>${c.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="totals-row subtotal">
              <span>Sub Total (Excluding SST)</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Tax @ 0% on ${subtotal.toFixed(2)}</span>
              <span>${sst.toFixed(2)}</span>
            </div>
            <div class="totals-row grand-total">
              <span>Total (Inclusive of SST)</span>
              <span>RM ${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="terms-section">
          <div class="terms-box">
            <h4>Payment Terms</h4>
            <p>C.O.D / 30 Days from Invoice Date</p>
          </div>
          <div class="terms-box">
            <h4>Validity</h4>
            <p>This invoice is valid for 30 days from the date of issue.</p>
          </div>
        </div>

        <div class="footer-note">
          We hope the above is agreeable to you. The Company has the right to revise charges upon the implementation of new taxes.
          Our invoice is exclusive of any government taxes that may be implemented from time to time. Thank you for your business!
        </div>

        <div class="signature-section">
          <div class="sig-box">
            <h4>Issued By</h4>
            <div class="sig-line"></div>
            <div class="sig-name">${job.invoiced_by_name || 'Accounts Department'}</div>
            <div class="sig-title">FieldPro Service Management</div>
            <div class="sig-title">Date: ${job.invoiced_at ? new Date(job.invoiced_at).toLocaleDateString() : ''}</div>
          </div>
          
          <div class="accept-box">
            <h4>Accepted and Agreed By:</h4>
            <div class="chop-area">(Please chop & sign)</div>
            <div class="sig-name">${job.customer?.name || ''}</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-theme-muted">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme">Invoices</h1>
          <p className="text-sm text-theme-muted mt-1">
            {filteredJobs.length} invoices | Total: <span className="font-semibold text-green-600">RM {grandTotal.toFixed(2)}</span>
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card-theme rounded-xl p-4 space-y-4 theme-transition">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
            <input
              type="text"
              placeholder="Search by invoice no, customer, equipment S/N..."
              className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme placeholder-slate-400 theme-transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-theme-muted" />
          
          <select
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
          >
            <option value="all">All Customers</option>
            {uniqueCustomers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-sm text-theme-muted">From:</span>
            <input
              type="date"
              className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-theme-muted">To:</span>
            <input
              type="date"
              className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>

          {(filterCustomer !== 'all' || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => {
                setFilterCustomer('all');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-theme-muted">Total Invoices</p>
              <p className="text-xl font-bold text-theme">{filteredJobs.length}</p>
            </div>
          </div>
        </div>
        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-theme-muted">Total Revenue</p>
              <p className="text-xl font-bold text-green-600">RM {grandTotal.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-theme-muted">Average Invoice</p>
              <p className="text-xl font-bold text-theme">RM {filteredJobs.length > 0 ? (grandTotal / filteredJobs.length).toFixed(2) : '0.00'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      {filteredJobs.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center theme-transition">
          <FileText className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No invoices found</h3>
          <p className="text-sm text-theme-muted">
            {searchQuery || filterCustomer !== 'all' || filterDateFrom || filterDateTo
              ? 'Try adjusting your search or filters'
              : 'Finalized invoices will appear here'}
          </p>
        </div>
      ) : (
        <div className="card-theme rounded-xl overflow-hidden theme-transition">
          <table className="w-full">
            <thead className="bg-theme-surface-2 text-theme-muted text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Invoice No.</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Job Title</th>
                <th className="px-4 py-3 text-left">Finalized By</th>
                <th className="px-4 py-3 text-right">Amount (RM)</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {filteredJobs.map(job => (
                <tr key={job.job_id} className="hover:bg-theme-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-blue-600">
                      INV-{job.job_id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-theme">
                    {new Date(job.invoiced_at || job.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-theme-muted" />
                      <span className="text-sm font-medium text-theme">{job.customer?.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-theme">{job.title}</td>
                  <td className="px-4 py-3 text-sm text-theme-muted">
                    {job.invoiced_by_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-green-600">
                      {calculateTotal(job).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => navigate(`/jobs/${job.job_id}`)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openInvoicePDF(job)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Print Invoice"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right font-semibold">Total:</td>
                <td className="px-4 py-3 text-right font-bold text-green-600 text-lg">
                  RM {grandTotal.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default Invoices;

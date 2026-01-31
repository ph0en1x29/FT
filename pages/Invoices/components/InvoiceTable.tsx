import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Job } from '../../../types';
import { FileText, Building2, Eye, Download } from 'lucide-react';
import { generateInvoicePDF, calculateJobTotal } from './generateInvoicePDF';

interface InvoiceTableProps {
  jobs: Job[];
  grandTotal: number;
  hasFilters: boolean;
}

const InvoiceTable: React.FC<InvoiceTableProps> = ({ jobs, grandTotal, hasFilters }) => {
  const navigate = useNavigate();

  if (jobs.length === 0) {
    return (
      <div className="card-theme rounded-xl p-12 text-center theme-transition">
        <FileText className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-theme mb-2">No invoices found</h3>
        <p className="text-sm text-theme-muted">
          {hasFilters
            ? 'Try adjusting your search or filters'
            : 'Finalized invoices will appear here'}
        </p>
      </div>
    );
  }

  return (
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
          {jobs.map(job => (
            <tr key={job.job_id} className="clickable-row">
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
                  {calculateJobTotal(job).toFixed(2)}
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
                    onClick={() => generateInvoicePDF(job)}
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
        <tfoot className="bg-theme-surface-2">
          <tr>
            <td colSpan={5} className="px-4 py-3 text-right font-semibold text-theme">Total:</td>
            <td className="px-4 py-3 text-right font-bold text-green-600 text-lg">
              RM {grandTotal.toFixed(2)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default InvoiceTable;

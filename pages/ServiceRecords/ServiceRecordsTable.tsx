import {
Building2,
CheckCircle,
Clock,
Download,
Eye,
FileText,
Truck,
User as UserIcon
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Job,JobStatus } from '../../types';

interface ServiceRecordsTableProps {
  jobs: Job[];
  onViewServiceReport: (job: Job) => void;
  hasFilters: boolean;
}

/**
 * Table display for service records with actions
 */
const ServiceRecordsTable: React.FC<ServiceRecordsTableProps> = ({
  jobs,
  onViewServiceReport,
  hasFilters,
}) => {
  const navigate = useNavigate();

  if (jobs.length === 0) {
    return (
      <div className="card-theme rounded-xl p-12 text-center theme-transition">
        <FileText className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-theme mb-2">No service records found</h3>
        <p className="text-sm text-theme-muted">
          {hasFilters
            ? 'Try adjusting your search or filters'
            : 'Completed jobs will appear here'}
        </p>
      </div>
    );
  }

  return (
    <div className="card-theme rounded-xl overflow-hidden theme-transition">
      <table className="w-full">
        <thead className="bg-theme-surface-2 text-theme-muted text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Report No.</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Customer</th>
            <th className="px-4 py-3 text-left">Equipment</th>
            <th className="px-4 py-3 text-left">Job Title</th>
            <th className="px-4 py-3 text-left">Technician</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-theme">
          {jobs.map(job => (
            <tr key={job.job_id} className="hover:bg-theme-surface-2 transition-colors">
              <td className="px-4 py-3">
                <span className="font-mono text-sm font-medium text-blue-600">
                  {job.job_id.slice(0, 8).toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-theme">
                {new Date(job.completion_time || job.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-theme-muted" />
                  <span className="text-sm font-medium text-theme">{job.customer?.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                {job.forklift ? (
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="text-sm font-medium text-theme">{job.forklift.serial_number}</div>
                      <div className="text-xs text-theme-muted">{job.forklift.make} {job.forklift.model}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-theme-muted text-sm">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-theme">{job.title}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-theme-muted" />
                  <span className="text-sm text-theme">{job.assigned_technician_name || '-'}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  job.status === JobStatus.COMPLETED 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {job.status === JobStatus.COMPLETED ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {job.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => navigate(`/jobs/${job.job_id}`)}
                    className="p-2 text-theme-muted hover:bg-theme-surface-2 rounded-lg"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onViewServiceReport(job)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Print Service Report"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ServiceRecordsTable;

import {
AlertTriangle,Calendar,CheckCircle,
ChevronRight,
Clock,
Wrench
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

type FilterType = 'all' | 'overdue' | 'due_soon' | 'job_created';

interface ForkliftDue {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: string;
  hourmeter: number;
  next_service_due: string | null;
  next_service_hourmeter: number | null;
  days_until_due: number | null;
  hours_until_due: number | null;
  is_overdue: boolean;
  has_open_job: boolean;
  current_customer_id?: string;
}

interface ServiceDueTableProps {
  forklifts: ForkliftDue[];
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
}

const ServiceDueTable: React.FC<ServiceDueTableProps> = ({ forklifts, filter, setFilter }) => {
  const navigate = useNavigate();

  const getFilterTitle = () => {
    switch (filter) {
      case 'overdue': return 'Overdue Forklifts';
      case 'due_soon': return 'Due Soon (No Job Yet)';
      case 'job_created': return 'With Service Job Created';
      default: return 'All Forklifts Due';
    }
  };

  return (
    <div className="card-theme rounded-xl overflow-hidden">
      <div className="p-4 border-b border-theme flex items-center justify-between">
        <h2 className="font-semibold text-theme">
          {getFilterTitle()}
          <span className="ml-2 text-theme-muted font-normal">({forklifts.length})</span>
        </h2>
        {filter !== 'all' && (
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            Show All
          </button>
        )}
      </div>

      {forklifts.length === 0 ? (
        <div className="p-8 text-center text-theme-muted">
          <Wrench className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No forklifts match this filter</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-theme-muted bg-theme-surface-2">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Serial Number</th>
                <th className="px-4 py-3 font-medium">Make / Model</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Hourmeter</th>
                <th className="px-4 py-3 font-medium">Next Service</th>
                <th className="px-4 py-3 font-medium">Time Until Due</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {forklifts.map(f => (
                <tr 
                  key={f.forklift_id} 
                  className="hover:bg-theme-surface-2 transition-colors cursor-pointer"
                  onClick={() => navigate(`/forklifts/${f.forklift_id}`)}
                >
                  <td className="px-4 py-3">
                    {f.has_open_job ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-600 rounded text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Job Created
                      </span>
                    ) : f.is_overdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-600 rounded text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Overdue
                      </span>
                    ) : f.days_until_due !== null && f.days_until_due <= 3 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-600 rounded text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Urgent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-600 rounded text-xs font-medium">
                        <Calendar className="w-3 h-3" />
                        Upcoming
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-theme">{f.serial_number}</td>
                  <td className="px-4 py-3 text-theme">{f.make} {f.model}</td>
                  <td className="px-4 py-3 text-theme-muted">{f.type}</td>
                  <td className="px-4 py-3 text-theme">{f.hourmeter?.toLocaleString()} hrs</td>
                  <td className="px-4 py-3 text-theme">
                    {f.next_service_due 
                      ? new Date(f.next_service_due).toLocaleDateString()
                      : <span className="text-theme-muted">Not set</span>}
                  </td>
                  <td className="px-4 py-3">
                    {f.days_until_due !== null && (
                      <span className={f.days_until_due < 0 ? 'text-red-500 font-medium' : 'text-theme'}>
                        {f.days_until_due < 0 ? `${Math.abs(f.days_until_due)} days ago` : `${f.days_until_due} days`}
                      </span>
                    )}
                    {f.hours_until_due !== null && (
                      <span className={`ml-2 text-xs ${f.hours_until_due <= 0 ? 'text-red-400' : 'text-theme-muted'}`}>
                        ({f.hours_until_due} hrs)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-theme-muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ServiceDueTable;

import {
  AlertTriangle, Calendar, CheckCircle,
  ChevronRight, Clock, Gauge, Wrench
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ForkliftDue } from '../ServiceDue';

type FilterType = 'all' | 'overdue' | 'due_soon' | 'job_created';

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
      default: return 'All Forklifts';
    }
  };

  const getStatusBadge = (f: ForkliftDue) => {
    if (f.has_open_job) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-600 rounded text-xs font-medium">
          <CheckCircle className="w-3 h-3" />
          Job Created
        </span>
      );
    }
    if (f.is_overdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-600 rounded text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          Overdue
        </span>
      );
    }
    if (f.days_remaining !== null && f.days_remaining <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-600 rounded text-xs font-medium">
          <Clock className="w-3 h-3" />
          Due Soon
        </span>
      );
    }
    if (f.days_remaining !== null && f.days_remaining <= 14) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-600 rounded text-xs font-medium">
          <Calendar className="w-3 h-3" />
          Upcoming
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-600 rounded text-xs font-medium">
        <CheckCircle className="w-3 h-3" />
        OK
      </span>
    );
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
                <th className="px-4 py-3 font-medium">Tracking</th>
                <th className="px-4 py-3 font-medium">Current</th>
                <th className="px-4 py-3 font-medium">Last Service</th>
                <th className="px-4 py-3 font-medium">Next Service</th>
                <th className="px-4 py-3 font-medium">Remaining</th>
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
                  <td className="px-4 py-3">{getStatusBadge(f)}</td>
                  <td className="px-4 py-3 font-mono text-theme">{f.serial_number}</td>
                  <td className="px-4 py-3 text-theme">{f.make} {f.model}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${
                      f.tracking_type === 'hourmeter' ? 'text-blue-600' : 'text-purple-600'
                    }`}>
                      {f.tracking_type === 'hourmeter' 
                        ? <><Gauge className="w-3 h-3" /> {f.type}</>
                        : <><Calendar className="w-3 h-3" /> {f.type} (90d)</>
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3 text-theme">
                    {f.tracking_type === 'hourmeter'
                      ? `${(f.current_hourmeter || 0).toLocaleString()} hrs`
                      : `${(f.hourmeter || 0).toLocaleString()} hrs`
                    }
                  </td>
                  <td className="px-4 py-3 text-theme-muted">
                    {f.tracking_type === 'hourmeter' ? (
                      <div>
                        <span>{f.last_service_hourmeter ? `${f.last_service_hourmeter.toLocaleString()} hrs` : '—'}</span>
                        {f.last_service_date && (
                          <div className="text-xs">{new Date(f.last_service_date).toLocaleDateString()}</div>
                        )}
                      </div>
                    ) : (
                      <span>{f.last_service_date ? new Date(f.last_service_date).toLocaleDateString() : 'No record'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-theme">
                    {f.tracking_type === 'hourmeter' ? (
                      <div>
                        <span>{f.next_service_hourmeter ? `${f.next_service_hourmeter.toLocaleString()} hrs` : '—'}</span>
                        {f.predicted_date && !f.is_overdue && (
                          <div className="text-xs text-theme-muted">{new Date(f.predicted_date).toLocaleDateString()}</div>
                        )}
                      </div>
                    ) : (
                      <span>{f.predicted_date ? new Date(f.predicted_date).toLocaleDateString() : '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {f.tracking_type === 'hourmeter' ? (
                      <div>
                        {f.hours_until_service !== null && (
                          <span className={`font-medium ${f.hours_until_service <= 0 ? 'text-red-500' : 'text-theme'}`}>
                            {f.hours_until_service <= 0 
                              ? `${Math.abs(f.hours_until_service)} hrs over`
                              : `${f.hours_until_service} hrs`
                            }
                          </span>
                        )}
                        {f.days_remaining !== null && (
                          <div className="text-xs text-theme-muted">
                            {f.is_overdue ? 'Overdue' : `${f.days_remaining}d`}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className={`font-medium ${f.is_overdue ? 'text-red-500' : 'text-theme'}`}>
                        {f.days_remaining !== null
                          ? f.is_overdue
                            ? `${Math.abs(f.days_remaining)}d overdue`
                            : `${f.days_remaining} days`
                          : '—'
                        }
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

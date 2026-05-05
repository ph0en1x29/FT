import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Clock,
  Loader2,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Customer } from '../../../types';
import { showToast } from '../../../services/toastService';
import {
  ExternalServicedForklift,
  getExternalServicedFleet,
} from '../../../services/serviceTrackingService';
import { getCustomers } from '../../../services/customerService';
import { TabProps } from '../types';

type UrgencyFilter = 'all' | 'overdue' | 'due_soon' | 'ok';
type ContractFilter = 'all' | 'amc' | 'no_contract';

const URGENCY_FILTERS: { id: UrgencyFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due_soon', label: 'Due in 7 days' },
  { id: 'ok', label: 'On schedule' },
];

const CONTRACT_FILTERS: { id: ContractFilter; label: string }[] = [
  { id: 'all', label: 'All contracts' },
  { id: 'amc', label: 'AMC covered' },
  { id: 'no_contract', label: 'No contract' },
];

const UrgencyBadge: React.FC<{ urgency: ExternalServicedForklift['service_urgency'] }> = ({ urgency }) => {
  switch (urgency) {
    case 'overdue':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertOctagon className="w-3 h-3" /> Overdue
        </span>
      );
    case 'due_soon':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <Clock className="w-3 h-3" /> Due soon
        </span>
      );
    case 'upcoming':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
          Upcoming
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          <CheckCircle className="w-3 h-3" /> On schedule
        </span>
      );
  }
};

const ContractBadge: React.FC<{ responsibility: ExternalServicedForklift['service_responsibility'] }> = ({
  responsibility,
}) => {
  if (responsibility === 'amc') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
        <ShieldCheck className="w-3 h-3" /> AMC
      </span>
    );
  }
  if (responsibility === 'chargeable_external') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        No contract
      </span>
    );
  }
  return null;
};

const ExternalFleetTab: React.FC<TabProps> = ({ currentUser: _currentUser }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ExternalServicedForklift[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const urlUrgency = searchParams.get('urgency') as UrgencyFilter | null;
  const initialUrgency: UrgencyFilter =
    urlUrgency && URGENCY_FILTERS.some(f => f.id === urlUrgency) ? urlUrgency : 'all';
  const [urgency, setUrgency] = useState<UrgencyFilter>(initialUrgency);
  const [contract, setContract] = useState<ContractFilter>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [extRows, allCustomers] = await Promise.all([
          getExternalServicedFleet(),
          getCustomers().catch(() => []),
        ]);
        if (cancelled) return;
        setRows(extRows);
        setCustomers(allCustomers);
      } catch (e) {
        showToast.error(`Failed to load external fleet: ${e instanceof Error ? e.message : 'Unknown error'}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const customerNameById = useMemo(() => {
    const m = new Map<string, string>();
    customers.forEach(c => m.set(c.customer_id, c.name));
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (urgency !== 'all') {
        if (urgency === 'ok' && !(r.service_urgency === 'ok' || r.service_urgency === 'upcoming')) return false;
        if (urgency === 'overdue' && r.service_urgency !== 'overdue') return false;
        if (urgency === 'due_soon' && r.service_urgency !== 'due_soon') return false;
      }
      if (contract !== 'all') {
        if (contract === 'amc' && r.service_responsibility !== 'amc') return false;
        if (contract === 'no_contract' && r.service_responsibility !== 'chargeable_external') return false;
      }
      if (customerFilter !== 'all' && r.current_customer_id !== customerFilter) return false;
      return true;
    });
  }, [rows, urgency, contract, customerFilter]);

  const summary = useMemo(() => {
    const overdue = rows.filter(r => r.service_urgency === 'overdue').length;
    const dueSoon = rows.filter(r => r.service_urgency === 'due_soon').length;
    const amc = rows.filter(r => r.service_responsibility === 'amc').length;
    return { total: rows.length, overdue, dueSoon, amc };
  }, [rows]);

  const handleUrgency = (next: UrgencyFilter) => {
    setUrgency(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'serviced-externals');
    if (next === 'all') params.delete('urgency');
    else params.set('urgency', next);
    setSearchParams(params);
  };

  const goCreateJob = (row: ExternalServicedForklift) => {
    const params = new URLSearchParams();
    params.set('customer_id', row.current_customer_id || '');
    params.set('forklift_id', row.forklift_id);
    navigate(`/jobs/new?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading external fleet…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile label="Machines" value={summary.total} icon={<Truck className="w-4 h-4" />} />
        <SummaryTile label="Overdue" value={summary.overdue} icon={<AlertOctagon className="w-4 h-4" />} tone="red" />
        <SummaryTile label="Due in 7 days" value={summary.dueSoon} icon={<Clock className="w-4 h-4" />} tone="amber" />
        <SummaryTile label="AMC covered" value={summary.amc} icon={<ShieldCheck className="w-4 h-4" />} tone="indigo" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {URGENCY_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => handleUrgency(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                urgency === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CONTRACT_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setContract(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                contract === f.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-200 bg-white text-slate-700"
          >
            <option value="all">All customers</option>
            {Array.from(customerNameById.entries())
              .filter(([id]) => rows.some(r => r.current_customer_id === id))
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          No customer-owned forklifts match these filters.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Asset</th>
                  <th className="px-4 py-3 text-left">Model</th>
                  <th className="px-4 py-3 text-left">Hourmeter</th>
                  <th className="px-4 py-3 text-left">Last service</th>
                  <th className="px-4 py-3 text-left">Next due</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(row => (
                  <tr key={row.forklift_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {row.current_customer_id
                        ? customerNameById.get(row.current_customer_id) || '—'
                        : <span className="text-slate-400">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {row.customer_forklift_no || row.serial_number}
                      </div>
                      {row.customer_forklift_no && (
                        <div className="text-xs text-slate-400">SN {row.serial_number}</div>
                      )}
                      {row.acquisition_source === 'sold_from_fleet' && (
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">Sold from fleet</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.make} {row.model}
                      <div className="text-xs text-slate-400">{row.type}{row.fuel_type ? ` · ${row.fuel_type}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.current_hourmeter != null ? `${row.current_hourmeter.toLocaleString()} h` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.last_service_date
                        ? new Date(row.last_service_date).toLocaleDateString()
                        : <span className="text-slate-400">Never</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.predicted_date
                        ? new Date(row.predicted_date).toLocaleDateString()
                        : row.next_service_due
                          ? new Date(row.next_service_due).toLocaleDateString()
                          : <span className="text-slate-400">—</span>}
                      {row.days_remaining != null && row.days_remaining < 30 && (
                        <div className={`text-xs ${row.days_remaining <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                          {row.days_remaining <= 0
                            ? `${Math.abs(row.days_remaining)} day${Math.abs(row.days_remaining) === 1 ? '' : 's'} overdue`
                            : `in ${row.days_remaining} day${row.days_remaining === 1 ? '' : 's'}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      <UrgencyBadge urgency={row.service_urgency} />
                      <div><ContractBadge responsibility={row.service_responsibility} /></div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => goCreateJob(row)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                        >
                          Schedule service
                        </button>
                        <button
                          onClick={() => navigate(`/forklift/${row.forklift_id}`)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 inline-flex items-center gap-1"
                        >
                          Open <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary.overdue > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            {summary.overdue} customer machine{summary.overdue === 1 ? '' : 's'} {summary.overdue === 1 ? 'is' : 'are'} overdue for service.
            Reach out to the customer to confirm the next visit.
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryTile: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'red' | 'amber' | 'indigo' | 'default';
}> = ({ label, value, icon, tone = 'default' }) => {
  const toneClasses = {
    red: 'text-red-600 bg-red-50',
    amber: 'text-amber-600 bg-amber-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    default: 'text-slate-600 bg-slate-50',
  }[tone];
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneClasses}`}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
};

export default ExternalFleetTab;

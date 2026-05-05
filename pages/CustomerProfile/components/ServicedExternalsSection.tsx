/**
 * ServicedExternalsSection — lists customer-owned forklifts (BYO or
 * sold-from-fleet) that Acwer is responsible for servicing for THIS
 * customer.
 *
 * Renders parallel to RentalsSection. RentalsSection covers the Acwer-fleet
 * side of the relationship; this section covers the customer-side.
 *
 * Click a row → navigate to the forklift profile (which shows the new
 * ForkliftOwnershipCard with full lifecycle history).
 */
import { Building2, ChevronRight, ShieldCheck, Truck, UserCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExternalServicedForklifts } from '../../../services/forkliftService';
import { showToast } from '../../../services/toastService';
import type { Forklift } from '../../../types';

interface Props {
  customerId: string;
}

const ServicedExternalsSection: React.FC<Props> = ({ customerId }) => {
  const navigate = useNavigate();
  const [forklifts, setForklifts] = useState<Forklift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getExternalServicedForklifts(customerId, { includeDormant: true })
      .then(rows => {
        if (!cancelled) setForklifts(rows);
      })
      .catch(e => {
        if (!cancelled) {
          showToast.error(`Failed to load customer-owned forklifts: ${e instanceof Error ? e.message : 'Unknown'}`);
          setForklifts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [customerId]);

  // Hide entirely when there's nothing to show — keeps the customer page
  // tidy for accounts without any externally-serviced units.
  if (!loading && forklifts.length === 0) return null;

  const sold = forklifts.filter(f => f.acquisition_source === 'sold_from_fleet').length;
  const byo = forklifts.filter(f => f.acquisition_source !== 'sold_from_fleet').length;

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Customer-owned forklifts under Acwer service</h3>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
            {forklifts.length}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {byo > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-3 h-3" /> {byo} BYO
            </span>
          )}
          {sold > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              <UserCheck className="w-3 h-3" /> {sold} sold from fleet
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Loading…</div>
        ) : (
          forklifts.map(f => {
            const modelDisplay = [f.make, f.model].filter(Boolean).join(' ').trim();
            const isSold = f.acquisition_source === 'sold_from_fleet';
            return (
              <button
                key={f.forklift_id}
                onClick={() => navigate(`/forklifts/${f.forklift_id}`)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isSold ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {isSold ? <UserCheck className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 truncate">
                    {f.customer_forklift_no || f.serial_number}
                    {f.customer_forklift_no && (
                      <span className="text-xs text-slate-400 font-normal ml-2">SN {f.serial_number}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {modelDisplay || <span className="text-slate-400">—</span>}
                    <span className="text-slate-400"> · {f.type}</span>
                    {f.hourmeter != null && <span className="text-slate-400"> · {f.hourmeter.toLocaleString()} h</span>}
                  </div>
                  {isSold && f.sold_to_customer_at && (
                    <div className="text-[10px] uppercase tracking-wide text-indigo-500 mt-0.5">
                      Sold {new Date(f.sold_to_customer_at).toLocaleDateString()}
                      {f.sold_price != null && ` · RM ${Number(f.sold_price).toLocaleString()}`}
                    </div>
                  )}
                  {f.service_management_status === 'dormant' && (
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">Dormant</div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            );
          })
        )}
      </div>

      {!loading && forklifts.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center gap-1.5">
          <Building2 className="w-3 h-3" />
          Click any forklift to view its full ownership history and service record.
        </div>
      )}
    </div>
  );
};

export default ServicedExternalsSection;

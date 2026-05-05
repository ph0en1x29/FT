/**
 * AdminDashboardV7_1ExternalFleetTile — discoverability surface for the
 * new External / Customer-Owned Fleet management track.
 *
 * Loads counts from getExternalServicedFleet() and renders a compact tile
 * whose CTA navigates to Forklifts → Serviced Externals (pre-filtered to
 * overdue when there's anything overdue).
 *
 * Only rendered when there's at least one external machine being managed
 * — keeps the dashboard clean for accounts that don't yet have the
 * customer-fleet line of business spun up.
 */
import { AlertOctagon, ChevronRight, Clock, ShieldCheck, Truck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalServicedForklift,
  getExternalServicedFleet,
} from '../../../../services/serviceTrackingService';

interface Counts {
  total: number;
  overdue: number;
  dueSoon: number;
  amc: number;
  noContract: number;
}

const computeCounts = (rows: ExternalServicedForklift[]): Counts => ({
  total: rows.length,
  overdue: rows.filter(r => r.service_urgency === 'overdue').length,
  dueSoon: rows.filter(r => r.service_urgency === 'due_soon').length,
  amc: rows.filter(r => r.service_responsibility === 'amc').length,
  noContract: rows.filter(r => r.service_responsibility === 'chargeable_external').length,
});

export const AdminDashboardV7_1ExternalFleetTile: React.FC = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExternalServicedFleet()
      .then(rows => {
        if (!cancelled) setCounts(computeCounts(rows));
      })
      .catch(() => {
        if (!cancelled) setCounts({ total: 0, overdue: 0, dueSoon: 0, amc: 0, noContract: 0 });
      });
    return () => { cancelled = true; };
  }, []);

  // Hide entirely when nothing is being managed — avoids dead pixels for
  // accounts that haven't onboarded any external customers yet.
  if (!counts || counts.total === 0) return null;

  const goToTab = (extra?: string) => {
    const qs = extra ? `&${extra}` : '';
    navigate(`/forklifts?tab=serviced-externals${qs}`);
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Customer-owned fleet under service
          </h3>
        </div>
        <button
          onClick={() => goToTab()}
          className="text-xs font-medium hover:opacity-70 flex items-center gap-1"
          style={{ color: 'var(--accent)' }}
        >
          Open <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Tile
          label="Total managed"
          value={counts.total}
          icon={<Truck className="w-3.5 h-3.5" />}
          onClick={() => goToTab()}
        />
        <Tile
          label="Overdue"
          value={counts.overdue}
          icon={<AlertOctagon className="w-3.5 h-3.5" />}
          tone="red"
          highlight={counts.overdue > 0}
          onClick={() => goToTab('urgency=overdue')}
        />
        <Tile
          label="Due in 7 days"
          value={counts.dueSoon}
          icon={<Clock className="w-3.5 h-3.5" />}
          tone="amber"
          highlight={counts.dueSoon > 0}
          onClick={() => goToTab('urgency=due_soon')}
        />
        <Tile
          label="AMC covered"
          value={counts.amc}
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          tone="indigo"
          onClick={() => goToTab()}
        />
      </div>

      {counts.overdue > 0 && (
        <div className="mt-3 text-xs text-amber-700">
          {counts.overdue} machine{counts.overdue === 1 ? '' : 's'} overdue — reach out to the customer to schedule the visit.
        </div>
      )}
    </div>
  );
};

const Tile: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'red' | 'amber' | 'indigo' | 'default';
  highlight?: boolean;
  onClick: () => void;
}> = ({ label, value, icon, tone = 'default', highlight = false, onClick }) => {
  const toneStyles = {
    red: { color: '#dc2626', bg: '#fef2f2', ring: '#fecaca' },
    amber: { color: '#d97706', bg: '#fffbeb', ring: '#fde68a' },
    indigo: { color: '#4f46e5', bg: '#eef2ff', ring: '#c7d2fe' },
    default: { color: 'var(--text-muted)', bg: 'var(--surface-2)', ring: 'var(--border-subtle)' },
  }[tone];

  return (
    <button
      onClick={onClick}
      className={`text-left p-2.5 rounded-xl border transition-all hover:scale-[1.02] active:scale-100`}
      style={{
        background: toneStyles.bg,
        borderColor: highlight ? toneStyles.color : toneStyles.ring,
        borderWidth: highlight ? 2 : 1,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color: toneStyles.color }}>
        {icon}
        <span className="text-[10px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color: toneStyles.color }}>{value}</div>
    </button>
  );
};

export default AdminDashboardV7_1ExternalFleetTile;

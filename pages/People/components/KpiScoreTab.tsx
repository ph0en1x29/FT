/**
 * KPI Score Tab — points + attendance bonus leaderboard (KPI Engine Phase 2).
 *
 * Source spec: /home/jay/Downloads/KPI_SPEC.md.
 *
 * Distinct from the Performance tab (TechnicianKPIPageV2) which shows
 * operational metrics (FTFR, MTTR, utilization, jobs/day, revenue). This tab
 * shows the spec's points + tier bonus model, surfaced from
 * `kpi_monthly_snapshots` via services/kpiService.ts.
 */

import {
  AlertTriangle,
  Award,
  Loader2,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  loadLeaderboard,
  recomputeMonthlyForAllTechs,
} from '../../../services/kpiService';
import { supabase } from '../../../services/supabaseClient';
import { showToast } from '../../../services/toastService';
import type { User } from '../../../types';
import type { KpiMonthlySnapshotRow } from '../../../types/kpi.types';

interface KpiScoreTabProps {
  currentUser: User;
}

const KpiScoreTab: React.FC<KpiScoreTabProps> = ({ currentUser }) => {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [snapshots, setSnapshots] = useState<KpiMonthlySnapshotRow[]>([]);
  const [techNames, setTechNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminish =
    currentUser.role === 'admin' ||
    currentUser.role === 'admin_service' ||
    currentUser.role === 'supervisor';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadLeaderboard(year, month)
      .then(async (rows) => {
        if (cancelled) return;
        setSnapshots(rows);
        if (rows.length === 0) {
          setTechNames(new Map());
          return;
        }
        const ids = Array.from(new Set(rows.map((r) => r.technician_id)));
        const { data: users } = await supabase
          .from('users')
          .select('user_id, name')
          .in('user_id', ids);
        if (cancelled) return;
        const m = new Map<string, string>();
        for (const u of users ?? []) m.set(u.user_id as string, u.name as string);
        setTechNames(m);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const handleRecompute = async () => {
    if (!isAdminish) return;
    setRecomputing(true);
    try {
      const rows = await recomputeMonthlyForAllTechs(
        year,
        month,
        currentUser.user_id,
      );
      setSnapshots([...rows].sort((a, b) => b.total_kpi_score - a.total_kpi_score));
      showToast.success(
        `Recomputed ${rows.length} snapshot${rows.length === 1 ? '' : 's'}`,
        `${year}-${String(month).padStart(2, '0')} period refreshed.`,
      );
    } catch (e) {
      showToast.error('Recompute failed', (e as Error).message);
    } finally {
      setRecomputing(false);
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1];

  return (
    <div className="space-y-6">
      {/* Header / period picker */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-theme flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" /> Monthly KPI Leaderboard
          </h2>
          <p className="text-xs text-theme-muted mt-1">
            Points + attendance bonus per the KPI spec. Snapshots are immutable once written;
            click Recompute to overwrite the row for the selected period.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-theme bg-[var(--bg)] px-3 py-2 text-sm text-theme"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-theme bg-[var(--bg)] px-3 py-2 text-sm text-theme"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleString('en-MY', { month: 'short' })}
              </option>
            ))}
          </select>
          {isAdminish && (
            <button
              type="button"
              onClick={handleRecompute}
              disabled={recomputing}
              className="btn-premium btn-premium-primary disabled:opacity-50 flex items-center gap-2"
            >
              {recomputing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {recomputing ? 'Recomputing...' : 'Recompute'}
            </button>
          )}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="card-premium p-6 flex items-center justify-center text-theme-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading snapshots...
        </div>
      )}
      {error && !loading && (
        <div className="card-premium p-4 border border-red-200 bg-red-50 text-red-700 text-sm">
          Could not load leaderboard: {error}
        </div>
      )}
      {!loading && !error && snapshots.length === 0 && (
        <div className="card-premium p-6 text-center text-theme-muted">
          <p className="font-medium mb-1">No snapshot for this period yet.</p>
          {isAdminish ? (
            <p className="text-sm">Click Recompute to compute and freeze the snapshot.</p>
          ) : (
            <p className="text-sm">Ask an admin to compute the snapshot for this period.</p>
          )}
        </div>
      )}

      {/* Leaderboard table */}
      {!loading && !error && snapshots.length > 0 && (
        <div className="card-premium overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-subtle)] text-theme-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-12">#</th>
                <th className="text-left px-4 py-3 font-medium">Technician</th>
                <th className="text-right px-4 py-3 font-medium">Job Pts</th>
                <th className="text-right px-4 py-3 font-medium">Attendance</th>
                <th className="text-right px-4 py-3 font-medium">Bonus</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Tier</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((row, i) => (
                <tr key={row.snapshot_id} className="border-t border-theme">
                  <td className="px-4 py-3 text-theme-muted">
                    {i === 0 && <Trophy className="inline w-4 h-4 text-amber-500 mr-1" />}
                    {i + 1}
                  </td>
                  <td className="px-4 py-3 text-theme font-medium">
                    {techNames.get(row.technician_id) ?? row.technician_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-right text-theme">{row.job_points}</td>
                  <td className="px-4 py-3 text-right text-theme">
                    {Number(row.attendance_pct).toFixed(1)}%
                    {row.red_flag && (
                      <AlertTriangle className="inline w-3.5 h-3.5 text-red-500 ml-1" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-theme">+{row.bonus_points}</td>
                  <td className="px-4 py-3 text-right font-semibold text-theme">
                    {row.total_kpi_score}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <TierBadge tier={row.tier} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-theme-muted px-1">
        Sources: monthly snapshots in <code>kpi_monthly_snapshots</code>. Computed by{' '}
        <code>services/kpiService.ts</code> from job status history + leave records + public holidays.
      </p>
    </div>
  );
};

const TierBadge: React.FC<{ tier: KpiMonthlySnapshotRow['tier'] }> = ({ tier }) => {
  const cfg =
    tier === 'elite'
      ? { label: 'Elite', cls: 'bg-amber-100 text-amber-700 border-amber-200' }
      : tier === 'steady'
        ? { label: 'Steady', cls: 'bg-blue-100 text-blue-700 border-blue-200' }
        : { label: 'Warning', cls: 'bg-red-100 text-red-700 border-red-200' };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export default KpiScoreTab;

/**
 * KPI Score Tab — points + attendance bonus leaderboard (KPI Engine Phase 2).
 *
 * Source spec: /home/jay/Downloads/KPI_SPEC.md.
 *
 * Distinct from the Performance tab (TechnicianKPIPageV2) which shows
 * operational metrics (FTFR, MTTR, utilization, jobs/day, revenue). This tab
 * shows the spec's points + tier bonus model, surfaced from
 * `kpi_monthly_snapshots` via services/kpiService.ts.
 *
 * Data fetching uses @tanstack/react-query for FT-consistent caching, dedupe,
 * and automatic refetch on window focus.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Award,
  Loader2,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  loadLeaderboard,
  recomputeMonthlyForAllTechs,
  type LeaderboardRow,
} from '../../../services/kpiService';
import { showToast } from '../../../services/toastService';
import type { User } from '../../../types';
import type { AttendanceTier } from '../../../types/kpi.types';

interface KpiScoreTabProps {
  currentUser: User;
}

const KpiScoreTab: React.FC<KpiScoreTabProps> = ({ currentUser }) => {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const queryClient = useQueryClient();

  const isAdminish =
    currentUser.role === 'admin' ||
    currentUser.role === 'admin_service' ||
    currentUser.role === 'supervisor';

  const leaderboardKey = ['kpi-leaderboard', year, month] as const;

  const {
    data: snapshots = [],
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: leaderboardKey,
    queryFn: () => loadLeaderboard(year, month),
    staleTime: 60_000, // snapshots are frozen — 1 min cache is plenty
  });

  const recomputeMutation = useMutation({
    mutationFn: () => recomputeMonthlyForAllTechs(year, month, currentUser.user_id),
    onSuccess: (rows) => {
      queryClient.setQueryData(leaderboardKey, () =>
        // recompute returns rows without the joined technician_name; map
        // them onto the existing names from the cache where possible
        rows
          .map((r) => {
            const existing = snapshots.find((s) => s.technician_id === r.technician_id);
            return { ...r, technician_name: existing?.technician_name ?? null } as LeaderboardRow;
          })
          .sort((a, b) => b.total_kpi_score - a.total_kpi_score),
      );
      // also invalidate so the next focus does a fresh read with the join
      queryClient.invalidateQueries({ queryKey: leaderboardKey });
      showToast.success(
        `Recomputed ${rows.length} snapshot${rows.length === 1 ? '' : 's'}`,
        `${year}-${String(month).padStart(2, '0')} period refreshed.`,
      );
    },
    onError: (e) => {
      showToast.error('Recompute failed', (e as Error).message);
    },
  });

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1];

  return (
    <div className="space-y-6">
      <KpiScoreHeader
        year={year}
        month={month}
        yearOptions={yearOptions}
        monthOptions={monthOptions}
        onYearChange={setYear}
        onMonthChange={setMonth}
        isAdminish={isAdminish}
        recomputing={recomputeMutation.isPending}
        isFetching={isFetching && !isLoading}
        onRecompute={() => recomputeMutation.mutate()}
      />

      {isLoading && <KpiScoreSkeleton />}

      {!isLoading && error && (
        <div className="card-premium p-4 border border-red-200 bg-red-50 text-red-700 text-sm">
          Could not load leaderboard: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && snapshots.length === 0 && (
        <div className="card-premium p-6 text-center text-theme-muted">
          <p className="font-medium mb-1">No snapshot for this period yet.</p>
          {isAdminish ? (
            <p className="text-sm">Click Recompute to compute and freeze the snapshot.</p>
          ) : (
            <p className="text-sm">Ask an admin to compute the snapshot for this period.</p>
          )}
        </div>
      )}

      {!isLoading && !error && snapshots.length > 0 && (
        <KpiLeaderboardTable rows={snapshots} />
      )}

      <p className="text-xs text-theme-muted px-1">
        Sources: monthly snapshots in <code>kpi_monthly_snapshots</code>. Computed by{' '}
        <code>services/kpiService.ts</code> from job status history + leave records + public holidays.
      </p>
    </div>
  );
};

// ─── Subcomponents ────────────────────────────────────────────────

interface HeaderProps {
  year: number;
  month: number;
  yearOptions: number[];
  monthOptions: number[];
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
  isAdminish: boolean;
  recomputing: boolean;
  isFetching: boolean;
  onRecompute: () => void;
}

const KpiScoreHeader: React.FC<HeaderProps> = ({
  year,
  month,
  yearOptions,
  monthOptions,
  onYearChange,
  onMonthChange,
  isAdminish,
  recomputing,
  isFetching,
  onRecompute,
}) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <div>
      <h2 className="text-lg font-semibold text-theme flex items-center gap-2">
        <Award className="w-5 h-5 text-amber-500" /> Monthly KPI Leaderboard
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-theme-muted" />}
      </h2>
      <p className="text-xs text-theme-muted mt-1">
        Points + attendance bonus per the KPI spec. Snapshots are immutable once written;
        click Recompute to overwrite the row for the selected period.
      </p>
    </div>
    <div className="flex items-center gap-2">
      <select
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className="rounded-lg border border-theme bg-[var(--bg)] px-3 py-2 text-sm text-theme"
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => onMonthChange(Number(e.target.value))}
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
          onClick={onRecompute}
          disabled={recomputing}
          className="btn-premium btn-premium-primary disabled:opacity-50 flex items-center gap-2"
        >
          {recomputing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {recomputing ? 'Recomputing...' : 'Recompute'}
        </button>
      )}
    </div>
  </div>
);

const KpiScoreSkeleton: React.FC = () => (
  <div className="card-premium overflow-hidden">
    <div className="bg-[var(--bg-subtle)] p-3">
      <div className="h-3 w-24 bg-[var(--border-subtle)] rounded animate-pulse" />
    </div>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="border-t border-theme p-3 flex items-center gap-4">
        <div className="h-3 w-6 bg-[var(--border-subtle)] rounded animate-pulse" />
        <div className="h-3 w-32 bg-[var(--border-subtle)] rounded animate-pulse" />
        <div className="h-3 w-12 bg-[var(--border-subtle)] rounded animate-pulse ml-auto" />
        <div className="h-3 w-16 bg-[var(--border-subtle)] rounded animate-pulse" />
        <div className="h-3 w-12 bg-[var(--border-subtle)] rounded animate-pulse" />
        <div className="h-3 w-12 bg-[var(--border-subtle)] rounded animate-pulse" />
        <div className="h-5 w-16 bg-[var(--border-subtle)] rounded-full animate-pulse" />
      </div>
    ))}
  </div>
);

const KpiLeaderboardTable: React.FC<{ rows: LeaderboardRow[] }> = ({ rows }) => (
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
        {rows.map((row, i) => (
          <tr key={row.snapshot_id} className="border-t border-theme">
            <td className="px-4 py-3 text-theme-muted">
              {i === 0 && <Trophy className="inline w-4 h-4 text-amber-500 mr-1" />}
              {i + 1}
            </td>
            <td className="px-4 py-3 text-theme font-medium">
              {row.technician_name ?? row.technician_id.slice(0, 8)}
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
);

const TIER_CFG: Record<AttendanceTier, { label: string; cls: string }> = {
  elite: { label: 'Elite', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  steady: { label: 'Steady', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  warning: { label: 'Warning', cls: 'bg-red-100 text-red-700 border-red-200' },
};

const TierBadge: React.FC<{ tier: AttendanceTier }> = ({ tier }) => {
  const cfg = TIER_CFG[tier];
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

export default KpiScoreTab;

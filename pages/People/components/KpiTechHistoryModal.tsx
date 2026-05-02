/**
 * KpiTechHistoryModal — 12-month KPI score trend for one technician.
 *
 * Phase 3.3 of the KPI Engine. Reads via services/kpiService.loadSnapshotsForTech.
 * Renders a zero-dependency div-based bar chart (no recharts needed) so the
 * bundle stays trim. If snapshots are sparse, missing months are shown as
 * grey bars at the lowest tier — makes gaps visible.
 */

import { useQuery } from '@tanstack/react-query';
import { Loader2, TrendingUp, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { loadSnapshotsForTech } from '../../../services/kpiService';
import type {
  AttendanceTier,
  KpiMonthlySnapshotRow,
} from '../../../types/kpi.types';

interface KpiTechHistoryModalProps {
  show: boolean;
  technicianId: string;
  technicianName: string;
  onClose: () => void;
}

const MONTHS_BACK = 12;

const TIER_COLOR: Record<AttendanceTier, string> = {
  elite: 'bg-amber-500',
  steady: 'bg-blue-500',
  warning: 'bg-red-500',
};

const KpiTechHistoryModal: React.FC<KpiTechHistoryModalProps> = ({
  show,
  technicianId,
  technicianName,
  onClose,
}) => {
  const {
    data: history = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['kpi-tech-history', technicianId, MONTHS_BACK],
    queryFn: () => loadSnapshotsForTech(technicianId, MONTHS_BACK),
    enabled: show && !!technicianId,
    staleTime: 60_000,
  });

  // Build a chronologically-ordered series of the last 12 months, with
  // missing months represented as null so gaps are visible.
  const series = useMemo(() => buildMonthSeries(history, MONTHS_BACK), [history]);
  const peak = useMemo(
    () => Math.max(135, ...series.map((s) => s.row?.total_kpi_score ?? 0)),
    [series],
  );

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-2xl shadow-premium-elevated">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-lg text-[var(--text)] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
            {technicianName} — 12-Month KPI History
          </h4>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className="py-12 flex justify-center text-theme-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading history...
          </div>
        )}

        {error && !isLoading && (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
            Could not load history: {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {history.length === 0 ? (
              <div className="py-8 text-center text-theme-muted">
                <p className="font-medium mb-1">No KPI snapshots yet for this technician.</p>
                <p className="text-sm">Snapshots are created when an admin clicks Recompute.</p>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-1.5 h-48 mb-4 pt-4 px-2">
                  {series.map((s) => {
                    const score = s.row?.total_kpi_score ?? 0;
                    const heightPct = (score / peak) * 100;
                    const colorCls = s.row ? TIER_COLOR[s.row.tier] : 'bg-[var(--border-subtle)]';
                    return (
                      <div
                        key={`${s.year}-${s.month}`}
                        className="flex-1 flex flex-col items-center justify-end gap-1 group"
                        title={
                          s.row
                            ? `${s.label}: ${score} pts (${s.row.tier}, attendance ${Number(s.row.attendance_pct).toFixed(1)}%)`
                            : `${s.label}: no snapshot`
                        }
                      >
                        <span className="text-[10px] text-theme-muted opacity-0 group-hover:opacity-100 transition">
                          {score}
                        </span>
                        <div
                          className={`w-full rounded-t ${colorCls} transition`}
                          style={{ height: `${Math.max(2, heightPct)}%` }}
                        />
                        <span className="text-[10px] text-theme-muted">{s.shortLabel}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-theme pt-4 grid grid-cols-3 gap-3 text-sm">
                  <SummaryStat
                    label="Peak"
                    value={Math.max(0, ...series.map((s) => s.row?.total_kpi_score ?? 0))}
                  />
                  <SummaryStat
                    label="Average"
                    value={
                      Math.round(
                        series.filter((s) => s.row).reduce((a, s) => a + (s.row?.total_kpi_score ?? 0), 0) /
                          Math.max(1, series.filter((s) => s.row).length),
                      )
                    }
                  />
                  <SummaryStat
                    label="Months on record"
                    value={series.filter((s) => s.row).length}
                  />
                </div>
                <div className="mt-4 text-xs text-theme-muted flex flex-wrap gap-3">
                  <LegendItem color="bg-amber-500" label="Elite (≥95%)" />
                  <LegendItem color="bg-blue-500" label="Steady (≥80%)" />
                  <LegendItem color="bg-red-500" label="Warning (<80%)" />
                  <LegendItem color="bg-[var(--border-subtle)]" label="No snapshot" />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface MonthSlot {
  year: number;
  month: number;
  label: string;
  shortLabel: string;
  row: KpiMonthlySnapshotRow | undefined;
}

function buildMonthSeries(
  rows: KpiMonthlySnapshotRow[],
  monthsBack: number,
): MonthSlot[] {
  const byKey = new Map<string, KpiMonthlySnapshotRow>();
  for (const r of rows) byKey.set(`${r.year}-${r.month}`, r);

  const now = new Date();
  const out: MonthSlot[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const monthName = d.toLocaleString('en-MY', { month: 'short' });
    out.push({
      year,
      month,
      label: `${monthName} ${year}`,
      shortLabel: monthName.charAt(0),
      row: byKey.get(`${year}-${month}`),
    });
  }
  return out;
}

const SummaryStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-[var(--bg-subtle)] rounded-xl p-3">
    <div className="text-xs text-theme-muted">{label}</div>
    <div className="text-xl font-semibold text-theme">{value}</div>
  </div>
);

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
    <span>{label}</span>
  </div>
);

export default KpiTechHistoryModal;

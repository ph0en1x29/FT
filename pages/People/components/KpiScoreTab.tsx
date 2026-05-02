/**
 * KPI Score Tab — points + attendance bonus leaderboard (KPI Engine Phase 2/3).
 *
 * Source spec: /home/jay/Downloads/KPI_SPEC.md.
 *
 * Distinct from the Performance tab (TechnicianKPIPageV2) which shows
 * operational metrics (FTFR, MTTR, utilization, jobs/day, revenue). This tab
 * shows the spec's points + tier bonus model, surfaced from
 * `kpi_monthly_snapshots` via services/kpiService.ts.
 *
 * Phase 3 additions:
 *   - Banner when pg_cron has queued a month-end reminder (3.4)
 *   - Per-row "📊 History" → 12-month trend chart (3.3)
 *   - Per-row notes edit for admin/supervisor (3.2 — dispute/correction)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Award,
  Bell,
  FileText,
  Loader2,
  RefreshCw,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  acknowledgeRecompute,
  loadLeaderboard,
  loadPendingRecomputes,
  recomputeMonthlyForAllTechs,
  updateSnapshotNotes,
  type LeaderboardRow,
} from '../../../services/kpiService';
import { showToast } from '../../../services/toastService';
import type { User } from '../../../types';
import type { AttendanceTier } from '../../../types/kpi.types';
import KpiTechHistoryModal from './KpiTechHistoryModal';

interface KpiScoreTabProps {
  currentUser: User;
}

const KpiScoreTab: React.FC<KpiScoreTabProps> = ({ currentUser }) => {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [historyTech, setHistoryTech] = useState<{ id: string; name: string } | null>(null);
  const [notesRow, setNotesRow] = useState<LeaderboardRow | null>(null);
  const queryClient = useQueryClient();

  const isAdminish =
    currentUser.role === 'admin' ||
    currentUser.role === 'admin_service' ||
    currentUser.role === 'supervisor';

  const leaderboardKey = ['kpi-leaderboard', year, month] as const;
  const pendingKey = ['kpi-recompute-pending'] as const;

  const { data: snapshots = [], isLoading, isFetching, error } = useQuery({
    queryKey: leaderboardKey,
    queryFn: () => loadLeaderboard(year, month),
    staleTime: 60_000,
  });

  const { data: pending = [] } = useQuery({
    queryKey: pendingKey,
    queryFn: loadPendingRecomputes,
    enabled: isAdminish,
    staleTime: 5 * 60_000,
  });

  const recomputeMutation = useMutation({
    mutationFn: () => recomputeMonthlyForAllTechs(year, month, currentUser.user_id),
    onSuccess: async (rows) => {
      queryClient.setQueryData(leaderboardKey, () =>
        rows
          .map((r) => {
            const existing = snapshots.find((s) => s.technician_id === r.technician_id);
            return { ...r, technician_name: existing?.technician_name ?? null } as LeaderboardRow;
          })
          .sort((a, b) => b.total_kpi_score - a.total_kpi_score),
      );
      queryClient.invalidateQueries({ queryKey: leaderboardKey });
      // Auto-acknowledge any pending reminder for this period
      const matching = pending.find((p) => p.year === year && p.month === month);
      if (matching) {
        try {
          await acknowledgeRecompute(year, month, currentUser.user_id);
          queryClient.invalidateQueries({ queryKey: pendingKey });
        } catch (_e) {
          // non-blocking
        }
      }
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

  const jumpToPending = (p: { year: number; month: number }) => {
    setYear(p.year);
    setMonth(p.month);
  };

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

      {isAdminish && pending.length > 0 && (
        <PendingReminderBanner pending={pending} onJumpTo={jumpToPending} />
      )}

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
        <KpiLeaderboardTable
          rows={snapshots}
          isAdminish={isAdminish}
          onOpenHistory={(id, name) => setHistoryTech({ id, name })}
          onOpenNotes={(row) => setNotesRow(row)}
        />
      )}

      <p className="text-xs text-theme-muted px-1">
        Sources: monthly snapshots in <code>kpi_monthly_snapshots</code>. Computed by{' '}
        <code>services/kpiService.ts</code> from job status history + leave records + public holidays.
      </p>

      {historyTech && (
        <KpiTechHistoryModal
          show={!!historyTech}
          technicianId={historyTech.id}
          technicianName={historyTech.name}
          onClose={() => setHistoryTech(null)}
        />
      )}

      {notesRow && (
        <KpiNotesModal
          row={notesRow}
          onClose={() => setNotesRow(null)}
          onSaved={(updated) => {
            queryClient.setQueryData(leaderboardKey, (prev: LeaderboardRow[] = []) =>
              prev.map((r) =>
                r.snapshot_id === updated.snapshot_id ? { ...r, notes: updated.notes } : r,
              ),
            );
            setNotesRow(null);
          }}
        />
      )}
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
  year, month, yearOptions, monthOptions,
  onYearChange, onMonthChange,
  isAdminish, recomputing, isFetching, onRecompute,
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
        {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
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

interface PendingProps {
  pending: { year: number; month: number; queued_at: string }[];
  onJumpTo: (p: { year: number; month: number }) => void;
}

const PendingReminderBanner: React.FC<PendingProps> = ({ pending, onJumpTo }) => (
  <div className="card-premium p-3 border border-amber-200 bg-amber-50 flex items-start gap-3">
    <Bell className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
    <div className="flex-1 text-sm">
      <p className="font-medium text-amber-800">
        {pending.length === 1 ? 'A new month is due for recompute' : `${pending.length} months due for recompute`}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {pending.map((p) => (
          <button
            key={`${p.year}-${p.month}`}
            type="button"
            onClick={() => onJumpTo(p)}
            className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-xs text-amber-800 hover:bg-amber-100 transition"
          >
            Jump to {new Date(p.year, p.month - 1, 1).toLocaleString('en-MY', { month: 'short' })} {p.year}
          </button>
        ))}
      </div>
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

interface TableProps {
  rows: LeaderboardRow[];
  isAdminish: boolean;
  onOpenHistory: (techId: string, techName: string) => void;
  onOpenNotes: (row: LeaderboardRow) => void;
}

const KpiLeaderboardTable: React.FC<TableProps> = ({ rows, isAdminish, onOpenHistory, onOpenNotes }) => (
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
          <th className="text-center px-4 py-3 font-medium w-20">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const techName = row.technician_name ?? row.technician_id.slice(0, 8);
          return (
            <tr key={row.snapshot_id} className="border-t border-theme">
              <td className="px-4 py-3 text-theme-muted">
                {i === 0 && <Trophy className="inline w-4 h-4 text-amber-500 mr-1" />}
                {i + 1}
              </td>
              <td className="px-4 py-3 text-theme font-medium">{techName}</td>
              <td className="px-4 py-3 text-right text-theme">{row.job_points}</td>
              <td className="px-4 py-3 text-right text-theme">
                {Number(row.attendance_pct).toFixed(1)}%
                {row.red_flag && <AlertTriangle className="inline w-3.5 h-3.5 text-red-500 ml-1" />}
              </td>
              <td className="px-4 py-3 text-right text-theme">+{row.bonus_points}</td>
              <td className="px-4 py-3 text-right font-semibold text-theme">{row.total_kpi_score}</td>
              <td className="px-4 py-3 text-center">
                <TierBadge tier={row.tier} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenHistory(row.technician_id, techName)}
                    className="text-theme-muted hover:text-[var(--accent)] transition"
                    title="12-month history"
                    aria-label={`View ${techName}'s 12-month KPI history`}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </button>
                  {isAdminish && (
                    <button
                      type="button"
                      onClick={() => onOpenNotes(row)}
                      className={`transition ${row.notes ? 'text-amber-600 hover:text-amber-700' : 'text-theme-muted hover:text-[var(--accent)]'}`}
                      title={row.notes ? `Notes: ${row.notes}` : 'Add correction note'}
                      aria-label={`${row.notes ? 'Edit' : 'Add'} correction note for ${techName}`}
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
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

// ─── Notes modal (Phase 3.2 — dispute/correction) ────────────────

interface NotesModalProps {
  row: LeaderboardRow;
  onClose: () => void;
  onSaved: (updated: { snapshot_id: string; notes: string | null }) => void;
}

const KpiNotesModal: React.FC<NotesModalProps> = ({ row, onClose, onSaved }) => {
  const [draft, setDraft] = useState(row.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateSnapshotNotes(row.snapshot_id, draft);
      showToast.success('Note saved', `Snapshot ${row.year}-${String(row.month).padStart(2, '0')} updated.`);
      onSaved({ snapshot_id: updated.snapshot_id, notes: updated.notes });
    } catch (e) {
      showToast.error('Could not save note', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-lg text-[var(--text)] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--accent)]" /> Correction Note
          </h4>
          <button type="button" onClick={onClose} className="text-theme-muted hover:text-theme">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-theme-muted mb-4">
          For {row.technician_name ?? row.technician_id.slice(0, 8)} — {row.year}-{String(row.month).padStart(2, '0')}.
          Notes are a paper trail; they don't change the score. To change the score itself, edit underlying job/leave data and Recompute.
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          placeholder="e.g. Manual review — admin override approved 2026-05-04 (job JOB-260420-003 disputed)"
          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] p-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none mb-4"
        />
        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="btn-premium btn-premium-secondary flex-1 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-premium btn-premium-primary flex-1 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KpiScoreTab;

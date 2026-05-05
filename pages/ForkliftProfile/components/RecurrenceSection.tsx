/**
 * RecurrenceSection — ACWER Phase 5 admin UI on ForkliftProfile.
 *
 * Visible only on company-owned forklifts. Lists active recurring_schedules
 * rows for this forklift, lets admin add a default monthly/quarterly/yearly
 * recurrence with one click, deactivate existing rows, and force-run the
 * generator (Phase 5's daily cron) on demand.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Loader2, Play, ShieldOff } from 'lucide-react';
import React, { useState } from 'react';

import {
  createRecurringSchedule,
  deactivateRecurringSchedule,
  getRecurringSchedulesForForklift,
  runRecurringScheduleGenerator,
} from '../../../services/recurringScheduleService';
import { showToast } from '../../../services/toastService';
import type { Forklift, RecurringSchedule, User } from '../../../types';

interface Props {
  forklift: Forklift;
  currentUser: User;
}

const formatDate = (s?: string | null) => (s ? s.slice(0, 10) : '—');

const RecurrenceSection: React.FC<Props> = ({ forklift, currentUser }) => {
  const queryClient = useQueryClient();
  const [savingFreq, setSavingFreq] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const role = currentUser.role.toString().toLowerCase();
  const canManage = role === 'admin' || role === 'admin_service' || role === 'supervisor';
  const isFleet = forklift.ownership === 'company';
  const isCustomerOwned = forklift.ownership === 'customer';

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['recurring-schedules', forklift.forklift_id],
    queryFn: () => getRecurringSchedulesForForklift(forklift.forklift_id),
    // Show for both fleet (Path C) and customer-owned (AMC / chargeable) so
    // admins can attach a PM cadence to externally-serviced units too.
    enabled: isFleet || isCustomerOwned,
  });

  // Only hide for fully-anonymous forklifts (no ownership) — anything with
  // an ownership flag now supports recurrence.
  if (!isFleet && !isCustomerOwned) return null;

  const activeSchedules = (schedules as RecurringSchedule[]).filter(s => s.is_active);

  const defaultDueDate = (() => {
    // Default next_due_date 30 days out, gives lead-time slack.
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const handleAdd = async (frequency: 'monthly' | 'quarterly' | 'yearly') => {
    setSavingFreq(frequency);
    try {
      await createRecurringSchedule({
        forklift_id: forklift.forklift_id,
        frequency,
        next_due_date: defaultDueDate,
        lead_time_days: 7,
        notes: `Default ${frequency} recurrence created by ${currentUser.name}`,
      });
      showToast.success(`${frequency.charAt(0).toUpperCase() + frequency.slice(1)} recurrence created`);
      queryClient.invalidateQueries({ queryKey: ['recurring-schedules', forklift.forklift_id] });
    } catch (e) {
      showToast.error('Could not create recurrence', (e as Error).message);
    } finally {
      setSavingFreq(null);
    }
  };

  const handleDeactivate = async (s: RecurringSchedule) => {
    if (!confirm(`Deactivate this ${s.frequency} recurrence? Existing scheduled_services rows already generated stay; future ones won't fire.`)) {
      return;
    }
    try {
      await deactivateRecurringSchedule(s.schedule_id);
      showToast.success('Recurrence deactivated');
      queryClient.invalidateQueries({ queryKey: ['recurring-schedules', forklift.forklift_id] });
    } catch (e) {
      showToast.error('Could not deactivate', (e as Error).message);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const created = await runRecurringScheduleGenerator();
      const matchingForUs = created.filter(r => r.forklift_id === forklift.forklift_id);
      if (matchingForUs.length > 0) {
        showToast.success(`Generated ${matchingForUs.length} scheduled service(s) for this forklift`);
      } else {
        showToast.success(`Generator ran (${created.length} schedules processed globally; none eligible for this forklift right now)`);
      }
      queryClient.invalidateQueries({ queryKey: ['recurring-schedules', forklift.forklift_id] });
    } catch (e) {
      showToast.error('Could not run generator', (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold inline-flex items-center gap-2">
          <CalendarClock className="w-4 h-4" />
          Recurring PM schedule
          <span className="px-2 py-0.5 rounded-full text-xs font-normal bg-slate-100 text-slate-600">
            {isFleet ? 'Path C · Fleet' : 'Customer-owned'}
          </span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 font-normal">
            {activeSchedules.length} active
          </span>
        </h3>
        {canManage && (
          <button
            onClick={handleRunNow}
            disabled={running}
            className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 inline-flex items-center gap-1 disabled:opacity-50"
            title="Force-run the daily generator now (instead of waiting for tomorrow's 00:30 UTC cron)"
          >
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run now
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : activeSchedules.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] mb-3">
          No active recurrence. The daily cron generator (00:30 UTC) won&apos;t produce any scheduled_services for this forklift until you set one up.
        </p>
      ) : (
        <ul className="space-y-2 mb-3">
          {activeSchedules.map(s => (
            <li
              key={s.schedule_id}
              className="border border-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-lg p-3 flex items-start justify-between"
            >
              <div className="text-sm">
                <span className="font-semibold capitalize">{s.frequency}</span>
                <span className="text-[var(--text-muted)] ml-2">·</span>
                <span className="text-[var(--text-muted)] ml-2">
                  next due {formatDate(s.next_due_date)} (lead {s.lead_time_days}d)
                </span>
                {s.last_generated_at && (
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    Last fired {formatDate(s.last_generated_at)}
                  </div>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => handleDeactivate(s)}
                  className="p-1.5 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600"
                  title="Deactivate this recurrence"
                >
                  <ShieldOff className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {(['monthly', 'quarterly', 'yearly'] as const).map(freq => (
            <button
              key={freq}
              onClick={() => handleAdd(freq)}
              disabled={savingFreq !== null}
              className="text-sm px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/20 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {savingFreq === freq && <Loader2 className="w-3 h-3 animate-spin" />}
              + {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurrenceSection;

import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DatePickerProps {
  /** Currently selected ISO string, or empty/undefined for no selection */
  value: string | null | undefined;
  /** Fires with an ISO string (07:30 Malaysia Time on the picked day) or '' when cleared */
  onChange: (isoString: string) => void;
  /** Shown on the trigger button when no date is selected */
  placeholder?: string;
  /** Disable all dates before today (browser local). Default true. */
  disablePast?: boolean;
  /** Optional label above the trigger */
  label?: string;
  /** Allow clearing the selection */
  allowClear?: boolean;
  /** className for the trigger button */
  buttonClassName?: string;
  /** Show a compact inline trigger instead of the full labeled input */
  compact?: boolean;
}

/**
 * Build an ISO string for 07:30 Malaysia Time (UTC+8) on the given calendar date.
 * The date argument is interpreted using its local year/month/day fields — we do NOT
 * use `date.toISOString()` because that would coerce through the browser's timezone
 * and shift the day for any user not in MYT.
 */
export function toMalaysia730ISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T07:30:00+08:00`;
}

/** Parse a stored ISO string back into the calendar day it represents in Malaysia Time. */
export function parseMalaysiaDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  // Pull year/month/day as-they-display-in-MYT, not as-they-display-locally.
  const mytString = parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
  // en-CA yields "YYYY-MM-DD" which is round-trippable.
  const [y, m, d] = mytString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a stored ISO string as a human label in Malaysia Time. */
export function formatMalaysiaDateLabel(iso: string | null | undefined): string {
  const d = parseMalaysiaDate(iso);
  if (!d) return '';
  const weekday = DAY_FULL_NAMES[d.getDay()];
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  disablePast = true,
  label,
  allowClear = true,
  buttonClassName,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const selected = useMemo(() => parseMalaysiaDate(value), [value]);
  const [viewDate, setViewDate] = useState<Date>(() => selected ?? new Date());

  // When the parent-controlled value changes, keep the visible month in sync.
  useEffect(() => {
    if (selected) setViewDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selected]);

  // Position the popover under the trigger each time it opens.
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const viewportWidth = window.innerWidth;
    let left = rect.left;
    if (left + popoverWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - popoverWidth - 8);
    }
    setPopoverPos({
      top: rect.bottom + window.scrollY + 4,
      left: left + window.scrollX,
    });
  }, [open]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay() returns 0=Sun..6=Sat; we want Monday-first columns.
  const firstDayOfMonthIndex = (new Date(year, month, 1).getDay() + 6) % 7;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const goPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const goNextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => setViewDate(new Date());

  const handlePickDay = (day: number) => {
    const picked = new Date(year, month, day);
    if (disablePast && picked < today) return;
    onChange(toMalaysia730ISO(picked));
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDayOfMonthIndex; i++) {
    cells.push(<div key={`blank-${i}`} className="h-9" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(year, month, day);
    const isToday = cellDate.getTime() === today.getTime();
    const isPast = disablePast && cellDate < today;
    const isSelected = selected !== null && cellDate.getTime() === selected.getTime();
    cells.push(
      <button
        key={day}
        type="button"
        disabled={isPast}
        onClick={() => handlePickDay(day)}
        className={[
          'h-9 w-9 rounded-lg text-sm font-medium transition-colors flex items-center justify-center',
          isPast ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-blue-50',
          isSelected ? 'bg-blue-600 text-white hover:bg-blue-700' : '',
          !isSelected && isToday ? 'ring-2 ring-blue-500 text-blue-700 font-bold' : '',
        ].join(' ')}
        aria-label={`${day} ${MONTH_NAMES[month]} ${year}`}
        aria-pressed={isSelected}
      >
        {day}
      </button>
    );
  }

  const triggerLabel = value ? formatMalaysiaDateLabel(value) : placeholder;
  const defaultBtnClasses = compact
    ? 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-[var(--surface)] text-sm text-slate-700 hover:bg-slate-50 transition-colors'
    : 'w-full inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[var(--surface)] text-sm text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={buttonClassName || defaultBtnClasses}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          <CalendarIcon className="w-4 h-4 shrink-0 text-slate-400" />
          <span className={`truncate ${value ? 'text-slate-900' : 'text-slate-400'}`}>{triggerLabel}</span>
        </span>
        {value && allowClear && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange('');
              }
            }}
            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Choose date"
          className="fixed z-[80] w-[320px] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 p-4 animate-in fade-in"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goPrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-semibold text-slate-800">
              {MONTH_NAMES[month]} {year}
            </div>
            <button
              type="button"
              onClick={goNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week header row */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_HEADERS.map(d => (
              <div key={d} className="h-7 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={goToday}
              className="px-2 py-1 rounded-md text-blue-600 hover:bg-blue-50 font-medium"
            >
              Today
            </button>
            <span className="text-slate-400">Notification at 7:30 AM MYT</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

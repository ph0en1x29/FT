/**
 * Shared ticker — one setInterval per (cadence, subscriber-set), fanned out
 * to every consumer.
 *
 * Use case: SlotInSLABadge previously created a per-instance setInterval
 * for its 1-second countdown. With 50 badges visible on a busy JobBoard
 * that's 50 timers and 50 setState calls per second, all triggering small
 * re-renders. This hook collapses them into a single timer per cadence,
 * shared across instances. Each consumer still gets its own re-render —
 * that part is unavoidable — but the timer cost is O(1) instead of O(N).
 */

import { useEffect, useState } from 'react';

interface TickerEntry {
  interval: ReturnType<typeof setInterval>;
  listeners: Set<(now: number) => void>;
}

const tickers = new Map<number, TickerEntry>();

const ensureTicker = (intervalMs: number): TickerEntry => {
  const entry = tickers.get(intervalMs);
  if (entry) return entry;
  const fresh: TickerEntry = {
    interval: setInterval(() => {
      const now = Date.now();
      fresh.listeners.forEach(fn => fn(now));
    }, intervalMs),
    listeners: new Set(),
  };
  tickers.set(intervalMs, fresh);
  return fresh;
};

const releaseTicker = (intervalMs: number, listener: (now: number) => void) => {
  const entry = tickers.get(intervalMs);
  if (!entry) return;
  entry.listeners.delete(listener);
  if (entry.listeners.size === 0) {
    clearInterval(entry.interval);
    tickers.delete(intervalMs);
  }
};

/**
 * Returns Date.now() updated at the requested cadence, shared across all
 * components subscribing at the same cadence. Pass `null` to opt out (no
 * interval, no re-renders) — useful when the consuming component is in a
 * "settled" state (e.g. SLA already acknowledged).
 */
export function useSharedNow(intervalMs: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs === null) return;
    const cadence = intervalMs;
    const entry = ensureTicker(cadence);
    const listener = (n: number) => setNow(n);
    entry.listeners.add(listener);
    return () => releaseTicker(cadence, listener);
  }, [intervalMs]);

  return now;
}

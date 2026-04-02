/**
 * Circuit Breaker for Supabase / API retries
 *
 * Prevents runaway retry loops (e.g. the Claude Code autocompact bug pattern:
 * 250K API calls/day from unguarded retry loops).
 *
 * Usage:
 *   const cb = createCircuitBreaker({ maxFailures: 3, resetAfterMs: 60_000 });
 *   const result = await cb.execute(() => supabase.from('jobs').select('*'));
 *
 *   // Or one-shot wrapper:
 *   const result = await withCircuitBreaker(() => supabase.from('jobs').select('*'), opts);
 */

export class CircuitBreakerTrippedError extends Error {
  public readonly consecutiveFailures: number;
  public readonly trippedAt: Date;

  constructor(consecutiveFailures: number, trippedAt: Date) {
    super(
      `Circuit breaker tripped after ${consecutiveFailures} consecutive failures ` +
        `(at ${trippedAt.toISOString()}). Retries paused.`
    );
    this.name = 'CircuitBreakerTrippedError';
    this.consecutiveFailures = consecutiveFailures;
    this.trippedAt = trippedAt;
  }
}

export interface CircuitBreakerOptions {
  /** Max consecutive failures before tripping (default: 3) */
  maxFailures?: number;
  /** Milliseconds after which an open circuit auto-resets (default: 60_000) */
  resetAfterMs?: number;
  /** Called when the circuit trips */
  onTripped?: (consecutiveFailures: number) => void;
  /** Optional label for debug logs */
  label?: string;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerInstance {
  /** Execute fn through the circuit breaker */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  /** Current state */
  readonly state: CircuitState;
  /** Force reset (for testing / manual recovery) */
  reset(): void;
}

/**
 * Create a stateful circuit breaker instance.
 * Reuse the same instance across calls to share failure state.
 */
export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreakerInstance {
  const maxFailures = options.maxFailures ?? 3;
  const resetAfterMs = options.resetAfterMs ?? 60_000;
  const onTripped = options.onTripped;
  const label = options.label ?? 'CircuitBreaker';

  let consecutiveFailures = 0;
  let trippedAt: Date | null = null;
  let _state: CircuitState = 'CLOSED';

  function getState(): CircuitState {
    if (_state === 'OPEN' && trippedAt) {
      const elapsed = Date.now() - trippedAt.getTime();
      if (elapsed >= resetAfterMs) {
        _state = 'HALF_OPEN';
        consecutiveFailures = 0;
        trippedAt = null;
        console.debug(`[${label}] Auto-reset after ${elapsed}ms — entering HALF_OPEN`);
      }
    }
    return _state;
  }

  async function execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = getState();

    if (currentState === 'OPEN') {
      throw new CircuitBreakerTrippedError(consecutiveFailures, trippedAt!);
    }

    try {
      const result = await fn();
      // Success: reset failure count and close circuit
      if (consecutiveFailures > 0 || _state === 'HALF_OPEN') {
        console.debug(`[${label}] Success — resetting failure count (was ${consecutiveFailures})`);
      }
      consecutiveFailures = 0;
      _state = 'CLOSED';
      return result;
    } catch (err) {
      // Don't count already-tripped errors against the new counter
      if (err instanceof CircuitBreakerTrippedError) throw err;

      consecutiveFailures++;
      console.debug(`[${label}] Failure ${consecutiveFailures}/${maxFailures}:`, (err as Error)?.message);

      if (consecutiveFailures >= maxFailures) {
        _state = 'OPEN';
        trippedAt = new Date();
        onTripped?.(consecutiveFailures);
        console.error(
          `[${label}] TRIPPED after ${consecutiveFailures} consecutive failures. ` +
            `Will auto-reset in ${resetAfterMs}ms.`
        );
        throw new CircuitBreakerTrippedError(consecutiveFailures, trippedAt);
      }

      throw err;
    }
  }

  function reset() {
    consecutiveFailures = 0;
    trippedAt = null;
    _state = 'CLOSED';
    console.debug(`[${label}] Manually reset`);
  }

  return {
    execute,
    get state() {
      return getState();
    },
    reset,
  };
}

/**
 * One-shot wrapper — creates a new circuit breaker per call.
 * Useful for ad-hoc protection, but prefer `createCircuitBreaker()` for
 * shared state across repeated calls to the same endpoint.
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  const cb = createCircuitBreaker(options);
  return cb.execute(fn);
}

export type RateLimiter = {
  isBlocked(key: string, now: Date): boolean;
  recordFailure(key: string, now: Date): void;
  reset(key: string): void;
  /** Undo the one attempt counted beforehand (on success) */
  forgive(key: string): void;
};

/** Kept in memory since this is a PoC (not shared across processes) */
export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
  const failures = new Map<string, number[]>();
  const recent = (key: string, now: Date) => (failures.get(key) ?? []).filter((t) => now.getTime() - t < opts.windowMs);

  return {
    isBlocked(key, now) {
      return recent(key, now).length >= opts.max;
    },
    recordFailure(key, now) {
      failures.set(key, [...recent(key, now), now.getTime()]);
    },
    reset(key) {
      failures.delete(key);
    },
    forgive(key) {
      failures.get(key)?.pop();
    },
  };
}

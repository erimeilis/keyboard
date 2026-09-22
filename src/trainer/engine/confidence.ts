import type { KeyStat } from '../types';

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Accuracy over the recent window when one exists, else the lifetime totals.
 *
 * Lifetime accuracy made the stage gates recede as a learner practised: against the
 * 98% bar, every past error on a key demanded another 50 clean attempts, so 20 early
 * mistakes cost 1,000. A window lets sustained improvement actually clear the gate,
 * and matches how latencies are already bounded (LATENCY_WINDOW).
 */
export function accuracyFor(stat: KeyStat): number {
  const recent = stat.recent;
  if (recent && recent.length > 0) {
    return recent.filter(Boolean).length / recent.length;
  }
  if (stat.attempts === 0) return 0;
  return Math.max(0, 1 - stat.errors / stat.attempts);
}

export function confidenceFor(stat: KeyStat, targetMs = 250): number {
  if (stat.attempts === 0) return 0;
  const accuracy = accuracyFor(stat);
  const med = median(stat.latencies);
  const speed = med === 0 ? 1 : Math.min(1, targetMs / med);
  return Math.max(0, Math.min(1, 0.6 * accuracy + 0.4 * speed));
}

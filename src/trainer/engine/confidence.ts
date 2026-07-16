import type { KeyStat } from '../types';

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function accuracyFor(stat: KeyStat): number {
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

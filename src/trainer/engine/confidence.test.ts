import { describe, it, expect } from 'vitest';
import { median, accuracyFor, confidenceFor } from './confidence';
import type { KeyStat } from '../types';

const stat = (o: Partial<KeyStat>): KeyStat => ({ code: 'KeyF', attempts: 0, errors: 0, latencies: [], ...o });

describe('confidence', () => {
  it('median handles odd/even', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 200, 300, 400])).toBe(250);
    expect(median([])).toBe(0);
  });
  it('accuracy is 1 - errors/attempts', () => {
    expect(accuracyFor(stat({ attempts: 10, errors: 1 }))).toBeCloseTo(0.9);
    expect(accuracyFor(stat({ attempts: 0 }))).toBe(0);
  });
  it('no attempts => confidence 0', () => {
    expect(confidenceFor(stat({}))).toBe(0);
  });
  it('perfect accuracy at/under target speed => confidence 1', () => {
    expect(confidenceFor(stat({ attempts: 20, errors: 0, latencies: [200, 220, 180] }), 250)).toBeCloseTo(1, 2);
  });
  it('errors and slowness reduce confidence', () => {
    const c = confidenceFor(stat({ attempts: 20, errors: 4, latencies: [500, 520] }), 250);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(0.7);
  });

  describe('recent-window accuracy', () => {
    // Lifetime accuracy made every stage gate recede as a learner practised: at a 98%
    // bar, 20 old errors on a key demanded 1,000 attempts to clear. Accuracy is judged
    // over a window of recent attempts instead, the way latencies already are.
    const recent = (o: Partial<KeyStat>): KeyStat => stat(o);

    it('uses the recent window when one is present, not the lifetime totals', () => {
      // 20 lifetime errors, but the last attempts were all clean.
      const s = recent({ attempts: 400, errors: 20, recent: Array(50).fill(true) });
      expect(accuracyFor(s)).toBe(1);
    });

    it('still reflects recent mistakes', () => {
      const s = recent({ attempts: 400, errors: 20, recent: [...Array(48).fill(true), false, false] });
      expect(accuracyFor(s)).toBeCloseTo(0.96);
    });

    it('falls back to lifetime totals when no window has been recorded yet', () => {
      // Stats persisted before the window existed must keep working.
      expect(accuracyFor(recent({ attempts: 10, errors: 1 }))).toBeCloseTo(0.9);
    });

    it('lets a learner recover from a bad start', () => {
      // The case that motivated this: early fumbling then sustained clean practice.
      const s = recent({ attempts: 120, errors: 18, recent: Array(50).fill(true) });
      expect(accuracyFor(s)).toBeGreaterThanOrEqual(0.98);
    });
  });
});

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
});

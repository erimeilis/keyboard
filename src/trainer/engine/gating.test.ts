import { describe, it, expect } from 'vitest';
import { canAdvance, GATE } from './gating';
import type { KeyStat } from '../types';

const good = (code: string): KeyStat => ({ code, attempts: 50, errors: 0, latencies: [180, 200] });
const weak = (code: string): KeyStat => ({ code, attempts: 50, errors: 10, latencies: [600] });

describe('gating', () => {
  it('advances when all stage-0 keys are mastered', () => {
    const stats = { KeyF: good('KeyF'), KeyJ: good('KeyJ'), Space: good('Space') };
    expect(canAdvance(0, stats)).toBe(true);
  });
  it('blocks when any stage key is weak', () => {
    const stats = { KeyF: good('KeyF'), KeyJ: weak('KeyJ'), Space: good('Space') };
    expect(canAdvance(0, stats)).toBe(false);
  });
  it('blocks when a stage key has no data', () => {
    expect(canAdvance(0, { KeyF: good('KeyF'), Space: good('Space') })).toBe(false);
  });
  it('gate is Hebrew-strict', () => {
    expect(GATE.minAccuracy).toBe(0.98);
  });
});

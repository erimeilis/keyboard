import { describe, it, expect } from 'vitest';
import { canAdvance, GATE } from './gating';
import type { KeyStat } from '../types';

const good = (code: string): KeyStat => ({ code, attempts: 50, errors: 0, latencies: [180, 200] });
const weak = (code: string): KeyStat => ({ code, attempts: 50, errors: 10, latencies: [600] });

describe('gating', () => {
  const homeRow = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'];
  const allGood = () => Object.fromEntries([...homeRow, 'Space'].map(c => [c, good(c)]));

  it('advances when all stage-0 keys are mastered', () => {
    expect(canAdvance(0, allGood())).toBe(true);
  });
  it('blocks when any stage key is weak', () => {
    expect(canAdvance(0, { ...allGood(), KeyJ: weak('KeyJ') })).toBe(false);
  });
  it('blocks when a stage key has no data', () => {
    const { KeyK: _omitted, ...missingOne } = allGood();
    expect(canAdvance(0, missingOne)).toBe(false);
  });
  it('gate is Hebrew-strict', () => {
    expect(GATE.minAccuracy).toBe(0.98);
  });
});

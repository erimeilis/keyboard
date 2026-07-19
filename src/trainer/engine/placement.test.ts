import { describe, it, expect } from 'vitest';
import { seedFromPlacement } from './placement';
import type { SessionResult } from '../types';

const r = (wpm: number, accuracy: number): SessionResult =>
  ({ wpm, accuracy, wholeWordAccuracy: accuracy, durationMs: 60000, typedChars: 100, perKey: {} });

describe('seedFromPlacement', () => {
  it('beginners start at stage 0', () => {
    expect(seedFromPlacement(r(8, 0.7)).currentStageIndex).toBe(0);
  });
  it('fast accurate typists skip ahead', () => {
    const seed = seedFromPlacement(r(60, 0.98));
    expect(seed.currentStageIndex).toBeGreaterThan(0);
    expect(seed.unlockedStageIndex).toBe(seed.currentStageIndex);
  });
  it('never seeds beyond the last stage', () => {
    const seed = seedFromPlacement(r(200, 1));
    expect(seed.currentStageIndex).toBeLessThanOrEqual(9); // STAGES has 10 entries (0..9)
  });
});

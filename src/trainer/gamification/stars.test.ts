// src/trainer/stars.test.ts
import { describe, it, expect } from 'vitest';
import { computeStars } from './stars';
import type { SessionResult } from '../types';
const r = (accuracy: number, wpm: number): SessionResult => ({ wpm, accuracy, wholeWordAccuracy: accuracy, durationMs: 60000, typedChars: 100, perKey: {} });

describe('computeStars', () => {
  it('1 star for completion', () => { expect(computeStars(r(0.5, 5))).toBe(1); });
  it('2 stars at 90% accuracy', () => { expect(computeStars(r(0.92, 5))).toBe(2); });
  it('3 stars at 98% accuracy and speed floor', () => { expect(computeStars(r(0.99, 30))).toBe(3); });
});

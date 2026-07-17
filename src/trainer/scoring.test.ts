import { describe, it, expect } from 'vitest';
import { computeSessionResult } from './scoring';
import type { SessionLog } from './types';

const log: SessionLog = {
  startTs: 0,
  endTs: 60000, // 1 minute
  words: [
    // word "שלום" (4 chars) all first-try
    [
      { code: 'KeyA', firstTryCorrect: true, latencyMs: 200 },
      { code: 'KeyK', firstTryCorrect: true, latencyMs: 200 },
      { code: 'KeyU', firstTryCorrect: true, latencyMs: 200 },
      { code: 'KeyO', firstTryCorrect: true, latencyMs: 200 },
    ],
    // word "לא" (2 chars) with one miss
    [
      { code: 'KeyK', firstTryCorrect: true, latencyMs: 200 },
      { code: 'KeyT', firstTryCorrect: false, latencyMs: 400 },
    ],
  ],
};

describe('computeSessionResult', () => {
  it('computes wpm from typed chars over minutes', () => {
    const r = computeSessionResult(log);
    // 6 chars / 5 = 1.2 words in 1 minute
    expect(r.wpm).toBeCloseTo(1.2, 1);
  });
  it('per-char accuracy counts first-try correctness', () => {
    expect(computeSessionResult(log).accuracy).toBeCloseTo(5 / 6, 3);
  });
  it('whole-word accuracy: a single miss fails the whole word (Hebrew reality)', () => {
    expect(computeSessionResult(log).wholeWordAccuracy).toBeCloseTo(0.5, 3);
  });
  it('aggregates per-key attempts/errors', () => {
    const r = computeSessionResult(log);
    expect(r.perKey['KeyK'].attempts).toBe(2);
    expect(r.perKey['KeyT'].errors).toBe(1);
  });
});

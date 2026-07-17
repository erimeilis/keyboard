import { describe, it, expect } from 'vitest';
import { ghostCharsAt, buildGhost, isFasterGhost } from './ghost';
import type { SessionLog } from './types';

describe('ghostCharsAt', () => {
  const ghost = [100, 250, 500]; // char 1 at 100ms, char 2 at 250ms, char 3 at 500ms
  it('counts characters completed by elapsed time', () => {
    expect(ghostCharsAt(ghost, 0)).toBe(0);
    expect(ghostCharsAt(ghost, 120)).toBe(1);
    expect(ghostCharsAt(ghost, 300)).toBe(2);
    expect(ghostCharsAt(ghost, 9999)).toBe(3);
  });
});

describe('buildGhost', () => {
  it('prefix-sums latencyMs across every position, in typed order', () => {
    const log: SessionLog = {
      startTs: 0,
      endTs: 170,
      words: [
        [
          { code: 'KeyA', firstTryCorrect: true, latencyMs: 100 },
          { code: 'KeyB', firstTryCorrect: true, latencyMs: 50 },
        ],
        [{ code: 'Space', firstTryCorrect: true, latencyMs: 20 }],
      ],
    };
    expect(buildGhost(log)).toEqual([100, 150, 170]);
  });

  it('returns an empty ghost for a session with no positions', () => {
    expect(buildGhost({ startTs: 0, endTs: 0, words: [] })).toEqual([]);
  });
});

describe('isFasterGhost', () => {
  it('beats an absent previous best', () => {
    expect(isFasterGhost([100], undefined)).toBe(true);
  });

  it('compares ms/char pace, independent of run length', () => {
    expect(isFasterGhost([50, 100], [200])).toBe(true); // 50ms/char vs 200ms/char
    expect(isFasterGhost([300], [50, 100])).toBe(false); // 300ms/char vs 50ms/char
  });

  it('never lets an empty run become (or replace) a best', () => {
    expect(isFasterGhost([], [100])).toBe(false);
    expect(isFasterGhost([], undefined)).toBe(false);
  });
});

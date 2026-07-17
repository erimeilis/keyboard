import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './storage';
import { loadSettings, saveSettings, mergeSessionStats, loadStats, saveStats } from './useTrainerState';
import type { SessionResult, KeyStat } from './types';

describe('trainer state', () => {
  it('persists settings with defaults', () => {
    const store = createMemoryStore();
    expect(loadSettings(store).guidanceMode).toBe('full');
    saveSettings(store, { ...loadSettings(store), guidanceMode: 'auto' });
    expect(loadSettings(store).guidanceMode).toBe('auto');
  });

  it('merges a session into cumulative per-key stats', () => {
    const prev: Record<string, KeyStat> = { KeyF: { code: 'KeyF', attempts: 5, errors: 1, latencies: [200] } };
    const result = { perKey: { KeyF: { attempts: 3, errors: 1, medianLatency: 240 } } } as unknown as SessionResult;
    const merged = mergeSessionStats(prev, result);
    expect(merged.KeyF.attempts).toBe(8);
    expect(merged.KeyF.errors).toBe(2);
    expect(merged.KeyF.latencies).toContain(240);
  });

  it('round-trips stats through the store', () => {
    const store = createMemoryStore();
    const stats = { KeyF: { code: 'KeyF', attempts: 1, errors: 0, latencies: [200] } };
    saveStats(store, stats);
    expect(loadStats(store).KeyF.attempts).toBe(1);
  });
});

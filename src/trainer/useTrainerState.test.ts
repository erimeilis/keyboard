import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './storage';
import {
  loadSettings, saveSettings, mergeSessionStats, loadStats, saveStats, loadHistory, saveHistory,
  loadStreak, saveStreak,
} from './useTrainerState';
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

  it('defaults to an empty history and round-trips through the store', () => {
    const store = createMemoryStore();
    expect(loadHistory(store)).toEqual([]);
    const history = [{ wpm: 40, accuracy: 0.9 }, { wpm: 45, accuracy: 0.95 }];
    saveHistory(store, history);
    expect(loadHistory(store)).toEqual(history);
  });

  it('defaults to a zeroed streak and round-trips through the store', () => {
    const store = createMemoryStore();
    expect(loadStreak(store)).toEqual({ lastPracticedISO: null, current: 0, longest: 0, todayMinutes: 0 });
    const streak = { lastPracticedISO: '2026-07-16', current: 2, longest: 3, todayMinutes: 5 };
    saveStreak(store, streak);
    expect(loadStreak(store)).toEqual(streak);
  });
});

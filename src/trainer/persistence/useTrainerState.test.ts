import { describe, it, expect } from 'vitest';
import { createMemoryStore } from './storage';
import {
  loadSettings, saveSettings, mergeSessionStats, loadStats, saveStats, loadHistory, saveHistory,
  loadStreak, saveStreak, loadGhosts, saveGhosts, loadProgress,
} from './useTrainerState';
import { LADDER_VERSION, STAGES } from '../engine/curriculum';
import type { SessionResult, KeyStat } from '../types';

describe('trainer state', () => {
  it('persists settings with defaults', () => {
    const store = createMemoryStore();
    expect(loadSettings(store).guidanceMode).toBe('full');
    saveSettings(store, { ...loadSettings(store), guidanceMode: 'auto' });
    expect(loadSettings(store).guidanceMode).toBe('auto');
  });

  it('merges a session into cumulative per-key stats', () => {
    const prev: Record<string, KeyStat> = { KeyF: { code: 'KeyF', attempts: 5, errors: 1, latencies: [200] } };
    const result = {
      perKey: { KeyF: { attempts: 3, errors: 1, medianLatency: 240, outcomes: [true, false, true] } },
    } as unknown as SessionResult;
    const merged = mergeSessionStats(prev, result);
    expect(merged.KeyF.attempts).toBe(8);
    expect(merged.KeyF.errors).toBe(2);
    expect(merged.KeyF.latencies).toContain(240);
    expect(merged.KeyF.recent).toEqual([true, false, true]);
  });

  it('bounds the accuracy window so old attempts stop counting', () => {
    const prev: Record<string, KeyStat> = {
      KeyF: { code: 'KeyF', attempts: 60, errors: 60, latencies: [], recent: Array(50).fill(false) },
    };
    const result = {
      perKey: { KeyF: { attempts: 50, errors: 0, medianLatency: 200, outcomes: Array(50).fill(true) } },
    } as unknown as SessionResult;
    const merged = mergeSessionStats(prev, result);
    expect(merged.KeyF.recent).toHaveLength(50);
    // Fifty clean attempts fully displace fifty old failures.
    expect(merged.KeyF.recent!.every(Boolean)).toBe(true);
    // Lifetime totals are untouched, so the stats view still shows the real history.
    expect(merged.KeyF.attempts).toBe(110);
    expect(merged.KeyF.errors).toBe(60);
  });

  it('merges stats and results that predate the window', () => {
    const prev: Record<string, KeyStat> = { KeyF: { code: 'KeyF', attempts: 5, errors: 1, latencies: [] } };
    const result = { perKey: { KeyF: { attempts: 2, errors: 0, medianLatency: 200 } } } as unknown as SessionResult;
    expect(() => mergeSessionStats(prev, result)).not.toThrow();
    expect(mergeSessionStats(prev, result).KeyF.attempts).toBe(7);
  });

  it('migrates progress saved against the previous ten-stage ladder', () => {
    const store = createMemoryStore();
    // No ladderVersion: this is how pre-migration progress looks on disk. Old stage 4
    // was the finished home row, which is the single home-row stage now — not
    // "Bottom outer", which is what a bare clamp would have produced.
    store.set('trainer.progress', { unlockedStageIndex: 4, currentStageIndex: 4, bestByStage: {} });
    const loaded = loadProgress(store);
    expect(loaded.currentStageIndex).toBe(0);
    expect(loaded.unlockedStageIndex).toBe(0);
    expect(loaded.ladderVersion).toBe(LADDER_VERSION);
  });

  it('leaves progress already on the current ladder untouched', () => {
    const store = createMemoryStore();
    store.set('trainer.progress', {
      unlockedStageIndex: 3, currentStageIndex: 3, bestByStage: {}, ladderVersion: LADDER_VERSION,
    });
    expect(loadProgress(store).currentStageIndex).toBe(3);
  });

  it('migrates the far end of the old ladder onto the last stage', () => {
    const store = createMemoryStore();
    store.set('trainer.progress', { unlockedStageIndex: 9, currentStageIndex: 9, bestByStage: {} });
    expect(loadProgress(store).currentStageIndex).toBe(STAGES.length - 1);
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

  it('defaults to no ghosts and round-trips per-stage ghosts through the store', () => {
    const store = createMemoryStore();
    expect(loadGhosts(store)).toEqual({});
    const ghosts = { 0: [100, 250, 500], 1: [80, 160] };
    saveGhosts(store, ghosts);
    expect(loadGhosts(store)).toEqual(ghosts);
  });
});

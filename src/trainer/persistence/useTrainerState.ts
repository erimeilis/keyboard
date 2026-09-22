import type { TrainerStore } from './storage';
import { STORAGE_KEYS } from './storage';
import type { Settings, Progress, KeyStat, SessionResult, KeyCode, StreakState } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { clampStageIndex, migrateStageIndex, LADDER_VERSION } from '../engine/curriculum';

const LATENCY_WINDOW = 20;
// Attempts per key that stage gating judges accuracy over. Long enough that the 98%
// bar still means sustained accuracy, short enough that a learner's early fumbling
// stops counting against them once they have moved past it.
const ACCURACY_WINDOW = 50;

export function loadSettings(store: TrainerStore): Settings {
  return store.get<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
}
export function saveSettings(store: TrainerStore, s: Settings): void {
  store.set(STORAGE_KEYS.settings, s);
}

export function loadProgress(store: TrainerStore): Progress {
  const fresh: Progress = {
    unlockedStageIndex: 0,
    currentStageIndex: 0,
    bestByStage: {},
    ladderVersion: LADDER_VERSION,
  };
  const saved = store.get<Progress>(STORAGE_KEYS.progress, fresh);

  // Unversioned progress was recorded against the ten-stage ladder, where the same
  // number meant a different stage. Translate rather than clamp, or a learner is
  // silently moved several stages ahead of what they earned.
  const stale = saved.ladderVersion !== LADDER_VERSION;
  const convert = stale ? migrateStageIndex : clampStageIndex;

  return {
    ...saved,
    currentStageIndex: convert(saved.currentStageIndex),
    unlockedStageIndex: convert(saved.unlockedStageIndex),
    // bestByStage is keyed by stage index too, but those are records of past runs
    // rather than position, so they are left alone instead of being renumbered.
    ladderVersion: LADDER_VERSION,
  };
}
export function saveProgress(store: TrainerStore, p: Progress): void {
  store.set(STORAGE_KEYS.progress, p);
}

export function loadStats(store: TrainerStore): Record<KeyCode, KeyStat> {
  return store.get<Record<KeyCode, KeyStat>>(STORAGE_KEYS.stats, {});
}
export function saveStats(store: TrainerStore, stats: Record<KeyCode, KeyStat>): void {
  store.set(STORAGE_KEYS.stats, stats);
}

const DEFAULT_STREAK: StreakState = { lastPracticedISO: null, current: 0, longest: 0, todayMinutes: 0 };

export function loadStreak(store: TrainerStore): StreakState {
  return store.get<StreakState>(STORAGE_KEYS.streak, DEFAULT_STREAK);
}
export function saveStreak(store: TrainerStore, s: StreakState): void {
  store.set(STORAGE_KEYS.streak, s);
}

export function loadGhosts(store: TrainerStore): Record<number, number[]> {
  return store.get<Record<number, number[]>>(STORAGE_KEYS.ghosts, {});
}
export function saveGhosts(store: TrainerStore, ghosts: Record<number, number[]>): void {
  store.set(STORAGE_KEYS.ghosts, ghosts);
}

export type HistoryEntry = { wpm: number; accuracy: number };

export function loadHistory(store: TrainerStore): HistoryEntry[] {
  return store.get<HistoryEntry[]>(STORAGE_KEYS.history, []);
}
export function saveHistory(store: TrainerStore, history: HistoryEntry[]): void {
  store.set(STORAGE_KEYS.history, history);
}

export function mergeSessionStats(
  prev: Record<KeyCode, KeyStat>,
  result: SessionResult,
): Record<KeyCode, KeyStat> {
  const next: Record<KeyCode, KeyStat> = { ...prev };
  for (const [code, s] of Object.entries(result.perKey)) {
    const cur = next[code] ?? { code, attempts: 0, errors: 0, latencies: [] };
    const latencies = [...cur.latencies, s.medianLatency].slice(-LATENCY_WINDOW);
    // Both sides are optional: stats persisted before the window existed have no
    // `recent`, and a result decoded from older storage has no `outcomes`.
    const recent = [...(cur.recent ?? []), ...(s.outcomes ?? [])].slice(-ACCURACY_WINDOW);
    next[code] = {
      code,
      // Lifetime totals still accumulate; only gating reads the window.
      attempts: cur.attempts + s.attempts,
      errors: cur.errors + s.errors,
      latencies,
      recent,
    };
  }
  return next;
}

import type { TrainerStore } from './storage';
import { STORAGE_KEYS } from './storage';
import type { Settings, Progress, KeyStat, SessionResult, KeyCode, StreakState } from './types';
import { DEFAULT_SETTINGS } from './types';

const LATENCY_WINDOW = 20;

export function loadSettings(store: TrainerStore): Settings {
  return store.get<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
}
export function saveSettings(store: TrainerStore, s: Settings): void {
  store.set(STORAGE_KEYS.settings, s);
}

export function loadProgress(store: TrainerStore): Progress {
  return store.get<Progress>(STORAGE_KEYS.progress, { unlockedStageIndex: 0, currentStageIndex: 0, bestByStage: {} });
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
    next[code] = { code, attempts: cur.attempts + s.attempts, errors: cur.errors + s.errors, latencies };
  }
  return next;
}

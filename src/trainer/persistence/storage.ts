export interface TrainerStore {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

export const STORAGE_KEYS = {
  settings: 'trainer.settings',
  progress: 'trainer.progress',
  stats: 'trainer.stats',
  streak: 'trainer.streak',
  ghosts: 'trainer.ghosts',
  history: 'trainer.history',
} as const;

export function createMemoryStore(): TrainerStore {
  const map = new Map<string, string>();
  return {
    get<T>(key: string, fallback: T): T {
      const raw = map.get(key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw) as T; } catch { return fallback; }
    },
    set<T>(key: string, value: T): void { map.set(key, JSON.stringify(value)); },
  };
}

// localStorage in the Tauri webview persists to the app's data dir. The interface
// lets us swap in @tauri-apps/plugin-store or fs later without touching consumers.
export function createLocalStorageStore(): TrainerStore {
  return {
    get<T>(key: string, fallback: T): T {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw) as T; } catch { return fallback; }
    },
    set<T>(key: string, value: T): void { localStorage.setItem(key, JSON.stringify(value)); },
  };
}

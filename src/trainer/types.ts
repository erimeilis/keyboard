export type KeyCode = string;      // physical key, e.g. "KeyA", "Space"
export type ComponentId = string;  // Keyboard/Key id, e.g. "ka", "space"
export type Letter = string;       // one Hebrew char, e.g. "ש", or " " for space

export type FingerId =
  | 'l-pinky' | 'l-ring' | 'l-middle' | 'l-index'
  | 'r-index' | 'r-middle' | 'r-ring' | 'r-pinky' | 'thumb';

export interface LayoutKey {
  code: KeyCode;
  componentId: ComponentId;
  letter: Letter;
  finger: FingerId;
  isSofit: boolean;
}

export interface KeyEvent { code: KeyCode; ts: number; down: boolean }

export interface KeySource {
  start(onKey: (e: KeyEvent) => void): void;
  stop(): void;
}

export type GuidanceMode = 'full' | 'auto' | 'dim' | 'hidden';
export type Strictness = 'stop' | 'markThrough';
export type CaptureSource = 'dom' | 'tap';

export interface KeyStat { code: KeyCode; attempts: number; errors: number; latencies: number[] }

export interface Settings {
  guidanceMode: GuidanceMode;
  strictness: Strictness;
  captureSource: CaptureSource;
  dailyGoalMinutes: number;
}

export interface Progress {
  unlockedStageIndex: number;
  currentStageIndex: number;
  bestByStage: Record<number, { wpm: number; accuracy: number }>;
}

export interface StreakState {
  lastPracticedISO: string | null;
  current: number;
  longest: number;
  todayMinutes: number;
}

export interface PosOutcome { code: KeyCode; firstTryCorrect: boolean; latencyMs: number }
export interface SessionLog { words: PosOutcome[][]; startTs: number; endTs: number }

export interface SessionResult {
  wpm: number;
  accuracy: number;            // per-char first-try, 0..1
  wholeWordAccuracy: number;   // words all-first-try / total, 0..1
  durationMs: number;
  typedChars: number;
  perKey: Record<KeyCode, { attempts: number; errors: number; medianLatency: number }>;
}

export interface TrainerKeyView {
  heat?: number;         // 0..1 confidence
  isNextTarget?: boolean;
  finger?: FingerId;
  dim?: boolean;
  hidden?: boolean;
  fault?: boolean;       // brief `key-fault` flash on a wrong keystroke (see useFaultFlash)
}
export type KeyboardView = Record<ComponentId, TrainerKeyView>;

export const DEFAULT_SETTINGS: Settings = {
  guidanceMode: 'full',
  strictness: 'stop',
  // Default to the global CGEventTap ('tap'): it captures keystrokes regardless of window
  // focus. DOM capture needs the (borderless) webview to hold keyboard first-responder, which
  // is unreliable — keystrokes wouldn't register. Users can switch to 'dom' in settings.
  captureSource: 'tap',
  dailyGoalMinutes: 10,
};

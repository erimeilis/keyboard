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

export interface KeyStat {
  code: KeyCode;
  /** Lifetime totals, kept for the stats view. */
  attempts: number;
  errors: number;
  latencies: number[];
  /**
   * First-try outcomes of the most recent attempts, newest last. Stage gating reads
   * this rather than the lifetime totals, so improvement counts and early fumbling
   * ages out. Absent on stats persisted before the window existed.
   */
  recent?: boolean[];
}

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
  /**
   * Which curriculum ladder these indices were recorded against. Absent on progress
   * saved before the ladder was reshaped, which is exactly how that case is detected
   * — a stage index alone cannot say which ladder it came from.
   */
  ladderVersion?: number;
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
  /** `outcomes` are this session's first-try results for the key, in order; they feed
   *  the rolling accuracy window in KeyStat.recent. */
  perKey: Record<KeyCode, { attempts: number; errors: number; medianLatency: number; outcomes: boolean[] }>;
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

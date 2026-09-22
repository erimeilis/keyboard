# Hebrew 10-Finger Typing Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Hebrew touch-typing Trainer mode to the existing overlay app, teaching 10-finger typing from beginner to fast with an adaptive weak-key engine, a per-key heatmap on the keyboard, switchable wean-off guidance, and a Hebrew-accurate error model.

**Architecture:** All pedagogy lives in the React/TypeScript frontend as small pure modules (layout data, adaptive engine, text selection, scoring, error classification) plus thin UI components, driven by keystrokes from a swappable `KeySource` (DOM adapter or Rust-tap adapter). The only backend change is a Tauri command to make the window focusable during training and an unthrottled per-key event for the tap adapter. Everything matches on **physical key codes** (`event.code` style, e.g. `KeyA`), so training is input-source-independent. State persists to local storage behind a small interface.

**Tech Stack:** Tauri v2.10, React 19, TypeScript 7.0, Vitest 4 (jsdom) + @testing-library/react, Rust (tauri, tauri-nspanel). No new runtime dependencies: persistence uses `localStorage` behind an interface; charts use inline SVG.

## Global Constraints

- **Platform:** macOS arm64 only (native keyboard APIs are macOS-specific). Guard native code with `#[cfg(target_os = "macos")]`.
- **Physical-keycode matching:** the trainer compares `KeyEvent.code` (physical, e.g. `KeyA`, `Space`) against the expected key for each Hebrew letter. Never depend on the produced character or the active OS input source.
- **Hebrew is RTL:** all target text and caret rendering use `dir="rtl"`.
- **Accuracy-first, Hebrew-strict:** stage-advance accuracy gate = **0.98**; confidence gate = **0.8**; default error handling = **stop-on-error** (block until corrected). These are constants, tunable in one place.
- **Reuse existing code:** physical→component-id mapping is `mapKeyCodeToComponentId` in `src/utils/keyMapping.ts`; the rendered keyboard is `src/components/Keyboard.tsx` using `src/components/Key.tsx`. Do not duplicate the key map.
- **No new deps** unless a task explicitly adds one (none do).
- **TDD, DRY, YAGNI, frequent commits.** Each task ends with a passing test run and a commit. Run tests with `npm test -- --run <path>`; type-check with `npx tsc --noEmit`.
- **Commit messages:** conventional style (`feat:`, `test:`, `refactor:`, `chore:`), matching recent history. Do not push or open PRs unless asked.

## File Structure

```
src/trainer/
  types.ts                     # all shared types (single source of truth)
  data/
    hebrewLayout.ts            # physical→Hebrew letter + finger map, sofit pairs, lookups
    words.he.ts                # curated common-word list (data)
    prose.he.ts                # public-domain prose/quotes with theme tags (data)
  keySource/
    DomKeySource.ts            # DOM keydown/keyup adapter
    TauriTapKeySource.ts       # Rust 'key-event' adapter
  engine/
    confidence.ts             # per-key confidence (pure)
    gating.ts                 # stage-advance gate (pure)
  curriculum.ts               # stage ladder + sofit/confusable groups (pure)
  textSelection.ts            # real-word selection + finger-drill fallback (pure)
  scoring.ts                  # WPM, per-char accuracy, whole-word accuracy (pure)
  errors.ts                   # Hebrew error classification (pure)
  keyboardView.ts             # stats+guidance -> per-key visual view (pure)
  ghost.ts                    # ghost-race position (pure)
  streak.ts                   # streak/goal update (pure)
  stars.ts                    # skill-star computation (pure)
  storage.ts                  # TrainerStore interface + memory & localStorage impls
  TrainerKeyboardContext.tsx  # React context carrying the keyboard view
  useTypingSession.ts         # session hook over a KeySource
  PracticePanel.tsx           # RTL target text + caret + live coloring
  PlacementTest.tsx           # placement flow + seeding
  SessionSummary.tsx          # end-of-session results
  StatsView.tsx               # progress graphs (inline SVG)
  CustomText.tsx              # paste-your-own-text flow
  Celebration.tsx             # celebratory + fault animation layer
  GhostBar.tsx                # ghost-race progress bar
  ThemeBackground.tsx         # text-theme-tied background
  TrainerMode.tsx             # top-level trainer container (assembles everything)

src/components/Key.tsx         # MODIFY: optional id + trainer visuals via context
src/components/Keyboard.tsx    # MODIFY: optional trainerView prop; ids on trainable keys
src/components/Keyboard.css    # MODIFY: heat/next/finger/dim/hidden/fault styles
src/App.tsx                    # MODIFY: Trainer toggle + mode switch
src-tauri/src/lib.rs           # MODIFY: set_trainer_mode command; register
src-tauri/src/keyboard_listener.rs  # MODIFY: emit unthrottled 'key-event'
```

---

# Phase 1 — Foundation

### Task 1: Shared types + Hebrew layout data

**Files:**
- Create: `src/trainer/types.ts`
- Create: `src/trainer/data/hebrewLayout.ts`
- Test: `src/trainer/data/hebrewLayout.test.ts`

**Interfaces:**
- Produces: all shared types (below); `HE_LAYOUT: LayoutKey[]`, lookups `byCode`, `byLetter`, `byComponentId`, `SOFIT_PAIRS`, and helpers `codeForLetter(letter): KeyCode | null`, `letterForCode(code): Letter | null`.

- [ ] **Step 1: Write `types.ts`** (no test needed — types only; verified by `tsc` in later tasks)

```ts
// src/trainer/types.ts
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
}
export type KeyboardView = Record<ComponentId, TrainerKeyView>;

export const DEFAULT_SETTINGS: Settings = {
  guidanceMode: 'full',
  strictness: 'stop',
  captureSource: 'dom',
  dailyGoalMinutes: 10,
};
```

- [ ] **Step 2: Write the failing test** `src/trainer/data/hebrewLayout.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { HE_LAYOUT, byCode, byLetter, SOFIT_PAIRS, codeForLetter, letterForCode } from './hebrewLayout';

describe('hebrewLayout', () => {
  it('maps home-row physical keys to the Israeli Hebrew letters', () => {
    expect(byCode['KeyA'].letter).toBe('ש');
    expect(byCode['KeyK'].letter).toBe('ל');
    expect(byCode['KeyT'].letter).toBe('א');
  });

  it('assigns standard touch-typing fingers', () => {
    expect(byCode['KeyA'].finger).toBe('l-pinky');
    expect(byCode['KeyF'].finger).toBe('l-index');
    expect(byCode['KeyJ'].finger).toBe('r-index');
    expect(byCode['Space'].finger).toBe('thumb');
  });

  it('marks the five sofit letters and pairs them with their regular form', () => {
    expect(byLetter['ם'].isSofit).toBe(true);
    expect(byLetter['מ'].isSofit).toBe(false);
    expect(SOFIT_PAIRS).toContainEqual({ sofit: 'ם', regular: 'מ' });
    expect(SOFIT_PAIRS).toHaveLength(5);
  });

  it('round-trips letter<->code for a real word (שלום)', () => {
    expect(codeForLetter('ש')).toBe('KeyA');
    expect(codeForLetter('ל')).toBe('KeyK');
    expect(codeForLetter('ו')).toBe('KeyU');
    expect(codeForLetter('ם')).toBe('KeyO');
    expect(letterForCode('KeyA')).toBe('ש');
  });

  it('every componentId matches keyMapping for its code', () => {
    // sanity: componentIds line up with the existing keyboard component ids
    expect(byCode['KeyA'].componentId).toBe('ka');
    expect(byCode['Space'].componentId).toBe('space');
  });
});
```

- [ ] **Step 3: Run it, expect FAIL** — `npm test -- --run src/trainer/data/hebrewLayout.test.ts` → fails (module missing).

- [ ] **Step 4: Write `hebrewLayout.ts`**

```ts
// src/trainer/data/hebrewLayout.ts
import type { KeyCode, ComponentId, Letter, LayoutKey } from '../types';

// Israeli standard layout. Letters read from the existing Keyboard.tsx secondary
// labels; fingers are the standard touch-typing columns; componentIds match keyMapping.ts.
export const HE_LAYOUT: LayoutKey[] = [
  // home row
  { code: 'KeyA', componentId: 'ka', letter: 'ש', finger: 'l-pinky',  isSofit: false },
  { code: 'KeyS', componentId: 'ks', letter: 'ד', finger: 'l-ring',   isSofit: false },
  { code: 'KeyD', componentId: 'kd', letter: 'ג', finger: 'l-middle', isSofit: false },
  { code: 'KeyF', componentId: 'kf', letter: 'כ', finger: 'l-index',  isSofit: false },
  { code: 'KeyG', componentId: 'kg', letter: 'ע', finger: 'l-index',  isSofit: false },
  { code: 'KeyH', componentId: 'kh', letter: 'י', finger: 'r-index',  isSofit: false },
  { code: 'KeyJ', componentId: 'kj', letter: 'ח', finger: 'r-index',  isSofit: false },
  { code: 'KeyK', componentId: 'kk', letter: 'ל', finger: 'r-middle', isSofit: false },
  { code: 'KeyL', componentId: 'kl', letter: 'ך', finger: 'r-ring',   isSofit: true  },
  { code: 'Semicolon', componentId: 'semi', letter: 'ף', finger: 'r-pinky', isSofit: true },
  // top row
  { code: 'KeyE', componentId: 'ke', letter: 'ק', finger: 'l-middle', isSofit: false },
  { code: 'KeyR', componentId: 'kr', letter: 'ר', finger: 'l-index',  isSofit: false },
  { code: 'KeyT', componentId: 'kt', letter: 'א', finger: 'l-index',  isSofit: false },
  { code: 'KeyY', componentId: 'ky', letter: 'ט', finger: 'r-index',  isSofit: false },
  { code: 'KeyU', componentId: 'ku', letter: 'ו', finger: 'r-index',  isSofit: false },
  { code: 'KeyI', componentId: 'ki', letter: 'ן', finger: 'r-middle', isSofit: true  },
  { code: 'KeyO', componentId: 'ko', letter: 'ם', finger: 'r-ring',   isSofit: true  },
  { code: 'KeyP', componentId: 'kp', letter: 'פ', finger: 'r-pinky',  isSofit: false },
  // bottom row
  { code: 'KeyZ', componentId: 'kz', letter: 'ז', finger: 'l-pinky',  isSofit: false },
  { code: 'KeyX', componentId: 'kx', letter: 'ס', finger: 'l-ring',   isSofit: false },
  { code: 'KeyC', componentId: 'kc', letter: 'ב', finger: 'l-middle', isSofit: false },
  { code: 'KeyV', componentId: 'kv', letter: 'ה', finger: 'l-index',  isSofit: false },
  { code: 'KeyB', componentId: 'kb', letter: 'נ', finger: 'l-index',  isSofit: false },
  { code: 'KeyN', componentId: 'kn', letter: 'מ', finger: 'r-index',  isSofit: false },
  { code: 'KeyM', componentId: 'km', letter: 'צ', finger: 'r-index',  isSofit: false },
  { code: 'Comma', componentId: 'comma', letter: 'ת', finger: 'r-middle', isSofit: false },
  { code: 'Period', componentId: 'dot', letter: 'ץ', finger: 'r-ring',  isSofit: true  },
  // space
  { code: 'Space', componentId: 'space', letter: ' ', finger: 'thumb', isSofit: false },
];

export const byCode: Record<KeyCode, LayoutKey> = Object.fromEntries(HE_LAYOUT.map(k => [k.code, k]));
export const byLetter: Record<Letter, LayoutKey> = Object.fromEntries(HE_LAYOUT.map(k => [k.letter, k]));
export const byComponentId: Record<ComponentId, LayoutKey> = Object.fromEntries(HE_LAYOUT.map(k => [k.componentId, k]));

export const SOFIT_PAIRS: Array<{ sofit: Letter; regular: Letter }> = [
  { sofit: 'ך', regular: 'כ' },
  { sofit: 'ם', regular: 'מ' },
  { sofit: 'ן', regular: 'נ' },
  { sofit: 'ף', regular: 'פ' },
  { sofit: 'ץ', regular: 'צ' },
];

export function codeForLetter(letter: Letter): KeyCode | null {
  return byLetter[letter]?.code ?? null;
}
export function letterForCode(code: KeyCode): Letter | null {
  return byCode[code]?.letter ?? null;
}
```

- [ ] **Step 5: Run it, expect PASS.** Then `npx tsc --noEmit` passes.

- [ ] **Step 6: Commit**

```bash
git add src/trainer/types.ts src/trainer/data/hebrewLayout.ts src/trainer/data/hebrewLayout.test.ts
git commit -m "feat(trainer): add shared types and Hebrew layout data"
```

---

### Task 2: `DomKeySource`

**Files:**
- Create: `src/trainer/keySource/DomKeySource.ts`
- Test: `src/trainer/keySource/DomKeySource.test.ts`

**Interfaces:**
- Consumes: `KeySource`, `KeyEvent` from `../types`.
- Produces: `class DomKeySource implements KeySource` with `constructor(target?: EventTarget)` (defaults to `window`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { DomKeySource } from './DomKeySource';
import type { KeyEvent } from '../types';

describe('DomKeySource', () => {
  it('emits down then up with the physical code', () => {
    const target = new EventTarget();
    const src = new DomKeySource(target);
    const events: KeyEvent[] = [];
    src.start(e => events.push(e));

    target.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyA', timeStamp: 100 }));
    target.dispatchEvent(Object.assign(new Event('keyup'),   { code: 'KeyA', timeStamp: 150 }));

    expect(events).toEqual([
      { code: 'KeyA', ts: 100, down: true },
      { code: 'KeyA', ts: 150, down: false },
    ]);
  });

  it('stops listening after stop()', () => {
    const target = new EventTarget();
    const src = new DomKeySource(target);
    const events: KeyEvent[] = [];
    src.start(e => events.push(e));
    src.stop();
    target.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyA', timeStamp: 1 }));
    expect(events).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/keySource/DomKeySource.ts
import type { KeySource, KeyEvent } from '../types';

export class DomKeySource implements KeySource {
  private target: EventTarget;
  private onKey: ((e: KeyEvent) => void) | null = null;
  private downHandler = (ev: Event) => this.emit(ev as KeyboardEvent, true);
  private upHandler = (ev: Event) => this.emit(ev as KeyboardEvent, false);

  constructor(target: EventTarget = window) {
    this.target = target;
  }

  start(onKey: (e: KeyEvent) => void): void {
    this.onKey = onKey;
    this.target.addEventListener('keydown', this.downHandler);
    this.target.addEventListener('keyup', this.upHandler);
  }

  stop(): void {
    this.target.removeEventListener('keydown', this.downHandler);
    this.target.removeEventListener('keyup', this.upHandler);
    this.onKey = null;
  }

  private emit(ev: KeyboardEvent, down: boolean): void {
    if (!this.onKey) return;
    this.onKey({ code: ev.code, ts: ev.timeStamp, down });
  }
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): add DomKeySource keystroke adapter"`

---

### Task 3: `TauriTapKeySource`

**Files:**
- Create: `src/trainer/keySource/TauriTapKeySource.ts`
- Test: `src/trainer/keySource/TauriTapKeySource.test.ts`

**Interfaces:**
- Consumes: `KeySource`, `KeyEvent`; Tauri `listen` from `@tauri-apps/api/event`.
- Produces: `class TauriTapKeySource implements KeySource` with `constructor(opts?: { now?: () => number })` (test injects `now`). Stamps `ts` on arrival because the Rust event carries only `{ code, down }`.

- [ ] **Step 1: Write the failing test** (mock the Tauri event module)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { KeyEvent } from '../types';

let handler: ((e: { payload: { code: string; down: boolean } }) => void) | null = null;
const unlisten = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_name: string, cb: any) => { handler = cb; return unlisten; }),
}));

import { TauriTapKeySource } from './TauriTapKeySource';

describe('TauriTapKeySource', () => {
  beforeEach(() => { handler = null; unlisten.mockClear(); });

  it('emits KeyEvents stamped with the injected clock', async () => {
    let t = 1000;
    const src = new TauriTapKeySource({ now: () => t });
    const events: KeyEvent[] = [];
    src.start(e => events.push(e));
    await Promise.resolve(); // let listen() resolve

    handler!({ payload: { code: 'KeyA', down: true } });
    t = 1080;
    handler!({ payload: { code: 'KeyA', down: false } });

    expect(events).toEqual([
      { code: 'KeyA', ts: 1000, down: true },
      { code: 'KeyA', ts: 1080, down: false },
    ]);
  });

  it('unlistens on stop()', async () => {
    const src = new TauriTapKeySource();
    src.start(() => {});
    await Promise.resolve();
    src.stop();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/keySource/TauriTapKeySource.ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { KeySource, KeyEvent } from '../types';

export class TauriTapKeySource implements KeySource {
  private now: () => number;
  private unlisten: UnlistenFn | null = null;
  private stopped = false;

  constructor(opts: { now?: () => number } = {}) {
    this.now = opts.now ?? (() => performance.now());
  }

  start(onKey: (e: KeyEvent) => void): void {
    this.stopped = false;
    listen<{ code: string; down: boolean }>('key-event', (event) => {
      onKey({ code: event.payload.code, ts: this.now(), down: event.payload.down });
    }).then((un) => {
      if (this.stopped) { un(); return; }
      this.unlisten = un;
    });
  }

  stop(): void {
    this.stopped = true;
    this.unlisten?.();
    this.unlisten = null;
  }
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): add TauriTapKeySource keystroke adapter"`

---

### Task 4: `TrainerStore` (persistence)

**Files:**
- Create: `src/trainer/storage.ts`
- Test: `src/trainer/storage.test.ts`

**Interfaces:**
- Produces: `interface TrainerStore { get<T>(key: string, fallback: T): T; set<T>(key: string, value: T): void }`; `createMemoryStore(): TrainerStore`; `createLocalStorageStore(): TrainerStore`; `STORAGE_KEYS` constants.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createMemoryStore, createLocalStorageStore, STORAGE_KEYS } from './storage';

describe('TrainerStore', () => {
  it('memory store round-trips values', () => {
    const s = createMemoryStore();
    expect(s.get(STORAGE_KEYS.settings, { a: 1 })).toEqual({ a: 1 }); // fallback
    s.set(STORAGE_KEYS.settings, { a: 2 });
    expect(s.get(STORAGE_KEYS.settings, { a: 1 })).toEqual({ a: 2 });
  });

  it('localStorage store persists JSON and returns fallback on missing/corrupt', () => {
    const s = createLocalStorageStore();
    expect(s.get('missing', 42)).toBe(42);
    s.set('k', { x: 'שלום' });
    expect(s.get('k', null)).toEqual({ x: 'שלום' });
    localStorage.setItem('bad', '{not json');
    expect(s.get('bad', 'fallback')).toBe('fallback');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/storage.ts
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
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): add TrainerStore persistence interface + adapters"`

---

### Task 5: Native — focusable window command + unthrottled key event

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/keyboard_listener.rs`

**Interfaces:**
- Produces (frontend-visible): Tauri command `set_trainer_mode(active: bool)`; Tauri event `"key-event"` with payload `{ code: string, down: bool }` emitted on every physical key press/release (unthrottled), consumed by `TauriTapKeySource`.

> Native focus behavior is empirical. `DomKeySource` needs the window focusable; `TauriTapKeySource` does not (global tap). This task enables the focusable path and is the reason both capture sources exist — if focus proves unreliable, the tap source is the fallback.

- [ ] **Step 1: Add the unthrottled event in `keyboard_listener.rs`.** In `start_listener`, inside the `while let Ok((keycode, is_press)) = rx.recv()` loop, right after `let code = keycode_to_string(keycode);`, add an unthrottled emit (independent of the 16ms `keyboard-state` throttle):

```rust
// Unthrottled per-key event for the trainer's Tauri-tap capture source.
#[derive(Clone, serde::Serialize)]
struct KeyEventPayload { code: String, down: bool }
let _ = app_clone.emit("key-event", KeyEventPayload { code: code.clone(), down: is_press });
```

(Place the `#[derive]` struct at module top-level instead if the linter prefers; keep the `emit` in the loop.)

- [ ] **Step 2: Add the command in `lib.rs`.** Add near `get_active_keyboard_layout`:

```rust
#[tauri::command]
fn set_trainer_mode(app: tauri::AppHandle, active: bool) {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
            if active {
                // Become a regular, focusable app so the webview receives key events
                // and keystrokes don't leak to background apps.
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                let _ = window.set_focus();
            } else {
                // Revert to the non-activating overlay.
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    { let _ = (app, active); }
}
```

- [ ] **Step 3: Register the command.** In `lib.rs`, extend the handler:

```rust
.invoke_handler(tauri::generate_handler![
    get_active_keyboard_layout,
    key_simulator::simulate_key,
    set_trainer_mode
])
```

- [ ] **Step 4: Build & manual-verify (native — no unit test).**

Run: `npm run tauri:dev`
Expected: app compiles. Temporarily add a dev button that calls `invoke('set_trainer_mode', { active: true })`; confirm (a) the window can take focus and typing lands in a focused DOM `<input>` (not a background app), and (b) `listen('key-event', ...)` fires on every keypress. Then `invoke('set_trainer_mode', { active: false })` restores the non-activating overlay (typing again passes through / does not focus). Remove the dev button.

- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): add set_trainer_mode command and unthrottled key-event"`

---

### Task 6: `Key` trainer visuals + `TrainerKeyboardContext`

**Files:**
- Create: `src/trainer/TrainerKeyboardContext.tsx`
- Modify: `src/components/Key.tsx`
- Modify: `src/components/Keyboard.css`
- Test: `src/trainer/TrainerKeyboardContext.test.tsx`

**Interfaces:**
- Produces: `TrainerKeyboardContext` (React context of `KeyboardView | null`), `TrainerKeyboardProvider`, `useTrainerKeyView(id?: ComponentId): TrainerKeyView | null`. `Key` gains optional `id?: ComponentId` on `BaseKeyProps` and renders trainer classes/styles when a view is present.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Key } from '../components/Key';
import { TrainerKeyboardProvider } from './TrainerKeyboardContext';

describe('Key trainer visuals', () => {
  it('adds next-target and finger classes from the context view', () => {
    const view = { ka: { isNextTarget: true, finger: 'l-pinky' as const, heat: 0.5 } };
    const { container } = render(
      <TrainerKeyboardProvider value={view}>
        <Key variant="dualPos" primary="A" secondary="ש" id="ka" />
      </TrainerKeyboardProvider>
    );
    const el = container.querySelector('.key')!;
    expect(el.className).toContain('key-next-target');
    expect(el.className).toContain('key-finger-l-pinky');
  });

  it('hides the key legend when view.hidden is set', () => {
    const view = { ka: { hidden: true } };
    const { container } = render(
      <TrainerKeyboardProvider value={view}>
        <Key variant="dualPos" primary="A" secondary="ש" id="ka" />
      </TrainerKeyboardProvider>
    );
    expect(container.querySelector('.key')!.className).toContain('key-hidden');
  });

  it('renders normally with no provider', () => {
    const { container } = render(<Key variant="single" label="esc" />);
    expect(container.querySelector('.key')!.className).not.toContain('key-next-target');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Create the context**

```tsx
// src/trainer/TrainerKeyboardContext.tsx
import React, { createContext, useContext } from 'react';
import type { KeyboardView, TrainerKeyView, ComponentId } from './types';

const Ctx = createContext<KeyboardView | null>(null);

export const TrainerKeyboardProvider: React.FC<{ value: KeyboardView | null; children: React.ReactNode }> =
  ({ value, children }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

export function useTrainerKeyView(id?: ComponentId): TrainerKeyView | null {
  const view = useContext(Ctx);
  if (!view || !id) return null;
  return view[id] ?? null;
}
```

- [ ] **Step 4: Modify `Key.tsx`.** (a) add `id?: string` to `BaseKeyProps`; (b) import the hook; (c) compute trainer classes/style; (d) merge into the root element.

Add to `BaseKeyProps`:
```ts
  id?: string;
```
Add import at top:
```ts
import { useTrainerKeyView } from '../trainer/TrainerKeyboardContext';
```
Inside `Key`, after destructuring props, add:
```ts
  const trainerView = useTrainerKeyView(props.id);
  const trainerClass = trainerView
    ? [
        trainerView.isNextTarget ? 'key-next-target' : '',
        trainerView.finger ? `key-finger-${trainerView.finger}` : '',
        trainerView.dim ? 'key-dim' : '',
        trainerView.hidden ? 'key-hidden' : '',
      ].filter(Boolean).join(' ')
    : '';
  const trainerStyle = trainerView?.heat != null
    ? ({ ['--key-heat' as any]: String(trainerView.heat) })
    : {};
```
Change the root `<div>` to include the class and style:
```tsx
    <div
      className={`key ${getThemeClass()} key-variant-${props.variant} ${isPressed ? 'key-pressed' : ''} ${trainerClass} ${className}`}
      style={{ width: widthStyle, ...flexStyle, ...trainerStyle }}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
    >
```

- [ ] **Step 5: Add styles to `Keyboard.css`** (append):

```css
/* Trainer visuals */
.key-next-target { outline: 2px solid #4ade80; outline-offset: -2px; box-shadow: 0 0 10px rgba(74,222,128,0.7); }
.key-hidden .key-label-primary,
.key-hidden .key-label-secondary,
.key-hidden .key-label-single { visibility: hidden; }
.key-dim .key-label-primary,
.key-dim .key-label-secondary { opacity: 0.25; }
/* Heatmap: red (0) -> green (1) via --key-heat (0..1) */
.key[style*="--key-heat"] { background-image: linear-gradient(hsl(calc(var(--key-heat) * 120) 70% 45% / 0.55), hsl(calc(var(--key-heat) * 120) 70% 45% / 0.55)); }
/* Finger zones (subtle left border tint) */
.key-finger-l-pinky  { border-bottom: 3px solid #f87171; }
.key-finger-l-ring   { border-bottom: 3px solid #fb923c; }
.key-finger-l-middle { border-bottom: 3px solid #facc15; }
.key-finger-l-index  { border-bottom: 3px solid #4ade80; }
.key-finger-r-index  { border-bottom: 3px solid #22d3ee; }
.key-finger-r-middle { border-bottom: 3px solid #60a5fa; }
.key-finger-r-ring   { border-bottom: 3px solid #a78bfa; }
.key-finger-r-pinky  { border-bottom: 3px solid #f472b6; }
.key-finger-thumb    { border-bottom: 3px solid #94a3b8; }
/* Fault animation (Task 27) */
@keyframes key-fault { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
.key-fault { animation: key-fault 180ms ease-in-out; background-color: rgba(248,113,113,0.6) !important; }
```

- [ ] **Step 6: Run, expect PASS.** `npx tsc --noEmit` passes.
- [ ] **Step 7: Commit** — `git commit -am "feat(trainer): Key trainer visuals via TrainerKeyboardContext"`

---

### Task 7: `Keyboard` accepts a trainer view + ids on trainable keys

**Files:**
- Modify: `src/components/Keyboard.tsx`
- Test: `src/components/Keyboard.trainer.test.tsx`

**Interfaces:**
- Consumes: `TrainerKeyboardProvider`, `KeyboardView`.
- Produces: `Keyboard` gains an optional prop `trainerView?: KeyboardView`. When provided, it wraps its output in `TrainerKeyboardProvider`. Every trainable key carries `id="<componentId>"` (the same string already used in its `isKeyPressed('...')` call).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Keyboard } from './Keyboard';

describe('Keyboard trainer view', () => {
  it('applies the next-target class to the mapped key', () => {
    const { container } = render(<Keyboard trainerView={{ ka: { isNextTarget: true } }} />);
    // The A/ש key must carry the highlight
    const highlighted = container.querySelector('.key-next-target');
    expect(highlighted).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (Keyboard has no `trainerView` prop; keys have no ids).

- [ ] **Step 3: Modify `Keyboard.tsx`.**
  1. Change the component signature to accept the prop:
     ```tsx
     import { TrainerKeyboardProvider } from '../trainer/TrainerKeyboardContext';
     import type { KeyboardView } from '../trainer/types';

     export const Keyboard: React.FC<{ trainerView?: KeyboardView }> = ({ trainerView }) => {
     ```
  2. Add `id="<componentId>"` to every Key that already has an `isPressed={isKeyPressed('X')}` prop, using the same string `X`. The complete set of ids to add (matching existing `isKeyPressed` calls): `esc, n1..n0, mn, eq, backspace, tab, kq, kw, ke, kr, kt, ky, ku, ki, ko, kp, lb, rb, bs, ka, ks, kd, kf, kg, kh, kj, kk, kl, semi, quot, enter, lshift, kz, kx, kc, kv, kb, kn, km, comma, dot, slash, rshift, space`. Example edits:
     ```tsx
     <Key variant="dualPos" primary="A" secondary="ש" id="ka" isPressed={isKeyPressed('ka')} onMouseClick={() => handleKeyClick('KeyA')} />
     <Key variant="single" label="" width="fill" id="space" isPressed={isKeyPressed('space')} onMouseClick={() => handleKeyClick('Space')} />
     ```
  3. Wrap the returned root in the provider:
     ```tsx
     return (
       <TrainerKeyboardProvider value={trainerView ?? null}>
         <div className="keyboard">
           {/* ...existing rows unchanged... */}
         </div>
       </TrainerKeyboardProvider>
     );
     ```

- [ ] **Step 4: Run, expect PASS.** Existing `Keyboard.test.tsx` still passes (prop is optional).
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): Keyboard accepts trainerView and tags trainable keys with ids"`

---

### Task 8: Trainer entry/exit shell (`TrainerMode` skeleton + App toggle)

**Files:**
- Create: `src/trainer/TrainerMode.tsx`
- Modify: `src/App.tsx`
- Test: `src/trainer/TrainerMode.test.tsx`

**Interfaces:**
- Consumes: `Keyboard`, `invoke('set_trainer_mode')`.
- Produces: `TrainerMode` component with prop `onExit: () => void`; it calls `set_trainer_mode(true)` on mount and `set_trainer_mode(false)` on unmount, renders the reused `<Keyboard>` and an (initially placeholder) panel. `App` renders a "Trainer" button that mounts `TrainerMode` and hides the overlay controls while active.

- [ ] **Step 1: Write the failing test** (mock invoke)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const invoke = vi.fn(async () => {});
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { TrainerMode } from './TrainerMode';

describe('TrainerMode', () => {
  it('enters trainer mode on mount and exits on unmount', () => {
    const onExit = vi.fn();
    const { unmount } = render(<TrainerMode onExit={onExit} />);
    expect(invoke).toHaveBeenCalledWith('set_trainer_mode', { active: true });
    unmount();
    expect(invoke).toHaveBeenCalledWith('set_trainer_mode', { active: false });
  });

  it('calls onExit when the Exit button is clicked', () => {
    const onExit = vi.fn();
    render(<TrainerMode onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    expect(onExit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `TrainerMode.tsx`** (skeleton; the session loop is wired in Task 21)

```tsx
// src/trainer/TrainerMode.tsx
import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Keyboard } from '../components/Keyboard';

export const TrainerMode: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  useEffect(() => {
    invoke('set_trainer_mode', { active: true }).catch(console.error);
    return () => { invoke('set_trainer_mode', { active: false }).catch(console.error); };
  }, []);

  return (
    <div className="trainer-mode">
      <div className="trainer-topbar">
        <button onClick={onExit}>Exit trainer</button>
      </div>
      <div className="trainer-panel">{/* PracticePanel mounts here in Task 21 */}</div>
      <Keyboard />
    </div>
  );
};
```

- [ ] **Step 4: Modify `App.tsx`.** Add trainer state and a toggle button in the control bar:
  ```tsx
  import { TrainerMode } from './trainer/TrainerMode';
  // ...inside App component state:
  const [isTraining, setIsTraining] = useState(false);
  // ...early return when training (before the collapsed/overlay returns):
  if (isTraining) {
    return <TrainerMode onExit={() => setIsTraining(false)} />;
  }
  // ...in the .window-controls div, add:
  <button className="control-btn trainer" onClick={() => setIsTraining(true)} title="Typing trainer">⌨</button>
  ```

- [ ] **Step 5: Run, expect PASS.** `npx tsc --noEmit` passes.
- [ ] **Step 6: Commit** — `git commit -am "feat(trainer): trainer entry/exit shell and App toggle"`

---

# Phase 2 — Pedagogy Core

### Task 9: Curriculum ladder

**Files:**
- Create: `src/trainer/curriculum.ts`
- Test: `src/trainer/curriculum.test.ts`

**Interfaces:**
- Produces: `interface Stage { index: number; name: string; newCodes: KeyCode[] }`; `STAGES: Stage[]`; `unlockedCodesForStage(index: number): Set<KeyCode>` (cumulative, includes `Space`); `CONFUSABLE_GROUPS: Letter[][]`; `SOFIT_STAGE_INDEX: number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { STAGES, unlockedCodesForStage, CONFUSABLE_GROUPS, SOFIT_STAGE_INDEX } from './curriculum';

describe('curriculum', () => {
  it('starts on the home-row index anchors + space', () => {
    expect(STAGES[0].newCodes).toEqual(['KeyF', 'KeyJ']);
    expect(unlockedCodesForStage(0).has('Space')).toBe(true);
  });
  it('accumulates unlocked codes across stages', () => {
    const s1 = unlockedCodesForStage(1);
    expect(s1.has('KeyF')).toBe(true); // from stage 0
    STAGES[1].newCodes.forEach(c => expect(s1.has(c)).toBe(true));
  });
  it('has a dedicated sofit stage covering the five finals', () => {
    const sofit = STAGES[SOFIT_STAGE_INDEX].newCodes;
    ['KeyL','KeyO','KeyI','Semicolon','Period'].forEach(c => expect(sofit).toContain(c));
  });
  it('defines confusable letter groups', () => {
    expect(CONFUSABLE_GROUPS).toContainEqual(['ד', 'ר']);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/curriculum.ts
import type { KeyCode, Letter } from './types';

export interface Stage { index: number; name: string; newCodes: KeyCode[] }

const STAGE_DEFS: Array<{ name: string; newCodes: KeyCode[] }> = [
  { name: 'Home anchors',   newCodes: ['KeyF', 'KeyJ'] },       // כ ח (F/J bumps)
  { name: 'Home index',     newCodes: ['KeyG', 'KeyH'] },       // ע י
  { name: 'Home middle',    newCodes: ['KeyD', 'KeyK'] },       // ג ל
  { name: 'Home ring',      newCodes: ['KeyS'] },               // ד
  { name: 'Home pinky',     newCodes: ['KeyA'] },               // ש  (full home row minus finals)
  { name: 'Top index',      newCodes: ['KeyR', 'KeyT', 'KeyU', 'KeyY'] }, // ר א ו ט
  { name: 'Top middle/ring',newCodes: ['KeyE', 'KeyP'] },       // ק פ
  { name: 'Bottom index',   newCodes: ['KeyV', 'KeyB', 'KeyN'] }, // ה נ מ
  { name: 'Bottom outer',   newCodes: ['KeyZ', 'KeyX', 'KeyC', 'KeyM', 'Comma'] }, // ז ס ב צ ת
  { name: 'Sofit finals',   newCodes: ['KeyL', 'KeyO', 'KeyI', 'Semicolon', 'Period'] }, // ך ם ן ף ץ
];

export const STAGES: Stage[] = STAGE_DEFS.map((s, i) => ({ index: i, ...s }));
export const SOFIT_STAGE_INDEX = STAGES.findIndex(s => s.name === 'Sofit finals');

export function unlockedCodesForStage(index: number): Set<KeyCode> {
  const set = new Set<KeyCode>(['Space']);
  for (let i = 0; i <= index && i < STAGES.length; i++) {
    STAGES[i].newCodes.forEach(c => set.add(c));
  }
  return set;
}

// Visually / positionally confusable Hebrew letters (meaning-changing if swapped).
export const CONFUSABLE_GROUPS: Letter[][] = [
  ['ד', 'ר'], ['כ', 'ב'], ['ה', 'ח', 'ת'], ['ט', 'ת'], ['ם', 'ס'], ['ן', 'ו'], ['ג', 'נ'],
];
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): Hebrew curriculum ladder with sofit and confusable groups"`

---

### Task 10: Confidence model

**Files:**
- Create: `src/trainer/engine/confidence.ts`
- Test: `src/trainer/engine/confidence.test.ts`

**Interfaces:**
- Produces: `median(nums: number[]): number`; `accuracyFor(stat: KeyStat): number`; `confidenceFor(stat: KeyStat, targetMs?: number): number` (0..1; 0 when no attempts; weights accuracy 0.6 / speed 0.4; `targetMs` default 250).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { median, accuracyFor, confidenceFor } from './confidence';
import type { KeyStat } from '../types';

const stat = (o: Partial<KeyStat>): KeyStat => ({ code: 'KeyF', attempts: 0, errors: 0, latencies: [], ...o });

describe('confidence', () => {
  it('median handles odd/even', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 200, 300, 400])).toBe(250);
    expect(median([])).toBe(0);
  });
  it('accuracy is 1 - errors/attempts', () => {
    expect(accuracyFor(stat({ attempts: 10, errors: 1 }))).toBeCloseTo(0.9);
    expect(accuracyFor(stat({ attempts: 0 }))).toBe(0);
  });
  it('no attempts => confidence 0', () => {
    expect(confidenceFor(stat({}))).toBe(0);
  });
  it('perfect accuracy at/under target speed => confidence 1', () => {
    expect(confidenceFor(stat({ attempts: 20, errors: 0, latencies: [200, 220, 180] }), 250)).toBeCloseTo(1, 2);
  });
  it('errors and slowness reduce confidence', () => {
    const c = confidenceFor(stat({ attempts: 20, errors: 4, latencies: [500, 520] }), 250);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(0.7);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/engine/confidence.ts
import type { KeyStat } from '../types';

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function accuracyFor(stat: KeyStat): number {
  if (stat.attempts === 0) return 0;
  return Math.max(0, 1 - stat.errors / stat.attempts);
}

export function confidenceFor(stat: KeyStat, targetMs = 250): number {
  if (stat.attempts === 0) return 0;
  const accuracy = accuracyFor(stat);
  const med = median(stat.latencies);
  const speed = med === 0 ? 1 : Math.min(1, targetMs / med);
  return Math.max(0, Math.min(1, 0.6 * accuracy + 0.4 * speed));
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): per-key confidence model"`

---

### Task 11: Stage-advance gating

**Files:**
- Create: `src/trainer/engine/gating.ts`
- Test: `src/trainer/engine/gating.test.ts`

**Interfaces:**
- Consumes: `accuracyFor`, `confidenceFor`, `KeyStat`, `Stage`, `unlockedCodesForStage`.
- Produces: `GATE = { minAccuracy: 0.98, minConfidence: 0.8 }`; `canAdvance(stageIndex: number, statsByCode: Record<KeyCode, KeyStat>, gate?): boolean` — true when every unlocked code in the stage meets both thresholds.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { canAdvance, GATE } from './gating';
import type { KeyStat } from '../types';

const good = (code: string): KeyStat => ({ code, attempts: 50, errors: 0, latencies: [180, 200] });
const weak = (code: string): KeyStat => ({ code, attempts: 50, errors: 10, latencies: [600] });

describe('gating', () => {
  it('advances when all stage-0 keys are mastered', () => {
    const stats = { KeyF: good('KeyF'), KeyJ: good('KeyJ'), Space: good('Space') };
    expect(canAdvance(0, stats)).toBe(true);
  });
  it('blocks when any stage key is weak', () => {
    const stats = { KeyF: good('KeyF'), KeyJ: weak('KeyJ'), Space: good('Space') };
    expect(canAdvance(0, stats)).toBe(false);
  });
  it('blocks when a stage key has no data', () => {
    expect(canAdvance(0, { KeyF: good('KeyF'), Space: good('Space') })).toBe(false);
  });
  it('gate is Hebrew-strict', () => {
    expect(GATE.minAccuracy).toBe(0.98);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/engine/gating.ts
import type { KeyCode, KeyStat } from '../types';
import { accuracyFor, confidenceFor } from './confidence';
import { unlockedCodesForStage } from '../curriculum';

export const GATE = { minAccuracy: 0.98, minConfidence: 0.8 };

export function canAdvance(
  stageIndex: number,
  statsByCode: Record<KeyCode, KeyStat>,
  gate = GATE,
): boolean {
  const codes = unlockedCodesForStage(stageIndex);
  for (const code of codes) {
    const stat = statsByCode[code];
    if (!stat || stat.attempts === 0) return false;
    if (accuracyFor(stat) < gate.minAccuracy) return false;
    if (confidenceFor(stat) < gate.minConfidence) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): accuracy-first stage gating"`

---

### Task 12: Text selection (real words + finger-drill fallback)

**Files:**
- Create: `src/trainer/data/words.he.ts` (data)
- Create: `src/trainer/textSelection.ts`
- Test: `src/trainer/textSelection.test.ts`

**Interfaces:**
- Consumes: `byLetter`, `codeForLetter` from layout; confidences map.
- Produces: `COMMON_WORDS_HE: string[]` (data); `wordIsTypable(word: string, unlocked: Set<KeyCode>): boolean`; `weakKeyScore(word: string, confByCode: Record<KeyCode, number>): number`; `selectPractice(opts): string` where
  ```ts
  interface SelectOpts {
    unlocked: Set<KeyCode>;
    confByCode: Record<KeyCode, number>;
    corpus: string[];
    targetChars: number;
    rng: () => number;   // deterministic in tests
  }
  ```
  Returns a space-joined practice string of real words; falls back to bigram finger drills when fewer than 3 letter-keys are unlocked or no corpus word is typable.

- [ ] **Step 1: Create `words.he.ts`** (seed list; expand later)

```ts
// src/trainer/data/words.he.ts
// Curated common Hebrew words (no niqqud). Ordered roughly by frequency.
// Seed set — expand during content curation.
export const COMMON_WORDS_HE: string[] = [
  'של', 'את', 'על', 'לא', 'זה', 'הוא', 'היא', 'אני', 'הם', 'גם',
  'כל', 'יש', 'אין', 'מה', 'מי', 'כי', 'אם', 'עם', 'או', 'אבל',
  'שלום', 'בית', 'ילד', 'ילדה', 'אבא', 'אמא', 'מים', 'לחם', 'ספר', 'יום',
  'לילה', 'אור', 'גדול', 'קטן', 'טוב', 'רע', 'חדש', 'ישן', 'הלך', 'בא',
  'ראש', 'עין', 'יד', 'רגל', 'דלת', 'חלון', 'שולחן', 'כיסא', 'עץ', 'פרח',
];
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { wordIsTypable, weakKeyScore, selectPractice } from './textSelection';
import { unlockedCodesForStage } from './curriculum';

const seededRng = (seq: number[]) => { let i = 0; return () => seq[(i++) % seq.length]; };

describe('textSelection', () => {
  it('accepts a word only when all its letters are unlocked', () => {
    const unlocked = new Set(['KeyA', 'KeyK', 'KeyU', 'KeyO', 'Space']); // ש ל ו ם
    expect(wordIsTypable('שלום', unlocked)).toBe(true);
    expect(wordIsTypable('בית', unlocked)).toBe(false); // ב not unlocked
  });

  it('scores words higher when they contain low-confidence keys', () => {
    const conf = { KeyA: 0.1, KeyK: 0.9, KeyU: 0.9, KeyO: 0.9 }; // ש is weak
    const withWeak = weakKeyScore('שלום', conf);
    const withoutWeak = weakKeyScore('לו', conf);
    expect(withWeak).toBeGreaterThan(withoutWeak);
  });

  it('falls back to finger drills when too few keys are unlocked', () => {
    const out = selectPractice({
      unlocked: unlockedCodesForStage(0), // only KeyF, KeyJ, Space
      confByCode: {}, corpus: ['שלום', 'בית'], targetChars: 12, rng: seededRng([0.1, 0.9]),
    });
    // Only כ (F) and ח (J) available -> no real word -> drill of those letters
    expect(out.replace(/\s/g, '').split('').every(ch => ch === 'כ' || ch === 'ח')).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  it('produces only typable real words when enough keys are unlocked', () => {
    const unlocked = new Set(['KeyA', 'KeyK', 'KeyU', 'KeyO', 'KeyC', 'KeyH', 'KeyT', 'Space']);
    const out = selectPractice({
      unlocked, confByCode: {}, corpus: ['שלום', 'בית', 'לו'], targetChars: 20, rng: seededRng([0.5]),
    });
    out.split(' ').filter(Boolean).forEach(w => expect(wordIsTypable(w, unlocked)).toBe(true));
  });
});
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement**

```ts
// src/trainer/textSelection.ts
import type { KeyCode } from './types';
import { codeForLetter } from './data/hebrewLayout';

const MIN_LETTER_KEYS_FOR_WORDS = 3;

export function wordIsTypable(word: string, unlocked: Set<KeyCode>): boolean {
  for (const ch of word) {
    const code = codeForLetter(ch);
    if (!code || !unlocked.has(code)) return false;
  }
  return true;
}

export function weakKeyScore(word: string, confByCode: Record<KeyCode, number>): number {
  // Higher when the word exercises low-confidence keys. weakness = 1 - confidence.
  let score = 0;
  for (const ch of word) {
    const code = codeForLetter(ch);
    if (!code) continue;
    const conf = confByCode[code] ?? 0;
    score += (1 - conf);
  }
  return score;
}

function unlockedLetterKeys(unlocked: Set<KeyCode>): KeyCode[] {
  return [...unlocked].filter(c => c !== 'Space');
}

function fingerDrill(unlocked: Set<KeyCode>, targetChars: number, rng: () => number): string {
  const letters = unlockedLetterKeys(unlocked)
    .map(c => lettersForCode(c)).filter(Boolean) as string[];
  if (letters.length === 0) return '';
  const parts: string[] = [];
  let count = 0;
  while (count < targetChars) {
    const a = letters[Math.floor(rng() * letters.length)];
    const b = letters[Math.floor(rng() * letters.length)];
    const bigram = a + b;
    parts.push(bigram);
    count += bigram.length + 1;
  }
  return parts.join(' ');
}

// local: letter for a code (avoids importing byCode circularly in tests)
import { byCode } from './data/hebrewLayout';
function lettersForCode(code: KeyCode): string | null { return byCode[code]?.letter ?? null; }

export interface SelectOpts {
  unlocked: Set<KeyCode>;
  confByCode: Record<KeyCode, number>;
  corpus: string[];
  targetChars: number;
  rng: () => number;
}

export function selectPractice(opts: SelectOpts): string {
  const { unlocked, confByCode, corpus, targetChars, rng } = opts;
  const typable = corpus.filter(w => wordIsTypable(w, unlocked));

  if (unlockedLetterKeys(unlocked).length < MIN_LETTER_KEYS_FOR_WORDS || typable.length === 0) {
    return fingerDrill(unlocked, targetChars, rng);
  }

  // Rank by weak-key score, then sample from the top half weighted by rng.
  const ranked = [...typable].sort((a, b) => weakKeyScore(b, confByCode) - weakKeyScore(a, confByCode));
  const pool = ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 2)));

  const chosen: string[] = [];
  let count = 0;
  while (count < targetChars) {
    const w = pool[Math.floor(rng() * pool.length)];
    chosen.push(w);
    count += w.length + 1;
  }
  return chosen.join(' ');
}
```

- [ ] **Step 5: Run, expect PASS.**
- [ ] **Step 6: Commit** — `git commit -am "feat(trainer): real-word selection with weak-key ranking and finger-drill fallback"`

---

### Task 13: Session scoring

**Files:**
- Create: `src/trainer/scoring.ts`
- Test: `src/trainer/scoring.test.ts`

**Interfaces:**
- Consumes: `SessionLog`, `SessionResult`.
- Produces: `computeSessionResult(log: SessionLog): SessionResult`. WPM = (typedChars / 5) / minutes; accuracy = first-try-correct positions / total positions; wholeWordAccuracy = words with all positions first-try-correct / total words; `perKey` aggregates attempts/errors/median latency per code.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/scoring.ts
import type { SessionLog, SessionResult, KeyCode } from './types';
import { median } from './engine/confidence';

export function computeSessionResult(log: SessionLog): SessionResult {
  const positions = log.words.flat();
  const typedChars = positions.length;
  const correctFirst = positions.filter(p => p.firstTryCorrect).length;
  const durationMs = Math.max(1, log.endTs - log.startTs);
  const minutes = durationMs / 60000;

  const perKeyLatencies: Record<KeyCode, number[]> = {};
  const perKey: SessionResult['perKey'] = {};
  for (const p of positions) {
    perKey[p.code] ??= { attempts: 0, errors: 0, medianLatency: 0 };
    perKey[p.code].attempts += 1;
    if (!p.firstTryCorrect) perKey[p.code].errors += 1;
    (perKeyLatencies[p.code] ??= []).push(p.latencyMs);
  }
  for (const code of Object.keys(perKey)) perKey[code].medianLatency = median(perKeyLatencies[code]);

  const wholeWords = log.words.length;
  const perfectWords = log.words.filter(w => w.every(p => p.firstTryCorrect)).length;

  return {
    wpm: (typedChars / 5) / minutes,
    accuracy: typedChars ? correctFirst / typedChars : 0,
    wholeWordAccuracy: wholeWords ? perfectWords / wholeWords : 0,
    durationMs,
    typedChars,
    perKey,
  };
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): session scoring (wpm, per-char + whole-word accuracy)"`

---

### Task 14: Hebrew error classification

**Files:**
- Create: `src/trainer/errors.ts`
- Test: `src/trainer/errors.test.ts`

**Interfaces:**
- Consumes: `SOFIT_PAIRS`, `CONFUSABLE_GROUPS`, `COMMON_WORDS_HE`.
- Produces: `errorKind(expected: Letter, typed: Letter): 'sofit' | 'confusable' | 'other'`; `classifyMistype(expectedWord: string, typedWord: string, wordSet: Set<string>): { isRealWord: boolean; typedWord: string }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { errorKind, classifyMistype } from './errors';

describe('errors', () => {
  it('detects sofit vs regular confusion', () => {
    expect(errorKind('מ', 'ם')).toBe('sofit');
    expect(errorKind('ם', 'מ')).toBe('sofit');
  });
  it('detects confusable pairs', () => {
    expect(errorKind('ד', 'ר')).toBe('confusable');
  });
  it('falls back to other', () => {
    expect(errorKind('א', 'ב')).toBe('other');
  });
  it('flags when a mistype produced a real (different) word', () => {
    const set = new Set(['שלום', 'שלוט']);
    expect(classifyMistype('שלום', 'שלוט', set)).toEqual({ isRealWord: true, typedWord: 'שלוט' });
    expect(classifyMistype('שלום', 'שלוx', set).isRealWord).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/errors.ts
import type { Letter } from './types';
import { SOFIT_PAIRS } from './data/hebrewLayout';
import { CONFUSABLE_GROUPS } from './curriculum';

const sofitSet = new Set(SOFIT_PAIRS.flatMap(p => [p.sofit + p.regular, p.regular + p.sofit]));

export function errorKind(expected: Letter, typed: Letter): 'sofit' | 'confusable' | 'other' {
  if (sofitSet.has(expected + typed)) return 'sofit';
  for (const group of CONFUSABLE_GROUPS) {
    if (group.includes(expected) && group.includes(typed)) return 'confusable';
  }
  return 'other';
}

export function classifyMistype(
  expectedWord: string,
  typedWord: string,
  wordSet: Set<string>,
): { isRealWord: boolean; typedWord: string } {
  return { isRealWord: typedWord !== expectedWord && wordSet.has(typedWord), typedWord };
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): Hebrew error classification (sofit, confusable, real-word)"`

---

### Task 15: `useTypingSession` hook

**Files:**
- Create: `src/trainer/useTypingSession.ts`
- Test: `src/trainer/useTypingSession.test.ts`

**Interfaces:**
- Consumes: `KeySource`, `Strictness`, `codeForLetter`, `SessionLog`.
- Produces: `useTypingSession(opts): SessionState` where
  ```ts
  interface UseSessionOpts { source: KeySource; target: string; strictness: Strictness; onComplete: (log: SessionLog) => void }
  interface SessionState { index: number; expectedCodes: KeyCode[]; statuses: ('pending'|'correct'|'error')[]; nextCode: KeyCode | null }
  ```
  It builds `expectedCodes` from `target` (each letter → its physical code; a space → `'Space'`), listens to the source, compares `event.code` on key-down, records first-try correctness + latency, enforces stop-on-error, and calls `onComplete` when the last position is correct.

- [ ] **Step 1: Write the failing test** (drive a fake KeySource)

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingSession } from './useTypingSession';
import type { KeySource, KeyEvent, SessionLog } from './types';

function fakeSource() {
  let cb: ((e: KeyEvent) => void) | null = null;
  const src: KeySource = { start: (f) => { cb = f; }, stop: () => { cb = null; } };
  const press = (code: string, ts: number) => act(() => cb!({ code, ts, down: true }));
  return { src, press };
}

describe('useTypingSession', () => {
  it('advances on the correct physical key and completes', () => {
    const { src, press } = fakeSource();
    const onComplete = vi.fn();
    // target "לו" -> KeyK, KeyU
    const { result } = renderHook(() => useTypingSession({ source: src, target: 'לו', strictness: 'stop', onComplete }));
    expect(result.current.nextCode).toBe('KeyK');
    press('KeyK', 100);
    expect(result.current.index).toBe(1);
    press('KeyU', 300);
    const log: SessionLog = onComplete.mock.calls[0][0];
    expect(log.words[0][0]).toMatchObject({ code: 'KeyK', firstTryCorrect: true });
    expect(log.words[0][1].latencyMs).toBe(200);
  });

  it('stop-on-error blocks advance and marks first-try false', () => {
    const { src, press } = fakeSource();
    const onComplete = vi.fn();
    const { result } = renderHook(() => useTypingSession({ source: src, target: 'לו', strictness: 'stop', onComplete }));
    press('KeyT', 100);              // wrong
    expect(result.current.index).toBe(0);
    expect(result.current.statuses[0]).toBe('error');
    press('KeyK', 150);              // correct now
    expect(result.current.index).toBe(1);
    press('KeyU', 200);
    expect(onComplete.mock.calls[0][0].words[0][0].firstTryCorrect).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/useTypingSession.ts
import { useEffect, useRef, useState } from 'react';
import type { KeySource, KeyEvent, KeyCode, Strictness, SessionLog, PosOutcome } from './types';
import { codeForLetter } from './data/hebrewLayout';

interface UseSessionOpts { source: KeySource; target: string; strictness: Strictness; onComplete: (log: SessionLog) => void }
interface SessionState { index: number; expectedCodes: KeyCode[]; statuses: ('pending'|'correct'|'error')[]; nextCode: KeyCode | null }

function buildExpected(target: string): { codes: KeyCode[]; wordOf: number[] } {
  const codes: KeyCode[] = [];
  const wordOf: number[] = [];
  let word = 0;
  for (const ch of target) {
    if (ch === ' ') { codes.push('Space'); wordOf.push(word); word += 1; }
    else { const c = codeForLetter(ch); if (c) { codes.push(c); wordOf.push(word); } }
  }
  return { codes, wordOf };
}

export function useTypingSession(opts: UseSessionOpts): SessionState {
  const { source, target, strictness, onComplete } = opts;
  const { codes, wordOf } = buildExpected(target);

  const [index, setIndex] = useState(0);
  const [statuses, setStatuses] = useState<('pending'|'correct'|'error')[]>(() => codes.map(() => 'pending'));

  // Refs so the event handler always sees current values without re-subscribing.
  const idx = useRef(0);
  const hadErrorHere = useRef(false);
  const lastTs = useRef<number | null>(null);
  const startTs = useRef<number | null>(null);
  const outcomes = useRef<PosOutcome[]>([]);

  useEffect(() => {
    const onKey = (e: KeyEvent) => {
      if (!e.down) return;
      const i = idx.current;
      if (i >= codes.length) return;
      if (startTs.current === null) startTs.current = e.ts;

      if (e.code === codes[i]) {
        const latency = lastTs.current === null ? 0 : e.ts - lastTs.current;
        lastTs.current = e.ts;
        outcomes.current.push({ code: codes[i], firstTryCorrect: !hadErrorHere.current, latencyMs: latency });
        hadErrorHere.current = false;
        setStatuses(s => { const n = [...s]; n[i] = 'correct'; return n; });
        const next = i + 1;
        idx.current = next; setIndex(next);
        if (next >= codes.length) {
          const words: PosOutcome[][] = [];
          outcomes.current.forEach((o, k) => { const w = wordOf[k]; (words[w] ??= []).push(o); });
          onComplete({ words: words.filter(Boolean), startTs: startTs.current!, endTs: e.ts });
        }
      } else {
        hadErrorHere.current = true;
        setStatuses(s => { const n = [...s]; n[i] = 'error'; return n; });
        if (strictness === 'markThrough') {
          outcomes.current.push({ code: codes[i], firstTryCorrect: false, latencyMs: 0 });
          const next = i + 1; idx.current = next; setIndex(next);
        }
      }
    };
    source.start(onKey);
    return () => source.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return { index, expectedCodes: codes, statuses, nextCode: codes[index] ?? null };
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): useTypingSession hook over a KeySource"`

---

### Task 16: `PracticePanel` (RTL text + live coloring)

**Files:**
- Create: `src/trainer/PracticePanel.tsx`
- Create: `src/trainer/trainer.css`
- Test: `src/trainer/PracticePanel.test.tsx`

**Interfaces:**
- Consumes: `SessionState`-like props.
- Produces: `PracticePanel({ target, statuses, index })` rendering the target RTL with per-char classes `char-correct | char-error | char-current | char-pending`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PracticePanel } from './PracticePanel';

describe('PracticePanel', () => {
  it('renders RTL and marks per-char status', () => {
    const { container } = render(
      <PracticePanel target="לו" statuses={['correct', 'pending']} index={1} />
    );
    const root = container.querySelector('.practice-text')!;
    expect(root.getAttribute('dir')).toBe('rtl');
    const chars = container.querySelectorAll('.practice-char');
    expect(chars[0].className).toContain('char-correct');
    expect(chars[1].className).toContain('char-current');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// src/trainer/PracticePanel.tsx
import React from 'react';
import './trainer.css';

interface Props { target: string; statuses: ('pending'|'correct'|'error')[]; index: number }

export const PracticePanel: React.FC<Props> = ({ target, statuses, index }) => {
  const chars = [...target];
  return (
    <div className="practice-text" dir="rtl">
      {chars.map((ch, i) => {
        const status = i === index ? 'current' : statuses[i] ?? 'pending';
        return (
          <span key={i} className={`practice-char char-${status}`}>
            {ch === ' ' ? ' ' : ch}
          </span>
        );
      })}
    </div>
  );
};
```

```css
/* src/trainer/trainer.css */
.practice-text { font-size: 28px; line-height: 1.6; direction: rtl; letter-spacing: 2px; padding: 12px; }
.practice-char { padding: 0 1px; }
.char-pending { color: #9ca3af; }
.char-correct { color: #4ade80; }
.char-error   { color: #f87171; text-decoration: underline wavy #f87171; }
.char-current { color: #e5e7eb; background: rgba(96,165,250,0.35); border-radius: 3px; }
.trainer-mode { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
.trainer-topbar { display: flex; justify-content: space-between; align-items: center; }
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): PracticePanel with RTL live coloring"`

---

### Task 17: `keyboardView` (stats + guidance → per-key visuals)

**Files:**
- Create: `src/trainer/keyboardView.ts`
- Test: `src/trainer/keyboardView.test.ts`

**Interfaces:**
- Consumes: `byCode`, `KeyStat`, `confidenceFor`, `GuidanceMode`, `KeyboardView`.
- Produces: `buildKeyboardView(opts): KeyboardView` where
  ```ts
  interface ViewOpts { nextCode: KeyCode | null; statsByCode: Record<KeyCode, KeyStat>; guidance: GuidanceMode }
  ```
  Maps each layout key → `{ heat, finger, isNextTarget, dim, hidden }` keyed by componentId. Guidance rules: `full` → all shown; `hidden` → all hidden (except next target); `dim` → all dimmed; `auto` → a key is hidden once its confidence ≥ 0.8 (the next target always stays visible).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { buildKeyboardView } from './keyboardView';
import type { KeyStat } from './types';

const strong = (code: string): KeyStat => ({ code, attempts: 50, errors: 0, latencies: [180] });

describe('buildKeyboardView', () => {
  it('marks the next target and its finger', () => {
    const v = buildKeyboardView({ nextCode: 'KeyA', statsByCode: {}, guidance: 'full' });
    expect(v['ka'].isNextTarget).toBe(true);
    expect(v['ka'].finger).toBe('l-pinky');
  });
  it('auto guidance hides mastered keys but keeps the next target visible', () => {
    const v = buildKeyboardView({ nextCode: 'KeyF', statsByCode: { KeyA: strong('KeyA'), KeyF: strong('KeyF') }, guidance: 'auto' });
    expect(v['ka'].hidden).toBe(true);     // mastered, not next
    expect(v['kf'].hidden).toBeFalsy();    // next target stays visible
  });
  it('hidden guidance hides everything except the next target', () => {
    const v = buildKeyboardView({ nextCode: 'KeyA', statsByCode: {}, guidance: 'hidden' });
    expect(v['ks'].hidden).toBe(true);
    expect(v['ka'].hidden).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/keyboardView.ts
import type { KeyCode, KeyStat, GuidanceMode, KeyboardView } from './types';
import { HE_LAYOUT } from './data/hebrewLayout';
import { confidenceFor } from './engine/confidence';
import { GATE } from './engine/gating';

interface ViewOpts { nextCode: KeyCode | null; statsByCode: Record<KeyCode, KeyStat>; guidance: GuidanceMode }

export function buildKeyboardView({ nextCode, statsByCode, guidance }: ViewOpts): KeyboardView {
  const view: KeyboardView = {};
  for (const key of HE_LAYOUT) {
    const stat = statsByCode[key.code];
    const conf = stat ? confidenceFor(stat) : 0;
    const isNext = key.code === nextCode;
    let hidden = false, dim = false;
    if (!isNext) {
      if (guidance === 'hidden') hidden = true;
      else if (guidance === 'dim') dim = true;
      else if (guidance === 'auto') hidden = conf >= GATE.minConfidence;
    }
    view[key.componentId] = { heat: conf, finger: key.finger, isNextTarget: isNext, hidden, dim };
  }
  return view;
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): keyboardView builder (heatmap + guidance modes)"`

---

### Task 18: Placement test (seeding)

**Files:**
- Create: `src/trainer/PlacementTest.tsx`
- Create: `src/trainer/placement.ts`
- Test: `src/trainer/placement.test.ts`

**Interfaces:**
- Consumes: `SessionResult`, `STAGES`, `Progress`.
- Produces (pure): `seedFromPlacement(result: SessionResult): { unlockedStageIndex: number; currentStageIndex: number }` — maps measured WPM/accuracy to a starting stage (fast+accurate → later stage; slow/inaccurate → stage 0). `PlacementTest` component runs one short session and calls `onDone(seed)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { seedFromPlacement } from './placement';
import type { SessionResult } from './types';

const r = (wpm: number, accuracy: number): SessionResult =>
  ({ wpm, accuracy, wholeWordAccuracy: accuracy, durationMs: 60000, typedChars: 100, perKey: {} });

describe('seedFromPlacement', () => {
  it('beginners start at stage 0', () => {
    expect(seedFromPlacement(r(8, 0.7)).currentStageIndex).toBe(0);
  });
  it('fast accurate typists skip ahead', () => {
    const seed = seedFromPlacement(r(60, 0.98));
    expect(seed.currentStageIndex).toBeGreaterThan(0);
    expect(seed.unlockedStageIndex).toBe(seed.currentStageIndex);
  });
  it('never seeds beyond the last stage', () => {
    const seed = seedFromPlacement(r(200, 1));
    expect(seed.currentStageIndex).toBeLessThanOrEqual(9); // STAGES has 10 entries (0..9)
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `placement.ts`**

```ts
// src/trainer/placement.ts
import type { SessionResult } from './types';
import { STAGES } from './curriculum';

export function seedFromPlacement(result: SessionResult): { unlockedStageIndex: number; currentStageIndex: number } {
  const maxIndex = STAGES.length - 1;
  // Accuracy gate first: only skip ahead when accurate enough to have real technique.
  let index = 0;
  if (result.accuracy >= 0.95) {
    // ~ every 12 wpm of measured speed unlocks one more stage, capped.
    index = Math.min(maxIndex, Math.floor(result.wpm / 12));
  }
  return { unlockedStageIndex: index, currentStageIndex: index };
}
```

- [ ] **Step 4: Implement `PlacementTest.tsx`** (uses the session hook against a fixed mixed drill)

```tsx
// src/trainer/PlacementTest.tsx
import React from 'react';
import type { KeySource, SessionLog } from './types';
import { useTypingSession } from './useTypingSession';
import { PracticePanel } from './PracticePanel';
import { computeSessionResult } from './scoring';
import { seedFromPlacement } from './placement';

const PLACEMENT_TEXT = 'שלום עולם זה מבחן קצר של מהירות הקלדה';

export const PlacementTest: React.FC<{
  source: KeySource;
  onDone: (seed: { unlockedStageIndex: number; currentStageIndex: number }) => void;
}> = ({ source, onDone }) => {
  const handleComplete = (log: SessionLog) => onDone(seedFromPlacement(computeSessionResult(log)));
  const s = useTypingSession({ source, target: PLACEMENT_TEXT, strictness: 'markThrough', onComplete: handleComplete });
  return (
    <div className="placement">
      <h3>Placement — type this once</h3>
      <PracticePanel target={PLACEMENT_TEXT} statuses={s.statuses} index={s.index} />
    </div>
  );
};
```

- [ ] **Step 5: Run, expect PASS.** `npx tsc --noEmit` passes.
- [ ] **Step 6: Commit** — `git commit -am "feat(trainer): placement test and stage seeding"`

---

### Task 19: Settings + persistence wiring (`useTrainerState`)

**Files:**
- Create: `src/trainer/useTrainerState.ts`
- Test: `src/trainer/useTrainerState.test.ts`

**Interfaces:**
- Consumes: `TrainerStore`, `Settings`, `Progress`, `KeyStat`, `DEFAULT_SETTINGS`, `STORAGE_KEYS`.
- Produces (pure helpers, hook wraps them): `loadSettings(store)`, `saveSettings(store, s)`, `loadProgress(store)`, `saveProgress(store, p)`, `loadStats(store)`, `mergeSessionStats(prev, result): Record<KeyCode, KeyStat>` (folds a `SessionResult.perKey` into cumulative `KeyStat`s, keeping a bounded latency window of 20), `saveStats(store, stats)`.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/useTrainerState.ts
import type { TrainerStore } from './storage';
import { STORAGE_KEYS } from './storage';
import type { Settings, Progress, KeyStat, SessionResult, KeyCode } from './types';
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
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): settings/progress/stats persistence helpers"`

---

### Task 20: `SessionSummary`

**Files:**
- Create: `src/trainer/SessionSummary.tsx`
- Test: `src/trainer/SessionSummary.test.tsx`

**Interfaces:**
- Consumes: `SessionResult`.
- Produces: `SessionSummary({ result, onNext })` showing WPM, per-char accuracy, whole-word accuracy, and a Continue button.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionSummary } from './SessionSummary';
import type { SessionResult } from './types';

const result: SessionResult = { wpm: 42.4, accuracy: 0.965, wholeWordAccuracy: 0.9, durationMs: 60000, typedChars: 200, perKey: {} };

describe('SessionSummary', () => {
  it('shows rounded stats and fires onNext', () => {
    const onNext = vi.fn();
    render(<SessionSummary result={result} onNext={onNext} />);
    expect(screen.getByText(/42/)).toBeTruthy();
    expect(screen.getByText(/97%|96%/)).toBeTruthy(); // accuracy rounded
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onNext).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// src/trainer/SessionSummary.tsx
import React from 'react';
import type { SessionResult } from './types';

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const SessionSummary: React.FC<{ result: SessionResult; onNext: () => void }> = ({ result, onNext }) => (
  <div className="session-summary">
    <div className="stat"><span className="stat-value">{Math.round(result.wpm)}</span><span className="stat-label">WPM</span></div>
    <div className="stat"><span className="stat-value">{pct(result.accuracy)}</span><span className="stat-label">Accuracy</span></div>
    <div className="stat"><span className="stat-value">{pct(result.wholeWordAccuracy)}</span><span className="stat-label">Whole words</span></div>
    <button onClick={onNext}>Continue</button>
  </div>
);
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): session summary view"`

---

### Task 21: Assemble the core session loop in `TrainerMode`

**Files:**
- Modify: `src/trainer/TrainerMode.tsx`
- Test: `src/trainer/TrainerMode.loop.test.tsx`

**Interfaces:**
- Consumes: everything above. Builds a `KeySource` from `settings.captureSource` (`dom` → `DomKeySource`, `tap` → `TauriTapKeySource`), selects practice text for the current stage, runs a session, on completion merges stats, checks `canAdvance`, persists, and shows `SessionSummary`. Placement runs first if `progress` is at defaults and no stats exist.

- [ ] **Step 1: Write the failing test** (inject a fake store + fake source via props for testability)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => {}) }));
import { TrainerMode } from './TrainerMode';
import { createMemoryStore } from './storage';
import type { KeySource, KeyEvent } from './types';

function fakeSource() {
  let cb: ((e: KeyEvent) => void) | null = null;
  const src: KeySource = { start: f => { cb = f; }, stop: () => { cb = null; } };
  return { src, press: (code: string, ts: number) => act(() => cb!({ code, ts, down: true })) };
}

describe('TrainerMode loop', () => {
  it('runs a session and shows a summary on completion', () => {
    const store = createMemoryStore();
    // Pre-seed progress past placement so it goes straight to a session with known text.
    store.set('trainer.progress', { unlockedStageIndex: 0, currentStageIndex: 0, bestByStage: {} });
    store.set('trainer.stats', { KeyF: { code: 'KeyF', attempts: 1, errors: 0, latencies: [200] } });
    const { src, press } = fakeSource();
    render(<TrainerMode onExit={() => {}} store={store} makeSource={() => src} fixedTarget="כ" />);
    press('KeyF', 100); // 'כ' == KeyF
    expect(screen.getByText(/WPM/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Rewrite `TrainerMode.tsx`** to assemble the loop. Add test-injection props (`store?`, `makeSource?`, `fixedTarget?`) that default to real implementations.

```tsx
// src/trainer/TrainerMode.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Keyboard } from '../components/Keyboard';
import { PracticePanel } from './PracticePanel';
import { SessionSummary } from './SessionSummary';
import { PlacementTest } from './PlacementTest';
import { useTypingSession } from './useTypingSession';
import { buildKeyboardView } from './keyboardView';
import { computeSessionResult } from './scoring';
import { selectPractice } from './textSelection';
import { COMMON_WORDS_HE } from './data/words.he';
import { unlockedCodesForStage } from './curriculum';
import { confidenceFor } from './engine/confidence';
import { canAdvance } from './engine/gating';
import { createLocalStorageStore, type TrainerStore } from './storage';
import {
  loadSettings, loadProgress, saveProgress, loadStats, saveStats, mergeSessionStats,
} from './useTrainerState';
import { DomKeySource } from './keySource/DomKeySource';
import { TauriTapKeySource } from './keySource/TauriTapKeySource';
import type { KeySource, KeyCode, KeyStat, Settings, SessionLog, SessionResult } from './types';
import './trainer.css';

interface Props {
  onExit: () => void;
  store?: TrainerStore;
  makeSource?: (s: Settings) => KeySource;
  fixedTarget?: string; // test hook; when set, skip selection randomness
}

export const TrainerMode: React.FC<Props> = ({ onExit, store: injStore, makeSource, fixedTarget }) => {
  const store = useMemo(() => injStore ?? createLocalStorageStore(), [injStore]);
  const settings = useMemo(() => loadSettings(store), [store]);
  const [progress, setProgress] = useState(() => loadProgress(store));
  const [stats, setStats] = useState<Record<KeyCode, KeyStat>>(() => loadStats(store));
  const [phase, setPhase] = useState<'placement' | 'typing' | 'summary'>(
    () => (Object.keys(loadStats(store)).length === 0 ? 'placement' : 'typing'),
  );
  const [result, setResult] = useState<SessionResult | null>(null);

  const source = useMemo<KeySource>(
    () => (makeSource ? makeSource(settings)
      : settings.captureSource === 'tap' ? new TauriTapKeySource() : new DomKeySource()),
    [makeSource, settings],
  );

  useEffect(() => {
    invoke('set_trainer_mode', { active: true }).catch(console.error);
    return () => { invoke('set_trainer_mode', { active: false }).catch(console.error); };
  }, []);

  const target = useMemo(() => {
    if (fixedTarget != null) return fixedTarget;
    const unlocked = unlockedCodesForStage(progress.currentStageIndex);
    const confByCode: Record<KeyCode, number> = {};
    for (const [code, st] of Object.entries(stats)) confByCode[code] = confidenceFor(st);
    return selectPractice({ unlocked, confByCode, corpus: COMMON_WORDS_HE, targetChars: 40, rng: Math.random });
  }, [progress.currentStageIndex, stats, fixedTarget, phase]);

  const finishSession = (log: SessionLog) => {
    const r = computeSessionResult(log);
    const merged = mergeSessionStats(stats, r);
    setStats(merged); saveStats(store, merged);
    if (canAdvance(progress.currentStageIndex, merged)) {
      const next = { ...progress, currentStageIndex: progress.currentStageIndex + 1, unlockedStageIndex: progress.currentStageIndex + 1 };
      setProgress(next); saveProgress(store, next);
    }
    setResult(r); setPhase('summary');
  };

  if (phase === 'placement') {
    return (
      <div className="trainer-mode">
        <div className="trainer-topbar"><button onClick={onExit}>Exit trainer</button></div>
        <PlacementTest source={source} onDone={(seed) => {
          const next = { ...progress, ...seed }; setProgress(next); saveProgress(store, next); setPhase('typing');
        }} />
      </div>
    );
  }

  return (
    <div className="trainer-mode">
      <div className="trainer-topbar"><button onClick={onExit}>Exit trainer</button></div>
      {phase === 'summary' && result ? (
        <>
          <SessionSummary result={result} onNext={() => { setResult(null); setPhase('typing'); }} />
          <Keyboard />
        </>
      ) : (
        <TypingSession source={source} target={target} strictness={settings.strictness}
          stats={stats} guidance={settings.guidanceMode} onComplete={finishSession} />
      )}
    </div>
  );
};

// Inner component so the session hook can drive the keyboard view.
const TypingSession: React.FC<{
  source: KeySource; target: string; strictness: Settings['strictness'];
  stats: Record<KeyCode, KeyStat>; guidance: Settings['guidanceMode'];
  onComplete: (log: SessionLog) => void;
}> = ({ source, target, strictness, stats, guidance, onComplete }) => {
  const s = useTypingSession({ source, target, strictness, onComplete });
  const view = buildKeyboardView({ nextCode: s.nextCode, statsByCode: stats, guidance });
  return (
    <>
      <PracticePanel target={target} statuses={s.statuses} index={s.index} />
      <Keyboard trainerView={view} />
    </>
  );
};
```

> Exactly one `<Keyboard>` renders per phase: the inner `TypingSession` renders it with the live `trainerView` during typing; the summary branch renders a plain `<Keyboard />`. The placement branch (earlier return) renders none. Do not add a second keyboard.

- [ ] **Step 4: Run, expect PASS.** `npx tsc --noEmit` passes. Manual: `npm run tauri:dev`, enter Trainer, type the shown Hebrew — keys highlight, wrong keys block, summary appears. Confirm only one keyboard is visible at a time.
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): assemble core session loop (select→type→score→advance)"`

---

# Phase 3 — Real text + feedback

### Task 22: Prose/quotes corpus + sentence selection

**Files:**
- Create: `src/trainer/data/prose.he.ts` (data, theme-tagged)
- Modify: `src/trainer/textSelection.ts` (add `selectSentence`)
- Test: `src/trainer/proseSelection.test.ts`

**Interfaces:**
- Produces: `PROSE_HE: Array<{ text: string; theme: string; source: string }>`; `selectSentence(opts: { unlocked: Set<KeyCode>; corpus: typeof PROSE_HE; rng: () => number }): { text: string; theme: string } | null` — returns a typable passage (all letters unlocked) or null when none fits.

- [ ] **Step 1: Create `prose.he.ts`** (seed; public-domain — expand during curation)

```ts
// src/trainer/data/prose.he.ts
// Public-domain Hebrew passages/proverbs. Verify licensing during content curation.
export const PROSE_HE: Array<{ text: string; theme: string; source: string }> = [
  { text: 'איזהו חכם הלומד מכל אדם', theme: 'wisdom', source: 'Pirkei Avot' },
  { text: 'ואהבת לרעך כמוך', theme: 'wisdom', source: 'Leviticus' },
  { text: 'הים הגדול נשקף מן החלון', theme: 'sea', source: 'seed' },
  { text: 'הכוכבים דלקו בשמי הלילה', theme: 'space', source: 'seed' },
];
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { selectSentence } from './textSelection';
import { PROSE_HE } from './data/prose.he';
import { codeForLetter } from './data/hebrewLayout';

describe('selectSentence', () => {
  it('returns null when no passage is fully typable', () => {
    const unlocked = new Set(['KeyF', 'Space']); // only כ
    expect(selectSentence({ unlocked, corpus: PROSE_HE, rng: () => 0 })).toBeNull();
  });
  it('returns a passage whose every letter is unlocked', () => {
    const all = new Set<string>(['Space']);
    PROSE_HE.forEach(p => [...p.text].forEach(ch => { const c = codeForLetter(ch); if (c) all.add(c); }));
    const picked = selectSentence({ unlocked: all, corpus: PROSE_HE, rng: () => 0 })!;
    expect(picked).not.toBeNull();
    [...picked.text].forEach(ch => { if (ch !== ' ') expect(all.has(codeForLetter(ch)!)).toBe(true); });
  });
});
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement `selectSentence`** in `textSelection.ts`

```ts
import type { KeyCode } from './types';
// (reuse existing wordIsTypable)

export function selectSentence(opts: {
  unlocked: Set<KeyCode>;
  corpus: Array<{ text: string; theme: string; source: string }>;
  rng: () => number;
}): { text: string; theme: string } | null {
  const typable = opts.corpus.filter(p => wordIsTypable(p.text.replace(/ /g, ''), opts.unlocked));
  if (typable.length === 0) return null;
  const pick = typable[Math.floor(opts.rng() * typable.length)];
  return { text: pick.text, theme: pick.theme };
}
```

- [ ] **Step 5: Run, expect PASS.**
- [ ] **Step 6: Wire into `TrainerMode`:** for stages at/after `SOFIT_STAGE_INDEX` (or when the user selects a "Prose" mode), prefer `selectSentence`; fall back to `selectPractice` when it returns null. Add a small mode toggle (Drills / Words / Prose) in the trainer topbar that chooses the source. Re-run the loop test.
- [ ] **Step 7: Commit** — `git commit -am "feat(trainer): Hebrew prose/quotes corpus and sentence selection"`

---

### Task 23: Custom text paste

**Files:**
- Create: `src/trainer/CustomText.tsx`
- Test: `src/trainer/CustomText.test.tsx`

**Interfaces:**
- Produces: `CustomText({ onUse })` — a textarea + "Practice this" button that sanitizes input (keep Hebrew letters + spaces, drop niqqud and non-typable chars) and calls `onUse(sanitized)`. Exports pure `sanitizeHebrew(input: string): string`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomText, sanitizeHebrew } from './CustomText';

describe('CustomText', () => {
  it('sanitizes to typable Hebrew letters + spaces', () => {
    expect(sanitizeHebrew('שָׁלוֹם, world! 123')).toBe('שלום');
  });
  it('passes sanitized text to onUse', () => {
    const onUse = vi.fn();
    render(<CustomText onUse={onUse} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'שלום עולם' } });
    fireEvent.click(screen.getByRole('button', { name: /practice/i }));
    expect(onUse).toHaveBeenCalledWith('שלום עולם');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// src/trainer/CustomText.tsx
import React, { useState } from 'react';
import { byLetter } from './data/hebrewLayout';

export function sanitizeHebrew(input: string): string {
  // Keep only letters present in the layout and single spaces; drop niqqud/punctuation.
  const kept = [...input].filter(ch => ch === ' ' || byLetter[ch] != null).join('');
  return kept.replace(/\s+/g, ' ').trim();
}

export const CustomText: React.FC<{ onUse: (text: string) => void }> = ({ onUse }) => {
  const [value, setValue] = useState('');
  return (
    <div className="custom-text">
      <textarea dir="rtl" value={value} onChange={e => setValue(e.target.value)} placeholder="הדביקו טקסט לתרגול" />
      <button onClick={() => onUse(sanitizeHebrew(value))}>Practice this</button>
    </div>
  );
};
```

- [ ] **Step 4: Run, expect PASS.** Wire a "Custom" entry into the trainer mode toggle that feeds the sanitized text as the session target.
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): custom text paste with Hebrew sanitization"`

---

### Task 24: Progress graphs (`StatsView`)

**Files:**
- Create: `src/trainer/StatsView.tsx`
- Create: `src/trainer/chart.ts`
- Test: `src/trainer/chart.test.ts`

**Interfaces:**
- Produces (pure): `linePoints(values: number[], width: number, height: number): string` (an SVG polyline `points` string, y-inverted, auto-scaled). `StatsView({ history })` where `history: { wpm: number; accuracy: number }[]` renders two inline-SVG sparklines. Session history persists under a new store key `trainer.history` (append `{ wpm, accuracy }` in `finishSession`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { linePoints } from './chart';

describe('linePoints', () => {
  it('maps values into the box with y inverted', () => {
    // values 0,50,100 over width 100 height 10 -> x 0,50,100 ; y 10,5,0
    expect(linePoints([0, 50, 100], 100, 10)).toBe('0,10 50,5 100,0');
  });
  it('handles a single value (flat line at mid)', () => {
    expect(linePoints([42], 100, 10)).toBe('0,5');
  });
  it('handles empty', () => {
    expect(linePoints([], 100, 10)).toBe('');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `chart.ts`**

```ts
// src/trainer/chart.ts
export function linePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  if (values.length === 1) return `0,${height / 2}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  return values
    .map((v, i) => `${Math.round(i * stepX)},${Math.round(height - ((v - min) / span) * height)}`)
    .join(' ');
}
```

- [ ] **Step 4: Implement `StatsView.tsx`**

```tsx
// src/trainer/StatsView.tsx
import React from 'react';
import { linePoints } from './chart';

export const StatsView: React.FC<{ history: { wpm: number; accuracy: number }[] }> = ({ history }) => {
  const wpm = history.map(h => h.wpm);
  const acc = history.map(h => h.accuracy * 100);
  return (
    <div className="stats-view">
      <div className="chart"><span>WPM</span>
        <svg viewBox="0 0 200 40" width="200" height="40"><polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={linePoints(wpm, 200, 40)} /></svg>
      </div>
      <div className="chart"><span>Accuracy</span>
        <svg viewBox="0 0 200 40" width="200" height="40"><polyline fill="none" stroke="#4ade80" strokeWidth="2" points={linePoints(acc, 200, 40)} /></svg>
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Run, expect PASS.** Append history in `finishSession` (`store.set('trainer.history', [...prevHistory, { wpm: r.wpm, accuracy: r.accuracy }].slice(-100))`) and show `StatsView` in the summary.
- [ ] **Step 6: Commit** — `git commit -am "feat(trainer): progress graphs (inline SVG)"`

---

### Task 25: Meaning-aware error flag in the session

**Files:**
- Modify: `src/trainer/useTypingSession.ts` (surface per-word mistype info)
- Modify: `src/trainer/PracticePanel.tsx` (render a callout)
- Test: `src/trainer/meaningAware.test.ts`

**Interfaces:**
- Consumes: `classifyMistype`, `COMMON_WORDS_HE`.
- Produces (pure): `wordFromOutcomes` helper + `detectRealWordMistake(expectedWord: string, typedWord: string): { isRealWord: boolean; typedWord: string }` bound to the common-word set. `useTypingSession` exposes an optional `lastMistake: { expected: string; typed: string } | null` when a completed word was typed as a *different real word* (only meaningful in `markThrough` mode; in `stop` mode, capture the first wrong letter's resulting word attempt). `PracticePanel` shows "typed ⟨X⟩ — target ⟨Y⟩" when present.

- [ ] **Step 1: Write the failing test** (pure detector first)

```ts
import { describe, it, expect } from 'vitest';
import { detectRealWordMistake } from './errors';

describe('detectRealWordMistake', () => {
  it('flags a real-word mistype from the common list', () => {
    // both must be in COMMON_WORDS_HE for a positive; use two seeded words
    expect(detectRealWordMistake('של', 'על').isRealWord).toBe(true); // both common
    expect(detectRealWordMistake('של', 'שx').isRealWord).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Add `detectRealWordMistake` to `errors.ts`**

```ts
import { COMMON_WORDS_HE } from './data/words.he';
const COMMON_SET = new Set(COMMON_WORDS_HE);
export function detectRealWordMistake(expectedWord: string, typedWord: string) {
  return classifyMistype(expectedWord, typedWord, COMMON_SET);
}
```

- [ ] **Step 4: Surface in the hook + panel.** In `useTypingSession`, accumulate the actually-typed letters per word (from `letterForCode(event.code)`), and when a word boundary is reached, if the typed word differs from the expected word and `detectRealWordMistake(...).isRealWord`, set `lastMistake`. Render it in `PracticePanel` as a dismissible callout: `נכתב: {typed} — היעד: {expected}`.
- [ ] **Step 5: Add a component test** that drives a wrong-but-real word (in `markThrough` mode) and asserts the callout text appears. Run, expect PASS.
- [ ] **Step 6: Commit** — `git commit -am "feat(trainer): meaning-aware real-word mistype feedback"`

---

# Phase 4 — Delight

### Task 26: Streaks, daily goal, and skill stars

**Files:**
- Create: `src/trainer/streak.ts`
- Create: `src/trainer/stars.ts`
- Test: `src/trainer/streak.test.ts`, `src/trainer/stars.test.ts`

**Interfaces:**
- Produces (pure):
  - `updateStreak(prev: StreakState, todayISO: string, addedMinutes: number): StreakState` — increments on consecutive calendar days, resets after a gap >1 day, accumulates `todayMinutes` (resetting on a new day), tracks `longest`.
  - `computeStars(result: SessionResult): 0 | 1 | 2 | 3` — 1★ complete, 2★ ≥90% accuracy, 3★ ≥98% accuracy AND ≥ target speed floor.

- [ ] **Step 1: Write the failing tests**

```ts
// streak.test.ts
import { describe, it, expect } from 'vitest';
import { updateStreak } from './streak';
import type { StreakState } from './types';
const base: StreakState = { lastPracticedISO: null, current: 0, longest: 0, todayMinutes: 0 };

describe('updateStreak', () => {
  it('starts a streak on first practice', () => {
    const s = updateStreak(base, '2026-07-16', 5);
    expect(s.current).toBe(1); expect(s.todayMinutes).toBe(5); expect(s.longest).toBe(1);
  });
  it('increments on the next calendar day', () => {
    const d1 = updateStreak(base, '2026-07-16', 5);
    const d2 = updateStreak(d1, '2026-07-17', 3);
    expect(d2.current).toBe(2); expect(d2.todayMinutes).toBe(3);
  });
  it('same-day practice accumulates minutes, not streak', () => {
    const d1 = updateStreak(base, '2026-07-16', 5);
    const again = updateStreak(d1, '2026-07-16', 4);
    expect(again.current).toBe(1); expect(again.todayMinutes).toBe(9);
  });
  it('resets after a gap', () => {
    const d1 = updateStreak(base, '2026-07-16', 5);
    const later = updateStreak(d1, '2026-07-20', 2);
    expect(later.current).toBe(1); expect(later.longest).toBe(1);
  });
});
```

```ts
// stars.test.ts
import { describe, it, expect } from 'vitest';
import { computeStars } from './stars';
import type { SessionResult } from './types';
const r = (accuracy: number, wpm: number): SessionResult => ({ wpm, accuracy, wholeWordAccuracy: accuracy, durationMs: 60000, typedChars: 100, perKey: {} });

describe('computeStars', () => {
  it('1 star for completion', () => { expect(computeStars(r(0.5, 5))).toBe(1); });
  it('2 stars at 90% accuracy', () => { expect(computeStars(r(0.92, 5))).toBe(2); });
  it('3 stars at 98% accuracy and speed floor', () => { expect(computeStars(r(0.99, 30))).toBe(3); });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/streak.ts
import type { StreakState } from './types';

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function updateStreak(prev: StreakState, todayISO: string, addedMinutes: number): StreakState {
  if (prev.lastPracticedISO === null) {
    return { lastPracticedISO: todayISO, current: 1, longest: 1, todayMinutes: addedMinutes };
  }
  const gap = daysBetween(prev.lastPracticedISO, todayISO);
  if (gap === 0) {
    return { ...prev, todayMinutes: prev.todayMinutes + addedMinutes };
  }
  const current = gap === 1 ? prev.current + 1 : 1;
  return { lastPracticedISO: todayISO, current, longest: Math.max(prev.longest, current), todayMinutes: addedMinutes };
}
```

```ts
// src/trainer/stars.ts
import type { SessionResult } from './types';
const SPEED_FLOOR_WPM = 20;
export function computeStars(result: SessionResult): 0 | 1 | 2 | 3 {
  if (result.accuracy >= 0.98 && result.wpm >= SPEED_FLOOR_WPM) return 3;
  if (result.accuracy >= 0.90) return 2;
  return 1;
}
```

- [ ] **Step 4: Run, expect PASS.** Wire into `finishSession`: compute `todayISO` from `new Date().toISOString().slice(0,10)`, persist streak under `STORAGE_KEYS.streak`, show streak + stars in the summary.
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): streaks, daily goal, and skill stars"`

---

### Task 27: Celebratory + fault animations

**Files:**
- Create: `src/trainer/Celebration.tsx`
- Modify: `src/trainer/trainer.css` (celebration keyframes)
- Test: `src/trainer/Celebration.test.tsx`

**Interfaces:**
- Produces: `Celebration({ trigger })` — when `trigger` increments, plays a brief CSS confetti/burst then unmounts its visual. `useFaultFlash()` hook returns `{ faultClass, flash() }` where calling `flash()` adds `key-fault` for 180ms (the `.key-fault` style added in Task 6). Wire `flash()` into the session's wrong-key path (add a `onError` callback to `useTypingSession`) and add `key-fault` to the current key via the keyboard view.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Celebration } from './Celebration';

describe('Celebration', () => {
  it('renders a burst when trigger changes', () => {
    const { container, rerender } = render(<Celebration trigger={0} />);
    expect(container.querySelector('.celebration.active')).toBeNull();
    rerender(<Celebration trigger={1} />);
    expect(container.querySelector('.celebration.active')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// src/trainer/Celebration.tsx
import React, { useEffect, useState } from 'react';

export const Celebration: React.FC<{ trigger: number }> = ({ trigger }) => {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (trigger === 0) return;
    setActive(true);
    const id = setTimeout(() => setActive(false), 900);
    return () => clearTimeout(id);
  }, [trigger]);
  return <div className={`celebration ${active ? 'active' : ''}`} aria-hidden />;
};
```

```css
/* append to trainer.css */
.celebration { position: absolute; inset: 0; pointer-events: none; opacity: 0; }
.celebration.active { animation: celebrate 900ms ease-out; }
@keyframes celebrate {
  0% { opacity: 0; transform: scale(0.9); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: scale(1.1); background: radial-gradient(circle, rgba(74,222,128,0.35), transparent 70%); }
}
```

- [ ] **Step 4: Run, expect PASS.** Wire: increment a `celebrateTrigger` on stage-advance and on 3-star sessions; call fault flash from the session's wrong-key path.
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): celebratory and fault animations"`

---

### Task 28: Ghost race (beat your best)

**Files:**
- Create: `src/trainer/ghost.ts`
- Create: `src/trainer/GhostBar.tsx`
- Test: `src/trainer/ghost.test.ts`

**Interfaces:**
- Produces (pure): a ghost is `number[]` — cumulative ms timestamp at which each character was completed in the best run. `ghostCharsAt(ghost: number[], elapsedMs: number): number` returns how many characters the ghost has completed by `elapsedMs`. `GhostBar({ ghost, elapsedMs, total })` renders a progress bar of the ghost vs. total chars. The best ghost per stage persists under `STORAGE_KEYS.ghosts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { ghostCharsAt } from './ghost';

describe('ghostCharsAt', () => {
  const ghost = [100, 250, 500]; // char 1 at 100ms, char 2 at 250ms, char 3 at 500ms
  it('counts characters completed by elapsed time', () => {
    expect(ghostCharsAt(ghost, 0)).toBe(0);
    expect(ghostCharsAt(ghost, 120)).toBe(1);
    expect(ghostCharsAt(ghost, 300)).toBe(2);
    expect(ghostCharsAt(ghost, 9999)).toBe(3);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/trainer/ghost.ts
export function ghostCharsAt(ghost: number[], elapsedMs: number): number {
  let n = 0;
  for (const t of ghost) { if (t <= elapsedMs) n++; else break; }
  return n;
}
```

```tsx
// src/trainer/GhostBar.tsx
import React from 'react';
import { ghostCharsAt } from './ghost';

export const GhostBar: React.FC<{ ghost: number[]; elapsedMs: number; total: number }> = ({ ghost, elapsedMs, total }) => {
  const pct = total ? (ghostCharsAt(ghost, elapsedMs) / total) * 100 : 0;
  return (
    <div className="ghost-bar" aria-hidden>
      <div className="ghost-marker" style={{ width: `${pct}%` }} />
    </div>
  );
};
```

- [ ] **Step 4: Run, expect PASS.** Build the ghost from a session's cumulative correct-char timestamps (derive from `PosOutcome.latencyMs` prefix sums); persist the fastest per stage; render `GhostBar` during typing with `elapsedMs = now - sessionStart` via `requestAnimationFrame`.
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): ghost race against personal best"`

---

### Task 29: Text-theme-tied background

**Files:**
- Create: `src/trainer/ThemeBackground.tsx`
- Modify: `src/trainer/trainer.css` (theme backgrounds)
- Test: `src/trainer/ThemeBackground.test.tsx`

**Interfaces:**
- Consumes: the `theme` string from `selectSentence`.
- Produces: `ThemeBackground({ theme })` renders `<div className={`theme-bg theme-${knownTheme(theme)}`} />` where `knownTheme` maps unknown themes to `'default'`. Themes seeded: `sea`, `space`, `wisdom`, `default`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeBackground, knownTheme } from './ThemeBackground';

describe('ThemeBackground', () => {
  it('maps known and unknown themes', () => {
    expect(knownTheme('sea')).toBe('sea');
    expect(knownTheme('banana')).toBe('default');
  });
  it('renders the theme class', () => {
    const { container } = render(<ThemeBackground theme="space" />);
    expect(container.querySelector('.theme-space')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// src/trainer/ThemeBackground.tsx
import React from 'react';

const KNOWN = new Set(['sea', 'space', 'wisdom', 'default']);
export function knownTheme(theme: string): string { return KNOWN.has(theme) ? theme : 'default'; }

export const ThemeBackground: React.FC<{ theme: string }> = ({ theme }) => (
  <div className={`theme-bg theme-${knownTheme(theme)}`} aria-hidden />
);
```

```css
/* append to trainer.css */
.theme-bg { position: absolute; inset: 0; z-index: -1; opacity: 0.25; transition: background 400ms ease; }
.theme-default { background: #0f172a; }
.theme-sea { background: linear-gradient(#0ea5e9, #0369a1); }
.theme-space { background: radial-gradient(circle at 30% 20%, #312e81, #020617); }
.theme-wisdom { background: linear-gradient(#7c3aed, #4c1d95); }
```

- [ ] **Step 4: Run, expect PASS.** Render `ThemeBackground` behind the practice panel when a prose passage is active, using its `theme`.
- [ ] **Step 5: Commit** — `git commit -am "feat(trainer): text-theme-tied background"`

---

## Final verification

- [ ] Run the full suite: `npm test -- --run` → all green.
- [ ] Type-check: `npx tsc --noEmit` → no errors.
- [ ] Manual end-to-end (`npm run tauri:dev`): enter Trainer → placement seeds a stage → type Hebrew with live key highlighting and finger colors → wrong keys block + flash → summary shows WPM / per-char / whole-word accuracy + stars + streak → heatmap fills → switch guidance modes (full/auto/dim/hidden) → prose + custom + ghost work → exit returns to the non-activating overlay.
- [ ] Verify both capture sources by toggling `settings.captureSource` (`dom` vs `tap`) and confirming keystrokes register (and, for `dom`, do not leak to background apps).

## Notes for the implementer

- **`useRef` import:** Task 15 uses `useRef`/`useState`/`useEffect` — import from `react`.
- **Single source of truth:** never re-map physical keys; always go through `hebrewLayout.ts` and the existing `keyMapping.ts`.
- **Determinism in tests:** all selection/generation takes an injected `rng`; never call `Math.random` inside pure modules.
- **Native uncertainty:** if `set_trainer_mode` focus proves unreliable on a given macOS build, set `settings.captureSource = 'tap'` (works without focus) — this is exactly why both adapters exist.
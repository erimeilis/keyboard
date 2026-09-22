# Hebrew 10-Finger Typing Trainer — Design

## Goal

Add a **Trainer mode** to the existing always-on-top keyboard overlay that teaches and
improves **Hebrew 10-finger touch typing** on the Israeli standard layout, taking a user
from absolute beginner to fast typist.

The market for English trainers is saturated; polished Hebrew touch-typing trainers barely
exist. This app already renders the Israeli Hebrew keymap and detects the Hebrew input
source, so it is uniquely positioned. The differentiators are:

1. **Adaptive weak-key targeting** — re-weight practice toward the user's slowest/least
   accurate keys (the keybr/TIPP10 model). We already own the keystroke stream.
2. **Per-key heatmap on the keyboard itself** — the on-screen keyboard becomes the progress
   surface (red→green). No overlay tool does this.
3. **Built-in wean-off-the-overlay progression** — the visible keyboard is a known crutch
   (Vanderbilt 2016); the trainer progressively fades its own hints so the user builds
   look-away muscle memory. The app teaches you until you no longer need it.
4. **Hebrew-accurate error model** — in Hebrew a single wrong consonant usually produces a
   *different real word*, not a recognizable typo. Accuracy is modeled and enforced far more
   strictly than any English-oriented trainer does. (See "Hebrew accuracy model".)

## Locked decisions

| Topic | Decision |
|---|---|
| Interaction model | Dedicated Trainer mode inside the app (the app is the tutor). |
| Audience | Both beginners and existing typists, via a placement test (level-based curve). |
| Primary layout | **Hebrew (Israeli standard)** first. Engine is layout-agnostic; other layouts are a separate future feature (scope boundary, not deferred work). |
| Text sources | **Real Hebrew text is primary** — common-word lists + prose/quotes + custom paste. Early stages use honest letter/bigram finger drills. **No algorithmic pseudo-words** (they produce nonsense in Hebrew). |
| Adaptivity | Weak-key targeting by **selecting real words/sentences rich in the user's weak keys** (not by generating fake words). |
| Progression | Staged home-row-first key-unlock ladder **plus** adaptive weak-key targeting within each stage; accuracy-first gate to advance. |
| Wean-off | Switchable **guidance modes**: Full → Auto-fade (per-key, confidence-driven) → Manual dim → Hidden. |
| Gamification | Progress visualization + streaks/goals/skill-stars + themed & fault animations + ghost race. |
| Keystroke capture | **Both** a DOM adapter and a Rust-tap adapter behind one `KeySource` interface, chosen by a setting. Default: DOM capture. |
| Error handling | Default **stop-on-error (must correct)**; configurable strictness. |
| Scope | **Nothing deferred** — the full set above is in scope. The build order below sequences the work; it does not cut anything. |

## Audience & the learning curve

A **placement test** (~60–90s of mixed drills) estimates starting WPM and accuracy, seeds
the adaptive engine's per-key confidence, and drops the user at the right stage. Re-takeable.

- **Beginner** → starts at stage 1 (home-row anchors), full guidance.
- **Existing typist** → placement seeds high confidence, skips ahead to weak-key work and
  speed/fluency stages, guidance auto-fades quickly.

The curve is level-based, so both audiences share one ladder; the placement test just sets
the entry point.

## User experience & flow

- **Entry/exit.** A Trainer toggle in the overlay control bar and in the menu-bar tray.
  Entering Trainer switches the app into the focused practice view; exiting returns it to the
  normal always-on-top overlay.
- **Session loop.**
  1. Continue current stage (or pick a stage / mode).
  2. A **practice panel** above the reused keyboard shows the Hebrew target text
     **right-to-left** with a caret. Correct chars go green, the current char is highlighted,
     errors are handled per the strictness setting (default: block until corrected).
  3. The keyboard highlights the **next key + its finger color**, subject to the active
     guidance mode.
  4. Session ends after N characters or seconds → **summary** (WPM, accuracy, whole-word
     accuracy, per-key deltas, stars, streak).
- **Guidance modes** switchable at any time (see below).

## Architecture

### Window & focus model

Trainer mode needs keyboard focus so keystrokes are captured cleanly and do not leak into
whatever app sits behind the overlay. On entering Trainer, a Rust command switches the window
to a focusable/activating state; on exit it reverts to the non-activating `NSPanel` overlay
(current behavior). This is the only substantive backend change.

### Keystroke capture — `KeySource` interface (both adapters)

We do not yet know which capture path performs best, so we build both behind one interface
and expose the choice as a setting (default: DOM).

```ts
interface KeyEvent { code: string; ts: number; down: boolean } // code = physical key, e.g. "KeyA"
interface KeySource {
  start(onKey: (e: KeyEvent) => void): void;
  stop(): void;
}
```

- **`DomKeySource`** — listens to DOM `keydown`/`keyup` on a focused, visually-hidden capture
  element. `event.code` gives the physical key (input-source-independent); `event.timeStamp`
  gives precise timing. Keystrokes do not leak to background apps. Works even if Accessibility
  permission is flaky. **Default.**
- **`TauriTapKeySource`** — consumes the existing Rust `CGEventTap` stream. To give discrete,
  timestamped keydowns (the current `keyboard-state` event is a throttled state snapshot, not
  a keydown stream), the Rust listener emits a new `keydown` event `{ code, ts }`. Reuses the
  app's existing native infrastructure.

The session logic consumes `KeyEvent`s and never cares which adapter produced them.

### Frontend components (layered on the existing `Keyboard.tsx`)

- `TrainerMode` — view/session lifecycle container; mounts when Trainer is active.
- `PracticePanel` — RTL target text, caret, live per-char coloring, error state.
- `useTypingSession` — consumes a `KeySource`; maps `event.code` → expected physical key;
  records per-key timing and errors; enforces the strictness setting; emits session events.
- `useAdaptiveEngine` — per-key confidence, next-item selection (weak-key weighting), stage
  gating. Pure, unit-tested.
- Heatmap / finger-hint layer — new visual props threaded into the existing `Key` component
  (heat color, next-key highlight, finger-zone color, guidance-driven fade). `Keyboard.tsx`
  stays the single source of truth for the physical→Hebrew key map.
- `SessionSummary`, `StatsView`, `PlacementTest`.

### Backend (Rust) — minimal

- `set_trainer_window(active: bool)` — toggles focusable vs non-activating `NSPanel`.
- `keydown` event `{ code, ts }` — only needed by `TauriTapKeySource`.

### Data model & persistence

Local JSON in the Tauri app-data dir. No server, no accounts.

- `KeyStat` per physical key: recent latency samples, error count, attempts → derived
  `confidence` (0–1).
- `Progress`: unlocked stages, current stage, per-stage best WPM/accuracy.
- `Streak`: last-practiced date, current/longest streak, daily-goal progress.
- `Settings`: guidance mode, error strictness, capture source, layout.
- `Ghosts`: per-stage/per-text personal-best keystroke timelines (for ghost race).

## Adaptive engine

- **Confidence** per key from recent median latency + error rate, decayed over time.
- **Weak-key targeting (by selection, not generation).** Within the active stage, rank the
  real-word/sentence corpus by how much each item exercises the lowest-confidence unlocked
  keys, and sample those. Sofit and confusable groups get a priority multiplier (see Hebrew
  accuracy model).
- **Stage gate (accuracy-first).** Advance only when every key in the stage clears an
  accuracy gate first, then a speed floor. Hebrew accuracy gate proposed at **~98%**
  (vs the ~95% English convention); speed floor tuned low for beginners. Numbers are
  configuration, not hard-coded.
- The placement test seeds initial confidence so existing typists skip ahead.

## Curriculum — Hebrew stage ladder

The finger map and physical→Hebrew mapping are **derived from the existing `Keyboard.tsx`
layout data** (single source of truth), not duplicated. Home row (physical A…;) is
`ש ד ג כ ע · י ח ל ך ף`; tactile anchors are `כ` (KeyF) and `ח`… (the F/J bump keys).

Illustrative ladder (data-driven, tunable):

1. Index anchors + space: `כ ח`
2. Index inner: `ע י`
3. Middle: `ג ל`
4. Ring: `ד ך`
5. Pinky → full home row: `ש ף`
6–8. Top row groups: `ר א · ו פ · ק ט` etc.
9–11. Bottom row groups: `נ מ · ב ה · ז ס צ` etc.
12. **Sofit finals focus** — `ן ם ך ף ץ` and their regular counterparts (`נ מ כ פ צ`), which
    live on *different physical keys* in the Israeli layout and are a classic meaning error.
13. **Confusable pairs** — e.g. `ד/ר`, `כ/ב`, `ה/ח`, `ט/ת`, `ם/ס`, `ן/ו`.
14. Numbers & punctuation.
15. Prose fluency (real text).

Finger zones are color-coded (index/middle/ring/pinky per hand) and rendered on the keyboard.

## Text sources

**Real Hebrew text is the primary source.** Algorithmic generation of pseudo-words produces
nonsense in Hebrew (a consonantal, root-based language), so we do **not** generate fake words.
Adaptivity comes from *selecting* real text rich in the user's weak keys, not from inventing
words. All content is local data files; the engine is layout-agnostic (finger map + frequency
data + word/text corpora keyed by layout).

1. **Curated common-word lists (primary for word stages).** Real top-N Hebrew words. In any
   stage we draw the words whose letters fall within the unlocked set, ranked toward the
   user's weak keys. This yields *real words* even mid-curriculum.
2. **Prose & quotes (primary for fluency + engagement).** Bundled public-domain Hebrew text —
   literature, Tanakh verses, proverbs, sayings — with natural punctuation and intrinsic
   motivation. Passages selected for weak-key density where possible. Needs a small curation
   pass (public-domain/licensing check).
3. **Custom paste.** The user pastes their own Hebrew text to drill. In scope.
4. **Early-stage finger drills (honest, not fake words).** When only 2–3 keys are unlocked no
   real word exists, so we drill the unlocked keys and bigrams directly (e.g. `כח חכ ככ חח`).
   These are explicitly presented as *finger drills*, never disguised as words. As soon as the
   unlocked set supports real words, we switch to source 1.

Adaptive weak-key targeting is therefore implemented as **corpus selection**: rank real
words/sentences by how much they exercise the user's low-confidence keys, and sample those
(the keybr/TIPP10 intent, achieved over *real* Hebrew text).

## Guidance modes (wean-off)

A `guidanceMode` setting drives how much the keyboard reveals; overridable anytime:

- **Full** — highlight next key + finger color + Hebrew legends.
- **Auto-fade** — per key, hints fade as that key's confidence rises (highlight → legend →
  blank). The overlay weans the user off itself.
- **Manual dim** — legends dimmed globally.
- **Hidden** — blank keys (look-away / "blind" practice).

## Gamification & feedback

- **Progress visualization.** Per-key heatmap (red→green) on the keyboard; live
  WPM/accuracy/whole-word accuracy; WPM/accuracy-over-time graphs; session summary.
- **Streaks, goals, skill-stars.** Daily streak + goal; stars/achievements tied to real
  milestones (stage at ≥ gate accuracy, a key turning green) — not collectibles.
- **Themed animations & juicy feedback.** Celebratory level-up/streak animations, satisfying
  correct-key feedback, playful fault animations on errors, and text-theme-tied backgrounds
  (sea/space/…) driven by a theme tag on each practice text. Kept tasteful so they never
  distract from typing.
- **Ghost race.** Race your own personal-best WPM ghost — no strangers, no leaderboard (heavy
  competition discourages the majority of learners).

## Hebrew accuracy model

Hebrew is consonantal and typed without niqqud, so one wrong consonant generally yields a
*different real word*, not a readable typo. Accuracy is therefore modeled and enforced more
strictly than in any English trainer, and this is itself a differentiator.

- **Accuracy dominates score and gate.** ~98% accuracy gate to advance; speed weighted far
  below accuracy.
- **Whole-word correctness metric.** In word/prose modes a word counts correct only if every
  letter is right — one wrong consonant = wrong word, mirroring the language. Reported
  alongside per-char accuracy.
- **Stop-on-error default.** A wrong key blocks progress until corrected (configurable to
  looser 1st/2nd/3rd-error strictness).
- **Confusable & sofit groups are first-class curriculum** (stages 12–13) and get adaptive
  priority.
- **Meaning-aware error feedback.** When a mistype produces a *real* Hebrew word (checked
  against the word list), flag it as a teaching moment: "you typed ⟨word⟩; target was
  ⟨word⟩." In scope.

## Layout-agnostic design (future)

Finger maps, frequency data, and word/text lists are keyed by layout id. Adding English (or
Arabic, etc.) is a data drop-in plus RTL/LTR handling, not an engine rewrite. Because the
session matches on physical key codes, training is input-source-independent (the user builds
finger memory regardless of the active OS input source; a gentle "switch to Hebrew to see
letters appear" hint may be shown but correctness never depends on it).

## Build order (all in scope — nothing deferred)

This sequences the work so there is a usable build early; it does not cut anything below.

1. **Foundation:** Trainer mode + focusable window toggle; `KeySource` interface with both
   adapters; local persistence; reused keyboard with heatmap/finger/guidance visual props.
2. **Pedagogy core:** staged ladder + adaptive engine; placement test; early finger drills +
   real common-word selection; accuracy-first gating; stop-on-error; sofit/confusable
   curriculum; per-key heatmap; live + summary stats incl. whole-word accuracy; guidance modes.
3. **Real text + feedback:** prose/quotes corpus; custom paste; progress graphs; meaning-aware
   error flagging (real-word mistype callout).
4. **Delight:** streaks/goals/skill-stars; celebratory + fault animations; ghost race;
   text-theme-tied animations.

**Scope boundary (not this feature):** additional layouts (English, Arabic, …). The engine is
layout-agnostic by design, but building non-Hebrew content is a separate future feature — a
boundary, not deferred work from this one. Say so if you want English pulled in here.

## Testing

- **Unit (Vitest), high value:** adaptive engine (confidence, weighting, gating), text
  selection (unlocked-key filtering, weak-key ranking, early finger-drill fallback), session
  scoring (WPM, per-char accuracy, whole-word accuracy), Hebrew error classification (sofit,
  confusable, real-word mistype), placement-test seeding.
- **Component:** `PracticePanel` RTL rendering + live correctness coloring + stop-on-error
  behavior; keyboard heatmap/finger-hint/guidance-fade visual props.
- **Integration/manual:** window focus toggle (enter/exit Trainer, clean `NSPanel` revert);
  both `KeySource` adapters produce equivalent `KeyEvent`s.

## Risks & open questions

- **Window focus toggle** edge cases (clean revert to non-activating `NSPanel`). Mitigated by
  keeping the Rust change minimal and reverting on every exit.
- **Hebrew data sourcing** — frequency tables, common-word lists, and public-domain prose need
  a small curation pass (licensing check for prose/quotes). This is the primary content
  effort now that text is real, not generated.
- **Early finger drills are repetitive by nature** — mitigate with short early stages and
  quick progression to real words as soon as the unlocked set allows.
- **Animation restraint** — must not distract from typing; keep opt-in/tasteful.
- **Capture-source parity** — the two adapters must agree on physical-key codes and timing
  units; covered by tests.

## Files (anticipated)

| File | Change |
|---|---|
| `src/trainer/TrainerMode.tsx` | New — trainer view/session container |
| `src/trainer/PracticePanel.tsx` | New — RTL target text + caret + coloring |
| `src/trainer/PlacementTest.tsx` | New — placement flow |
| `src/trainer/SessionSummary.tsx`, `StatsView.tsx` | New — results & stats |
| `src/trainer/useTypingSession.ts` | New — session logic over `KeySource` |
| `src/trainer/useAdaptiveEngine.ts` | New — confidence/weighting/gating (pure) |
| `src/trainer/textSelection.ts` | New — real-text selection: unlocked-key filter, weak-key ranking, early finger-drill fallback (pure) |
| `src/trainer/CustomText.tsx` | New — paste-your-own-Hebrew-text flow |
| `src/trainer/keySource/` | New — `KeySource` interface + `DomKeySource`, `TauriTapKeySource` |
| `src/trainer/data/` | New — Hebrew finger map (derived), letter frequency, common-word lists, public-domain prose/quotes |
| `src/trainer/curriculum.ts` | New — stage ladder, sofit/confusable groups |
| `src/trainer/storage.ts` | New — local JSON persistence |
| `src/components/Key.tsx`, `Keyboard.tsx`, `Keyboard.css` | Modify — heatmap/finger/guidance visual props |
| `src/App.tsx` | Modify — Trainer toggle + mode switch |
| `src-tauri/src/lib.rs` | Modify — `set_trainer_window` command; register |
| `src-tauri/src/keyboard_listener.rs` | Modify — emit `keydown { code, ts }` event |

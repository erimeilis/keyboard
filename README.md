<div align="center">
  <img src="src-tauri/icons/icon.png" alt="keyboard" width="128"/>

  # keyboard

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Tauri](https://img.shields.io/badge/Tauri-2.11-orange.svg)](https://v2.tauri.app)
  [![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
  [![Platform](https://img.shields.io/badge/macOS-arm64-lightgrey.svg)]()

  **Always-on-top virtual keyboard overlay that types into any app — like macOS Accessibility Keyboard, but prettier**

  [Features](#-features) · [Quick Start](#-quick-start) · [Architecture](#-architecture) · [Credits](#-credits) · [Contributing](#-contributing)

</div>

---

## 🎯 What is this?

A floating keyboard overlay that sits on top of all your windows. Click a key on the overlay — it types into whatever app has focus. Type on your physical keyboard — the overlay lights up in real time.

Currently ships with a **Hebrew layout** (English + Hebrew dual labels). More keyboard layouts and visual designs are planned.

## ✨ Features

- **🖱️ Click-to-type** — click any key on the overlay to inject keystrokes into the focused app via macOS CGEvent API
- **⌨️ Live key animation** — physical keyboard presses highlight corresponding keys in real time via CGEventTap
- **🪟 Non-activating overlay** — uses NSPanel so clicking the keyboard never steals focus from your target app
- **🔤 Layout detection** — automatically detects active input source (Hebrew/English) and emphasizes the corresponding labels
- **📌 Always on top** — floats above all windows, draggable with screen-edge snapping
- **🔀 Sticky modifiers** — single-click a modifier to apply it to the next keypress; double-click to lock it
- **📏 Resizable** — drag the corner handle to scale the keyboard up or down (0.5x–1.5x)
- **🫧 Collapsible** — collapse to a tiny draggable pill icon, click to expand back
- **🍎 Menu bar control** — tray icon with Show/Hide and Quit (no dock icon clutter)
- **🖥️ Multi-display** — the panel joins all Spaces, so dragging it to a second monitor
  keeps it visible under macOS's default "Displays have separate Spaces"
- **🎨 Native macOS chrome** — the window buttons are real AppKit `standardWindowButton`
  views (glass, hover glyphs, inactive dimming all from the system), the trainer sits on
  Liquid Glass, and the UI follows the accent colour you chose in System Settings
- **🎓 Hebrew typing trainer** — a full 10-finger course built on the overlay: a 6-stage
  curriculum starting on the whole home row, per-key confidence tracking, accuracy-first
  gating over recent attempts, live RTL coloring, four guidance modes, placement test,
  progress graphs, streaks and a ghost race — practising on the real Siddur with English
  under every term ([details](#-hebrew-typing-trainer))

## 🚀 Quick Start

### Prerequisites

- **macOS** (arm64) — the native keyboard APIs are macOS-specific
- **Node.js** 18+
- **Rust** toolchain (`rustup` with stable)
- **Tauri CLI** — installed via npm

### Build & Run

```bash
# Clone the repo
git clone https://github.com/erimeilis/keyboard.git
cd keyboard

# Install dependencies
npm install

# Development mode (hot reload)
npm run tauri:dev

# Production build
npm run tauri:build
```

The built `.app` and `.dmg` appear in `build/`.

### ⚠️ Accessibility Permission

On first launch, macOS will prompt for **Accessibility** permission. You must grant it in:

**System Settings → Privacy & Security → Accessibility → Hebrew Keyboard → ON**

> After each rebuild, the code signature changes. You'll need to toggle the permission **OFF then ON** and relaunch the app for it to take effect.

## 🏗️ Architecture

```
keyboard/
├── src/                          # React frontend
│   ├── App.tsx                   # Window state (overlay / pill / trainer), button routing
│   ├── App.test.tsx              # Routing and state-transition tests
│   ├── components/
│   │   ├── Keyboard.tsx          # Keyboard layout, key click → simulate_key
│   │   ├── Key.tsx               # Individual key component (4 variants)
│   │   └── Keyboard.css          # Key themes (black/gray/red), press states
│   ├── hooks/
│   │   ├── useKeyboardLayout.ts  # Polls active input source (Hebrew/English)
│   │   ├── useAccentColor.ts     # Publishes the macOS accent as --accent
│   │   └── useWindowActive.ts    # Mirrors key-window state for inactive dimming
│   ├── utils/
│   │   └── keyMapping.ts         # Maps backend key codes → component IDs
│   └── trainer/                  # Hebrew typing trainer
│       ├── TrainerMode.tsx       # Shell: mode switching, settings, session loop
│       ├── engine/               # Pure logic: curriculum, confidence, gating,
│       │                         #   selection, scoring, error classification
│       ├── components/           # PracticePanel, SessionSummary, StatsView, …
│       ├── hooks/                # useTypingSession
│       ├── keySource/            # DOM and Tauri-tap keystroke adapters
│       ├── persistence/          # Settings / progress / stats storage
│       ├── gamification/         # Streaks, stars, ghost race, charts
│       └── data/                 # Layout, Siddur corpus (siddur.corpus.json), glosses.he.ts
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── lib.rs                # App setup, NSPanel, tray icon, accessibility check
│       ├── keyboard_listener.rs  # CGEventTap FFI — listens to physical keyboard
│       ├── key_simulator.rs      # CGEvent — injects keystrokes into focused app
│       ├── layout_detector_macos.rs  # TIS API — detects active keyboard layout
│       └── titlebar_macos.rs     # Real AppKit window buttons hosted in a borderless window
├── scripts/
│   ├── copy-build.js             # Copies build artifacts to build/
│   ├── ingest-siddur.mjs         # Fetches the Siddur corpus from Sefaria
│   └── build-corpus.mjs          # Shapes it into the bundled corpus JSON
└── build/                        # Production .app and .dmg (gitignored)
```

### How It Works

```
Physical keyboard → CGEventTap (listener) → Tauri event → React state → key highlights
Overlay click → React → Tauri command → CGEvent (simulator) → target app receives keystroke
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Keyboard listener | Raw CGEventTap FFI | Captures physical key events without stealing focus |
| Key simulator | `core-graphics` CGEvent | Injects keystrokes via `post_to_pid` to the focused app |
| Layout detection | Carbon TIS API | Reads `TISCopyCurrentKeyboardInputSource` for Hebrew/English |
| Window management | `tauri-nspanel` | NSPanel with NonactivatingPanel style mask; converted to a plain window for the trainer |
| Window buttons | `NSWindow.standardWindowButton` via `objc2` | Genuine traffic lights in a borderless window, retargeted to the app's actions |
| Material | `NSGlassEffectView` (fallback `NSVisualEffectView`) | Liquid Glass behind the trainer, looked up by class name at runtime |
| Frontend | React 19 + TypeScript | Keyboard rendering, state management, window controls |

### Key Design Decisions

- **Raw CGEventTap FFI** instead of the `rdev` crate — `rdev` silently fails on macOS Tahoe when Input Monitoring is separated from Accessibility
- **NSPanel with Accessory activation policy** — prevents the overlay from appearing in the dock or stealing focus, while staying above all windows
- **`post_to_pid`** instead of `post(Session)` — ensures keystrokes go to the correct app even when the overlay is clicked
- **Event marker (`0x4B424F56`)** on simulated events — so the listener can filter out its own injected keystrokes and avoid feedback loops
- **Real window buttons, not drawn ones** — native decorations throw an NSException on this transparent panel, so the strip is drawn, but its three lights are `standardWindowButton` views. Their glass, hover glyphs and inactive dimming cannot be reproduced in CSS. They opt out of Auto Layout (which sized them to 0×0), are re-laid out on every content-view resize, kept in front of the webview, and have their actions rebound after each panel↔window swizzle, which resets them
- **One `titlebar-action` subscriber** — the buttons report clicks as a single Tauri event that `App` alone listens to and routes by mode. Tauri's event plugin keys its listener table per event name, so two subscribers trample each other and the loser's unlisten throws
- **One window-state model** — collapse, trainer and hide are decided together: entering the trainer always un-collapses, yellow minimises to the pill in both modes (never hides), and every Rust-side `show()` emits `restore-window` so the tray and Dock always bring back a usable overlay
- **Native transition follows state** — `set_trainer_mode` runs from `App`'s `isTraining` effect, one call per real change. Driving it from `TrainerMode`'s mount effect produced three conversions per click under `React.StrictMode`
- **`CanJoinAllSpaces`** — macOS defaults each display to its own Space; without it the panel stayed bound to the Space it was created in and vanished when dragged to another monitor
- **Accent from `NSColor.controlAccentColor`** — the CSS `AccentColor` system colour is unsupported in this WKWebView, so it is read natively and published as `--accent`, with a 3:1 contrast floor choosing the foreground
- **Measured, not guessed** — titlebar height (32px), light size (14px), inset and gaps (9px) and the 16px corner radius were read from a live `NSWindow` on macOS 27; a borderless window reports a radius of 0, so it is drawn on `#root`

## 🎓 Hebrew typing trainer

A 10-finger Hebrew course that runs inside the overlay. The keyboard you learn on is the
keyboard on screen: keys light up, fingers are color-coded, and wrong keys are blocked and
flashed rather than silently accepted.

**How it teaches**

| Piece | What it does |
|---|---|
| Curriculum | 6 stages: the whole home row first, then top row, bottom row, sofit finals last |
| Placement test | Seeds your starting stage instead of restarting from the home row |
| Confidence model | Per-key accuracy *and* latency, not just hit rate |
| Gating | Accuracy-first — a stage unlocks at 98% accuracy and 0.8 confidence, judged over the last 50 attempts per key so early mistakes stop counting once you've moved past them |
| Guidance modes | Full labels → auto → dimmed → hidden, as you stop needing them |
| Error classification | Distinguishes sofit slips, confusable letters, and real-word mistypes |
| Capture source | `dom` (focused window) or `tap` (CGEventTap, works unfocused) |

**Corpus**

Practice text is the real Siddur Ashkenaz, fetched from [Sefaria](https://www.sefaria.org/Siddur_Ashkenaz):
**2,322 lines** and **5,839 unique terms**, replacing an earlier hand-typed seed. Both
source versions are **CC-BY** — *The Metsudah siddur, 1981* and *Translation based on the
Metsudah linear siddur, by Avrohom Davis, 1981* — and the app credits them on screen.

Ingest normalizes the text for typing: HTML and inline footnotes stripped, niqqud and
cantillation removed, maqaf and hyphen joiners split into separate terms, halachic rubric
segments filtered out, and the Tetragrammaton written as `ה׳` so it is not drilled
repeatedly. The geresh is therefore always-unlocked rather than gated behind a stage.

Two levels of English are shown while you type. The **line translation is Metsudah's,
quoted verbatim**, available for 1,387 lines (60%); where Sefaria publishes no English
for a source ref, none is shown. The **per-term gloss is derived** — Sefaria has no
term-level alignment, and its lexicon API has no context disambiguation (it glosses
`מודה` as *"fashion"*). The 1,257 derived glosses in `src/trainer/data/glosses.he.ts`
cover every term reachable in the first three stages and 59.7% of all term occurrences;
they are hand-maintained, and an unglossed term renders nothing rather than a guess.

The curriculum ladder is versioned (`ladderVersion` on saved progress): progress recorded
against the earlier ten-stage ladder is translated onto the equivalent stage, not clamped.

To refresh the corpus:

```bash
node scripts/ingest-siddur.mjs    # fetch 456 refs from Sefaria (~5 min)
node scripts/build-corpus.mjs     # shape into the bundled corpus JSON
npm test                          # corpus invariants guard the normalization
```

`ingest-siddur.mjs` never rewrites `glosses.he.ts`.

## 🛠️ Development

```bash
# Run tests
npm test

# Type check
npx tsc --noEmit

# Rust (must be warning-free)
cd src-tauri && cargo build

# Dev mode with hot reload
npm run tauri:dev
```

### Project Scripts

| Script | Description |
|--------|-------------|
| `npm run tauri:dev` | Start development with hot reload |
| `npm run tauri:build` | Production build → `build/` directory |
| `npm test` | Run the Vitest suite (191 cases across 36 files) |
| `npm run dev` | Vite dev server only (no Tauri) |
| `node scripts/ingest-siddur.mjs` | Fetch the Siddur corpus from Sefaria (~5 min) |
| `node scripts/build-corpus.mjs` | Shape the fetched cache into the bundled corpus |

## 🗺️ Roadmap

- [ ] Extend derived term glosses beyond the highest-frequency terms
- [ ] Additional keyboard layouts (Arabic, Chinese, Japanese, etc.)
- [ ] Custom keyboard visual themes/skins
- [ ] Windows and Linux support
- [ ] Layout editor for custom key mappings

## 🙏 Credits

**Texts.** The practice corpus is the Siddur Ashkenaz as published by
[Sefaria](https://www.sefaria.org/Siddur_Ashkenaz), from two CC-BY sources:

- Hebrew — *The Metsudah siddur*, 1981
- English — *Translation based on the Metsudah linear siddur*, by Avrohom Davis, 1981

Both are credited on screen in the trainer. The per-term English glosses in
`src/trainer/data/glosses.he.ts` are this project's own derived work and are not quotations
from Metsudah; the line translations are.

**Software.**

- [Tauri](https://v2.tauri.app) — the app shell
- [`tauri-nspanel`](https://github.com/ahkohd/tauri-nspanel) by @ahkohd — the non-activating
  NSPanel conversion the overlay depends on, and the `objc2` re-exports the native chrome
  is built with
- [`objc2`](https://github.com/madsmtm/objc2) — Rust bindings to AppKit
- [`window-vibrancy`](https://github.com/tauri-apps/window-vibrancy) — the material fallback
  where Liquid Glass is unavailable

## 🤝 Contributing

Contributions are welcome! Whether it's a new keyboard layout, a visual theme, or a bug fix.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-layout`)
3. Make your changes and test them
4. Submit a pull request

## 📄 License

[MIT](LICENSE) — use it however you like.

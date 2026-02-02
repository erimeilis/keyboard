# Hebrew Keyboard App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-platform Hebrew keyboard visualization app with Tauri + React that shows key presses in real-time and supports mouse-based Hebrew character input.

**Architecture:** Tauri app with React frontend (reusing existing Keyboard components) and Rust backend (rdev for listening, enigo for emulation). Backend emits events to frontend via Tauri IPC for key highlights and OS layout changes.

**Tech Stack:** Tauri 2.x, React 19, TypeScript 5.x, Rust 1.75+, rdev, enigo, Vitest

---

## Phase 1: Foundation Setup

### Task 1.1: Initialize Tauri Project

**Files:**
- Create: `package.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `vite.config.ts`
- Create: `tsconfig.json`

**Step 1: Install Tauri CLI**

Run:
```bash
npm install --save-dev @tauri-apps/cli@latest
```

Expected: Package installed successfully

**Step 2: Create Tauri project structure**

Run:
```bash
npm create tauri-app@latest -- --name hebrew-keyboard --template vanilla-ts
```

Answer prompts:
- Package manager: npm
- Frontend template: React + TypeScript
- Skip initial git setup (already initialized)

Expected: Project structure created

**Step 3: Update package.json with existing dependencies**

File: `package.json`

Add to dependencies:
```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tauri-apps/api": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0"
  }
}
```

**Step 4: Install dependencies**

Run:
```bash
npm install
```

Expected: All packages installed

**Step 5: Configure Tauri window settings**

File: `src-tauri/tauri.conf.json`

Update windows configuration:
```json
{
  "productName": "Hebrew Keyboard",
  "version": "0.1.0",
  "identifier": "com.keyboard.hebrew",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Hebrew Keyboard",
        "width": 952,
        "height": 340,
        "resizable": true,
        "fullscreen": false,
        "decorations": false,
        "alwaysOnTop": true,
        "transparent": true,
        "skipTaskbar": true,
        "visible": true
      }
    ],
    "security": {
      "csp": null
    }
  }
}
```

**Step 6: Update npm scripts**

File: `package.json`

Update scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

**Step 7: Verify Tauri setup**

Run:
```bash
npm run tauri:dev
```

Expected: Tauri window opens with default template

**Step 8: Commit foundation**

```bash
git add .
git commit -m "feat: initialize Tauri project structure

- Set up Tauri 2.0 with React + TypeScript
- Configure frameless, always-on-top window
- Add Vitest for testing"
```

---

### Task 1.2: Port Existing Keyboard Components

**Files:**
- Move: `src/components/Key.tsx` → `src/components/Key.tsx`
- Move: `src/components/Keyboard.tsx` → `src/components/Keyboard.tsx`
- Move: `src/components/Keyboard.css` → `src/components/Keyboard.css`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/main.tsx`

**Step 1: Create main entry point**

File: `src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 2: Create App component**

File: `src/App.tsx`

```typescript
import React from 'react';
import { Keyboard } from './components/Keyboard';
import './App.css';

function App() {
  return (
    <div className="app-container">
      <Keyboard />
    </div>
  );
}

export default App;
```

**Step 3: Create App styles**

File: `src/App.css`

```css
.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  overflow: hidden;
}
```

**Step 4: Create global styles**

File: `src/index.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
}

#root {
  width: 100vw;
  height: 100vh;
}
```

**Step 5: Move existing components**

Run:
```bash
mkdir -p src/components
cp src/components/Key.tsx src/components/Key.tsx
cp src/components/Keyboard.tsx src/components/Keyboard.tsx
cp src/components/Keyboard.css src/components/Keyboard.css
```

(Note: Files already exist in correct location from Pencil generation)

**Step 6: Test component rendering**

Run:
```bash
npm run tauri:dev
```

Expected: Keyboard displays correctly in Tauri window

**Step 7: Commit component integration**

```bash
git add src/
git commit -m "feat: integrate existing Keyboard components

- Port Key.tsx and Keyboard.tsx to Tauri app
- Create App shell and entry point
- Add global styles for transparent window"
```

---

## Phase 2: Backend Keyboard Listener

### Task 2.1: Add Rust Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Add rdev dependency**

File: `src-tauri/Cargo.toml`

Add to `[dependencies]`:
```toml
[dependencies]
tauri = { version = "2.0", features = ["macos-private-api"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rdev = "0.5"
log = "0.4"
env_logger = "0.11"
```

**Step 2: Install dependencies**

Run:
```bash
cd src-tauri
cargo build
cd ..
```

Expected: Dependencies compile successfully

**Step 3: Commit Rust dependencies**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add Rust dependencies for keyboard listening

- Add rdev for keyboard event capture
- Add logging infrastructure"
```

---

### Task 2.2: Implement Keyboard Listener Module

**Files:**
- Create: `src-tauri/src/keyboard_listener.rs`
- Modify: `src-tauri/src/main.rs`

**Step 1: Write keyboard listener module**

File: `src-tauri/src/keyboard_listener.rs`

```rust
use rdev::{listen, Event, EventType, Key};
use tauri::{AppHandle, Emitter};
use log::{info, error};
use std::sync::mpsc::{channel, Sender};
use std::thread;

pub fn start_listener(app_handle: AppHandle) {
    info!("Starting keyboard listener thread");

    let (tx, rx) = channel::<Event>();

    // Spawn listener thread
    thread::spawn(move || {
        if let Err(error) = listen(move |event| {
            if let Err(e) = tx.send(event) {
                error!("Failed to send event: {:?}", e);
            }
        }) {
            error!("Listener error: {:?}", error);
        }
    });

    // Process events in main thread
    thread::spawn(move || {
        for event in rx {
            match event.event_type {
                EventType::KeyPress(key) => {
                    let key_code = format_key_code(key);
                    info!("Key pressed: {}", key_code);

                    if let Err(e) = app_handle.emit("key-pressed", key_code) {
                        error!("Failed to emit key-pressed: {:?}", e);
                    }
                }
                EventType::KeyRelease(key) => {
                    let key_code = format_key_code(key);
                    info!("Key released: {}", key_code);

                    if let Err(e) = app_handle.emit("key-released", key_code) {
                        error!("Failed to emit key-released: {:?}", e);
                    }
                }
                _ => {}
            }
        }
    });
}

fn format_key_code(key: Key) -> String {
    match key {
        Key::KeyA => "KeyA".to_string(),
        Key::KeyB => "KeyB".to_string(),
        Key::KeyC => "KeyC".to_string(),
        Key::KeyD => "KeyD".to_string(),
        Key::KeyE => "KeyE".to_string(),
        Key::KeyF => "KeyF".to_string(),
        Key::KeyG => "KeyG".to_string(),
        Key::KeyH => "KeyH".to_string(),
        Key::KeyI => "KeyI".to_string(),
        Key::KeyJ => "KeyJ".to_string(),
        Key::KeyK => "KeyK".to_string(),
        Key::KeyL => "KeyL".to_string(),
        Key::KeyM => "KeyM".to_string(),
        Key::KeyN => "KeyN".to_string(),
        Key::KeyO => "KeyO".to_string(),
        Key::KeyP => "KeyP".to_string(),
        Key::KeyQ => "KeyQ".to_string(),
        Key::KeyR => "KeyR".to_string(),
        Key::KeyS => "KeyS".to_string(),
        Key::KeyT => "KeyT".to_string(),
        Key::KeyU => "KeyU".to_string(),
        Key::KeyV => "KeyV".to_string(),
        Key::KeyW => "KeyW".to_string(),
        Key::KeyX => "KeyX".to_string(),
        Key::KeyY => "KeyY".to_string(),
        Key::KeyZ => "KeyZ".to_string(),
        Key::Num0 => "Digit0".to_string(),
        Key::Num1 => "Digit1".to_string(),
        Key::Num2 => "Digit2".to_string(),
        Key::Num3 => "Digit3".to_string(),
        Key::Num4 => "Digit4".to_string(),
        Key::Num5 => "Digit5".to_string(),
        Key::Num6 => "Digit6".to_string(),
        Key::Num7 => "Digit7".to_string(),
        Key::Num8 => "Digit8".to_string(),
        Key::Num9 => "Digit9".to_string(),
        Key::Space => "Space".to_string(),
        Key::Escape => "Escape".to_string(),
        Key::Backspace => "Backspace".to_string(),
        Key::Tab => "Tab".to_string(),
        Key::Return => "Enter".to_string(),
        Key::ShiftLeft => "ShiftLeft".to_string(),
        Key::ShiftRight => "ShiftRight".to_string(),
        _ => format!("{:?}", key),
    }
}
```

**Step 2: Integrate into main.rs**

File: `src-tauri/src/main.rs`

```rust
mod keyboard_listener;

use log::info;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .setup(|app| {
            info!("Application started");

            let handle = app.handle().clone();
            keyboard_listener::start_listener(handle);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Test keyboard listener**

Run:
```bash
RUST_LOG=info npm run tauri:dev
```

Expected: Terminal shows "Key pressed: KeyA" when typing

**Step 4: Commit keyboard listener**

```bash
git add src-tauri/
git commit -m "feat: implement global keyboard listener

- Add keyboard_listener module with rdev
- Emit key-pressed and key-released events to frontend
- Map rdev keys to web KeyboardEvent codes"
```

---

## Phase 3: Frontend Key Highlighting

### Task 3.1: Enhance Key Component

**Files:**
- Create: `src/components/Key.test.tsx`
- Modify: `src/components/Key.tsx`
- Modify: `src/components/Keyboard.css`

**Step 1: Write failing test for isPressed prop**

File: `src/components/Key.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Key } from './Key';

describe('Key Component', () => {
  it('applies pressed class when isPressed is true', () => {
    render(
      <Key
        variant="single"
        label="A"
        isPressed={true}
      />
    );

    const keyElement = screen.getByText('A').closest('.key');
    expect(keyElement).toHaveClass('key-pressed');
  });

  it('does not apply pressed class when isPressed is false', () => {
    render(
      <Key
        variant="single"
        label="A"
        isPressed={false}
      />
    );

    const keyElement = screen.getByText('A').closest('.key');
    expect(keyElement).not.toHaveClass('key-pressed');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test
```

Expected: FAIL - "Property 'isPressed' does not exist"

**Step 3: Add isPressed prop to Key component**

File: `src/components/Key.tsx`

Update interfaces:
```typescript
interface BaseKeyProps {
  width?: number | 'fill';
  className?: string;
  colorTheme?: 'black' | 'gray' | 'red';
  isPressed?: boolean; // NEW
  onMouseClick?: () => void; // NEW
}

export interface KeySingleProps extends BaseKeyProps {
  variant: 'single';
  label: string;
}
// ... other interfaces extend BaseKeyProps
```

Update component:
```typescript
export const Key: React.FC<KeyProps> = (props) => {
  const {
    width = 54,
    className = '',
    colorTheme = 'black',
    isPressed = false, // NEW
    onMouseClick // NEW
  } = props;

  const widthStyle = width === 'fill' ? '100%' : `${width}px`;

  const getThemeClass = () => {
    switch (colorTheme) {
      case 'red':
        return 'key-theme-red';
      case 'gray':
        return 'key-theme-gray';
      default:
        return 'key-theme-black';
    }
  };

  const handleClick = () => {
    if (onMouseClick) {
      onMouseClick();
    }
  };

  // ... renderContent() stays the same ...

  return (
    <div
      className={`key ${getThemeClass()} key-variant-${props.variant} ${isPressed ? 'key-pressed' : ''} ${className}`}
      style={{ width: widthStyle }}
      onClick={handleClick}
    >
      {renderContent()}
    </div>
  );
};
```

**Step 4: Add pressed animation styles**

File: `src/components/Keyboard.css`

Add at end:
```css
/* Key pressed state */
.key-pressed {
  transform: translateY(2px) scale(0.98);
  box-shadow:
    0 0 1px rgba(58, 58, 66, 0.53),
    0 1px 1px rgba(13, 13, 15, 0.8),
    0 0 1px 0 rgba(0, 0, 0, 0.67),
    inset 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.05s ease, box-shadow 0.05s ease;
}

.key {
  transition: transform 0.05s ease, box-shadow 0.05s ease;
}
```

**Step 5: Run test to verify it passes**

Run:
```bash
npm test
```

Expected: PASS - All tests passing

**Step 6: Commit Key enhancements**

```bash
git add src/components/Key.tsx src/components/Key.test.tsx src/components/Keyboard.css
git commit -m "feat: add isPressed prop and pressed animation to Key

- Add isPressed boolean prop
- Add pressed state CSS animation
- Add click handler prop
- Add unit tests for pressed state"
```

---

### Task 3.2: Add Key Mapping System

**Files:**
- Create: `src/utils/keyMapping.ts`
- Create: `src/utils/keyMapping.test.ts`

**Step 1: Write failing test for key mapping**

File: `src/utils/keyMapping.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { mapKeyCodeToComponentId } from './keyMapping';

describe('Key Mapping', () => {
  it('maps letter keys correctly', () => {
    expect(mapKeyCodeToComponentId('KeyA')).toBe('ka');
    expect(mapKeyCodeToComponentId('KeyQ')).toBe('kq');
    expect(mapKeyCodeToComponentId('KeyZ')).toBe('kz');
  });

  it('maps number keys correctly', () => {
    expect(mapKeyCodeToComponentId('Digit1')).toBe('n1');
    expect(mapKeyCodeToComponentId('Digit0')).toBe('n0');
  });

  it('maps special keys correctly', () => {
    expect(mapKeyCodeToComponentId('Space')).toBe('space');
    expect(mapKeyCodeToComponentId('Escape')).toBe('esc');
    expect(mapKeyCodeToComponentId('Backspace')).toBe('backspace');
  });

  it('returns null for unmapped keys', () => {
    expect(mapKeyCodeToComponentId('F1')).toBeNull();
    expect(mapKeyCodeToComponentId('Unknown')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test
```

Expected: FAIL - "Cannot find module './keyMapping'"

**Step 3: Implement key mapping**

File: `src/utils/keyMapping.ts`

```typescript
/**
 * Maps OS key codes (from rdev) to Keyboard component IDs
 */
export function mapKeyCodeToComponentId(keyCode: string): string | null {
  const mapping: Record<string, string> = {
    // Letters
    'KeyA': 'ka',
    'KeyB': 'kb',
    'KeyC': 'kc',
    'KeyD': 'kd',
    'KeyE': 'ke',
    'KeyF': 'kf',
    'KeyG': 'kg',
    'KeyH': 'kh',
    'KeyI': 'ki',
    'KeyJ': 'kj',
    'KeyK': 'kk',
    'KeyL': 'kl',
    'KeyM': 'km',
    'KeyN': 'kn',
    'KeyO': 'ko',
    'KeyP': 'kp',
    'KeyQ': 'kq',
    'KeyR': 'kr',
    'KeyS': 'ks',
    'KeyT': 'kt',
    'KeyU': 'ku',
    'KeyV': 'kv',
    'KeyW': 'kw',
    'KeyX': 'kx',
    'KeyY': 'ky',
    'KeyZ': 'kz',

    // Numbers
    'Digit1': 'n1',
    'Digit2': 'n2',
    'Digit3': 'n3',
    'Digit4': 'n4',
    'Digit5': 'n5',
    'Digit6': 'n6',
    'Digit7': 'n7',
    'Digit8': 'n8',
    'Digit9': 'n9',
    'Digit0': 'n0',

    // Special keys
    'Space': 'space',
    'Escape': 'esc',
    'Backspace': 'backspace',
    'Tab': 'tab',
    'Enter': 'enter',
    'ShiftLeft': 'lshift',
    'ShiftRight': 'rshift',
    'Minus': 'mn',
    'Equal': 'eq',
    'BracketLeft': 'lb',
    'BracketRight': 'rb',
    'Backslash': 'bs',
    'Semicolon': 'semi',
    'Quote': 'quot',
    'Comma': 'comma',
    'Period': 'dot',
    'Slash': 'slash',
  };

  return mapping[keyCode] || null;
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm test
```

Expected: PASS

**Step 5: Commit key mapping**

```bash
git add src/utils/
git commit -m "feat: add key code to component ID mapping

- Create keyMapping utility
- Map OS key codes to Keyboard component IDs
- Add comprehensive unit tests"
```

---

### Task 3.3: Connect Backend Events to Frontend

**Files:**
- Modify: `src/components/Keyboard.tsx`
- Create: `src/components/Keyboard.test.tsx`

**Step 1: Write failing test for key press handling**

File: `src/components/Keyboard.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Keyboard } from './Keyboard';

// Mock Tauri API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event, callback) => {
    // Return cleanup function
    return Promise.resolve(() => {});
  }),
}));

describe('Keyboard Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Keyboard />);
    expect(container.querySelector('.keyboard')).toBeInTheDocument();
  });

  it('sets up event listeners on mount', async () => {
    const { listen } = await import('@tauri-apps/api/event');
    render(<Keyboard />);

    expect(listen).toHaveBeenCalledWith('key-pressed', expect.any(Function));
    expect(listen).toHaveBeenCalledWith('key-released', expect.any(Function));
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test
```

Expected: FAIL - "listen not called"

**Step 3: Add event listener logic to Keyboard**

File: `src/components/Keyboard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Key } from './Key';
import { mapKeyCodeToComponentId } from '../utils/keyMapping';
import './Keyboard.css';

export const Keyboard: React.FC = () => {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let unlistenPress: (() => void) | undefined;
    let unlistenRelease: (() => void) | undefined;

    // Set up event listeners
    const setupListeners = async () => {
      unlistenPress = await listen<string>('key-pressed', (event) => {
        const componentId = mapKeyCodeToComponentId(event.payload);
        if (componentId) {
          setPressedKeys(prev => new Set(prev).add(componentId));
        }
      });

      unlistenRelease = await listen<string>('key-released', (event) => {
        const componentId = mapKeyCodeToComponentId(event.payload);
        if (componentId) {
          setPressedKeys(prev => {
            const next = new Set(prev);
            next.delete(componentId);
            return next;
          });
        }
      });
    };

    setupListeners();

    // Cleanup
    return () => {
      if (unlistenPress) unlistenPress();
      if (unlistenRelease) unlistenRelease();
    };
  }, []);

  const isKeyPressed = (id: string) => pressedKeys.has(id);

  return (
    <div className="keyboard">
      {/* Row 1: Number row */}
      <div className="keyboard-row">
        <Key variant="single" label="esc" colorTheme="red" isPressed={isKeyPressed('esc')} />
        <Key variant="dualStack" top="1" bottom="!" isPressed={isKeyPressed('n1')} />
        <Key variant="dualStack" top="2" bottom="@" isPressed={isKeyPressed('n2')} />
        <Key variant="dualStack" top="3" bottom="#" isPressed={isKeyPressed('n3')} />
        <Key variant="dualStack" top="4" bottom="$" isPressed={isKeyPressed('n4')} />
        <Key variant="dualStack" top="5" bottom="%" colorTheme="gray" isPressed={isKeyPressed('n5')} />
        <Key variant="dualStack" top="6" bottom="^" colorTheme="gray" isPressed={isKeyPressed('n6')} />
        <Key variant="dualStack" top="7" bottom="&" colorTheme="gray" isPressed={isKeyPressed('n7')} />
        <Key variant="dualStack" top="8" bottom="*" colorTheme="gray" isPressed={isKeyPressed('n8')} />
        <Key variant="dualStack" top="9" bottom="(" isPressed={isKeyPressed('n9')} />
        <Key variant="dualStack" top="0" bottom=")" isPressed={isKeyPressed('n0')} />
        <Key variant="dualStack" top="-" bottom="—" isPressed={isKeyPressed('mn')} />
        <Key variant="dualStack" top="=" bottom="+" isPressed={isKeyPressed('eq')} />
        <Key variant="single" label="← backspace" width="fill" isPressed={isKeyPressed('backspace')} />
        <Key variant="single" label="☀" />
      </div>

      {/* Row 2: QWERTY row */}
      <div className="keyboard-row">
        <Key variant="single" label="tab⇥" width={81} isPressed={isKeyPressed('tab')} />
        <Key variant="dualPos" primary="Q" secondary="/" isPressed={isKeyPressed('kq')} />
        <Key variant="dualPos" primary="W" secondary="'" isPressed={isKeyPressed('kw')} />
        <Key variant="dualPos" primary="E" secondary="ק" isPressed={isKeyPressed('ke')} />
        <Key variant="dualPos" primary="R" secondary="ר" isPressed={isKeyPressed('kr')} />
        <Key variant="dualPos" primary="T" secondary="א" isPressed={isKeyPressed('kt')} />
        <Key variant="dualPos" primary="Y" secondary="ט" isPressed={isKeyPressed('ky')} />
        <Key variant="dualPos" primary="U" secondary="ו" isPressed={isKeyPressed('ku')} />
        <Key variant="dualPos" primary="I" secondary="ן" isPressed={isKeyPressed('ki')} />
        <Key variant="dualPos" primary="O" secondary="ם" isPressed={isKeyPressed('ko')} />
        <Key variant="dualPos" primary="P" secondary="פ" isPressed={isKeyPressed('kp')} />
        <Key variant="dualStack" top="{" bottom="[" isPressed={isKeyPressed('lb')} />
        <Key variant="dualStack" top="}" bottom="]" isPressed={isKeyPressed('rb')} />
        <Key variant="dualStack" top="|" bottom="\" width="fill" colorTheme="gray" isPressed={isKeyPressed('bs')} />
        <Key variant="single" label="home" />
      </div>

      {/* Row 3: ASDF row */}
      <div className="keyboard-row">
        <Key variant="single" label="caps lock" width={95} />
        <Key variant="dualPos" primary="A" secondary="ש" isPressed={isKeyPressed('ka')} />
        <Key variant="dualPos" primary="S" secondary="ד" isPressed={isKeyPressed('ks')} />
        <Key variant="dualPos" primary="D" secondary="ג" isPressed={isKeyPressed('kd')} />
        <Key variant="dualPos" primary="F" secondary="כ" isPressed={isKeyPressed('kf')} />
        <Key variant="dualPos" primary="G" secondary="ע" isPressed={isKeyPressed('kg')} />
        <Key variant="dualPos" primary="H" secondary="י" isPressed={isKeyPressed('kh')} />
        <Key variant="dualPos" primary="J" secondary="ח" isPressed={isKeyPressed('kj')} />
        <Key variant="dualPos" primary="K" secondary="ל" isPressed={isKeyPressed('kk')} />
        <Key variant="dualPos" primary="L" secondary="ך" isPressed={isKeyPressed('kl')} />
        <Key variant="dualPos" primary=":" secondary="ף" isPressed={isKeyPressed('semi')} />
        <Key variant="dualPos" primary="&quot;" secondary="," isPressed={isKeyPressed('quot')} />
        <Key variant="single" label="← enter" colorTheme="red" width="fill" isPressed={isKeyPressed('enter')} />
        <Key variant="single" label="pgup" />
      </div>

      {/* Row 4: ZXCV row */}
      <div className="keyboard-row">
        <Key variant="single" label="⇧ shift" width="fill" isPressed={isKeyPressed('lshift')} />
        <Key variant="dualPos" primary="Z" secondary="ז" isPressed={isKeyPressed('kz')} />
        <Key variant="dualPos" primary="X" secondary="ס" isPressed={isKeyPressed('kx')} />
        <Key variant="dualPos" primary="C" secondary="ב" isPressed={isKeyPressed('kc')} />
        <Key variant="dualPos" primary="V" secondary="ה" isPressed={isKeyPressed('kv')} />
        <Key variant="dualPos" primary="B" secondary="נ" isPressed={isKeyPressed('kb')} />
        <Key variant="dualPos" primary="N" secondary="מ" isPressed={isKeyPressed('kn')} />
        <Key variant="dualPos" primary="M" secondary="צ" isPressed={isKeyPressed('km')} />
        <Key variant="dualPos" primary="<" secondary="ת" isPressed={isKeyPressed('comma')} />
        <Key variant="dualPos" primary=">" secondary="ץ" isPressed={isKeyPressed('dot')} />
        <Key variant="dualPos" primary="?" secondary="." isPressed={isKeyPressed('slash')} />
        <Key variant="single" label="⇧ shift" width={95} isPressed={isKeyPressed('rshift')} />
        <Key variant="icon" iconName="chevron-up" />
        <Key variant="single" label="pgdn" />
      </div>

      {/* Row 5: Bottom row */}
      <div className="keyboard-row">
        <Key variant="single" label="control" width={68} />
        <Key variant="single" label="option" width={68} />
        <Key variant="icon" iconName="command" width={68} colorTheme="gray" />
        <Key variant="single" label="" width="fill" isPressed={isKeyPressed('space')} />
        <Key variant="icon" iconName="command" colorTheme="gray" />
        <Key variant="single" label="fn1" />
        <Key variant="single" label="fn2" />
        <Key variant="icon" iconName="chevron-left" />
        <Key variant="icon" iconName="chevron-down" />
        <Key variant="icon" iconName="chevron-right" />
      </div>
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm test
```

Expected: PASS

**Step 5: Test integration manually**

Run:
```bash
RUST_LOG=info npm run tauri:dev
```

Action: Press keys on keyboard
Expected: Keys highlight in real-time

**Step 6: Commit keyboard event integration**

```bash
git add src/components/Keyboard.tsx src/components/Keyboard.test.tsx
git commit -m "feat: connect backend keyboard events to frontend

- Listen to key-pressed/key-released events from Rust
- Map key codes to component IDs
- Update Key components with isPressed state
- Add integration tests"
```

---

## Phase 4: OS Layout Detection

### Task 4.1: Implement macOS Layout Detection

**Files:**
- Create: `src-tauri/src/layout_detector_macos.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`

**Step 1: Add core-foundation dependency (macOS)**

File: `src-tauri/Cargo.toml`

Add to `[target.'cfg(target_os = "macos")'.dependencies]`:
```toml
[target.'cfg(target_os = "macos")'.dependencies]
core-foundation = "0.9"
core-foundation-sys = "0.8"
```

**Step 2: Implement macOS layout detector**

File: `src-tauri/src/layout_detector_macos.rs`

```rust
#[cfg(target_os = "macos")]
use core_foundation::base::TCFType;
use core_foundation::string::{CFString, CFStringRef};
use core_foundation_sys::base::CFTypeRef;
use std::ffi::c_void;

#[link(name = "Carbon", kind = "framework")]
extern "C" {
    fn TISCopyCurrentKeyboardInputSource() -> CFTypeRef;
    fn TISGetInputSourceProperty(source: CFTypeRef, property_key: CFStringRef) -> *const c_void;
}

const K_TIS_PROPERTY_INPUT_SOURCE_ID: &str = "TISPropertyInputSourceID";

pub fn get_active_keyboard_layout() -> String {
    unsafe {
        let source = TISCopyCurrentKeyboardInputSource();
        if source.is_null() {
            return "unknown".to_string();
        }

        let property_key = CFString::new(K_TIS_PROPERTY_INPUT_SOURCE_ID);
        let layout_id_ptr = TISGetInputSourceProperty(source, property_key.as_concrete_TypeRef());

        if layout_id_ptr.is_null() {
            return "unknown".to_string();
        }

        let layout_id = CFString::wrap_under_get_rule(layout_id_ptr as CFStringRef);
        layout_id.to_string()
    }
}
```

**Step 3: Add Tauri command**

File: `src-tauri/src/main.rs`

```rust
mod keyboard_listener;

#[cfg(target_os = "macos")]
mod layout_detector_macos;

use log::info;
use tauri::Manager;

#[tauri::command]
fn get_active_keyboard_layout() -> String {
    #[cfg(target_os = "macos")]
    {
        layout_detector_macos::get_active_keyboard_layout()
    }

    #[cfg(not(target_os = "macos"))]
    {
        "com.apple.keylayout.US".to_string() // Fallback for non-macOS
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .setup(|app| {
            info!("Application started");

            let handle = app.handle().clone();
            keyboard_listener::start_listener(handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_active_keyboard_layout])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 4: Build and test**

Run:
```bash
cd src-tauri
cargo build
cd ..
npm run tauri:dev
```

Expected: App launches successfully

**Step 5: Test layout detection in browser console**

In Tauri dev window, open DevTools console and run:
```javascript
window.__TAURI__.invoke('get_active_keyboard_layout').then(console.log)
```

Expected: Logs layout ID like "com.apple.keylayout.US"

**Step 6: Commit layout detection**

```bash
git add src-tauri/
git commit -m "feat: add macOS keyboard layout detection

- Implement TIS API integration for macOS
- Add get_active_keyboard_layout command
- Return layout identifier string"
```

---

### Task 4.2: Add Frontend Layout Polling

**Files:**
- Modify: `src/App.tsx`
- Create: `src/hooks/useKeyboardLayout.ts`
- Create: `src/hooks/useKeyboardLayout.test.ts`

**Step 1: Write failing test for layout hook**

File: `src/hooks/useKeyboardLayout.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useKeyboardLayout } from './useKeyboardLayout';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('useKeyboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "en" for US layout', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValue('com.apple.keylayout.US');

    const { result } = renderHook(() => useKeyboardLayout());

    await waitFor(() => {
      expect(result.current).toBe('en');
    });
  });

  it('returns "he" for Hebrew layout', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValue('com.apple.keylayout.Hebrew');

    const { result } = renderHook(() => useKeyboardLayout());

    await waitFor(() => {
      expect(result.current).toBe('he');
    });
  });

  it('polls layout every 500ms', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValue('com.apple.keylayout.US');

    renderHook(() => useKeyboardLayout());

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_active_keyboard_layout');
    });

    // Wait for second poll
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test
```

Expected: FAIL - "Cannot find module './useKeyboardLayout'"

**Step 3: Implement layout hook**

File: `src/hooks/useKeyboardLayout.ts`

```typescript
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type KeyboardLayout = 'en' | 'he';

export function useKeyboardLayout(): KeyboardLayout {
  const [layout, setLayout] = useState<KeyboardLayout>('en');

  useEffect(() => {
    const checkLayout = async () => {
      try {
        const layoutId = await invoke<string>('get_active_keyboard_layout');

        // Detect Hebrew layout
        if (layoutId.toLowerCase().includes('hebrew')) {
          setLayout('he');
        } else {
          setLayout('en');
        }
      } catch (error) {
        console.error('Failed to get keyboard layout:', error);
      }
    };

    // Initial check
    checkLayout();

    // Poll every 500ms
    const interval = setInterval(checkLayout, 500);

    return () => clearInterval(interval);
  }, []);

  return layout;
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm test
```

Expected: PASS

**Step 5: Integrate hook into App**

File: `src/App.tsx`

```typescript
import React from 'react';
import { Keyboard } from './components/Keyboard';
import { useKeyboardLayout } from './hooks/useKeyboardLayout';
import './App.css';

function App() {
  const activeLayout = useKeyboardLayout();

  return (
    <div className="app-container">
      <div className="keyboard-wrapper" data-active-lang={activeLayout}>
        <Keyboard />
      </div>
    </div>
  );
}

export default App;
```

**Step 6: Add layout emphasis CSS**

File: `src/components/Keyboard.css`

Add at end:
```css
/* Language emphasis based on active layout */
.keyboard-wrapper[data-active-lang="he"] .key-label-primary {
  opacity: 0.4; /* English dim */
}

.keyboard-wrapper[data-active-lang="he"] .key-label-secondary {
  opacity: 1.0; /* Hebrew bright */
}

.keyboard-wrapper[data-active-lang="en"] .key-label-primary {
  opacity: 1.0; /* English bright */
}

.keyboard-wrapper[data-active-lang="en"] .key-label-secondary {
  opacity: 0.4; /* Hebrew dim */
}
```

**Step 7: Test layout switching**

Run:
```bash
npm run tauri:dev
```

Action: Change keyboard layout using macOS Cmd+Space
Expected: Visual emphasis switches between English/Hebrew labels

**Step 8: Commit layout polling**

```bash
git add src/hooks/ src/App.tsx src/components/Keyboard.css
git commit -m "feat: add keyboard layout polling and visual emphasis

- Create useKeyboardLayout hook
- Poll layout every 500ms
- Apply CSS emphasis based on active layout
- Add unit tests for hook"
```

---

## Summary & Next Steps

This implementation plan covers **Phase 1 (Foundation)**, **Phase 2 (Backend Listener)**, **Phase 3 (Frontend Highlighting)**, and **Phase 4 (Layout Detection)**.

**Remaining phases** (to be added in separate plan documents):
- **Phase 5**: Mouse Emulation Mode (enigo integration, keyboard injection)
- **Phase 6**: Settings Panel (always-on-top toggle, opacity, persistence)
- **Phase 7**: Window Management (draggable region, system tray, position memory)
- **Phase 8**: Error Handling & Polish (permission modals, fallbacks, logging)
- **Phase 9**: Testing & CI/CD (integration tests, benchmarks, release pipeline)

**Current State After This Plan**:
✅ Tauri app with React frontend
✅ Global keyboard listener (rdev)
✅ Real-time key highlighting
✅ OS layout detection (macOS)
✅ Visual language emphasis
✅ Unit tests for all components

**To Complete Next**:
- Add keyboard emulation with enigo
- Implement settings UI
- Add permission handling
- Polish and package for release

# Virtual Keyboard Typing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the overlay keyboard functional for typing — clicking keys sends characters to the focused app, like macOS Accessibility Keyboard.

**Architecture:** Non-activating NSPanel window (clicks don't steal focus) + `rdev::simulate` for raw keycode injection (macOS applies active input source for Hebrew/English) + sticky modifier state in React (single-click = active until next key, double-click = locked).

**Tech Stack:** Rust (Tauri, rdev, cocoa), React/TypeScript, macOS CGEvent API (via rdev)

---

### Task 1: Add `cocoa` crate and make window non-activating (NSPanel)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add cocoa dependency to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[target.'cfg(target_os = "macos")'.dependencies]`:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
core-foundation = "0.9"
core-foundation-sys = "0.8"
cocoa = "0.26"
```

**Step 2: Add NSPanel non-activating setup in lib.rs**

In `src-tauri/src/lib.rs`, inside the `.setup(|app| { ... })` closure, after `keyboard_listener::start_listener(handle);`, add:

```rust
#[cfg(target_os = "macos")]
{
    use cocoa::appkit::NSWindow;
    use cocoa::base::id;

    if let Some(window) = app.get_webview_window("main") {
        let ns_window = window.ns_window().unwrap() as id;
        unsafe {
            // NSWindowStyleMaskNonactivatingPanel = 1 << 7 = 128
            // This prevents the window from stealing focus when clicked
            ns_window.setStyleMask_(ns_window.styleMask() | 128);
        }
    }
}
```

This requires `use tauri::Manager;` at the top (already imported).

**Step 3: Build and verify**

Run: `cd src-tauri && cargo build 2>&1`

Expected: Compiles with no errors or warnings. The `cocoa` crate downloads and the NSPanel mask is applied.

**Step 4: Run and verify non-activating behavior**

Run: `npm run tauri:dev`

Test: Open a text editor (e.g., TextEdit), type some text to give it focus, then click on the keyboard overlay. **The text editor should keep focus** — the keyboard overlay should NOT activate/steal focus.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: make overlay window non-activating with NSPanel"
```

---

### Task 2: Create key simulator module (Rust backend)

**Files:**
- Create: `src-tauri/src/key_simulator.rs`

**Step 1: Create the key_simulator.rs file**

Create `src-tauri/src/key_simulator.rs` with the full `simulate_key` Tauri command and the inverse `key_from_string` mapping:

```rust
use rdev::{simulate, EventType, Key};
use log::{info, error};
use std::thread;
use std::time::Duration;

/// Inverse of keyboard_listener::format_key_code()
/// Maps string key codes back to rdev::Key enum
fn key_from_string(key_code: &str) -> Option<Key> {
    match key_code {
        // Letters
        "KeyA" => Some(Key::KeyA),
        "KeyB" => Some(Key::KeyB),
        "KeyC" => Some(Key::KeyC),
        "KeyD" => Some(Key::KeyD),
        "KeyE" => Some(Key::KeyE),
        "KeyF" => Some(Key::KeyF),
        "KeyG" => Some(Key::KeyG),
        "KeyH" => Some(Key::KeyH),
        "KeyI" => Some(Key::KeyI),
        "KeyJ" => Some(Key::KeyJ),
        "KeyK" => Some(Key::KeyK),
        "KeyL" => Some(Key::KeyL),
        "KeyM" => Some(Key::KeyM),
        "KeyN" => Some(Key::KeyN),
        "KeyO" => Some(Key::KeyO),
        "KeyP" => Some(Key::KeyP),
        "KeyQ" => Some(Key::KeyQ),
        "KeyR" => Some(Key::KeyR),
        "KeyS" => Some(Key::KeyS),
        "KeyT" => Some(Key::KeyT),
        "KeyU" => Some(Key::KeyU),
        "KeyV" => Some(Key::KeyV),
        "KeyW" => Some(Key::KeyW),
        "KeyX" => Some(Key::KeyX),
        "KeyY" => Some(Key::KeyY),
        "KeyZ" => Some(Key::KeyZ),

        // Numbers
        "Digit0" => Some(Key::Num0),
        "Digit1" => Some(Key::Num1),
        "Digit2" => Some(Key::Num2),
        "Digit3" => Some(Key::Num3),
        "Digit4" => Some(Key::Num4),
        "Digit5" => Some(Key::Num5),
        "Digit6" => Some(Key::Num6),
        "Digit7" => Some(Key::Num7),
        "Digit8" => Some(Key::Num8),
        "Digit9" => Some(Key::Num9),

        // Special keys
        "Space" => Some(Key::Space),
        "Escape" => Some(Key::Escape),
        "Backspace" => Some(Key::Backspace),
        "Tab" => Some(Key::Tab),
        "Enter" => Some(Key::Return),
        "CapsLock" => Some(Key::CapsLock),

        // Modifiers
        "ShiftLeft" => Some(Key::ShiftLeft),
        "ShiftRight" => Some(Key::ShiftRight),
        "ControlLeft" => Some(Key::ControlLeft),
        "ControlRight" => Some(Key::ControlRight),
        "Alt" => Some(Key::Alt),
        "MetaLeft" => Some(Key::MetaLeft),
        "MetaRight" => Some(Key::MetaRight),

        // Punctuation
        "Minus" => Some(Key::Minus),
        "Equal" => Some(Key::Equal),
        "BracketLeft" => Some(Key::LeftBracket),
        "BracketRight" => Some(Key::RightBracket),
        "Backslash" => Some(Key::BackSlash),
        "Semicolon" => Some(Key::SemiColon),
        "Quote" => Some(Key::Quote),
        "Comma" => Some(Key::Comma),
        "Period" => Some(Key::Dot),
        "Slash" => Some(Key::Slash),

        // Arrow keys
        "ArrowUp" => Some(Key::UpArrow),
        "ArrowDown" => Some(Key::DownArrow),
        "ArrowLeft" => Some(Key::LeftArrow),
        "ArrowRight" => Some(Key::RightArrow),

        _ => None,
    }
}

fn send(event_type: &EventType) {
    if let Err(e) = simulate(event_type) {
        error!("simulate error: {:?}", e);
    }
    // Small delay for macOS to process the event
    thread::sleep(Duration::from_millis(20));
}

#[tauri::command]
pub fn simulate_key(key_code: String, modifiers: Vec<String>) {
    info!("simulate_key: {} with modifiers: {:?}", key_code, modifiers);

    let target_key = match key_from_string(&key_code) {
        Some(k) => k,
        None => {
            error!("Unknown key code: {}", key_code);
            return;
        }
    };

    // Collect modifier keys
    let mod_keys: Vec<Key> = modifiers
        .iter()
        .filter_map(|m| key_from_string(m))
        .collect();

    // Press modifiers
    for mk in &mod_keys {
        send(&EventType::KeyPress(*mk));
    }

    // Press and release the target key
    send(&EventType::KeyPress(target_key));
    send(&EventType::KeyRelease(target_key));

    // Release modifiers (reverse order)
    for mk in mod_keys.iter().rev() {
        send(&EventType::KeyRelease(*mk));
    }
}
```

**Step 2: Build and verify**

Run: `cd src-tauri && cargo build 2>&1`

Expected: Compiles with no errors or warnings. The `simulate_key` function and `key_from_string` mapping are available.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add key simulator module with rdev::simulate"
```

---

### Task 3: Register simulate_key command in lib.rs

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add module declaration and register command**

In `src-tauri/src/lib.rs`:

1. Add `mod key_simulator;` at the top (after `mod keyboard_listener;`)
2. Add `key_simulator::simulate_key` to the `invoke_handler`:

```rust
.invoke_handler(tauri::generate_handler![
    get_active_keyboard_layout,
    key_simulator::simulate_key
])
```

**Step 2: Build and verify**

Run: `cd src-tauri && cargo build 2>&1`

Expected: Compiles with no errors or warnings.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: register simulate_key Tauri command"
```

---

### Task 4: Add sticky modifier state and click handlers in React

**Files:**
- Modify: `src/components/Keyboard.tsx`

This is the biggest task. We need to:
1. Add `stickyModifiers` and `lockedModifiers` state
2. Create a `handleKeyClick(keyCode)` function
3. Pass `onMouseClick` callbacks to every `<Key>` component
4. Wire modifier keys to toggle sticky/locked state
5. Wire regular keys to invoke `simulate_key` then clear sticky modifiers

**Step 1: Update Keyboard.tsx with full click handling**

Add to imports:

```typescript
import { invoke } from '@tauri-apps/api/core';
```

Add state inside the `Keyboard` component (after `pressedKeys` state):

```typescript
const [stickyModifiers, setStickyModifiers] = useState<Set<string>>(new Set());
const [lockedModifiers, setLockedModifiers] = useState<Set<string>>(new Set());
```

Define the set of modifier key codes:

```typescript
const MODIFIER_KEYS = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'Alt', 'MetaLeft', 'MetaRight'
]);
```

Add the click handler:

```typescript
const handleKeyClick = async (keyCode: string) => {
  if (MODIFIER_KEYS.has(keyCode)) {
    // Toggle sticky modifier
    setStickyModifiers(prev => {
      const next = new Set(prev);
      if (next.has(keyCode)) {
        next.delete(keyCode);
      } else {
        next.add(keyCode);
      }
      return next;
    });
    return;
  }

  // Regular key: collect all active modifiers and simulate
  const modifiers = [...stickyModifiers, ...lockedModifiers];
  try {
    await invoke('simulate_key', { keyCode, modifiers });
  } catch (e) {
    console.error('simulate_key failed:', e);
  }

  // Clear sticky modifiers (keep locked)
  setStickyModifiers(new Set());
};
```

Add double-click handler for locking modifiers:

```typescript
const handleModifierDoubleClick = (keyCode: string) => {
  setLockedModifiers(prev => {
    const next = new Set(prev);
    if (next.has(keyCode)) {
      next.delete(keyCode);
    } else {
      next.add(keyCode);
    }
    return next;
  });
  // Remove from sticky if locked
  setStickyModifiers(prev => {
    const next = new Set(prev);
    next.delete(keyCode);
    return next;
  });
};
```

Helper to check if a key is in sticky or locked state:

```typescript
const isKeySticky = (keyCode: string) => stickyModifiers.has(keyCode);
const isKeyLocked = (keyCode: string) => lockedModifiers.has(keyCode);
```

**Step 2: Wire onMouseClick to every Key component**

Each `<Key>` needs `onMouseClick={() => handleKeyClick('KeyCode')}` where the key code matches the `format_key_code` strings from `keyboard_listener.rs`.

For modifier keys, also add `onDoubleClick`.

The component ID to key code reverse mapping (from `keyMapping.ts`):
- `ka` → `KeyA`, `n1` → `Digit1`, `space` → `Space`, etc.
- `lshift` → `ShiftLeft`, `rshift` → `ShiftRight`

Every key in Keyboard.tsx that has an `isPressed` prop already has a component ID. Add `onMouseClick` using the corresponding key code string.

Example for a few keys (apply to ALL keys):

```tsx
<Key variant="single" label="esc" colorTheme="red"
  isPressed={isKeyPressed('esc')}
  onMouseClick={() => handleKeyClick('Escape')} />

<Key variant="dualStack" top="1" bottom="!"
  isPressed={isKeyPressed('n1')}
  onMouseClick={() => handleKeyClick('Digit1')} />

<Key variant="dualPos" primary="Q" secondary="/"
  isPressed={isKeyPressed('kq')}
  onMouseClick={() => handleKeyClick('KeyQ')} />

<Key variant="single" label="⇧ shift" width="fill"
  isPressed={isKeyPressed('lshift')}
  onMouseClick={() => handleKeyClick('ShiftLeft')}
  className={isKeySticky('ShiftLeft') ? 'key-sticky' : isKeyLocked('ShiftLeft') ? 'key-locked' : ''} />
```

Complete list of key code mappings for onMouseClick (apply to every Key that has isPressed):

| Component ID | Key Code for onMouseClick |
|---|---|
| esc | Escape |
| n1-n9 | Digit1-Digit9 |
| n0 | Digit0 |
| mn | Minus |
| eq | Equal |
| backspace | Backspace |
| tab | Tab |
| kq-kz | KeyQ-KeyZ (matching letter) |
| lb | BracketLeft |
| rb | BracketRight |
| bs | Backslash |
| semi | Semicolon |
| quot | Quote |
| enter | Enter |
| lshift | ShiftLeft |
| rshift | ShiftRight |
| comma | Comma |
| dot | Period |
| slash | Slash |
| space | Space |

Bottom row modifier keys (currently without isPressed/component IDs):
- `caps lock` → CapsLock
- `control` → ControlLeft
- `option` → Alt
- `command` (left) → MetaLeft
- `command` (right) → MetaRight

Arrow keys:
- chevron-up → ArrowUp
- chevron-down → ArrowDown
- chevron-left → ArrowLeft
- chevron-right → ArrowRight

Keys like `home`, `pgup`, `pgdn`, `fn1`, `fn2`, `☀` can be left without onMouseClick for now.

**Step 3: Handle double-click on modifier keys**

The `Key` component currently only supports `onMouseClick`. We need to handle double-click for modifier locking. Two options:

**Option A (simpler):** Use `onDoubleClick` on the `<div>` in Key.tsx. Add `onDoubleClick` prop to `BaseKeyProps`.

In `Key.tsx`, add to `BaseKeyProps`:

```typescript
onDoubleClick?: () => void;
```

In the `<div>` element, add:

```tsx
onDoubleClick={onDoubleClick}
```

Then in Keyboard.tsx for modifier keys:

```tsx
<Key variant="single" label="⇧ shift" width="fill"
  isPressed={isKeyPressed('lshift')}
  onMouseClick={() => handleKeyClick('ShiftLeft')}
  onDoubleClick={() => handleModifierDoubleClick('ShiftLeft')}
  className={isKeySticky('ShiftLeft') ? 'key-sticky' : isKeyLocked('ShiftLeft') ? 'key-locked' : ''} />
```

**Step 4: Build and verify**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors.

**Step 5: Run and test the full flow**

Run: `npm run tauri:dev`

Test sequence:
1. Open TextEdit, type a few characters to have a cursor position
2. Click "A" on the overlay → "a" appears in TextEdit
3. Click "⇧ shift" on overlay (it should highlight as sticky) → click "A" → "A" (uppercase) appears in TextEdit, shift un-highlights
4. Double-click "⇧ shift" (it should highlight as locked) → click "A", "B", "C" → "ABC" all uppercase → click shift again to unlock
5. Switch macOS input to Hebrew → click "T" on overlay → "א" appears (macOS maps the raw keycode)

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add virtual typing with sticky modifiers"
```

---

### Task 5: Add CSS styles for sticky and locked modifier states

**Files:**
- Modify: `src/components/Keyboard.css`

**Step 1: Add sticky and locked CSS classes**

Add to `src/components/Keyboard.css`:

```css
/* Sticky modifier — single click active, waiting for next key */
.key-sticky {
  background: linear-gradient(180deg, #4a6fa5 0%, #2d4a7a 100%) !important;
  border-color: rgba(100, 160, 255, 0.4) !important;
  box-shadow: 0 0 8px rgba(100, 160, 255, 0.3);
}

/* Locked modifier — double-click locked, stays active */
.key-locked {
  background: linear-gradient(180deg, #5a3a8a 0%, #3d2060 100%) !important;
  border-color: rgba(160, 100, 255, 0.4) !important;
  box-shadow: 0 0 8px rgba(160, 100, 255, 0.3);
}
```

**Step 2: Verify styles appear**

Run: `npm run tauri:dev`

Test: Click shift — it should glow blue. Double-click shift — it should glow purple.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add visual styles for sticky and locked modifiers"
```

---

## Risks & Mitigations

1. **Accessibility permissions**: `rdev::simulate` needs Accessibility access. We already have it for listening. If not working, check System Settings → Privacy → Accessibility.

2. **NSPanel conversion**: Setting the non-activating mask after window creation may have edge cases. If clicks still steal focus, we may need to create the window as an NSPanel from the start (requires Tauri plugin or raw window creation).

3. **Simulate timing**: The 20ms delay between simulated events may need tuning. If events are dropped, increase to 30-40ms. If typing feels sluggish, decrease to 10ms.

4. **Keyboard listener echo**: Our physical keyboard listener will pick up simulated events, causing the key to flash pressed briefly. This is actually desirable — it provides visual feedback.

5. **Focus edge cases**: Some apps (terminal emulators, games) may handle synthetic events differently than real keypresses.

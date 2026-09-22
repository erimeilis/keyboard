# Virtual Keyboard Typing Design

## Goal

Make the keyboard overlay functional for typing. Clicking keys on the overlay inputs characters into whatever application currently has focus, like macOS Accessibility Keyboard.

## Decisions

- **Focus handling**: Non-activating window (NSPanel) — clicks don't steal focus from target app
- **Key injection**: `rdev::simulate` — sends raw keycodes, macOS applies active input source (Hebrew/English)
- **Modifier behavior**: Sticky modifiers — click Shift, it stays active, next key is modified, then Shift auto-releases. Double-click locks.
- **Input method**: Raw keycodes, not Unicode characters. macOS handles layout mapping.

## Architecture

### 1. Non-Activating Window (Rust/macOS)

In `lib.rs` setup, after window creation, access the native `NSWindow` and set it as non-activating:

```rust
#[cfg(target_os = "macos")]
{
    use cocoa::appkit::NSWindow;
    use cocoa::base::id;

    let ns_window = window.ns_window().unwrap() as id;
    unsafe {
        // NSWindowStyleMaskNonactivatingPanel = 1 << 7 = 128
        ns_window.setStyleMask_(ns_window.styleMask() | 128);
    }
}
```

Requires `cocoa` crate added to `Cargo.toml`.

### 2. Key Simulation (Rust backend)

New file `src-tauri/src/key_simulator.rs`:

- Tauri command: `simulate_key(key_code: String, modifiers: Vec<String>)`
- Presses active modifiers, presses/releases target key, releases modifiers
- Uses `rdev::simulate()` which wraps `CGEventPost` on macOS
- Includes `key_from_string()` — inverse of existing `format_key_code()`

Sequence for clicking "A" with Shift sticky:
```
Shift↓ → A↓ → A↑ → Shift↑
```

Small delay (~20ms) between simulate calls may be needed for macOS to process events reliably.

### 3. Sticky Modifier State (React)

In `Keyboard.tsx`:

- State: `stickyModifiers: Set<string>` tracks active modifiers
- State: `lockedModifiers: Set<string>` tracks double-click-locked modifiers
- Click modifier key → toggle in stickyModifiers
- Double-click modifier → toggle in lockedModifiers
- Click regular key → invoke `simulate_key` with current modifiers → clear stickyModifiers (keep lockedModifiers)
- Visual: `.key-sticky` class for single-click active, `.key-locked` for double-click locked

### 4. Data Flow

```
User clicks key in overlay
  → Key.onClick fires
  → Keyboard.handleKeyClick(keyCode) called
  → Collects stickyModifiers + lockedModifiers into modifiers array
  → invoke("simulate_key", { key_code, modifiers })
  → Rust: rdev::simulate(KeyPress/KeyRelease) sequence
  → macOS CGEvent posted to focused app
  → React: clear stickyModifiers (keep lockedModifiers)
  → Physical keyboard listener picks up the simulated event
  → Key shows pressed animation briefly
```

### 5. Key Mapping

Reuse the same key code strings from `keyboard_listener.rs::format_key_code()`. Add inverse function `key_from_string()` with the same mapping table.

Modifier keys: ShiftLeft, ShiftRight, ControlLeft, Alt (Option), MetaLeft (Command), MetaRight.

## Files to Create/Modify

| File | Change |
|------|--------|
| `src-tauri/src/key_simulator.rs` | New — simulate_key command + string-to-Key mapping |
| `src-tauri/src/lib.rs` | Register simulate_key command, add NSPanel non-activating setup |
| `src-tauri/Cargo.toml` | Add `cocoa` crate |
| `src/components/Keyboard.tsx` | Add sticky modifier state, wire onMouseClick to invoke |
| `src/components/Keyboard.css` | Add .key-sticky and .key-locked visual styles |

## Risks

- **Accessibility permissions**: `rdev::simulate` requires Accessibility access. We already request this for listening, so it should work.
- **NSPanel conversion**: Converting an existing NSWindow to non-activating after creation may have edge cases. Fallback: create the window as NSPanel from the start.
- **Simulate timing**: macOS may need small delays between simulated key events. Start with 0ms, add delay if events are dropped.
- **Focus edge cases**: Some apps may handle synthetic events differently than real keypresses.

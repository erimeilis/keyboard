# Hebrew Keyboard Visualization App - Design Document

**Date**: February 2, 2026
**Status**: Approved
**Tech Stack**: Tauri + React + Rust

## Overview

A cross-platform desktop app that provides visual feedback for Hebrew keyboard layout, helping users with English-only keyboards type Hebrew without physical stickers.

### Primary Use Cases
- **Accessibility**: Help users see Hebrew characters on English keyboards
- **Learning**: Teach Hebrew keyboard layout through visual feedback

### Target Platforms
- macOS (primary)
- Windows
- Linux

---

## Architecture

### Frontend: React + TypeScript
- Existing keyboard components (Key.tsx, Keyboard.tsx, Keyboard.css)
- UI state management for key highlights
- Language emphasis based on OS layout detection
- Settings panel (always-on-top, opacity, size)
- Tauri IPC for backend communication

### Backend: Rust
- **rdev**: Global keyboard listener (captures all keypresses)
- **enigo**: Keyboard event injection (mouse emulation mode)
- **tauri**: Window management and IPC
- OS-specific APIs for keyboard layout detection

### Key Libraries
- `rdev` - Cross-platform keyboard/mouse event listening
- `enigo` - Cross-platform keyboard event injection
- `tauri` - App framework
- React + TypeScript (existing)

### Communication Flow
```
Physical Keyboard → rdev listener → Tauri event → React (highlight key)
Mouse Click → React → Tauri command → enigo → OS (inject keypress)
OS Layout Change → Backend poll → React (update emphasis)
```

### Performance Targets
- Bundle size: ~5MB
- Memory usage: <100MB idle
- Keypress latency: <16ms (60fps)
- Launch time: <2 seconds

---

## Component Structure

```
<App>
  ├── <SettingsPanel> (collapsible)
  │   ├── Always-on-Top Toggle
  │   ├── Opacity Slider (50-100%)
  │   └── Window Size Presets (75%, 100%, 125%)
  │
  ├── <KeyboardContainer>
  │   └── <Keyboard> (existing component)
  │       └── <Key> variants (single, dualStack, dualPos, icon)
  │
  └── <StatusBar> (optional)
      └── Mode indicator: "Passive" or "Emulation"
```

### Component Enhancements

**Key.tsx** additions:
- `isPressed: boolean` - Highlight state
- `onMouseClick: (key) => void` - Emit click events
- `pressedAnimation` - CSS class for visual feedback

**Keyboard.tsx** additions:
- `currentLanguage: 'en' | 'he'` - Detected from OS
- `pressedKeys: Set<string>` - Track simultaneous keys
- `emulationMode: boolean` - Enable/disable mouse input

**New: SettingsPanel.tsx**:
- Persist preferences to localStorage
- Communicate window settings to Tauri backend
- Compact design (top-right corner)

---

## Keyboard Input Handling

### Passive Mode (Physical Keyboard)

**Backend (Rust)**:
```rust
fn start_keyboard_listener() {
    rdev::listen(|event| {
        match event.event_type {
            EventType::KeyPress(key) => {
                emit_to_frontend("key-pressed", key_code);
            }
            EventType::KeyRelease(key) => {
                emit_to_frontend("key-released", key_code);
            }
        }
    });
}
```

**Frontend (React)**:
```typescript
useEffect(() => {
  const unlisten = listen('key-pressed', (event) => {
    setPressedKeys(prev => new Set(prev).add(event.payload));
  });

  const unlisten2 = listen('key-released', (event) => {
    setPressedKeys(prev => {
      const next = new Set(prev);
      next.delete(event.payload);
      return next;
    });
  });

  return () => { unlisten(); unlisten2(); };
}, []);
```

**Key Mapping**:
- Maintain `OS key code → Keyboard component ID` mapping
- Example: `KeyQ` → `"kq"` component
- Handle modifier keys for character variants

---

## Mouse Emulation Mode

### On-Screen Keyboard Clicking

**Frontend**:
```typescript
const handleMouseClick = () => {
  if (emulationMode) {
    invoke('inject_keypress', {
      key: props.label,
      language: currentLanguage,
      modifiers: []
    });
  }
};
```

**Backend (Rust)**:
```rust
#[tauri::command]
fn inject_keypress(key: String, language: String, modifiers: Vec<String>) {
    let mut enigo = Enigo::new();
    let char_to_inject = map_to_hebrew(key);
    enigo.key_sequence(&char_to_inject);
}
```

### OS Permissions

- **macOS**: Accessibility permissions (prompt on first run)
- **Windows**: No special permissions needed
- **Linux**: X11/Wayland access (usually available)

### UX Considerations

1. **Focus handling**: App doesn't steal focus when clicked
2. **Visual feedback**: Different animation for injected vs passive keypresses
3. **Fallback**: If permissions denied, disable emulation mode with clear instructions

---

## Window Management

### Tauri Configuration
```json
{
  "tauri": {
    "windows": [{
      "title": "Hebrew Keyboard",
      "width": 952,
      "height": 340,
      "resizable": true,
      "decorations": false,
      "alwaysOnTop": true,
      "transparent": true,
      "skipTaskbar": true
    }]
  }
}
```

### User Controls

1. **Always-on-Top Toggle**: `invoke('set_always_on_top', { enabled })`
2. **Opacity Slider**: 50-100% (default 85%)
3. **Position Persistence**: Save on drag, restore on restart
4. **Window Snapping**: Snap to screen edges
5. **System Tray**: Minimize to tray, right-click for options

### Draggable Area
```typescript
<div data-tauri-drag-region className="drag-handle">
  <SettingsIcon />
</div>
```

---

## Language Detection & Visual Emphasis

### How It Works

**Keys Never Move** - Always show both languages:
- English letters (primary position)
- Hebrew letters (secondary position)

**Visual State Based on OS Layout**:

**Backend** detects active layout:
```rust
#[tauri::command]
fn get_active_keyboard_layout() -> String {
    // macOS: TISCopyCurrentKeyboardInputSource
    // Windows: GetKeyboardLayout
    // Returns: "com.apple.keylayout.US" or "com.apple.keylayout.Hebrew"
}
```

**Frontend** polls and updates:
```typescript
const [activeLayout, setActiveLayout] = useState<'en' | 'he'>('en');

useEffect(() => {
  const checkLayout = async () => {
    const layout = await invoke('get_active_keyboard_layout');
    setActiveLayout(layout.includes('Hebrew') ? 'he' : 'en');
  };

  const interval = setInterval(checkLayout, 500);
  return () => clearInterval(interval);
}, []);
```

**CSS** applies emphasis:
```css
/* Hebrew active - Hebrew bright, English subtle */
.keyboard[data-active-lang="he"] .key-label-primary {
  opacity: 0.4; /* English dim */
}
.keyboard[data-active-lang="he"] .key-label-secondary {
  opacity: 1.0; /* Hebrew bright */
}

/* English active - English bright, Hebrew subtle */
.keyboard[data-active-lang="en"] .key-label-primary {
  opacity: 1.0; /* English bright */
}
.keyboard[data-active-lang="en"] .key-label-secondary {
  opacity: 0.4; /* Hebrew dim */
}
```

### Future Enhancement
- Detect other keyboard layouts (Russian, Arabic, etc.)
- Dynamically show that language instead of Hebrew
- Marked as v2.0 feature

---

## Data Flow

### Scenario 1: Physical Keyboard Typing (Passive)
```
1. User presses 'A' on physical keyboard (Hebrew layout active)
2. OS → rdev listener (Rust)
3. Backend emits: { type: "key-pressed", code: "KeyA" }
4. React receives event
5. Update state: setPressedKeys([...prev, "KeyA"])
6. Re-render: <Key id="ka" isPressed={true}>
7. CSS animation: scale down, glow
8. 100ms later: KeyRelease → remove from state
9. Hebrew 'ש' appears in user's document (OS handles)
```

### Scenario 2: Mouse Click (Emulation)
```
1. User clicks Hebrew 'ש' key in app
2. Key.tsx: onMouseClick() fires
3. invoke('inject_keypress', { char: 'ש', keyCode: 'KeyA' })
4. Rust: enigo.key_sequence("ש")
5. OS receives synthetic keypress → injects into focused app
6. 'ש' appears in document
7. Frontend shows "injected" animation (color flash)
```

### Scenario 3: OS Layout Change
```
1. User presses Cmd+Space (macOS) or Alt+Shift (Windows)
2. OS switches layout: English → Hebrew
3. Backend polls get_active_keyboard_layout() (500ms interval)
4. Detects change, emits: { type: "layout-changed", layout: "Hebrew" }
5. React: setActiveLayout('he')
6. CSS: Hebrew labels bright, English labels dim
```

---

## Error Handling

### Permission Errors

**macOS Accessibility Check**:
```rust
fn check_accessibility_permissions() -> bool {
    if !has_accessibility_access() {
        emit_to_frontend("permission-error", {
            platform: "macOS",
            message: "Accessibility access required",
            instructions: "System Settings → Privacy & Security → Accessibility"
        });
        return false;
    }
    true
}
```

**Frontend Error Modal**:
- Clear instructions with screenshots
- "Retry" button to check again
- "Continue without emulation" option

### Fallback Modes
- Emulation fails → Passive mode only
- Keyboard listening fails → Static keyboard (no highlights)
- Layout detection fails → Default to English active

### Edge Cases

1. **Rapid Typing**: Debounce to 16ms, queue keypresses
2. **Multiple Keyboards**: Works automatically (rdev captures all)
3. **App Loses Focus**: Continue working (emulation targets focused app)
4. **Backend Crash**: Show "Connection lost", attempt auto-restart
5. **Unsupported Layout**: Show warning, continue with EN/HE

### Logging
```rust
// Logs to: ~/Library/Logs/HebrewKeyboard/app.log (macOS)
info!("Keyboard listener started");
warn!("Layout changed to: {}", layout_name);
error!("Failed to inject keypress: {}", err);
```

---

## Testing Strategy

### 1. Frontend Unit Tests (Vitest)
```typescript
// Key.test.tsx
- Test highlight on isPressed
- Test click event in emulation mode
- Test visual states for different languages

// Keyboard.test.tsx
- Test language switching
- Test key mapping

// SettingsPanel.test.tsx
- Test persistence
- Test window controls
```

### 2. Rust Backend Tests
```rust
#[test]
fn test_key_code_mapping()
fn test_hebrew_character_injection()
fn test_layout_detection()
```

### 3. Integration Tests (Tauri)
```typescript
test('keyboard listener emits events')
test('emulation injects correct characters')
test('layout change updates visual state')
```

### 4. Manual Testing Checklist
- [ ] Physical keyboard highlights (EN/HE layouts)
- [ ] OS layout change updates emphasis
- [ ] Mouse clicks inject Hebrew characters
- [ ] Always-on-top works
- [ ] Opacity slider works
- [ ] Position persistence
- [ ] External/Bluetooth keyboards work
- [ ] Accessibility permissions prompt (macOS)
- [ ] System tray functionality
- [ ] Multi-monitor support
- [ ] Doesn't steal focus
- [ ] Rapid typing performance
- [ ] Emulation in various apps (TextEdit, Chrome, VS Code)

### 5. Performance Benchmarks
- Keypress to highlight: <16ms (60fps)
- Memory usage: <100MB idle
- CPU usage: <2% idle, <10% during typing
- Launch time: <2 seconds

### CI/CD Pipeline
```yaml
- Frontend tests (Vitest)
- Rust tests (cargo test)
- Build for macOS/Windows/Linux
- Create release artifacts (.dmg, .exe, .AppImage)
```

---

## Implementation Phases

### Phase 1: Foundation
- Set up Tauri project structure
- Port existing React keyboard components
- Basic window management (always-on-top, draggable)

### Phase 2: Passive Mode
- Implement rdev keyboard listener
- Key press/release event handling
- Visual highlight animations
- OS layout detection

### Phase 3: Emulation Mode
- Implement enigo keyboard injection
- Permission handling (macOS Accessibility)
- Mouse click event handling
- Error handling and fallbacks

### Phase 4: Polish
- Settings panel with persistence
- System tray integration
- Window snapping and position memory
- Opacity controls

### Phase 5: Testing & Release
- Comprehensive testing
- Performance optimization
- CI/CD pipeline
- Packaging for all platforms

---

## Success Criteria

✅ App launches in <2 seconds
✅ Keypress highlights appear within 16ms
✅ OS layout changes reflected within 500ms
✅ Mouse emulation works in all major apps
✅ Memory usage stays below 100MB
✅ No crashes during 1-hour continuous typing test
✅ Clear error messages for permission issues
✅ Settings persist across restarts
✅ Works on macOS, Windows, Linux

---

## Future Enhancements (v2.0+)

- Support for additional languages (Russian, Arabic, etc.)
- Custom keyboard layouts (upload .pen files)
- Keyboard shortcuts learning mode
- Statistics tracking (typing speed, most used keys)
- Dark/light theme toggle
- Customizable key colors
- Export/import settings

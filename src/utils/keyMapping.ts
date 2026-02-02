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

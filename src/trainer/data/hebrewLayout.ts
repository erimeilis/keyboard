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

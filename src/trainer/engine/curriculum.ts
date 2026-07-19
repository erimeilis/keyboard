import type { KeyCode, Letter } from '../types';

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

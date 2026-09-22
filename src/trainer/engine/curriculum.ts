import type { KeyCode, Letter } from '../types';

export interface Stage { index: number; name: string; newCodes: KeyCode[] }

// The home row is one stage, as in conventional touch-typing courses. It was previously
// built up over five, two of which added a single key — the right ring and pinky home
// keys are ך and ף, sofit finals held back to the last stage, so only the left hand had
// a stage per finger. Worse, the opening stage was just the two index fingers: no finger
// choice to learn, and too few letters for any Hebrew word to exist, so the first
// sessions were bigram drills with nothing to read or translate. All eight home keys
// together put every finger to work immediately and open 84 real glossed terms.
const STAGE_DEFS: Array<{ name: string; newCodes: KeyCode[] }> = [
  { name: 'Home row',       newCodes: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'] }, // ש ד ג כ ע י ח ל
  { name: 'Top index',      newCodes: ['KeyR', 'KeyT', 'KeyU', 'KeyY'] }, // ר א ו ט
  { name: 'Top middle/ring',newCodes: ['KeyE', 'KeyP'] },       // ק פ
  { name: 'Bottom index',   newCodes: ['KeyV', 'KeyB', 'KeyN'] }, // ה נ מ
  { name: 'Bottom outer',   newCodes: ['KeyZ', 'KeyX', 'KeyC', 'KeyM', 'Comma'] }, // ז ס ב צ ת
  { name: 'Sofit finals',   newCodes: ['KeyL', 'KeyO', 'KeyI', 'Semicolon', 'Period'] }, // ך ם ן ף ץ
];

export const STAGES: Stage[] = STAGE_DEFS.map((s, i) => ({ index: i, ...s }));
export const SOFIT_STAGE_INDEX = STAGES.findIndex(s => s.name === 'Sofit finals');

export const LAST_STAGE_INDEX = STAGES.length - 1;

/**
 * Keeps a stage index inside the ladder. Needed in two places: advancing past the
 * final stage, and reading progress saved when the ladder was longer — the home row
 * used to be five stages, so an index persisted then can point past the end now.
 */
export function clampStageIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(LAST_STAGE_INDEX, Math.max(0, Math.floor(index)));
}

/**
 * Bumped whenever the ladder's shape changes, so stored progress can be recognised as
 * belonging to an older one. Progress with no version predates the six-stage ladder.
 */
export const LADDER_VERSION = 2;

/**
 * Translates a stage index saved under the previous ten-stage ladder.
 *
 * That ladder built the home row a finger-pair at a time — 0 Home anchors, 1 Home index,
 * 2 Home middle, 3 Home ring, 4 Home pinky — before 5 Top index, 6 Top middle/ring,
 * 7 Bottom index, 8 Bottom outer, 9 Sofit finals. Clamping keeps an old value inside the
 * new range but quietly changes its meaning: old 4 was the finished home row, and as a
 * new index it reads as "Bottom outer", skipping the learner three stages ahead.
 *
 * Anything up to old 4 lands on the single home-row stage; the rest shift down by four,
 * which maps each old stage onto the new one that unlocks the same keys.
 */
export function migrateStageIndex(oldIndex: number): number {
  if (!Number.isFinite(oldIndex)) return 0;
  const i = Math.floor(oldIndex);
  return clampStageIndex(i <= 4 ? 0 : i - 4);
}

export function unlockedCodesForStage(index: number): Set<KeyCode> {
  // Space and the geresh (ה׳) are never gated: every stage needs them.
  const set = new Set<KeyCode>(['Space', 'KeyW']);
  for (let i = 0; i <= index && i < STAGES.length; i++) {
    STAGES[i].newCodes.forEach(c => set.add(c));
  }
  return set;
}

// Visually / positionally confusable Hebrew letters (meaning-changing if swapped).
export const CONFUSABLE_GROUPS: Letter[][] = [
  ['ד', 'ר'], ['כ', 'ב'], ['ה', 'ח', 'ת'], ['ט', 'ת'], ['ם', 'ס'], ['ן', 'ו'], ['ג', 'נ'],
];

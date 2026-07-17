import type { KeyCode } from './types';
import { codeForLetter, byCode } from './data/hebrewLayout';

const MIN_LETTER_KEYS_FOR_WORDS = 3;

export function wordIsTypable(word: string, unlocked: Set<KeyCode>): boolean {
  for (const ch of word) {
    const code = codeForLetter(ch);
    if (!code || !unlocked.has(code)) return false;
  }
  return true;
}

export function weakKeyScore(word: string, confByCode: Record<KeyCode, number>): number {
  // Higher when the word exercises low-confidence keys. weakness = 1 - confidence.
  let score = 0;
  for (const ch of word) {
    const code = codeForLetter(ch);
    if (!code) continue;
    const conf = confByCode[code] ?? 0;
    score += (1 - conf);
  }
  return score;
}

function unlockedLetterKeys(unlocked: Set<KeyCode>): KeyCode[] {
  return [...unlocked].filter(c => c !== 'Space');
}

// local: letter for a code (avoids importing byCode circularly in tests)
function lettersForCode(code: KeyCode): string | null { return byCode[code]?.letter ?? null; }

function fingerDrill(unlocked: Set<KeyCode>, targetChars: number, rng: () => number): string {
  const letters = unlockedLetterKeys(unlocked)
    .map(c => lettersForCode(c)).filter(Boolean) as string[];
  if (letters.length === 0) return '';
  const parts: string[] = [];
  let count = 0;
  while (count < targetChars) {
    const a = letters[Math.floor(rng() * letters.length)];
    const b = letters[Math.floor(rng() * letters.length)];
    const bigram = a + b;
    parts.push(bigram);
    count += bigram.length + 1;
  }
  return parts.join(' ');
}

export interface SelectOpts {
  unlocked: Set<KeyCode>;
  confByCode: Record<KeyCode, number>;
  corpus: string[];
  targetChars: number;
  rng: () => number;
}

export function selectPractice(opts: SelectOpts): string {
  const { unlocked, confByCode, corpus, targetChars, rng } = opts;
  const typable = corpus.filter(w => wordIsTypable(w, unlocked));

  if (unlockedLetterKeys(unlocked).length < MIN_LETTER_KEYS_FOR_WORDS || typable.length === 0) {
    return fingerDrill(unlocked, targetChars, rng);
  }

  // Rank by weak-key score, then sample from the top half weighted by rng.
  const ranked = [...typable].sort((a, b) => weakKeyScore(b, confByCode) - weakKeyScore(a, confByCode));
  const pool = ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 2)));

  const chosen: string[] = [];
  let count = 0;
  while (count < targetChars) {
    const w = pool[Math.floor(rng() * pool.length)];
    chosen.push(w);
    count += w.length + 1;
  }
  return chosen.join(' ');
}

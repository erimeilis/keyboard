import { describe, it, expect } from 'vitest';
import { wordIsTypable, weakKeyScore, selectPractice } from './textSelection';
import { unlockedCodesForStage } from './curriculum';

const seededRng = (seq: number[]) => { let i = 0; return () => seq[(i++) % seq.length]; };

describe('textSelection', () => {
  it('accepts a word only when all its letters are unlocked', () => {
    const unlocked = new Set(['KeyA', 'KeyK', 'KeyU', 'KeyO', 'Space']); // ש ל ו ם
    expect(wordIsTypable('שלום', unlocked)).toBe(true);
    expect(wordIsTypable('בית', unlocked)).toBe(false); // ב not unlocked
  });

  it('scores words higher when they contain low-confidence keys', () => {
    const conf = { KeyA: 0.1, KeyK: 0.9, KeyU: 0.9, KeyO: 0.9 }; // ש is weak
    const withWeak = weakKeyScore('שלום', conf);
    const withoutWeak = weakKeyScore('לו', conf);
    expect(withWeak).toBeGreaterThan(withoutWeak);
  });

  it('falls back to finger drills when too few keys are unlocked', () => {
    // Built from an explicit key set rather than a stage: the fallback is a property of
    // selectPractice, and tying it to stage 0 broke when the ladder changed.
    const out = selectPractice({
      unlocked: new Set(['KeyF', 'KeyJ', 'Space']), // כ ח only
      confByCode: {}, corpus: ['שלום', 'בית'], targetChars: 12, rng: seededRng([0.1, 0.9]),
    });
    expect(out.replace(/\s/g, '').split('').every(ch => ch === 'כ' || ch === 'ח')).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  it('gives real words from the very first stage', () => {
    // The whole point of starting on the full home row: no drills-only opening.
    const out = selectPractice({
      unlocked: unlockedCodesForStage(0),
      confByCode: {}, corpus: ['שלום', 'לכל', 'חג'], targetChars: 12, rng: seededRng([0.1, 0.9]),
    });
    expect(out.split(' ').some(w => ['שלום', 'לכל', 'חג'].includes(w))).toBe(true);
  });

  it('produces only typable real words when enough keys are unlocked', () => {
    const unlocked = new Set(['KeyA', 'KeyK', 'KeyU', 'KeyO', 'KeyC', 'KeyH', 'KeyT', 'Space']);
    const out = selectPractice({
      unlocked, confByCode: {}, corpus: ['שלום', 'בית', 'לו'], targetChars: 20, rng: seededRng([0.5]),
    });
    out.split(' ').filter(Boolean).forEach(w => expect(wordIsTypable(w, unlocked)).toBe(true));
  });
});

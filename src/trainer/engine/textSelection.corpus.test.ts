import { describe, it, expect } from 'vitest';
import { selectPractice, wordIsTypable } from './textSelection';
import { activeTerm } from './terms';
import { glossFor } from '../data/siddur.he';
import { unlockedCodesForStage, STAGES } from './curriculum';
import { COMMON_WORDS_HE } from '../data/words.he';
import type { KeyCode } from '../types';

// Against the real corpus: once enough keys are unlocked, practice must be actual
// Siddur terms, not finger-drill bigrams. Drills carry no meaning and therefore no
// gloss, so a silent fallback to them is what makes translations disappear.
describe('selectPractice over the real corpus', () => {
  const emptyConf: Record<KeyCode, number> = {};

  it('ships a non-empty word corpus', () => {
    expect(COMMON_WORDS_HE.length).toBeGreaterThan(5000);
  });

  it.each(STAGES.map((s, i) => [i, s.name] as const))(
    'stage %i (%s) yields real terms once words are possible',
    (stageIndex) => {
      const unlocked = unlockedCodesForStage(stageIndex);
      const out = selectPractice({
        unlocked, confByCode: emptyConf, corpus: COMMON_WORDS_HE,
        targetChars: 40, rng: () => 0.5,
      });
      const tokens = out.split(' ').filter(Boolean);
      const real = tokens.filter(t => COMMON_WORDS_HE.includes(t));
      // Every stage now starts from the full home row, so real words exist throughout;
      // a fallback to bigram drills anywhere would mean the corpus wiring is broken.
      expect(real.length, `stage ${stageIndex} produced "${out}"`).toBeGreaterThan(0);
    },
  );

  // The gloss is what makes a term teach anything, so "a real term was selected" is only
  // half the guarantee — it also has to have a translation to show.
  // Glosses are complete through the top rows; from the bottom row on they are still
  // being filled in frequency order, and an unglossed term renders nothing by design.
  it.each([0, 1, 2])('every term reachable at stage %i is glossed', (stageIndex) => {
    const unlocked = unlockedCodesForStage(stageIndex);
    const reachable = COMMON_WORDS_HE.filter(w => wordIsTypable(w, unlocked));
    const unglossed = reachable.filter(w => glossFor(w) == null);
    expect(unglossed, `stage ${stageIndex} has unglossed reachable terms`).toEqual([]);
  });

  it('shows a gloss for the first term of an actual stage-0 selection', () => {
    const unlocked = unlockedCodesForStage(0);
    const out = selectPractice({
      unlocked, confByCode: emptyConf, corpus: COMMON_WORDS_HE,
      targetChars: 40, rng: () => 0.5,
    });
    const term = activeTerm(out, 0);
    expect(term).not.toBeNull();
    expect(glossFor(term!.term), `no gloss for "${term!.term}" in "${out}"`).not.toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { selectSentence } from './textSelection';
import { PROSE_HE } from '../data/prose.he';
import { codeForLetter } from '../data/hebrewLayout';

describe('selectSentence', () => {
  it('returns null when no passage is fully typable', () => {
    const unlocked = new Set(['KeyF', 'Space']); // only כ
    expect(selectSentence({ unlocked, corpus: PROSE_HE, rng: () => 0 })).toBeNull();
  });
  it('returns a passage whose every letter is unlocked', () => {
    const all = new Set<string>(['Space']);
    PROSE_HE.forEach(p => [...p.text].forEach(ch => { const c = codeForLetter(ch); if (c) all.add(c); }));
    const picked = selectSentence({ unlocked: all, corpus: PROSE_HE, rng: () => 0 })!;
    expect(picked).not.toBeNull();
    [...picked.text].forEach(ch => { if (ch !== ' ') expect(all.has(codeForLetter(ch)!)).toBe(true); });
  });
});

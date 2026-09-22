import { describe, it, expect } from 'vitest';
import { SIDDUR_LINES, SIDDUR_TERMS, SIDDUR_CREDIT, glossFor, glossCoverage } from './siddur.he';
import { codeForLetter } from './hebrewLayout';
import { TERM_GLOSSES } from './glosses.he';

// Invariants over the generated corpus. These guard the ingest pipeline at the data
// level: a normalization regression (a dropped maqaf, surviving niqqud, an untyped
// character) shows up here rather than as an unreachable practice line at runtime.

const typable = (text: string) => [...text].every(ch => ch === ' ' || codeForLetter(ch) != null);

describe('Siddur corpus', () => {
  it('ships a corpus large enough to train on', () => {
    expect(SIDDUR_LINES.length).toBeGreaterThan(2000);
    expect(SIDDUR_TERMS.length).toBeGreaterThan(5000);
  });

  it('contains only characters the trainer can type', () => {
    const bad = SIDDUR_LINES.filter(l => !typable(l.text)).slice(0, 5);
    expect(bad).toEqual([]);
  });

  it('leaves no niqqud or cantillation in practice text', () => {
    const pointed = /[֑-ֽֿ-ׇ]/;
    expect(SIDDUR_LINES.filter(l => pointed.test(l.text)).slice(0, 5)).toEqual([]);
  });

  it('substitutes the divine name everywhere rather than in places', () => {
    expect(SIDDUR_LINES.filter(l => l.text.includes('יהוה')).slice(0, 5)).toEqual([]);
    expect(SIDDUR_TERMS.filter(t => t.includes('יהוה')).slice(0, 5)).toEqual([]);
    // The substitution must actually be present, or the assertion above is vacuous.
    expect(SIDDUR_TERMS).toContain('ה׳');
  });

  it('splits maqaf-joined terms instead of gluing them', () => {
    // כְּבוֹד־יְהֹוָה once collapsed into a single fake term; no term should be this long.
    expect(SIDDUR_TERMS.filter(t => t.length > 11).slice(0, 5)).toEqual([]);
  });

  it('has no empty or whitespace-padded lines', () => {
    expect(SIDDUR_LINES.filter(l => l.text !== l.text.trim() || l.text === '')).toEqual([]);
  });

  it('gives every line a theme the background component knows', () => {
    const known = new Set(['sea', 'space', 'wisdom', 'default']);
    expect([...new Set(SIDDUR_LINES.map(l => l.theme))].filter(t => !known.has(t))).toEqual([]);
  });

  it('carries the attribution the CC-BY licence requires', () => {
    expect(SIDDUR_CREDIT.license).toBe('CC-BY');
    expect(SIDDUR_CREDIT.hebrew).toMatch(/Metsudah/);
    expect(SIDDUR_CREDIT.english).toMatch(/Metsudah/);
  });
});

describe('term glosses', () => {
  it('returns null for an unglossed term rather than a placeholder', () => {
    expect(glossFor('אין-כזה-מונח')).toBeNull();
  });

  it('glosses the most frequent terms', () => {
    for (const term of SIDDUR_TERMS.slice(0, 50)) {
      expect(glossFor(term), `missing gloss for ${term}`).not.toBeNull();
    }
  });

  it('has no empty gloss values', () => {
    expect(Object.entries(TERM_GLOSSES).filter(([, en]) => !en.trim())).toEqual([]);
  });

  it('glosses only terms that occur in the corpus', () => {
    const inCorpus = new Set(SIDDUR_TERMS);
    expect(Object.keys(TERM_GLOSSES).filter(t => !inCorpus.has(t))).toEqual([]);
  });

  it('reports coverage honestly', () => {
    const c = glossCoverage();
    expect(c.termsGlossed).toBeGreaterThan(0);
    expect(c.termsGlossed).toBeLessThanOrEqual(c.terms);
    expect(c.occurrencesGlossed).toBeLessThanOrEqual(c.occurrences);
  });
});

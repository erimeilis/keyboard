import { describe, it, expect } from 'vitest';
import { splitTerms, activeTerm } from './terms';

describe('splitTerms', () => {
  it('returns each term with its character span', () => {
    expect(splitTerms('מודה אני')).toEqual([
      { term: 'מודה', start: 0, end: 4 },
      { term: 'אני', start: 5, end: 8 },
    ]);
  });

  it('is empty for blank input', () => {
    expect(splitTerms('')).toEqual([]);
    expect(splitTerms('   ')).toEqual([]);
  });

  it('tolerates repeated and leading spaces without emitting empty terms', () => {
    expect(splitTerms('  אל  כי ')).toEqual([
      { term: 'אל', start: 2, end: 4 },
      { term: 'כי', start: 6, end: 8 },
    ]);
  });

  it('keeps the geresh attached to its term', () => {
    expect(splitTerms('ברוך אתה ה׳')).toEqual([
      { term: 'ברוך', start: 0, end: 4 },
      { term: 'אתה', start: 5, end: 8 },
      { term: 'ה׳', start: 9, end: 11 },
    ]);
  });
});

describe('activeTerm', () => {
  const text = 'מודה אני לפניך';

  it('returns the term containing the cursor', () => {
    expect(activeTerm(text, 0)?.term).toBe('מודה');
    expect(activeTerm(text, 3)?.term).toBe('מודה');
    expect(activeTerm(text, 5)?.term).toBe('אני');
    expect(activeTerm(text, 9)?.term).toBe('לפניך');
  });

  it('attributes the space between terms to the term just finished', () => {
    // The cursor sits on the space at index 4; the learner is still completing מודה.
    expect(activeTerm(text, 4)?.term).toBe('מודה');
  });

  it('returns the last term when the cursor is past the end', () => {
    expect(activeTerm(text, text.length)?.term).toBe('לפניך');
    expect(activeTerm(text, 999)?.term).toBe('לפניך');
  });

  it('returns null when there is nothing to type', () => {
    expect(activeTerm('', 0)).toBeNull();
  });
});

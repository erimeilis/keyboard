import { describe, it, expect } from 'vitest';
import { errorKind, classifyMistype, detectRealWordMistake } from './errors';

describe('errors', () => {
  it('detects sofit vs regular confusion', () => {
    expect(errorKind('מ', 'ם')).toBe('sofit');
    expect(errorKind('ם', 'מ')).toBe('sofit');
  });
  it('detects confusable pairs', () => {
    expect(errorKind('ד', 'ר')).toBe('confusable');
  });
  it('falls back to other', () => {
    expect(errorKind('א', 'ב')).toBe('other');
  });
  it('flags when a mistype produced a real (different) word', () => {
    const set = new Set(['שלום', 'שלוט']);
    expect(classifyMistype('שלום', 'שלוט', set)).toEqual({ isRealWord: true, typedWord: 'שלוט' });
    expect(classifyMistype('שלום', 'שלוx', set).isRealWord).toBe(false);
  });
  it('detectRealWordMistake flags a real-word mistype from the common list', () => {
    // both must be in COMMON_WORDS_HE for a positive; use two seeded words
    expect(detectRealWordMistake('של', 'על').isRealWord).toBe(true); // both common
    expect(detectRealWordMistake('של', 'שx').isRealWord).toBe(false);
  });
  it('detectRealWordMistake does not flag the same word as a mistake', () => {
    expect(detectRealWordMistake('של', 'של').isRealWord).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { errorKind, classifyMistype } from './errors';

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
});

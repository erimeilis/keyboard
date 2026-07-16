import { describe, it, expect } from 'vitest';
import { byCode, byLetter, SOFIT_PAIRS, codeForLetter, letterForCode } from './hebrewLayout';

describe('hebrewLayout', () => {
  it('maps home-row physical keys to the Israeli Hebrew letters', () => {
    expect(byCode['KeyA'].letter).toBe('ש');
    expect(byCode['KeyK'].letter).toBe('ל');
    expect(byCode['KeyT'].letter).toBe('א');
  });

  it('assigns standard touch-typing fingers', () => {
    expect(byCode['KeyA'].finger).toBe('l-pinky');
    expect(byCode['KeyF'].finger).toBe('l-index');
    expect(byCode['KeyJ'].finger).toBe('r-index');
    expect(byCode['Space'].finger).toBe('thumb');
  });

  it('marks the five sofit letters and pairs them with their regular form', () => {
    expect(byLetter['ם'].isSofit).toBe(true);
    expect(byLetter['מ'].isSofit).toBe(false);
    expect(SOFIT_PAIRS).toContainEqual({ sofit: 'ם', regular: 'מ' });
    expect(SOFIT_PAIRS).toHaveLength(5);
  });

  it('round-trips letter<->code for a real word (שלום)', () => {
    expect(codeForLetter('ש')).toBe('KeyA');
    expect(codeForLetter('ל')).toBe('KeyK');
    expect(codeForLetter('ו')).toBe('KeyU');
    expect(codeForLetter('ם')).toBe('KeyO');
    expect(letterForCode('KeyA')).toBe('ש');
  });

  it('every componentId matches keyMapping for its code', () => {
    // sanity: componentIds line up with the existing keyboard component ids
    expect(byCode['KeyA'].componentId).toBe('ka');
    expect(byCode['Space'].componentId).toBe('space');
  });
});

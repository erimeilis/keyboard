import { describe, it, expect } from 'vitest';
import { STAGES, unlockedCodesForStage, CONFUSABLE_GROUPS, SOFIT_STAGE_INDEX } from './curriculum';

describe('curriculum', () => {
  it('starts on the home-row index anchors + space', () => {
    expect(STAGES[0].newCodes).toEqual(['KeyF', 'KeyJ']);
    expect(unlockedCodesForStage(0).has('Space')).toBe(true);
  });
  it('accumulates unlocked codes across stages', () => {
    const s1 = unlockedCodesForStage(1);
    expect(s1.has('KeyF')).toBe(true); // from stage 0
    STAGES[1].newCodes.forEach(c => expect(s1.has(c)).toBe(true));
  });
  it('has a dedicated sofit stage covering the five finals', () => {
    const sofit = STAGES[SOFIT_STAGE_INDEX].newCodes;
    ['KeyL','KeyO','KeyI','Semicolon','Period'].forEach(c => expect(sofit).toContain(c));
  });
  it('defines confusable letter groups', () => {
    expect(CONFUSABLE_GROUPS).toContainEqual(['ד', 'ר']);
  });
});

import { describe, it, expect } from 'vitest';
import {
  STAGES, unlockedCodesForStage, CONFUSABLE_GROUPS, SOFIT_STAGE_INDEX,
  clampStageIndex, migrateStageIndex,
} from './curriculum';

describe('curriculum', () => {
  it('starts on the whole home row, every finger at once', () => {
    expect(STAGES[0].newCodes).toEqual(['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK']);
    expect(unlockedCodesForStage(0).has('Space')).toBe(true);
  });

  it('keeps every stage big enough to be worth a stage', () => {
    // Two stages used to add a single key, because the right ring and pinky home keys
    // are sofits held back to the end and only the left hand got a stage per finger.
    for (const s of STAGES) {
      expect(s.newCodes.length, `stage "${s.name}" adds too few keys`).toBeGreaterThan(1);
    }
  });

  it('maps an index saved under the older ladder onto the equivalent stage', () => {
    // Old ladder: 0-4 built the home row one finger-pair at a time, then 5 Top index,
    // 6 Top middle/ring, 7 Bottom index, 8 Bottom outer, 9 Sofit finals. Clamping alone
    // keeps a value in range but silently changes what it means: old 4 ("Home pinky",
    // the full home row) would read as new 4 ("Bottom outer").
    expect(migrateStageIndex(0)).toBe(0);
    expect(migrateStageIndex(3)).toBe(0);
    expect(migrateStageIndex(4)).toBe(0); // full home row -> the one home-row stage
    expect(migrateStageIndex(5)).toBe(1); // Top index
    expect(migrateStageIndex(6)).toBe(2);
    expect(migrateStageIndex(7)).toBe(3);
    expect(migrateStageIndex(8)).toBe(4);
    expect(migrateStageIndex(9)).toBe(5); // Sofit finals, still last
  });

  it('never lets a migrated index escape the ladder', () => {
    expect(migrateStageIndex(99)).toBe(STAGES.length - 1);
    expect(migrateStageIndex(-2)).toBe(0);
    expect(migrateStageIndex(Number.NaN)).toBe(0);
  });

  it('clamps a stage index saved under the older, longer ladder', () => {
    expect(clampStageIndex(9)).toBe(STAGES.length - 1);
    expect(clampStageIndex(-3)).toBe(0);
    expect(clampStageIndex(Number.NaN)).toBe(0);
    expect(clampStageIndex(2)).toBe(2);
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

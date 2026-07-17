// src/trainer/placement.ts
import type { SessionResult } from './types';
import { STAGES } from './curriculum';

export function seedFromPlacement(result: SessionResult): { unlockedStageIndex: number; currentStageIndex: number } {
  const maxIndex = STAGES.length - 1;
  // Accuracy gate first: only skip ahead when accurate enough to have real technique.
  let index = 0;
  if (result.accuracy >= 0.95) {
    // ~ every 12 wpm of measured speed unlocks one more stage, capped.
    index = Math.min(maxIndex, Math.floor(result.wpm / 12));
  }
  return { unlockedStageIndex: index, currentStageIndex: index };
}

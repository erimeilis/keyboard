import type { KeyCode, KeyStat } from '../types';
import { accuracyFor, confidenceFor } from './confidence';
import { unlockedCodesForStage } from './curriculum';
import { UNGATED_CODES } from '../data/hebrewLayout';

export const GATE = { minAccuracy: 0.98, minConfidence: 0.8 };

export function canAdvance(
  stageIndex: number,
  statsByCode: Record<KeyCode, KeyStat>,
  gate = GATE,
): boolean {
  const codes = unlockedCodesForStage(stageIndex);
  for (const code of codes) {
    if (UNGATED_CODES.has(code)) continue;
    const stat = statsByCode[code];
    if (!stat || stat.attempts === 0) return false;
    if (accuracyFor(stat) < gate.minAccuracy) return false;
    if (confidenceFor(stat) < gate.minConfidence) return false;
  }
  return true;
}

// src/trainer/stars.ts
import type { SessionResult } from '../types';
const SPEED_FLOOR_WPM = 20;
export function computeStars(result: SessionResult): 0 | 1 | 2 | 3 {
  if (result.accuracy >= 0.98 && result.wpm >= SPEED_FLOOR_WPM) return 3;
  if (result.accuracy >= 0.90) return 2;
  return 1;
}

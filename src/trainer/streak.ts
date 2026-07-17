// src/trainer/streak.ts
import type { StreakState } from './types';

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function updateStreak(prev: StreakState, todayISO: string, addedMinutes: number): StreakState {
  if (prev.lastPracticedISO === null) {
    return { lastPracticedISO: todayISO, current: 1, longest: 1, todayMinutes: addedMinutes };
  }
  const gap = daysBetween(prev.lastPracticedISO, todayISO);
  if (gap === 0) {
    return { ...prev, todayMinutes: prev.todayMinutes + addedMinutes };
  }
  const current = gap === 1 ? prev.current + 1 : 1;
  return { lastPracticedISO: todayISO, current, longest: Math.max(prev.longest, current), todayMinutes: addedMinutes };
}

// src/trainer/streak.test.ts
import { describe, it, expect } from 'vitest';
import { updateStreak } from './streak';
import type { StreakState } from './types';
const base: StreakState = { lastPracticedISO: null, current: 0, longest: 0, todayMinutes: 0 };

describe('updateStreak', () => {
  it('starts a streak on first practice', () => {
    const s = updateStreak(base, '2026-07-16', 5);
    expect(s.current).toBe(1); expect(s.todayMinutes).toBe(5); expect(s.longest).toBe(1);
  });
  it('increments on the next calendar day', () => {
    const d1 = updateStreak(base, '2026-07-16', 5);
    const d2 = updateStreak(d1, '2026-07-17', 3);
    expect(d2.current).toBe(2); expect(d2.todayMinutes).toBe(3);
  });
  it('same-day practice accumulates minutes, not streak', () => {
    const d1 = updateStreak(base, '2026-07-16', 5);
    const again = updateStreak(d1, '2026-07-16', 4);
    expect(again.current).toBe(1); expect(again.todayMinutes).toBe(9);
  });
  it('resets after a gap', () => {
    const d1 = updateStreak(base, '2026-07-16', 5);
    const later = updateStreak(d1, '2026-07-20', 2);
    expect(later.current).toBe(1); expect(later.longest).toBe(1);
  });
});

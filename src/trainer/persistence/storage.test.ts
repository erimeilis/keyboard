import { describe, it, expect } from 'vitest';
import { createMemoryStore, createLocalStorageStore, STORAGE_KEYS } from './storage';

describe('TrainerStore', () => {
  it('memory store round-trips values', () => {
    const s = createMemoryStore();
    expect(s.get(STORAGE_KEYS.settings, { a: 1 })).toEqual({ a: 1 }); // fallback
    s.set(STORAGE_KEYS.settings, { a: 2 });
    expect(s.get(STORAGE_KEYS.settings, { a: 1 })).toEqual({ a: 2 });
  });

  it('localStorage store persists JSON and returns fallback on missing/corrupt', () => {
    const s = createLocalStorageStore();
    expect(s.get('missing', 42)).toBe(42);
    s.set('k', { x: 'שלום' });
    expect(s.get('k', null)).toEqual({ x: 'שלום' });
    localStorage.setItem('bad', '{not json');
    expect(s.get('bad', 'fallback')).toBe('fallback');
  });
});

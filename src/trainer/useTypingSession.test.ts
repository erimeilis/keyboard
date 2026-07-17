import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingSession } from './useTypingSession';
import type { KeySource, KeyEvent, SessionLog } from './types';

function fakeSource() {
  let cb: ((e: KeyEvent) => void) | null = null;
  const src: KeySource = { start: (f) => { cb = f; }, stop: () => { cb = null; } };
  const press = (code: string, ts: number) => act(() => cb!({ code, ts, down: true }));
  return { src, press };
}

describe('useTypingSession', () => {
  it('advances on the correct physical key and completes', () => {
    const { src, press } = fakeSource();
    const onComplete = vi.fn();
    // target "לו" -> KeyK, KeyU
    const { result } = renderHook(() => useTypingSession({ source: src, target: 'לו', strictness: 'stop', onComplete }));
    expect(result.current.nextCode).toBe('KeyK');
    press('KeyK', 100);
    expect(result.current.index).toBe(1);
    press('KeyU', 300);
    const log: SessionLog = onComplete.mock.calls[0][0];
    expect(log.words[0][0]).toMatchObject({ code: 'KeyK', firstTryCorrect: true });
    expect(log.words[0][1].latencyMs).toBe(200);
  });

  it('stop-on-error blocks advance and marks first-try false', () => {
    const { src, press } = fakeSource();
    const onComplete = vi.fn();
    const { result } = renderHook(() => useTypingSession({ source: src, target: 'לו', strictness: 'stop', onComplete }));
    press('KeyT', 100);              // wrong
    expect(result.current.index).toBe(0);
    expect(result.current.statuses[0]).toBe('error');
    press('KeyK', 150);              // correct now
    expect(result.current.index).toBe(1);
    press('KeyU', 200);
    expect(onComplete.mock.calls[0][0].words[0][0].firstTryCorrect).toBe(false);
  });

  it('resets session state when target changes on the same hook instance', () => {
    const { src, press } = fakeSource();
    const onComplete = vi.fn();
    const { result, rerender } = renderHook(
      ({ target }) => useTypingSession({ source: src, target, strictness: 'stop', onComplete }),
      { initialProps: { target: 'לו' } }
    );
    // Partial progress on the first target: "לו" -> KeyK, KeyU.
    expect(result.current.nextCode).toBe('KeyK');
    press('KeyK', 100);
    expect(result.current.index).toBe(1);
    expect(result.current.statuses).toEqual(['correct', 'pending']);

    // Switch to a different target on the SAME hook instance.
    rerender({ target: 'דג' }); // -> KeyS, KeyD

    expect(result.current.index).toBe(0);
    expect(result.current.expectedCodes).toEqual(['KeyS', 'KeyD']);
    expect(result.current.statuses).toEqual(['pending', 'pending']);
    expect(result.current.nextCode).toBe('KeyS');
    expect(onComplete).not.toHaveBeenCalled();

    // Typing the new target completes independently of the old session.
    press('KeyS', 300);
    expect(result.current.index).toBe(1);
    press('KeyD', 500);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const log: SessionLog = onComplete.mock.calls[0][0];
    expect(log.words).toHaveLength(1);
    expect(log.words[0]).toHaveLength(2);
    expect(log.words[0][0]).toMatchObject({ code: 'KeyS', firstTryCorrect: true });
    expect(log.words[0][1]).toMatchObject({ code: 'KeyD', firstTryCorrect: true });
  });

  it('markThrough: a wrong key advances the index and the session still completes', () => {
    const { src, press } = fakeSource();
    const onComplete = vi.fn();
    const { result } = renderHook(() => useTypingSession({ source: src, target: 'לו', strictness: 'markThrough', onComplete }));
    press('KeyX', 100);              // wrong for KeyK, but markThrough advances anyway
    expect(result.current.index).toBe(1);
    expect(result.current.statuses[0]).toBe('error');
    press('KeyU', 200);              // correct for the remaining position
    expect(onComplete).toHaveBeenCalledTimes(1);
    const log: SessionLog = onComplete.mock.calls[0][0];
    expect(log.words[0][0]).toMatchObject({ code: 'KeyK', firstTryCorrect: false });
  });

  it('markThrough: an error at one position does not leak into the next position\'s firstTryCorrect', () => {
    const { src, press } = fakeSource();
    const onComplete = vi.fn();
    // target "לוד" -> KeyK, KeyU, KeyS (3 positions)
    const { result } = renderHook(() => useTypingSession({ source: src, target: 'לוד', strictness: 'markThrough', onComplete }));
    press('KeyX', 100);              // wrong for position 0 (KeyK), markThrough advances anyway
    expect(result.current.index).toBe(1);
    expect(result.current.statuses[0]).toBe('error');
    press('KeyU', 200);              // correct on the FIRST try for position 1
    expect(result.current.index).toBe(2);
    expect(result.current.statuses[1]).toBe('correct');
    press('KeyS', 300);              // correct for position 2, completes the session
    expect(onComplete).toHaveBeenCalledTimes(1);
    const log: SessionLog = onComplete.mock.calls[0][0];
    expect(log.words[0][0]).toMatchObject({ code: 'KeyK', firstTryCorrect: false });
    // The error at position 0 must not leak forward: position 1 was correct on the first try.
    expect(log.words[0][1]).toMatchObject({ code: 'KeyU', firstTryCorrect: true });
  });
});

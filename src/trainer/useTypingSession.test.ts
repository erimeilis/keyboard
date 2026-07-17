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
});

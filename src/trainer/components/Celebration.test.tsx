import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { Celebration, useFaultFlash } from './Celebration';

describe('Celebration', () => {
  it('renders a burst when trigger changes', () => {
    const { container, rerender } = render(<Celebration trigger={0} />);
    expect(container.querySelector('.celebration.active')).toBeNull();
    rerender(<Celebration trigger={1} />);
    expect(container.querySelector('.celebration.active')).not.toBeNull();
  });

  it('clears the burst ~900ms after the trigger fires', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<Celebration trigger={0} />);
      rerender(<Celebration trigger={1} />);
      expect(container.querySelector('.celebration.active')).not.toBeNull();
      act(() => { vi.advanceTimersByTime(900); });
      expect(container.querySelector('.celebration.active')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('bursts again on a subsequent trigger increment', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<Celebration trigger={1} />);
      act(() => { vi.advanceTimersByTime(900); });
      rerender(<Celebration trigger={2} />);
      expect(container.querySelector('.celebration.active')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useFaultFlash', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts with no fault class', () => {
    const { result } = renderHook(() => useFaultFlash());
    expect(result.current.faultClass).toBe('');
  });

  it('adds key-fault for ~180ms then clears it', () => {
    const { result } = renderHook(() => useFaultFlash());
    act(() => { result.current.flash(); });
    expect(result.current.faultClass).toBe('key-fault');
    act(() => { vi.advanceTimersByTime(180); });
    expect(result.current.faultClass).toBe('');
  });

  it('re-triggers the flash timer on a second call before it clears', () => {
    const { result } = renderHook(() => useFaultFlash());
    act(() => { result.current.flash(); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { result.current.flash(); }); // restart the 180ms window
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current.faultClass).toBe('key-fault'); // still active: only 100ms since restart
    act(() => { vi.advanceTimersByTime(80); });
    expect(result.current.faultClass).toBe('');
  });
});

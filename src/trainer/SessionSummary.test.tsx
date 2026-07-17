import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionSummary } from './SessionSummary';
import type { SessionResult, StreakState } from './types';

const result: SessionResult = { wpm: 42.4, accuracy: 0.965, wholeWordAccuracy: 0.9, durationMs: 60000, typedChars: 200, perKey: {} };

describe('SessionSummary', () => {
  it('shows rounded stats and fires onNext', () => {
    const onNext = vi.fn();
    render(<SessionSummary result={result} onNext={onNext} />);
    expect(screen.getByText(/42/)).toBeTruthy();
    expect(screen.getByText(/97%|96%/)).toBeTruthy(); // accuracy rounded
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onNext).toHaveBeenCalled();
  });

  it('omits streak and stars when not provided', () => {
    render(<SessionSummary result={result} onNext={() => {}} />);
    expect(screen.queryByText('Stars', { selector: '.stat-label' })).toBeNull();
    expect(screen.queryByText('Day streak', { selector: '.stat-label' })).toBeNull();
  });

  it('shows streak and stars when provided', () => {
    const streak: StreakState = { lastPracticedISO: '2026-07-17', current: 4, longest: 7, todayMinutes: 12 };
    render(<SessionSummary result={result} onNext={() => {}} streak={streak} stars={3} />);
    expect(screen.getByText('★★★')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Day streak', { selector: '.stat-label' })).toBeTruthy();
  });
});

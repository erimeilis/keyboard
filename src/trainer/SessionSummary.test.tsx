import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionSummary } from './SessionSummary';
import type { SessionResult } from './types';

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
});

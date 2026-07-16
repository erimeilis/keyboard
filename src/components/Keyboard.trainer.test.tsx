import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Keyboard } from './Keyboard';

// Mock Tauri API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_event, _callback) => {
    // Return cleanup function
    return Promise.resolve(() => {});
  }),
}));

describe('Keyboard trainer view', () => {
  it('applies the next-target class to the mapped key', () => {
    const { container } = render(<Keyboard trainerView={{ ka: { isNextTarget: true } }} />);
    // The A/ש key must carry the highlight
    const highlighted = container.querySelector('.key-next-target');
    expect(highlighted).not.toBeNull();
  });
});

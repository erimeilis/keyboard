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

describe('Keyboard Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Keyboard />);
    expect(container.querySelector('.keyboard')).toBeInTheDocument();
  });

  it('sets up the keyboard-state listener on mount', async () => {
    const { listen } = await import('@tauri-apps/api/event');
    render(<Keyboard />);

    expect(listen).toHaveBeenCalledWith('keyboard-state', expect.any(Function));
  });
});

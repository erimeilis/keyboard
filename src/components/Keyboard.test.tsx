import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Keyboard } from './Keyboard';

// Mock Tauri API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event, callback) => {
    // Return cleanup function
    return Promise.resolve(() => {});
  }),
}));

describe('Keyboard Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Keyboard />);
    expect(container.querySelector('.keyboard')).toBeInTheDocument();
  });

  it('sets up event listeners on mount', async () => {
    const { listen } = await import('@tauri-apps/api/event');
    render(<Keyboard />);

    expect(listen).toHaveBeenCalledWith('key-pressed', expect.any(Function));
    expect(listen).toHaveBeenCalledWith('key-released', expect.any(Function));
  });
});

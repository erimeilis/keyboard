import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// vi.mock factories are hoisted above top-level statements, so a plain `const invoke =
// vi.fn()` referenced inside the factory throws "Cannot access before initialization"
// on this vitest version. vi.hoisted() defines the mock in the same hoisted scope,
// letting the factory (and later assertions) reference the same fn instance.
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn(async () => {}) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

// Keyboard (rendered inside TrainerMode) sets up a `keyboard-state` listener via
// @tauri-apps/api/event — mock it so mounting TrainerMode doesn't leave an unhandled
// rejection dangling (see Keyboard.test.tsx for the same pattern).
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_event, _callback) => Promise.resolve(() => {})),
}));

import { TrainerMode } from './TrainerMode';

describe('TrainerMode', () => {
  it('enters trainer mode on mount and exits on unmount', () => {
    const onExit = vi.fn();
    const { unmount } = render(<TrainerMode onExit={onExit} />);
    expect(invoke).toHaveBeenCalledWith('set_trainer_mode', { active: true });
    unmount();
    expect(invoke).toHaveBeenCalledWith('set_trainer_mode', { active: false });
  });

  it('calls onExit when the Exit button is clicked', () => {
    const onExit = vi.fn();
    render(<TrainerMode onExit={onExit} />);
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    expect(onExit).toHaveBeenCalled();
  });
});
